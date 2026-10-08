import { useEffect, useState } from 'react';
import { ShieldCheck, User } from 'lucide-react';
import { apiClient } from '../lib/axios';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { Input } from '../components/ui/Field';
import { RoleBadge } from '../components/ui/Badge';
import { LoadingState } from '../components/ui/Feedback';

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiClient
      .get('/auth/me')
      .then((res) => {
        setProfile(res.data);
        setName(res.data.name || '');
        setAddress(res.data.address || '');
        setPhone(res.data.phone_number || '');
      })
      .catch(() => setError('Failed to load your profile.'))
      .finally(() => setLoading(false));
  }, []);

  const requestEdit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await apiClient.post('/auth/me/admin/request-edit', {
        email,
        name,
        address,
        phoneNumber: phone,
      });
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to request authorization.');
    } finally {
      setBusy(false);
    }
  };

  const confirmEdit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await apiClient.put('/auth/me/admin', {
        email,
        otp,
        name,
        address,
        phoneNumber: phone,
      });
      setMsg('Profile updated securely.');
      setStep(1);
      setOtp('');
    } catch (err) {
      setError(err.response?.data?.error || 'Update failed.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState label="Loading settings…" />;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          Authority settings
        </h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          {profile?.region_name ? `Governing ${profile.region_name}` : 'Profile'}
          <RoleBadge role={profile?.role} />
        </p>
      </div>

      {msg && (
        <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          {msg}
        </div>
      )}
      {error && (
        <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      <Card className="p-6">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
          <User className="h-4 w-4 text-blue-500" /> Profile
        </h2>
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          Authority profile edits require authorization from the Super Admin.
        </p>

        {step === 1 ? (
          <form onSubmit={requestEdit} className="space-y-4">
            <Input
              id="aemail"
              label="Account email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="official@city.gov"
            />
            <Input id="aname" label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input id="aaddress" label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
            <Input
              id="aphone"
              label="Phone number"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
            />
            <Button type="submit" loading={busy}>
              Request authorization
            </Button>
          </form>
        ) : (
          <form onSubmit={confirmEdit} className="space-y-4">
            <div className="flex items-start gap-3 rounded-2xl bg-blue-50 p-4 text-sm text-blue-800 ring-1 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
              <p>Enter the authorization code the Super Admin shared with you to apply the changes.</p>
            </div>
            <Input
              id="aotp"
              label="Authorization code"
              required
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="123456"
              className="text-center font-mono text-2xl tracking-widest"
            />
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button type="submit" loading={busy} full>
                Apply changes
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
