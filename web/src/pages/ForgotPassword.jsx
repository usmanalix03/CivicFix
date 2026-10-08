import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/axios';
import AuthShell from '../components/AuthShell';
import Button from '../components/ui/Button';
import { Input } from '../components/ui/Field';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const requestOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiClient.post('/auth/forgot-password/request-otp', { email });
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send reset code.');
    } finally {
      setLoading(false);
    }
  };

  const confirm = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiClient.post('/auth/forgot-password/confirm', { email, otp, newPassword });
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Reset password"
      subtitle={step === 1 ? 'We’ll email you a reset code' : `Code sent to ${email}`}
      footer={
        <>
          Remembered it?{' '}
          <Link to="/login" className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
            Sign in
          </Link>
        </>
      }
    >
      {error && (
        <div className="mb-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      {step === 1 ? (
        <form onSubmit={requestOtp} className="space-y-5">
          <Input
            id="email"
            label="Email address"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
          />
          <Button type="submit" loading={loading} full size="lg">
            Send reset code
          </Button>
        </form>
      ) : (
        <form onSubmit={confirm} className="space-y-5">
          <Input
            id="otp"
            label="Verification code"
            required
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="123456"
            className="text-center text-2xl font-mono tracking-widest"
          />
          <Input
            id="newPassword"
            label="New password"
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
          <Button type="submit" loading={loading} full size="lg">
            Reset password
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
