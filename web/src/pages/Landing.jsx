import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Camera, GitMerge, BadgeCheck, Map, ArrowRight, Flame, Heart } from 'lucide-react';
import { apiClient } from '../lib/axios';
import { useAuth } from '../context/AuthContext';
import { CategoryBadge, StatusBadge } from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { formatCount, timeAgo } from '../lib/format';
import Logo from '../components/Logo';

const STEPS = [
  {
    icon: Camera,
    title: 'Snap & report',
    text: 'Photograph a civic problem. Our AI verifies the photo is authentic and categorizes it for you.',
  },
  {
    icon: GitMerge,
    title: 'Auto-cluster',
    text: 'H3 spatial clustering merges duplicate reports into one pin, so one pothole never becomes five.',
  },
  {
    icon: BadgeCheck,
    title: 'Citizens verify',
    text: 'A fix only closes when a majority of reporters confirm it on the ground — never by a lazy official.',
  },
];

function PublicIssueCard({ issue }) {
  return (
    <div className="flex items-stretch gap-4 overflow-hidden rounded-[24px] bg-white p-4 shadow-[0_2px_20px_rgb(0,0,0,0.04)] ring-1 ring-gray-100 dark:bg-slate-800/80 dark:ring-white/5">
      {issue.imageUrl && (
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-gray-100 dark:bg-slate-700">
          <img src={issue.imageUrl} alt={issue.title} loading="lazy" className="h-full w-full object-cover" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap gap-1.5">
          <CategoryBadge category={issue.category} />
          <StatusBadge status={issue.status} />
        </div>
        <h3 className="truncate text-sm font-bold text-gray-900 dark:text-white">{issue.title}</h3>
        <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span className="inline-flex items-center gap-1">
            <Flame className="h-3.5 w-3.5 text-orange-500" /> {formatCount(issue.density_score)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Heart className="h-3.5 w-3.5 text-rose-500" /> {formatCount(issue.likes_count)}
          </span>
          <span className="ml-auto text-gray-400 dark:text-gray-500">{timeAgo(issue.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get('/public/feed', { params: { limit: 12 } })
      .then((res) => setFeed(res.data?.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const primary = user
    ? { label: 'Report an Issue', to: '/report', icon: Camera }
    : { label: 'Get Started', to: '/signup', icon: ArrowRight };

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#1c1b1f] transition-colors duration-500 dark:bg-[#0f172a] dark:text-gray-50">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl dark:bg-blue-600/20" />
          <div className="absolute -right-24 top-20 h-72 w-72 rounded-full bg-purple-500/15 blur-3xl dark:bg-purple-600/15" />
        </div>

        <div className="mx-auto max-w-7xl px-4 pb-16 pt-20 sm:px-6 sm:pt-28 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', bounce: 0.3, duration: 0.8 }}
            className="mx-auto max-w-3xl text-center"
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-blue-700 shadow-sm ring-1 ring-blue-100 dark:bg-slate-800 dark:text-blue-300 dark:ring-blue-500/30">
              🏙️ Civic accountability, powered by citizens
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
              Fix your city, one{' '}
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent dark:from-blue-400 dark:to-purple-400">
                report
              </span>{' '}
              at a time.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base text-gray-600 sm:text-lg dark:text-gray-400">
              Report potholes, broken streetlights and illegal dumping. CivicFix clusters community
              reports and lets citizens — not officials — verify every fix.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" icon={primary.icon} onClick={() => navigate(primary.to)}>
                {primary.label}
              </Button>
              <Button
                size="lg"
                variant="secondary"
                icon={Map}
                onClick={() => navigate(user ? '/map' : '/login')}
              >
                Explore the map
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, type: 'spring', bounce: 0.3 }}
              className="rounded-[28px] bg-white p-7 shadow-[0_2px_20px_rgb(0,0,0,0.04)] ring-1 ring-gray-100 dark:bg-slate-800/80 dark:ring-white/5"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                <s.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{s.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Live community feed */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Live from your community
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Anonymized issues reported by citizens near you.
            </p>
          </div>
          <Button variant="ghost" onClick={() => navigate(user ? '/map' : '/login')}>
            View all <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-[24px] bg-gray-100 dark:bg-slate-800/60"
              />
            ))}
          </div>
        ) : feed.length === 0 ? (
          <div className="rounded-[28px] bg-white px-6 py-16 text-center text-gray-400 ring-1 ring-gray-100 dark:bg-slate-800/40 dark:ring-white/5">
            No issues reported yet — be the first to make your street heard.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {feed.map((issue) => (
              <PublicIssueCard key={issue.id} issue={issue} />
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200/60 py-10 text-center text-sm text-gray-400 dark:border-slate-800 dark:text-gray-500">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4">
          <Logo className="h-6 w-6" />
          <span className="font-semibold text-gray-600 dark:text-gray-400">CivicFix</span>
          <span>· Civic issues, verified by citizens.</span>
        </div>
      </footer>
    </div>
  );
}
