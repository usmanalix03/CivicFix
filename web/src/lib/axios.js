import axios from 'axios';

export const apiClient = axios.create({
    // Vite uses import.meta.env for environment variables
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

// Intercept requests to attach the auth token
apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('civic_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Intercept responses to handle expired tokens globally
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('civic_token');
            localStorage.removeItem('civic_user');

            // Redirect to login if they aren't already there
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);