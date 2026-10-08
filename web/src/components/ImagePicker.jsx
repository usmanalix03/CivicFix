import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, ImagePlus, X } from 'lucide-react';

const MAX_MB = 8;

export default function ImagePicker({ image, onImage, compact = false }) {
  const inputRef = useRef(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);

  const handleFiles = (files) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Only image files (JPEG, PNG, WEBP) are allowed.');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Image must be under ${MAX_MB} MB.`);
      return;
    }
    setError('');
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    onImage(file);
  };

  const clear = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
    onImage(null);
  };

  if (preview) {
    return (
      <div className="relative overflow-hidden rounded-[24px] ring-1 ring-gray-200 dark:ring-slate-700">
        <img src={preview} alt="Selected" className="max-h-80 w-full object-cover" />
        <button
          type="button"
          onClick={clear}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition-colors hover:bg-black/80"
          aria-label="Remove image"
        >
          <X className="h-4 w-4" />
        </button>
        {image?.name && (
          <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur">
            {image.name}
          </span>
        )}
      </div>
    );
  }

  return (
    <div>
      <motion.button
        type="button"
        whileTap={{ scale: 0.98 }}
        onClick={() => inputRef.current?.click()}
        className={`flex w-full flex-col items-center justify-center gap-3 rounded-[24px] border-2 border-dashed border-gray-300 bg-gray-50 text-gray-500 transition-colors hover:border-blue-400 hover:bg-blue-50/40 dark:border-slate-700 dark:bg-slate-800/40 dark:text-gray-400 dark:hover:border-blue-500 dark:hover:bg-blue-500/5 ${
          compact ? 'py-8' : 'py-14'
        }`}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm ring-1 ring-gray-100 dark:bg-slate-900 dark:text-blue-400 dark:ring-slate-700">
          {compact ? <ImagePlus className="h-6 w-6" /> : <Camera className="h-6 w-6" />}
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            Tap to add a photo
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            JPEG, PNG or WEBP · up to {MAX_MB} MB
          </p>
        </div>
      </motion.button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {error && <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
