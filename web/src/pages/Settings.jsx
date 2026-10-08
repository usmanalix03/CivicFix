import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, KeyRound, Trash2 } from 'lucide-react';
import { apiClient } from '../lib/axios';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { Input } from '../components/ui/Field';
import { RoleBadge } from '../components/ui/Badge';
import { LoadingState } from '../components/ui/Feedback';
import { formatDate } from '../lib/format';

export default function Settings() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');

  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');

  const [delStep, setDelStep] = useState(1);
  const [delEmail, setDelEmail] = useState('');
  const [delOtp, setDelOtp] = useState('');

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

  const banner = (m, isError) => (
    <div
      className={`mb-4 rounded-2xl p-4 text-sm ${
        isError
          ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
      }`}
    >
      {m}
    </div>
  );

  const saveProfile = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await apiClient.put('/auth/me/citizen', {
        name: name || undefined,
        address: address || undefined,
        phoneNumber: phone || undefined,
      });
      setMsg('Profile updated.');
    } catch (err) {
      setError(err.response?.data?.error || 'Update failed.');
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await apiClient.put('/auth/me/change-password', {
        currentPassword: curPw,
        newPassword: newPw,
      });
      setMsg('Password changed.');
      setCurPw('');
      setNewPw('');
    } catch (err) {
      setError(err.response?.data?.error || 'Password change failed.');
    } finally {
      setBusy(false);
    }
  };

  const requestDelete = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiClient.post('/auth/me/request-delete', { email: delEmail });
      setDelStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send deletion code.');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiClient.delete('/auth/me', { data: { email: delEmail, otp1: delOtp } });
      logout();
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Deletion failed.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState label="Loading settings…" />;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          Settings
        </h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          {profile?.region_name ? `Bound to ${profile.region_name}` : 'Account details'}
          <RoleBadge role={profile?.role} />
        </p>
      </div>

      {msg && banner(msg, false)}
      {error && banner(error, true)}

      {/* Profile */}
      <Card className="p-6">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
          <User className="h-4 w-4 text-blue-500" /> Profile
        </h2>
        <form onSubmit={saveProfile} className="space-y-4">
          <Input id="name" label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input id="address" label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
          <Input
            id="phone"
            label="Phone number"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
          />
          <Button type="submit" loading={busy}>
            Save profile
          </Button>
        </form>
        {profile?.created_at && (
          <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
            Member since {formatDate(profile.created_at)}
          </p>
        )}
      </Card>

      {/* Password */}
      <Card className="p-6">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
          <KeyRound className="h-4 w-4 text-blue-500" /> Change password
        </h2>
        <form onSubmit={changePassword} className="space-y-4">
          <Input
            id="curPw"
            label="Current password"
            type="password"
            required
            value={curPw}
            onChange={(e) => setCurPw(e.target.value)}
          />
          <Input
            id="newPw"
            label="New password"
            type="password"
            required
            minLength={8}
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder="At least 8 characters"
          />
          <Button type="submit" loading={busy}>
            Update password
          </Button>
        </form>
      </Card>

      {/* Danger zone */}
      <Card className="p-6 ring-red-100 dark:ring-red-500/20">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-red-600 dark:text-red-400">
          <Trash2 className="h-4 w-4" /> Delete account
        </h2>
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          This permanently deletes your account and its records. You’ll need an email verification
          code.
        </p>

        {delStep === 1 ? (
          <form onSubmit={requestDelete} className="space-y-4">
            <Input
              id="delEmail"
              label="Confirm your email"
              type="email"
              required
              value={delEmail}
              onChange={(e) => setDelEmail(e.target.value)}
            />
            <Button type="submit" variant="danger" loading={busy}>
              Send deletion code
            </Button>
          </form>
        ) : (
          <form onSubmit={confirmDelete} className="space-y-4">
            <Input
              id="delOtp"
              label="Verification code"
              required
              maxLength={6}
              value={delOtp}
              onChange={(e) => setDelOtp(e.target.value)}
              placeholder="123456"
              className="text-center font-mono text-2xl tracking-widest"
            />
            <Button type="submit" variant="danger" loading={busy}>
              Permanently delete account
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
