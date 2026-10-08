import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { apiClient } from '../lib/axios';
import { useAuth } from '../context/AuthContext';
import AuthShell from '../components/AuthShell';
import Button from '../components/ui/Button';
import { Input } from '../components/ui/Field';
import useGeolocation from '../lib/useGeolocation';

export default function AdminSignup() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { coords, error: geoError } = useGeolocation();

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp1, setOtp1] = useState('');
  const [otp2, setOtp2] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const requestOtp = async (e) => {
    e.preventDefault();
    if (coords.lat === null) {
      setError('Waiting for GPS coordinates. Please allow location access.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await apiClient.post('/auth/admin/request-otp', { email });
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send authorization codes.');
    } finally {
      setLoading(false);
    }
  };

  const signup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/admin/signup', {
        email,
        otp1,
        otp2,
        password,
        lat: coords.lat,
        lng: coords.lng,
      });
      login(res.data.user, res.data.token);
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Authority registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Become an Authority"
      subtitle={
        step === 1
          ? 'Dual-authorization registration for civic officials'
          : 'Enter both codes to complete registration'
      }
      footer={
        <>
          Just a citizen?{' '}
          <Link to="/signup" className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
            Create a citizen account
          </Link>
        </>
      }
    >
      {step === 1 && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl bg-blue-50 p-4 text-sm text-blue-800 ring-1 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            Authority accounts need two codes: one sent to your email, and a second authorization
            code sent to the Super Admin — who shares it with you only if they approve.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}
      {geoError && step === 1 && (
        <div className="mb-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          {geoError}
        </div>
      )}

      {step === 1 ? (
        <form onSubmit={requestOtp} className="space-y-4">
          <Input
            id="email"
            label="Official email address"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="official@city.gov"
          />
          <Input
            id="password"
            label="Password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
          <Button type="submit" loading={loading} disabled={coords.lat === null} full size="lg">
            Request authorization codes
          </Button>
        </form>
      ) : (
        <form onSubmit={signup} className="space-y-4">
          <Input
            id="otp1"
            label="Code 1 · sent to your email"
            required
            maxLength={6}
            value={otp1}
            onChange={(e) => setOtp1(e.target.value)}
            placeholder="123456"
            className="text-center font-mono text-2xl tracking-widest"
          />
          <Input
            id="otp2"
            label="Code 2 · from the Super Admin"
            required
            maxLength={6}
            value={otp2}
            onChange={(e) => setOtp2(e.target.value)}
            placeholder="123456"
            className="text-center font-mono text-2xl tracking-widest"
          />
          <Button type="submit" loading={loading} full size="lg">
            Complete registration
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
