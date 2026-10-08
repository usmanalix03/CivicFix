import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { apiClient } from '../lib/axios';
import IssueCard from '../components/IssueCard';
import Button from '../components/ui/Button';
import { EmptyState, ErrorState } from '../components/ui/Feedback';

export default function MyReports() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiClient
      .get('/reports/mine')
      .then((res) => setItems(res.data?.items || []))
      .catch((e) => setError(e.response?.data?.error || 'Failed to load your reports.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            My reports
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {items.length} issue{items.length === 1 ? '' : 's'} you started
          </p>
        </div>
        <Button icon={Plus} onClick={() => navigate('/report')}>
          New report
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-[24px] bg-gray-100 dark:bg-slate-800" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} />
      ) : items.length === 0 ? (
        <EmptyState
          title="You haven’t reported anything yet"
          description="When you photograph a civic issue, it will show up here."
          action={<Button icon={Plus} onClick={() => navigate('/report')}>Report an issue</Button>}
        />
      ) : (
        <div className="space-y-3">
          {items.map((issue) => (
            <IssueCard key={issue.id} issue={issue} onClick={() => navigate(`/issue/${issue.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}
