import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../lib/axios';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import Logo from '../components/Logo';

export default function Signup() {
    const [step, setStep] = useState(1); // 1: Details & Request OTP, 2: Enter OTP & Password
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [coords, setCoords] = useState({ lat: null, lng: null });
    const [locationError, setLocationError] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const navigate = useNavigate();
    const { login } = useAuth();

    // Automatically request browser GPS coordinates on mount
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setCoords({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    });
                },
                (err) => {
                    setLocationError('GPS location is required for jurisdictional mapping. Please enable location permissions.');
                },
                { enableHighAccuracy: true }
            );
        } else {
            setLocationError('Geolocation is not supported by your browser.');
        }
    }, []);

    const handleRequestOtp = async (e) => {
        e.preventDefault();
        if (coords.lat === null || coords.lng === null) {
            setError('Waiting for GPS coordinates. Please allow location access.');
            return;
        }
        setError('');
        setIsLoading(true);

        try {
            await apiClient.post('/auth/citizen/request-otp', { email });
            setStep(2); // Move to OTP verification step
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to send verification code.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const response = await apiClient.post('/auth/citizen/signup', {
                name,
                email,
                phone,
                password,
                otp,
                lat: coords.lat,
                lng: coords.lng,
            });

            login(response.data.user, response.data.token);

            // Persist optional profile fields (the signup endpoint ignores name/phone).
            if (name || phone) {
                apiClient
                    .put('/auth/me/citizen', { name: name || undefined, phoneNumber: phone || undefined })
                    .catch(() => {});
            }

            navigate('/map', { replace: true });
        } catch (err) {
            setError(err.response?.data?.error || 'Registration failed. Please check your details.');
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
                    <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">Create Account</h1>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        {step === 1 ? 'Join CivicFix as a verified citizen' : `Enter verification code sent to ${email}`}
                    </p>
                </div>

                {error && (
                    <div className="mb-6 rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        {error}
                    </div>
                )}

                {locationError && (
                    <div className="mb-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                        {locationError}
                    </div>
                )}

                {step === 1 ? (
                    <form onSubmit={handleRequestOtp} className="space-y-4">
                        <div>
                            <label className="mb-1.5 block text-sm font-semibold text-gray-900 dark:text-gray-300">Full Name</label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full rounded-2xl border-0 bg-gray-100 px-4 py-3 text-gray-900 outline-none ring-1 ring-inset ring-transparent transition-all focus:bg-white focus:ring-2 focus:ring-blue-600 dark:bg-slate-700/50 dark:text-white dark:focus:bg-slate-800 dark:focus:ring-blue-500"
                                placeholder="John Doe"
                            />
                        </div>

                        <div>
                            <label className="mb-1.5 block text-sm font-semibold text-gray-900 dark:text-gray-300">Email Address</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full rounded-2xl border-0 bg-gray-100 px-4 py-3 text-gray-900 outline-none ring-1 ring-inset ring-transparent transition-all focus:bg-white focus:ring-2 focus:ring-blue-600 dark:bg-slate-700/50 dark:text-white dark:focus:bg-slate-800 dark:focus:ring-blue-500"
                                placeholder="name@example.com"
                            />
                        </div>

                        <div>
                            <label className="mb-1.5 block text-sm font-semibold text-gray-900 dark:text-gray-300">Phone Number (Optional)</label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full rounded-2xl border-0 bg-gray-100 px-4 py-3 text-gray-900 outline-none ring-1 ring-inset ring-transparent transition-all focus:bg-white focus:ring-2 focus:ring-blue-600 dark:bg-slate-700/50 dark:text-white dark:focus:bg-slate-800 dark:focus:ring-blue-500"
                                placeholder="+91 98765 43210"
                            />
                        </div>

                        <div>
                            <label className="mb-1.5 block text-sm font-semibold text-gray-900 dark:text-gray-300">Password</label>
                            <input
                                type="password"
                                required
                                minLength={8}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full rounded-2xl border-0 bg-gray-100 px-4 py-3 text-gray-900 outline-none ring-1 ring-inset ring-transparent transition-all focus:bg-white focus:ring-2 focus:ring-blue-600 dark:bg-slate-700/50 dark:text-white dark:focus:bg-slate-800 dark:focus:ring-blue-500"
                                placeholder="At least 8 characters"
                            />
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            disabled={isLoading || coords.lat === null}
                            className="w-full mt-2 rounded-full bg-blue-600 px-4 py-4 text-sm font-bold text-white shadow-lg shadow-blue-500/25 transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50 dark:bg-blue-500"
                        >
                            {isLoading ? 'Sending verification code...' : 'Continue & Verify Email'}
                        </motion.button>
                    </form>
                ) : (
                    <form onSubmit={handleSignup} className="space-y-5">
                        <div>
                            <label className="mb-2 block text-sm font-semibold text-gray-900 dark:text-gray-300">Verification Code (OTP)</label>
                            <input
                                type="text"
                                required
                                maxLength={6}
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                className="w-full rounded-2xl border-0 bg-gray-100 px-4 py-3.5 text-center text-2xl tracking-widest font-mono text-gray-900 outline-none ring-1 ring-inset ring-transparent transition-all focus:bg-white focus:ring-2 focus:ring-blue-600 dark:bg-slate-700/50 dark:text-white dark:focus:bg-slate-800 dark:focus:ring-blue-500"
                                placeholder="123456"
                            />
                            <p className="mt-2 text-xs text-gray-500 text-center dark:text-gray-400">Check your backend console terminal for the OTP code during development.</p>
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            disabled={isLoading}
                            className="w-full rounded-full bg-blue-600 px-4 py-4 text-sm font-bold text-white shadow-lg shadow-blue-500/25 transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50 dark:bg-blue-500"
                        >
                            {isLoading ? 'Creating account...' : 'Complete Signup'}
                        </motion.button>
                    </form>
                )}

                <div className="mt-8 space-y-2 text-center text-sm text-gray-600 dark:text-gray-400">
                    <p>
                        Already have an account?{' '}
                        <Link to="/login" className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
                            Sign in
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
