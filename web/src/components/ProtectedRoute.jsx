import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ allowedRoles }) {
    const { user, isInitialized } = useAuth();

    // Show nothing while checking localStorage on first load
    if (!isInitialized) return null;

    // Not logged in? Send to login page.
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // Logged in, but wrong role? Route them to their proper home.
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return user.role === 'USER'
            ? <Navigate to="/map" replace />
            : <Navigate to="/admin/dashboard" replace />;
    }

    // Authorized! Render the nested routes.
    return <Outlet />;
}