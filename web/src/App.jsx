import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import AdminSignup from './pages/AdminSignup';
import ForgotPassword from './pages/ForgotPassword';
import CitizenMap from './pages/CitizenMap';
import ReportIssue from './pages/ReportIssue';
import IssueDetail from './pages/IssueDetail';
import MyReports from './pages/MyReports';
import Settings from './pages/Settings';
import AdminDashboard from './pages/AdminDashboard';
import AdminQueue from './pages/AdminQueue';
import AdminIssueReview from './pages/AdminIssueReview';
import AdminSettings from './pages/AdminSettings';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <BrowserRouter>
      <div className="font-sans antialiased selection:bg-blue-200 selection:text-blue-900">
        <Routes>
          {/* Public & onboarding */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/admin/signup" element={<AdminSignup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Authenticated app shell */}
          <Route element={<Layout />}>
            {/* Citizen hub */}
            <Route element={<ProtectedRoute allowedRoles={['USER']} />}>
              <Route path="/map" element={<CitizenMap />} />
              <Route path="/report" element={<ReportIssue />} />
              <Route path="/issue/:id" element={<IssueDetail />} />
              <Route path="/my-reports" element={<MyReports />} />
              <Route path="/settings" element={<Settings />} />
            </Route>

            {/* Authority hub */}
            <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']} />}>
              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/queue" element={<AdminQueue />} />
              <Route path="/admin/issue/:id" element={<AdminIssueReview />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
