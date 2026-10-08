import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../lib/axios';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import Logo from '../components/Logo';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await apiClient.post('/auth/login', { email, password });
      
      login(response.data.user, response.data.token);

      if (response.data.user.role === 'USER') {
        navigate('/map', { replace: true });
      } else {
        navigate('/admin/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to sign in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-[#f8f9fa] transition-colors duration-500 dark:bg-[#0f172a]">
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', bounce: 0.3, duration: 0.8 }}
        className="w-full max-w-md rounded-[32px] bg-white p-8 shadow-[0_8px_40px_rgb(0,0,0,0.06)] ring-1 ring-gray-100 sm:p-10 dark:bg-slate-800/90 dark:ring-white/10 dark:shadow-[0_8px_40px_rgb(0,0,0,0.3)] backdrop-blur-xl"
      >
        
        <div className="mb-8 text-center">
          <Logo className="mx-auto mb-4 h-12 w-12 shadow-md" />
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">Welcome back</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Sign in to your CivicFix account</p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-6 rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400"
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-900 dark:text-gray-300" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border-0 bg-gray-100 px-4 py-3.5 text-gray-900 outline-none ring-1 ring-inset ring-transparent transition-all placeholder:text-gray-500 hover:bg-gray-200 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-blue-600 dark:bg-slate-700/50 dark:text-white dark:placeholder:text-gray-400 dark:hover:bg-slate-700 dark:focus:bg-slate-800 dark:focus:ring-blue-500"
              placeholder="name@example.com"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-900 dark:text-gray-300" htmlFor="password">
                Password
              </label>
              <Link to="/forgot-password" className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border-0 bg-gray-100 px-4 py-3.5 text-gray-900 outline-none ring-1 ring-inset ring-transparent transition-all placeholder:text-gray-500 hover:bg-gray-200 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-blue-600 dark:bg-slate-700/50 dark:text-white dark:placeholder:text-gray-400 dark:hover:bg-slate-700 dark:focus:bg-slate-800 dark:focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isLoading}
            className="w-full rounded-full bg-blue-600 px-4 py-4 text-sm font-bold text-white shadow-lg shadow-blue-500/25 transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-70 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </motion.button>
        </form>

        <div className="mt-8 space-y-2 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>
            Don't have an account?{' '}
            <Link to="/signup" className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
              Create citizen account
            </Link>
          </p>
          <p>
            <Link to="/admin/signup" className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
              Register as an Authority
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
