import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  MapPinOff,
  Flame,
  Heart,
  Flag,
  TrendingUp,
  MessageCircle,
} from 'lucide-react';
import { apiClient } from '../lib/axios';
import { CategoryBadge, StatusBadge } from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import { LoadingState, ErrorState } from '../components/ui/Feedback';
import { formatCount, formatDateTime } from '../lib/format';

const ACTION_LABELS = {
  INITIAL_REPORT: 'Reported the issue',
  CONFIRM_FIXED: 'Confirmed the fix',
  FLAG_SPAM: 'Flagged as spam',
  STILL_EXISTS: 'Re-verified it still exists',
};

export default function AdminIssueReview() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // 'confirm_fix' | 'not_found'

  const reload = useCallback(async () => {
    try {
      const res = await apiClient.get(`/admin/issues/${id}`);
      setData(res.data);
      setError(null);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load issue.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    reload();
  }, [reload]);

  const image = data?.history?.find((h) => h.image_url)?.image_url;
  const canTakeAuthorityAction = data?.status === 'ACTIVE';

  const runAction = async () => {
    setBusy(true);
    try {
      let response;
      if (confirm === 'not_found') {
        response = await apiClient.post(`/admin/issues/${id}/not-found`);
      } else if (confirm === 'confirm_fix') {
        const fd = new FormData();
        fd.append('action', 'CONFIRM_FIXED');
        response = await apiClient.post(`/reports/${id}/action`, fd);
      }
      setData((current) => (current && response?.data?.status ? { ...current, status: response.data.status } : current));
      setConfirm(null);
      reload();
    } catch (e) {
      setError(e.response?.data?.error || 'Action failed.');
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState label="Loading issue…" />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="mx-auto max-w-5xl">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Back to queue
      </button>

      {error && (
        <div className="mb-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="overflow-hidden">
            {image && <img src={image} alt={data?.title} className="max-h-[420px] w-full object-cover" />}
            <div className="p-5 sm:p-6">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <CategoryBadge category={data?.category} />
                <StatusBadge status={data?.status} />
              </div>
              <h1 className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-2xl">
                {data?.title}
              </h1>
              {data?.description && (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                  {data.description}
                </p>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                <Mini icon={Flame} label="Density" value={data?.density_score} tone="text-orange-500" />
                <Mini icon={Heart} label="Likes" value={data?.likes_count} tone="text-rose-500" />
                <Mini icon={Flag} label="Flags" value={data?.flag_count} tone="text-amber-500" />
                <Mini icon={TrendingUp} label="Escalations" value={data?.escalation_count} tone="text-purple-500" />
              </div>
            </div>
          </Card>

          {/* Comments */}
          <Card className="p-5 sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
              <MessageCircle className="h-4 w-4 text-blue-500" /> Citizen discussion
            </h2>
            {!data?.comments?.length ? (
              <p className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">No comments yet.</p>
            ) : (
              <div className="space-y-3">
                {data.comments.map((c) => (
                  <div key={c.id} className="rounded-2xl bg-gray-50 p-3 dark:bg-slate-800/60">
                    <p className="text-sm text-gray-700 dark:text-gray-200">{c.content}</p>
                    <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">{formatDateTime(c.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* History */}
          <Card className="p-5 sm:p-6">
            <h2 className="mb-4 text-sm font-bold text-gray-900 dark:text-white">Evidence timeline</h2>
            <div className="space-y-4">
              {data?.history?.map((h, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {ACTION_LABELS[h.action_type] || h.action_type}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{formatDateTime(h.created_at)}</p>
                    {h.image_url && (
                      <img
                        src={h.image_url}
                        alt=""
                        loading="lazy"
                        className="mt-2 h-24 w-24 rounded-xl object-cover ring-1 ring-gray-200 dark:ring-slate-700"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Authority actions */}
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-bold text-gray-900 dark:text-white">Authority actions</h2>
            {canTakeAuthorityAction ? (
              <div className="space-y-2">
                <Button
                  full
                  variant="success"
                  icon={CheckCircle2}
                  loading={busy}
                  onClick={() => setConfirm('confirm_fix')}
                >
                  Confirm it's fixed
                </Button>
                <Button
                  full
                  variant="outline"
                  icon={MapPinOff}
                  loading={busy}
                  onClick={() => setConfirm('not_found')}
                >
                  Mark as not found
                </Button>
                <p className="pt-1 text-xs text-gray-400 dark:text-gray-500">
                  Confirming prompts citizens to verify. “Not found” opens a 48h reverse-consensus
                  window.
                </p>
              </div>
            ) : (
              <p className="rounded-2xl bg-gray-50 p-4 text-xs text-gray-500 dark:bg-slate-800/60 dark:text-gray-400">
                This issue is {data?.status?.toLowerCase()} — no further authority action available.
              </p>
            )}
          </Card>
        </div>
      </div>

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Confirm action">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {confirm === 'not_found'
              ? 'Mark this issue as “not found” and start a 48-hour reverse-consensus window? The original reporter can appeal with a fresh photo.'
              : 'Confirm that this issue has been fixed on the ground? Citizens will be notified to verify, and only their majority can close it.'}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" full onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant={confirm === 'not_found' ? 'danger' : 'success'}
              full
              loading={busy}
              onClick={runAction}
            >
              Confirm
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Mini({ icon: Icon, label, value, tone }) {
  return (
    <div className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 dark:bg-slate-800">
      <Icon className={`h-4 w-4 ${tone}`} />
      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCount(value)}</span>
    </div>
  );
}
