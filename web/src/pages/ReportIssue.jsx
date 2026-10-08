import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LocateFixed, Sparkles, Send } from 'lucide-react';
import { apiClient } from '../lib/axios';
import MapView from '../components/MapView';
import EvidenceCapture from '../components/EvidenceCapture';
import Turnstile from '../components/Turnstile';
import Button from '../components/ui/Button';
import { Input, Select, Textarea } from '../components/ui/Field';
import { CATEGORIES } from '../lib/constants';
import useGeolocation from '../lib/useGeolocation';

const categoryOptions = [
  { value: '', label: 'Select a category…', disabled: true },
  ...CATEGORIES.map((c) => ({ value: c.value, label: `${c.emoji} ${c.value}` })),
];

export default function ReportIssue() {
  const navigate = useNavigate();
  const { coords: liveCoords, error: geoError, loading: geoLoading } = useGeolocation();

  const [evidence, setEvidence] = useState({ files: [], location: null, source: null });
  const [turnstileToken, setTurnstileToken] = useState('');
  const [needsManual, setNeedsManual] = useState(false);
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // A live-camera capture supplies a locked location. Uploaded photos begin
  // at the browser's location and let the reporter fine-tune the map pin.
  const hasEvidenceLocation = evidence.location?.lat != null && evidence.location?.lng != null;
  const coords = evidence.location || liveCoords;
  const waitingForLocation = geoLoading && !hasEvidenceLocation;

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (evidence.files.length < 2) return setError('At least two distinct photos of the issue are required.');
    if (coords.lat === null || coords.lng === null)
      return setError('Waiting for your GPS location. Please enable location access.');
    if (!evidence.source) return setError('Add uploaded photos or use the live camera for your evidence.');
    if (!turnstileToken) return setError('Bot verification is not ready yet. Please wait a moment.');

    setLoading(true);
    try {
      const fd = new FormData();
      evidence.files.forEach((file) => fd.append('images', file));
      fd.append('lat', String(coords.lat));
      fd.append('lng', String(coords.lng));
      fd.append('turnstileToken', turnstileToken);
      fd.append('website', ''); // honeypot — must stay empty
      fd.append('locationSource', evidence.source);

      if (needsManual) {
        fd.append('category', category);
        fd.append('title', title);
        if (description) fd.append('description', description);
      }

      const res = await apiClient.post('/reports', fd);
      navigate(`/issue/${res.data.nodeId}`, { replace: true });
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'AI_UNAVAILABLE') {
        setNeedsManual(true);
        setError(
          'Our AI inspector is temporarily unavailable. Please choose a category and title manually, then submit again.',
        );
      } else {
        setError(err.response?.data?.error || 'Failed to submit your report.');
      }
    } finally {
      setLoading(false);
    }
  };

  const marker = coords.lat != null ? [{ id: 'me', lat: coords.lat, lng: coords.lng, color: '#2563eb', size: 20 }] : [];
  const canTuneLocation = evidence.source === 'UPLOAD';
  const fineTuneLocation = ({ lat, lng }) => {
    if (!canTuneLocation) return;
    setEvidence((current) => ({ ...current, location: { lat, lng } }));
  };

  return (
    <div className="mx-auto max-w-5xl">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          Report an issue
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Snap a photo, confirm the location, and our AI does the rest.
        </p>
      </motion.div>

      {error && (
        <div className="mb-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={submit} className="grid gap-4 lg:grid-cols-2">
        {/* Photo */}
        <div className="space-y-4 rounded-[28px] bg-white p-5 shadow-[0_2px_20px_rgb(0,0,0,0.04)] ring-1 ring-gray-100 dark:bg-slate-800/80 dark:ring-white/5">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
              <Sparkles className="h-4 w-4 text-blue-500" /> Photo evidence
            </h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              The AI verifies it’s a real, authentic photo of civic infrastructure.
            </p>
          </div>
          <EvidenceCapture
            value={evidence.files}
            location={evidence.location}
            liveLocation={liveCoords}
            source={evidence.source}
            onChange={(next) => setEvidence((current) => ({
              files: next.files,
              location: next.location === undefined ? current.location : next.location,
              source: next.source === undefined ? current.source : next.source,
            }))}
          />

          {needsManual && (
            <div className="space-y-4 rounded-2xl bg-amber-50/60 p-4 ring-1 ring-amber-100 dark:bg-amber-500/5 dark:ring-amber-500/20">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                Manual details (AI unavailable)
              </p>
              <Select
                id="category"
                label="Category"
                options={categoryOptions}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
              <Input
                id="title"
                label="Title"
                value={title}
                maxLength={100}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Large pothole near the bus stop"
              />
              <Textarea
                id="description"
                label="Description (optional)"
                value={description}
                maxLength={1000}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add any helpful detail…"
              />
            </div>
          )}
        </div>

        {/* Location */}
        <div className="space-y-4 rounded-[28px] bg-white p-5 shadow-[0_2px_20px_rgb(0,0,0,0.04)] ring-1 ring-gray-100 dark:bg-slate-800/80 dark:ring-white/5">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
              <LocateFixed className="h-4 w-4 text-blue-500" /> Location
            </h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {waitingForLocation
                ? 'Fetching your GPS location…'
                : coords.lat != null
                  ? evidence.source === 'CAMERA'
                    ? 'Location locked from the live camera capture.'
                    : evidence.source === 'UPLOAD'
                      ? 'Location starts at your live GPS. Tap the map to fine-tune the pin.'
                      : 'Location fetched from live GPS.'
                  : geoError}
            </p>
          </div>

          {waitingForLocation ? (
            <div className="flex h-64 items-center justify-center rounded-[20px] bg-gray-100 text-sm text-gray-500 dark:bg-slate-900/40 dark:text-gray-400">
              <div className="animate-pulse">Locating you…</div>
            </div>
          ) : coords.lat != null ? (
            <MapView
              markers={marker}
              center={[coords.lat, coords.lng]}
              zoom={16}
              followCenter
              onMapClick={canTuneLocation ? fineTuneLocation : undefined}
              className="h-64 w-full overflow-hidden rounded-[20px] ring-1 ring-gray-100 dark:ring-white/10"
              scrollWheelZoom={false}
            />
          ) : (
            <div className="flex h-64 items-center justify-center rounded-[20px] bg-amber-50 text-center text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              Location unavailable. Enable GPS to continue.
            </div>
          )}

          {coords.lat != null && (
            <p className="font-mono text-xs text-gray-500 dark:text-gray-400">
              {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
            </p>
          )}
          {canTuneLocation && (
            <p className="text-xs text-blue-600 dark:text-blue-400">Tap the map to move the report pin.</p>
          )}

          <Turnstile onToken={setTurnstileToken} />

          <Button
            type="submit"
            loading={loading}
            full
            size="lg"
            icon={Send}
            disabled={waitingForLocation || coords.lat === null || evidence.files.length < 2}
          >
            {loading ? 'Submitting…' : 'Submit report'}
          </Button>
        </div>
      </form>
    </div>
  );
}
