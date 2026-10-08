import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';
import Button from './ui/Button';

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_CAPTURE_DIMENSION = 1600;

const validFile = (file) =>
  ['image/jpeg', 'image/png', 'image/webp'].includes(file?.type) && file.size <= MAX_BYTES;

/**
 * Collects proof images. Gallery uploads use the editable map location, while
 * live-camera captures lock the location supplied by the device at capture time.
 */
export default function EvidenceCapture({
  value = [],
  location = null,
  liveLocation = null,
  source = null,
  onChange,
  minImages = 2,
  label = 'Photo evidence',
}) {
  const galleryRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const previewUrlsRef = useRef(new Map());
  const [cameraOpen, setCameraOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [error, setError] = useState('');
  const [previewUrls, setPreviewUrls] = useState(() => new Map());

  const emit = (files, location, source) => onChange?.({ files, location, source });

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  };

  useEffect(() => () => stopCamera(), []);
  useEffect(
    () => () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraOpen]);

  const addPreviews = (files) => {
    const entries = files
      .filter((file) => !previewUrlsRef.current.has(file))
      .map((file) => [file, URL.createObjectURL(file)]);
    if (!entries.length) return;
    const next = new Map(previewUrlsRef.current);
    entries.forEach(([file, url]) => next.set(file, url));
    previewUrlsRef.current = next;
    setPreviewUrls(next);
  };

  const removePreview = (file) => {
    const url = previewUrlsRef.current.get(file);
    if (!url) return;
    URL.revokeObjectURL(url);
    const next = new Map(previewUrlsRef.current);
    next.delete(file);
    previewUrlsRef.current = next;
    setPreviewUrls(next);
  };

  const addGallery = (selected) => {
    const additions = Array.from(selected || []);
    if (!additions.length) return;
    if (source && source !== 'UPLOAD') {
      setError('Use either uploaded photos or live camera photos for one report, not both.');
      return;
    }
    if (value.length + additions.length > 3) {
      setError(`You can attach a maximum of 3 photos. You can add ${3 - value.length} more.`);
      return;
    }
    if (additions.some((file) => !validFile(file))) {
      setError('Use JPEG, PNG or WEBP images smaller than 2 MB.');
      return;
    }
    setError('');
    const files = [...value, ...additions].slice(0, 3);
    addPreviews(additions);
    emit(files, location, 'UPLOAD');
    if (galleryRef.current) galleryRef.current.value = '';
  };

  const openCamera = async () => {
    setCameraError('');
    if (source && source !== 'CAMERA') {
      setError('Use either uploaded photos or live camera photos for one report, not both.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch {
      setCameraError('Camera access was denied or is unavailable. You can upload photos instead.');
    }
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return setCameraError('Camera is still starting. Please try again.');
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, MAX_CAPTURE_DIMENSION / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) return setCameraError('Could not capture this camera frame. Please try again.');
    context.drawImage(video, 0, 0);

    const saveCapture = (captureLocation) => {
      canvas.toBlob((blob) => {
        setCapturing(false);
        if (!blob) return setCameraError('Could not create a photo from this camera frame. Please try again.');
        if (blob.size > MAX_BYTES) {
          return setCameraError('The captured photo is too large. Move closer to the issue and try again.');
        }
        const file = new File([blob], `civicfix-camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
        addPreviews([file]);
        emit([...value, file].slice(0, 3), location || captureLocation, 'CAMERA');
        if (value.length + 1 >= 3) stopCamera();
      }, 'image/jpeg', 0.82);
    };

    setCameraError('');
    setCapturing(true);
    if (liveLocation?.lat != null && liveLocation?.lng != null) {
      saveCapture(liveLocation);
      return;
    }
    if (!navigator.geolocation) {
      setCapturing(false);
      setCameraError('Live location is unavailable for this camera capture.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => saveCapture({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => {
        setCapturing(false);
        setCameraError('Live location permission is required for a camera capture.');
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  };

  const remove = (index) => {
    removePreview(value[index]);
    const files = value.filter((_, i) => i !== index);
    emit(files, files.length ? location : null, files.length ? source : null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{label}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">At least {minImages} distinct photos. Uploaded photos use the adjustable map pin; live-camera photos lock to your current location.</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${value.length >= minImages ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'}`}>{value.length}/{minImages} minimum</span>
      </div>

      {value.length > 0 && <div className="grid grid-cols-3 gap-2">{value.map((file, index) => <div key={`${file.name}-${file.lastModified}-${index}`} className="relative aspect-square overflow-hidden rounded-2xl bg-gray-100 dark:bg-slate-800">{previewUrls.get(file) && <img src={previewUrls.get(file)} alt={`Proof ${index + 1}`} className="h-full w-full object-cover" />}<button type="button" onClick={() => remove(index)} className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1.5 text-white"><X className="h-3.5 w-3.5" /></button></div>)}</div>}

      {cameraOpen ? <div className="space-y-3 rounded-2xl bg-black p-3"><video ref={videoRef} autoPlay playsInline className="max-h-72 w-full rounded-xl object-cover" /><div className="flex gap-2"><Button type="button" full onClick={capture} icon={Camera} loading={capturing} disabled={capturing}>{capturing ? 'Saving photo…' : 'Capture photo'}</Button><Button type="button" variant="secondary" onClick={stopCamera} disabled={capturing}>Cancel</Button></div></div> : <div className="grid gap-2 sm:grid-cols-2"><Button type="button" variant="secondary" icon={Camera} onClick={openCamera} disabled={value.length >= 3}>Use live camera</Button><Button type="button" variant="outline" icon={ImagePlus} onClick={() => galleryRef.current?.click()} disabled={value.length >= 3}>Choose photos</Button></div>}
      <input ref={galleryRef} hidden type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => addGallery(e.target.files)} />
      {(error || cameraError) && <p className="text-xs font-medium text-red-600 dark:text-red-400">{error || cameraError}</p>}
    </div>
  );
}
