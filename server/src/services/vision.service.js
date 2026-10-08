import axios from 'axios';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { HttpError } from '../utils/validators.js';
import { cleanText, cleanTitle } from '../utils/sanitize.js';

const REPORT_EVIDENCE_PROMPT = `You are the automated municipal inspection engine for CivicFix, a civic reporting platform. You will receive a set of 2 or 3 labelled photographs submitted as evidence for one report.

Inspect EVERY submitted photo independently, then assess the set together. Never accept a set based on just its first photo.

REJECT the ENTIRE set (isValid: false) if ANY photo is ANY of the following:
- A screenshot or photograph of a screen (moiré patterns, visible pixels, monitor bezels, lens reflections).
- A stock photo, watermarked image (e.g. gettyimages, shutterstock, copyright text), or an AI-generated image.
- Unrelated to public civic infrastructure (selfies, pets, food, indoor rooms, private property interiors, documents).
- A wallpaper, decorative image, or another unrelated scene.
- Evidence of a different civic issue or location from the other submitted photos.
If rejected, identify which photo or mismatch caused the rejection and return ONLY this JSON: {"isValid": false, "reason": "<specific reason>"}

ACCEPT (isValid: true) only if ALL photos are authentic, real-world photographs of the same public civic infrastructure issue or its immediately related surroundings (pothole, broken streetlight, illegal dumping, downed power line, water logging, graffiti, damaged road, blocked drain, etc.). Then return ONLY this JSON:
{"isValid": true, "category": "<one of: Pothole, Road Damage, Water Logging, Drainage, Streetlight, Electrical Hazard, Sanitation, Illegal Dumping, Vandalism, Traffic Signal, Public Property Damage, Other>", "title": "<professional title, max 50 chars>", "description": "<detailed assessment: visible damage, hazards, surroundings, max 300 chars>", "dynamicMessage": "<one encouraging sentence addressed to the reporting citizen, max 120 chars>"}

Return STRICTLY valid JSON with no markdown fences and no commentary.`;

/** Extracts a JSON object from a possibly noisy model response. */
const extractJson = (text) => {
  let cleaned = String(text || '').trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) cleaned = fence[1].trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end > start) cleaned = cleaned.slice(start, end + 1);
  return JSON.parse(cleaned);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Fallback models tried in order when the primary is overloaded/unavailable. */
const modelFallbackChain = ['gemini-3-flash-preview', 'gemini-flash-lite-latest', 'gemini-flash-latest'];

const appealEvidencePrompt = `You are reviewing an appeal for a civic issue. You will receive original report photos followed by newly submitted appeal photos.

Accept only when ALL new photos are authentic new photographs of the same or clearly related civic issue/location shown in the original evidence. Reject if any new photo is a duplicate or re-upload of an original, unrelated, a screenshot, stock/AI-generated, or not a civic issue.

Return ONLY JSON: {"isValid":true,"reason":"brief explanation"} or {"isValid":false,"reason":"specific rejection reason"}.`;

const generateWithModel = async (model, payload) => {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
    `?key=${encodeURIComponent(env.geminiApiKey)}`;

  const { data } = await axios.post(url, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 45_000,
  });

  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  if (!text) throw new Error('Empty model response');
  return text;
};

const isRetryable = (err) =>
  Boolean(err.response) && [429, 500, 502, 503, 504].includes(err.response.status);

/**
 * Server-side VLM analysis of a complete 2–3 photo report-evidence set
 * (anti-spoof + consistency + categorization + titling).
 * Uses Google Gemini via REST with one retry and a model fallback chain.
 * Throws AI_UNAVAILABLE when no model can be reached, so uninspected evidence
 * is never accepted as a report.
 */
