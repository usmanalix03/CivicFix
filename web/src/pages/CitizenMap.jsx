import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Map, List, Plus, RefreshCw } from 'lucide-react';
import { apiClient } from '../lib/axios';
import MapView from '../components/MapView';
import IssueCard from '../components/IssueCard';
import { categoryMeta } from '../lib/constants';
import { EmptyState, ErrorState } from '../components/ui/Feedback';
import useGeolocation from '../lib/useGeolocation';

export default function CitizenMap() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mobileView, setMobileView] = useState('map');
  const [fitReady, setFitReady] = useState(false);
  const skipNextMove = useRef(false);
  const firstLoad = useRef(false);
  const { coords: liveCoords } = useGeolocation({ watch: true });

  const load = useCallback(async (bounds) => {
    setLoading(true);
    try {
      const params = { limit: 200 };
      if (bounds) {
        params.south_lat = bounds.south;
        params.west_lng = bounds.west;
        params.north_lat = bounds.north;
        params.east_lng = bounds.east;
      }
      const res = await apiClient.get('/reports', { params });
      const list = res.data?.items || [];
      setItems(list);
      setError(null);
      if (!firstLoad.current) {
        firstLoad.current = true;
        if (list.length > 0) {
          skipNextMove.current = true;
          setFitReady(true);
        }
      }
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load issues.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleBounds = useCallback(
    (bounds) => {
      if (skipNextMove.current) {
        skipNextMove.current = false;
        return;
      }
      load(bounds);
    },
    [load],
  );

  const markers = items
    .filter((i) => i.lat != null && i.lng != null)
    .map((i) => ({
      id: i.id,
      lat: Number(i.lat),
      lng: Number(i.lng),
      color: categoryMeta(i.category).color,
      size: i.escalation_count > 0 ? 19 : 15,
      title: i.title,
      onClick: () => navigate(`/issue/${i.id}`),
    }));

  if (liveCoords.lat != null && liveCoords.lng != null) {
    markers.push({
      id: 'current-user',
      lat: liveCoords.lat,
      lng: liveCoords.lng,
      color: '#2563eb',
      size: 22,
      title: 'Your live location',
      isUserLocation: true,
    });
  }

  const toggle = (v) => (
    <button
      onClick={() => setMobileView(v)}
      className={`flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold transition-colors ${
        mobileView === v
          ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-700 dark:text-white'
          : 'text-gray-500 dark:text-gray-400'
      }`}
    >
      {v === 'map' ? <Map className="h-4 w-4" /> : <List className="h-4 w-4" />}
      {v === 'map' ? 'Map' : `List (${items.length})`}
    </button>
  );

  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100vh-6.5rem)] lg:flex-row">
      {/* Mobile toggle */}
      <div className="flex rounded-full bg-gray-100 p-1 dark:bg-slate-800 lg:hidden">{toggle('map')}{toggle('list')}</div>

      {/* Map pane */}
      <div
        className={`relative flex-1 overflow-hidden rounded-[28px] ring-1 ring-gray-100 dark:ring-white/10 ${
          mobileView === 'map' ? 'block' : 'hidden'
        } lg:block`}
      >
      <MapView
          markers={markers}
          center={liveCoords.lat != null ? [liveCoords.lat, liveCoords.lng] : undefined}
          followCenter={liveCoords.lat != null}
          fitToMarkers={fitReady}
          onBoundsChange={handleBounds}
          className="h-[60vh] w-full lg:h-full"
        />

        <button
          onClick={() => load()}
          className="absolute left-4 top-4 z-[500] flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-gray-700 shadow-lg backdrop-blur transition-colors hover:bg-white dark:bg-slate-800/90 dark:text-gray-200 dark:hover:bg-slate-800"
        >
          <RefreshCw className="h-4 w-4" /> Refresh area
        </button>

        <button
          onClick={() => navigate('/report')}
          className="absolute bottom-5 right-5 z-[500] flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-xl shadow-blue-600/30 transition-colors hover:bg-blue-700 dark:bg-blue-500"
        >
          <Plus className="h-4 w-4" /> Report
        </button>
      </div>

      {/* List pane */}
      <div
        className={`flex flex-col overflow-hidden rounded-[28px] bg-white ring-1 ring-gray-100 dark:bg-slate-800/60 dark:ring-white/10 lg:w-[400px] lg:flex-none ${
          mobileView === 'list' ? 'flex' : 'hidden'
        } lg:flex`}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-slate-700/60">
          <div>
            <h1 className="text-base font-bold text-gray-900 dark:text-white">Community issues</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {loading ? 'Loading…' : `${items.length} in view`}
            </p>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {loading && items.length === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-[24px] bg-gray-100 dark:bg-slate-800" />
              ))}
            </div>
          ) : error ? (
            <ErrorState message={error} onRetry={() => load()} />
          ) : items.length === 0 ? (
            <EmptyState
              title="No issues in this area"
              description="Pan the map or tap Report to be the first to raise something."
            />
          ) : (
            items.map((issue) => (
              <IssueCard key={issue.id} issue={issue} onClick={() => navigate(`/issue/${issue.id}`)} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
