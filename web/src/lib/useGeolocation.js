import { useEffect, useState } from 'react';

export default function useGeolocation({ watch = false } = {}) {
  const [coords, setCoords] = useState({ lat: null, lng: null });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported by your browser.');
      setLoading(false);
      return undefined;
    }

    const onSuccess = (pos) => {
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setLoading(false);
    };
    const onError = () => {
      setError('GPS location is required. Please enable location permissions.');
      setLoading(false);
    };
    const options = { enableHighAccuracy: true, timeout: 15000, maximumAge: watch ? 5000 : 30000 };

    if (watch) {
      const watchId = navigator.geolocation.watchPosition(onSuccess, onError, options);
      return () => navigator.geolocation.clearWatch(watchId);
    }

    navigator.geolocation.getCurrentPosition(
      onSuccess,
      onError,
      options,
    );

    return undefined;
  }, [watch]);

  return { coords, setCoords, error, setError, loading };
}