export async function analyzeReportEvidence(files) {
  if (!Array.isArray(files) || files.length < 2 || files.length > 3) {
    throw new HttpError(400, 'Submit two or three proof photos for AI inspection.');
  }

  const payload = {
    contents: [
      {
        parts: [
          { text: REPORT_EVIDENCE_PROMPT },
          ...files.flatMap((file, index) => [
            { text: `Report evidence photo ${index + 1} of ${files.length}:` },
            { inline_data: { mime_type: file.mimetype, data: file.buffer.toString('base64') } },
          ]),
        ],
      },
    ],
  };

  const chain = env.geminiModel
    ? [env.geminiModel, ...modelFallbackChain.filter((m) => m !== env.geminiModel)]
    : modelFallbackChain;

  for (const model of chain) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const text = await generateWithModel(model, payload);
        const parsed = extractJson(text);
        if (typeof parsed.isValid !== 'boolean') throw new Error('Malformed model output');

        return {
          isValid: Boolean(parsed.isValid),
          reason: parsed.reason ? cleanText(parsed.reason, 300) : null,
          category: parsed.category ? cleanText(parsed.category, 50) : null,
          title: parsed.title ? cleanTitle(parsed.title) : null,
          description: parsed.description ? cleanText(parsed.description, 1000) : null,
          dynamicMessage: parsed.dynamicMessage ? cleanText(parsed.dynamicMessage, 300) : null,
        };
      } catch (err) {
        logger.warn(`Vision attempt failed (${model}, try ${attempt + 1}/2): ${err.message}`);
        if (isRetryable(err) || err.message === 'Empty model response' || err instanceof SyntaxError) {
          await sleep(1200 * (attempt + 1));
          continue;
        }
        break; // Non-transient (e.g. auth, malformed) — try the next model.
      }
    }
  }

  logger.error('Vision analysis failed after all attempts.');
  throw new HttpError(503, 'AI analysis is temporarily unavailable.', 'AI_UNAVAILABLE');
}

const downloadOriginalEvidence = async (url) => {
  const source = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 15_000,
    maxContentLength: 10 * 1024 * 1024,
  });

  // Cloudinary can serve a compact derivative for vision comparison while the
  // unmodified source bytes remain available for exact-duplicate detection.
  const visionUrl = String(url).includes('res.cloudinary.com/')
    ? String(url).replace('/upload/', '/upload/f_jpg,q_auto,w_1024,c_limit/')
    : url;
  const vision = visionUrl === url
    ? source
    : await axios.get(visionUrl, {
      responseType: 'arraybuffer',
      timeout: 15_000,
      maxContentLength: 10 * 1024 * 1024,
    });

  return {
    sourceHash: crypto.createHash('sha256').update(Buffer.from(source.data)).digest('hex'),
    buffer: Buffer.from(vision.data),
    mimeType: String(vision.headers['content-type'] || 'image/jpeg').split(';')[0],
  };
};

/**
 * Ensures appeal photos are new evidence for the original issue. Byte-identical
 * re-uploads are rejected before the vision model assesses the scene relation.
 */
export async function verifyAppealEvidence(originalUrls, freshFiles) {
  if (!originalUrls?.length) {
    throw new HttpError(409, 'The original evidence is unavailable for comparison. Please contact support.');
  }
  if (!Array.isArray(freshFiles) || freshFiles.length < 2 || freshFiles.length > 3) {
    throw new HttpError(400, 'Submit two or three new proof photos for an appeal.');
  }

  let originals;
  try {
    originals = await Promise.all(originalUrls.slice(0, 3).map(downloadOriginalEvidence));
  } catch (err) {
    logger.error(`Could not retrieve original appeal evidence: ${err.message}`);
    throw new HttpError(503, 'Evidence comparison is temporarily unavailable. Please try again.', 'AI_UNAVAILABLE');
  }

  const originalHashes = new Set(originals.map(({ sourceHash }) => sourceHash));
  if (
    freshFiles.some((file) =>
      originalHashes.has(crypto.createHash('sha256').update(file.buffer).digest('hex')),
    )
  ) {
    throw new HttpError(422, 'Appeal photos must be newly captured evidence, not copies of the original report photos.');
  }

  const parts = [
    { text: appealEvidencePrompt },
    ...originals.flatMap(({ buffer, mimeType }, index) => [
      { text: `Original report photo ${index + 1}:` },
      { inline_data: { mime_type: mimeType, data: buffer.toString('base64') } },
    ]),
    ...freshFiles.flatMap((file, index) => [
      { text: `New appeal photo ${index + 1}:` },
      { inline_data: { mime_type: file.mimetype, data: file.buffer.toString('base64') } },
    ]),
  ];
  const payload = { contents: [{ parts }] };
  const chain = env.geminiModel
    ? [env.geminiModel, ...modelFallbackChain.filter((model) => model !== env.geminiModel)]
    : modelFallbackChain;

  for (const model of chain) {
    try {
      const parsed = extractJson(await generateWithModel(model, payload));
      if (typeof parsed.isValid !== 'boolean') throw new Error('Malformed model output');
      return { isValid: parsed.isValid, reason: cleanText(parsed.reason, 300) };
    } catch (err) {
      logger.warn(`Appeal evidence review failed (${model}): ${err.message}`);
    }
  }

  throw new HttpError(503, 'Evidence comparison is temporarily unavailable. Please try again.', 'AI_UNAVAILABLE');
}
