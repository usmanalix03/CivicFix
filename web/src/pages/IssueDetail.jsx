import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Heart,
  Flame,
  Flag,
  TrendingUp,
  MessageCircle,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Pencil,
  Trash2,
  Send,
} from 'lucide-react';
import { apiClient } from '../lib/axios';
import { CategoryBadge, StatusBadge } from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import ImagePicker from '../components/ImagePicker';
import EvidenceCapture from '../components/EvidenceCapture';
import MapView from '../components/MapView';
import { Textarea } from '../components/ui/Field';
import { LoadingState, ErrorState } from '../components/ui/Feedback';
import { formatCount, formatDateTime, timeAgo } from '../lib/format';
import useGeolocation from '../lib/useGeolocation';

const ACTION_LABELS = {
  INITIAL_REPORT: 'Reported the issue',
  CONFIRM_FIXED: 'Confirmed the fix',
  FLAG_SPAM: 'Flagged as spam',
  STILL_EXISTS: 'Re-verified it still exists',
};

const ACTION_ICONS = {
  INITIAL_REPORT: Flame,
  CONFIRM_FIXED: CheckCircle2,
  FLAG_SPAM: Flag,
  STILL_EXISTS: RotateCcw,
};

export default function IssueDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { coords: liveCoords } = useGeolocation({ watch: true });

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState('');

  const [actionModal, setActionModal] = useState(null);
  const [actionFile, setActionFile] = useState(null);
  const [appealOpen, setAppealOpen] = useState(false);
  const [appealEvidence, setAppealEvidence] = useState({ files: [], location: null, source: null });
  const [editOpen, setEditOpen] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const appealCoords = appealEvidence.location || liveCoords;
  const canTuneAppealLocation = appealEvidence.source === 'UPLOAD';

  const reload = useCallback(async () => {
    try {
      const params = liveCoords.lat != null ? { lat: liveCoords.lat, lng: liveCoords.lng } : undefined;
      const res = await apiClient.get(`/reports/${id}`, { params });
      setData(res.data);
      setError(null);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load issue.');
    } finally {
      setLoading(false);
    }
  }, [id, liveCoords.lat, liveCoords.lng]);

  useEffect(() => {
    reload();
  }, [reload]);

  const toggleLike = async () => {
    setBusy(true);
    try {
      const res = await apiClient.post(`/reports/${id}/like`);
      setData((d) => ({
        ...d,
        hasLiked: res.data.isLiked,
        likes_count: Math.max(0, (d.likes_count || 0) + (res.data.isLiked ? 1 : -1)),
      }));
    } catch {
      /* silent */
    } finally {
      setBusy(false);
    }
  };

  const addComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setBusy(true);
    try {
      const res = await apiClient.post(`/reports/${id}/comment`, { content: comment });
      setData((d) => ({ ...d, comments: [...(d.comments || []), res.data.comment] }));
      setComment('');
    } catch {
      /* silent */
    } finally {
      setBusy(false);
    }
  };

  const submitAction = async (action) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('action', action);
      if (liveCoords.lat != null) {
        fd.append('lat', String(liveCoords.lat));
        fd.append('lng', String(liveCoords.lng));
      }
      if (actionFile && action !== 'FLAG_SPAM') fd.append('image', actionFile);
      await apiClient.post(`/reports/${id}/action`, fd);
      setActionModal(null);
      setActionFile(null);
      reload();
    } catch (e) {
      setError(e.response?.data?.error || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  const submitAppeal = async () => {
    if (appealEvidence.files.length < 2 || !appealEvidence.source || appealCoords.lat == null || appealCoords.lng == null) return;
    setBusy(true);
    try {
      const fd = new FormData();
      appealEvidence.files.forEach((file) => fd.append('images', file));
      fd.append('lat', String(appealCoords.lat));
      fd.append('lng', String(appealCoords.lng));
      fd.append('locationSource', appealEvidence.source);
      await apiClient.post(`/reports/${id}/appeal`, fd);
      setAppealOpen(false);
      setAppealEvidence({ files: [], location: null, source: null });
      reload();
    } catch (e) {
      setError(e.response?.data?.error || 'Appeal failed.');
    } finally {
      setBusy(false);
    }
  };

  const fineTuneAppealLocation = ({ lat, lng }) => {
    if (!canTuneAppealLocation) return;
    setAppealEvidence((current) => ({ ...current, location: { lat, lng } }));
  };

  const saveEdit = async () => {
    setBusy(true);
    try {
      await apiClient.put(`/reports/${id}`, { description: editDesc });
      setEditOpen(false);
      reload();
    } catch (e) {
      setError(e.response?.data?.error || 'Update failed.');
    } finally {
      setBusy(false);
    }
  };

  const removeIssue = async () => {
    setBusy(true);
    try {
      await apiClient.delete(`/reports/${id}`);
      navigate('/map', { replace: true });
    } catch (e) {
      setError(e.response?.data?.error || 'Delete failed.');
      setDeleteOpen(false);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState label="Loading issue…" />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;

  const p = data?.permissions || {};
  const open = ['ACTIVE', 'NEEDS_VERIFICATION', 'CONTESTED'].includes(data?.status);
  const verificationOpen = data?.status === 'NEEDS_VERIFICATION' && p.canVerify;

  return (
    <div className="mx-auto max-w-5xl">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {error && (
        <div className="mb-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-4 lg:col-span-2">
          <Card className="overflow-hidden">
            {data?.imageUrl && (
              <img src={data.imageUrl} alt={data.title} className="max-h-[420px] w-full object-cover" />
            )}
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
                <Metric icon={Flame} label="Reports" value={data?.density_score} tone="text-orange-500" />
                <Metric icon={Heart} label="Likes" value={data?.likes_count} tone="text-rose-500" />
                <Metric icon={Flag} label="Flags" value={data?.flag_count} tone="text-amber-500" />
                <Metric icon={TrendingUp} label="Escalations" value={data?.escalation_count} tone="text-purple-500" />
              </div>

              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-400 dark:text-gray-500">
                <span>Reported {timeAgo(data?.created_at)}</span>
                <span>Updated {timeAgo(data?.updated_at)}</span>
                {data?.contested_at && <span>Contested {formatDateTime(data.contested_at)}</span>}
                {data?.resolution_deadline && <span>Deadline {formatDateTime(data.resolution_deadline)}</span>}
              </div>
            </div>
          </Card>

          {/* Comments */}
          <Card className="p-5 sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
              <MessageCircle className="h-4 w-4 text-blue-500" /> Discussion
            </h2>

            {p.canComment && (
              <form onSubmit={addComment} className="mb-5 flex gap-2">
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add a comment…"
                  className="flex-1 rounded-2xl border-0 bg-gray-100 px-4 py-3 text-sm text-gray-900 outline-none ring-1 ring-inset ring-transparent transition-all placeholder:text-gray-500 focus:bg-white focus:ring-2 focus:ring-blue-600 dark:bg-slate-700/50 dark:text-white dark:placeholder:text-gray-400 dark:focus:bg-slate-800 dark:focus:ring-blue-500"
                />
                <Button type="submit" icon={Send} disabled={!comment.trim()} loading={busy}>
                  Post
                </Button>
              </form>
            )}

            {!data?.comments?.length ? (
              <p className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">No comments yet.</p>
            ) : (
              <div className="space-y-3">
                {data.comments.map((c) => (
                  <div key={c.id} className="rounded-2xl bg-gray-50 p-3 dark:bg-slate-800/60">
                    <p className="text-sm text-gray-700 dark:text-gray-200">{c.content}</p>
                    <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">{timeAgo(c.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* History */}
          <Card className="p-5 sm:p-6">
            <h2 className="mb-4 text-sm font-bold text-gray-900 dark:text-white">Activity timeline</h2>
            <div className="space-y-4">
              {data?.history?.map((h, i) => {
                const Icon = ACTION_ICONS[h.action_type] || Flame;
                return (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-gray-400">
                      <Icon className="h-4 w-4" />
                    </div>
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
                          className="mt-2 h-20 w-20 rounded-xl object-cover ring-1 ring-gray-200 dark:ring-slate-700"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Side column */}
        <div className="space-y-4">
          {open && (
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-bold text-gray-900 dark:text-white">Take action</h2>

              <div className="space-y-2">
                {verificationOpen ? (
                  <>
                    <Button
                      full
                      variant="success"
                      icon={CheckCircle2}
                      onClick={() => setActionModal('CONFIRM_FIXED')}
                    >
                      Confirm it's fixed
                    </Button>
                    <Button
                      full
                      variant="outline"
                      icon={RotateCcw}
                      onClick={() => setActionModal('STILL_EXISTS')}
                    >
                      Still exists
                    </Button>
                  </>
                ) : !p.canAppeal && (
                  <>
                    <Button full variant="secondary" icon={Heart} onClick={toggleLike} loading={busy}>
                      {data?.hasLiked ? 'Unlike' : 'Like'} ({formatCount(data?.likes_count)})
                    </Button>
                    <Button full variant="ghost" icon={Flag} onClick={() => submitAction('FLAG_SPAM')} loading={busy}>
                      Flag as spam
                    </Button>
                  </>
                )}

                {p.canAppeal && (
                  <Button full icon={AlertTriangle} onClick={() => setAppealOpen(true)}>
                    Appeal with a fresh photo
                  </Button>
                )}
              </div>
            </Card>
          )}

          {!open && (
            <Card className="p-5">
              <h2 className="mb-2 text-sm font-bold text-gray-900 dark:text-white">This issue is closed</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                It was {data?.status?.toLowerCase()} by the community. No further actions can be taken.
              </p>
            </Card>
          )}

          {(p.canEdit || p.canDelete) && (
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-bold text-gray-900 dark:text-white">Owner tools</h2>
              <div className="space-y-2">
                {p.canEdit && (
                  <Button
                    full
                    variant="outline"
                    icon={Pencil}
                    onClick={() => {
                      setEditDesc(data?.description || '');
                      setEditOpen(true);
                    }}
                  >
                    Edit details
                  </Button>
                )}
                {p.canDelete && (
                  <Button full variant="danger" icon={Trash2} onClick={() => setDeleteOpen(true)}>
                    Delete / withdraw
                  </Button>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Action modal */}
      <Modal open={!!actionModal} onClose={() => setActionModal(null)} title="Confirm your action">
        {actionModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {actionModal === 'CONFIRM_FIXED' &&
                'You’re confirming this issue is fixed on the ground. A locality-wide quorum must agree before it can close.'}
              {actionModal === 'STILL_EXISTS' &&
                'You’re re-verifying that this issue still exists. Attach a fresh photo as evidence.'}
              {actionModal === 'FLAG_SPAM' &&
                'You’re flagging this for authority review. It will not change the complaint status automatically.'}
            </p>
            {actionModal !== 'FLAG_SPAM' && <ImagePicker image={actionFile} onImage={setActionFile} compact />}
            <div className="flex gap-2">
              <Button variant="secondary" full onClick={() => setActionModal(null)}>
                Cancel
              </Button>
              <Button
                variant={actionModal === 'FLAG_SPAM' ? 'danger' : 'primary'}
                full
                loading={busy}
                onClick={() => submitAction(actionModal)}
              >
                Confirm
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Appeal modal */}
      <Modal open={appealOpen} onClose={() => setAppealOpen(false)} title="Appeal with fresh photo">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            An authority marked this issue as “not found”. Upload a fresh photo proving it still
            exists to return it to the active queue.
          </p>
          <EvidenceCapture
            value={appealEvidence.files}
            location={appealEvidence.location}
            liveLocation={liveCoords}
            source={appealEvidence.source}
            onChange={(next) => setAppealEvidence((current) => ({
              files: next.files,
              location: next.location === undefined ? current.location : next.location,
              source: next.source === undefined ? current.source : next.source,
            }))}
            label="Fresh local evidence"
          />
          {appealEvidence.source && appealCoords.lat != null && (
            <div className="space-y-2">
              <MapView
                markers={[{ id: 'appeal-location', lat: appealCoords.lat, lng: appealCoords.lng, color: '#2563eb', size: 20 }]}
                center={[appealCoords.lat, appealCoords.lng]}
                zoom={16}
                followCenter
                onMapClick={canTuneAppealLocation ? fineTuneAppealLocation : undefined}
                className="h-48 w-full overflow-hidden rounded-2xl ring-1 ring-gray-100 dark:ring-white/10"
                scrollWheelZoom={false}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {canTuneAppealLocation
                  ? 'Tap the map to fine-tune the evidence location.'
                  : 'Location is locked to the live camera capture.'}
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" full onClick={() => setAppealOpen(false)}>
              Cancel
            </Button>
            <Button full loading={busy} disabled={appealEvidence.files.length < 2 || !appealEvidence.source || appealCoords.lat == null || appealCoords.lng == null} onClick={submitAppeal}>
              Submit appeal
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit issue">
        <div className="space-y-4">
          <Textarea
            id="edesc"
            label="Description"
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            maxLength={1000}
            rows={5}
          />
          <div className="flex gap-2">
            <Button variant="secondary" full onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button full loading={busy} onClick={saveEdit}>
              Save changes
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete modal */}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete this report?">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            If others have joined this issue, only your report is withdrawn and the pin stays for the
            community. If you’re the only reporter, it is removed entirely.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" full onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" full loading={busy} onClick={removeIssue}>
              Yes, delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone }) {
  return (
    <div className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 dark:bg-slate-800">
      <Icon className={`h-4 w-4 ${tone}`} />
      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCount(value)}</span>
    </div>
  );
}
