import { useState, useEffect } from 'react';
import { apiClient } from '../lib/axios';
import { motion } from 'framer-motion';

export default function AdminDashboard() {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await apiClient.get('/admin/stats');
                setData(response.data);
            } catch (err) {
                setError('Failed to load dashboard statistics.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (isLoading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <div className="text-lg font-medium text-gray-500 animate-pulse dark:text-gray-400">Loading metrics...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-3xl bg-red-50 p-6 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                <p className="font-semibold">Error</p>
                <p className="mt-1 text-sm">{error}</p>
            </div>
        );
    }

    const stats = data?.stats || {};
    const byCategory = data?.byCategory || [];

    // Framer Motion staggered animation variants
    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20, scale: 0.95 },
        show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', bounce: 0.4 } }
    };

    // Reusable card component with Apple-style bounce on hover
    const StatCard = ({ label, value, highlight }) => (
        <motion.div
            variants={itemVariants}
            whileHover={{ y: -4, scale: 1.02 }}
            className="flex flex-col justify-between rounded-[32px] bg-white p-6 sm:p-8 shadow-[0_2px_20px_rgb(0,0,0,0.04)] ring-1 ring-gray-100 transition-shadow hover:shadow-[0_12px_32px_rgb(0,0,0,0.08)] dark:bg-slate-800/80 dark:ring-white/5 dark:hover:shadow-[0_12px_32px_rgb(0,0,0,0.2)]"
        >
            <span className="text-xs font-bold tracking-wider text-gray-500 uppercase dark:text-gray-400">
                {label}
            </span>
            <span className={`mt-4 text-4xl sm:text-5xl font-extrabold tracking-tight ${highlight ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                {value || 0}
            </span>
        </motion.div>
    );

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-8"
        >
            <motion.div variants={itemVariants}>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">Authority Overview</h1>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Live civic metrics and jurisdiction health.</p>
            </motion.div>

            {/* Primary Metrics Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Total Issues" value={stats.total} highlight />
                <StatCard label="Active (Unresolved)" value={stats.active} />
                <StatCard label="Needs Verification" value={stats.needs_verification} />
                <StatCard label="Resolved" value={stats.resolved} />
            </div>

            {/* Secondary Metrics & Category Breakdown */}
            <div className="grid gap-6 lg:grid-cols-3">

                {/* Left Column: Engagement Stats */}
                <motion.div variants={itemVariants} className="flex flex-col gap-4 lg:col-span-1">
                    <div className="rounded-[32px] bg-blue-50/50 p-6 sm:p-8 ring-1 ring-blue-100 dark:bg-blue-900/10 dark:ring-blue-900/30">
                        <h3 className="text-sm font-bold text-blue-900 uppercase tracking-wider dark:text-blue-400">Citizen Engagement</h3>
                        <div className="mt-6 space-y-4">
                            <div className="flex justify-between border-b border-blue-100/50 pb-3 dark:border-blue-900/30">
                                <span className="text-gray-600 dark:text-gray-400">Total Upvotes</span>
                                <span className="font-bold text-gray-900 dark:text-white">{stats.total_likes || 0}</span>
                            </div>
                            <div className="flex justify-between border-b border-blue-100/50 pb-3 dark:border-blue-900/30">
                                <span className="text-gray-600 dark:text-gray-400">Spam Flags</span>
                                <span className="font-bold text-gray-900 dark:text-white">{stats.total_flags || 0}</span>
                            </div>
                            <div className="flex justify-between border-b border-blue-100/50 pb-3 dark:border-blue-900/30">
                                <span className="text-gray-600 dark:text-gray-400">Escalations</span>
                                <span className="font-bold text-gray-900 dark:text-white">{stats.total_escalations || 0}</span>
                            </div>
                            <div className="flex justify-between pt-1">
                                <span className="text-gray-600 dark:text-gray-400">Citizens in Region</span>
                                <span className="font-bold text-gray-900 dark:text-white">{stats.users || 0}</span>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Right Column: Category Breakdown */}
                <motion.div variants={itemVariants} className="rounded-[32px] bg-white p-6 sm:p-8 shadow-[0_2px_20px_rgb(0,0,0,0.04)] ring-1 ring-gray-100 lg:col-span-2 dark:bg-slate-800/80 dark:ring-white/5">
                    <h3 className="text-sm font-bold tracking-wider text-gray-500 uppercase dark:text-gray-400">Issues by Category</h3>

                    {byCategory.length === 0 ? (
                        <div className="mt-12 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                            <p>No categorised issues found yet.</p>
                        </div>
                    ) : (
                        <div className="mt-8 space-y-5">
                            {byCategory.map((cat) => (
                                <div key={cat.category} className="flex items-center">
                                    <div className="w-1/3 truncate text-sm font-medium text-gray-700 dark:text-gray-300">
                                        {cat.category}
                                    </div>
                                    <div className="w-2/3 flex items-center gap-4">
                                        {/* Visual Bar */}
                                        <div className="h-2.5 flex-grow rounded-full bg-gray-100 overflow-hidden dark:bg-slate-700">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${Math.max(5, (cat.count / stats.total) * 100)}%` }}
                                                transition={{ duration: 1, ease: "easeOut" }}
                                                className="h-full bg-blue-500 rounded-full dark:bg-blue-400"
                                            />
                                        </div>
                                        <span className="w-8 text-right text-sm font-bold text-gray-900 dark:text-white">{cat.count}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </motion.div>

            </div>
        </motion.div>
    );
}