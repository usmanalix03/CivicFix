import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { apiClient } from '../lib/axios';
import IssueCard from '../components/IssueCard';
import Button from '../components/ui/Button';
import { Select } from '../components/ui/Field';
import { EmptyState, ErrorState } from '../components/ui/Feedback';
import { ISSUE_STATUSES, CATEGORIES } from '../lib/constants';
import { formatCount } from '../lib/format';

const statusOptions = [
  { value: '', label: 'All statuses' },
  ...Object.values(ISSUE_STATUSES).map((s) => ({ value: s, label: s.replaceAll('_', ' ') })),
];

const categoryOptions = [
  { value: '', label: 'All categories' },
  ...CATEGORIES.map((c) => ({ value: c.value, label: `${c.emoji} ${c.value}` })),
];

export default function AdminQueue() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 50 };
      if (status) params.status = status;
      if (category) params.category = category;
      if (search) params.q = search;
      const res = await apiClient.get('/admin/issues', { params });
      setItems(res.data?.items || []);
      setError(null);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load queue.');
    } finally {
      setLoading(false);
    }
  }, [page, status, category, search]);

  useEffect(() => {
    load();
  }, [load]);

  const onSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(q.trim());
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          Action queue
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Ranked by priority — density, community signal and escalations.
        </p>
      </div>

      {/* Filters */}
      <form onSubmit={onSearch} className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title or description…"
            className="w-full rounded-2xl border-0 bg-gray-100 py-3 pl-11 pr-4 text-sm text-gray-900 outline-none ring-1 ring-inset ring-transparent transition-all placeholder:text-gray-500 focus:bg-white focus:ring-2 focus:ring-blue-600 dark:bg-slate-700/50 dark:text-white dark:placeholder:text-gray-400 dark:focus:bg-slate-800 dark:focus:ring-blue-500"
          />
        </div>
        <Select
          value={status}
          options={statusOptions}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="py-3 text-sm"
        />
        <Select
          value={category}
          options={categoryOptions}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          className="py-3 text-sm"
        />
        <Button type="submit">Search</Button>
      </form>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-[24px] bg-gray-100 dark:bg-slate-800" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No issues match"
          description="Try clearing the filters, or check back after citizens file new reports."
        />
      ) : (
        <div className="space-y-3">
          {items.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              onClick={() => navigate(`/admin/issue/${issue.id}`)}
              footer={
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <Users className="h-3.5 w-3.5" />
                  {formatCount(issue.reporter_count)} reporter{Number(issue.reporter_count) === 1 ? '' : 's'}
                  <span className="ml-auto">Priority {formatCount(issue.priority_score)}</span>
                </div>
              }
            />
          ))}

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2">
            <Button variant="secondary" icon={ChevronLeft} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Prev
            </Button>
            <span className="text-sm text-gray-500 dark:text-gray-400">Page {page}</span>
            <Button
              variant="secondary"
              disabled={items.length < 50}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
