import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import FloatingAssistant from './components/FloatingAssistant';

// Admin shared pages
import Dashboard from './pages/Dashboard';
import Operations from './pages/groups/Operations';
import Intelligence from './pages/groups/Intelligence';
import SimulationGroup from './pages/groups/SimulationGroup';
import Strategy from './pages/groups/Strategy';
import Reports from './pages/Reports';
import SettingsPage from './pages/Settings';
import LoginPage from './pages/LoginPage';
import UserManagement from './pages/UserManagement';

// Doctor pages
import DoctorDashboard from './pages/DoctorDashboard';
import PatientManagement from './pages/PatientManagement';
import AppointmentManagement from './pages/AppointmentManagement';

// Nurse pages
import NurseDashboard from './pages/NurseDashboard';
import PatientVitals from './pages/PatientVitals';
import RegisterPatient from './pages/RegisterPatient';

// Patient pages
import PatientDashboard from './pages/PatientDashboard';
import AppointmentBooking from './pages/AppointmentBooking';
import PatientProfile from './pages/PatientProfile';
import PatientQueries from './pages/PatientQueries';
import ResponseSuggestions from './pages/ResponseSuggestions';
import WorkflowAutomation from './pages/WorkflowAutomation';
import ClinicalDecisionSupport from './pages/ClinicalDecisionSupport';

// Role-based route permissions
const ROLE_ROUTES = {
  admin: ['/', '/operations', '/intelligence', '/simulation', '/strategy', '/reports', '/settings', '/admin/users', '/response-suggestions', '/workflow', '/cdss'],
  doctor: ['/', '/patient-management', '/appointment-management', '/reports', '/response-suggestions', '/workflow', '/cdss'],
  nurse: ['/', '/patient-vitals', '/register-patient', '/reports', '/response-suggestions', '/workflow', '/cdss'],
  patient: ['/', '/book-appointment', '/profile', '/reports', '/patient-queries'],
};

function ProtectedRoute({ user, path, children }) {
  const allowed = ROLE_ROUTES[user?.role] || [];
  if (!allowed.includes(path)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem('zi_user');
    return saved ? JSON.parse(saved) : null;
  });

  const handleLogin = (userData) => {
    setUser(userData);
    sessionStorage.setItem('zi_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    sessionStorage.removeItem('zi_user');
    sessionStorage.removeItem('zi_token');
  };

  if (!user) return <LoginPage onLogin={handleLogin} />;

  // Role-specific dashboard
  const DashHome = user.role === 'doctor' ? DoctorDashboard
    : user.role === 'nurse' ? NurseDashboard
      : user.role === 'patient' ? PatientDashboard
        : Dashboard;

  return (
    <div className="min-h-screen bg-surface pb-20">
      <main className="p-6">
        <Routes>
          <Route path="/" element={<DashHome />} />

          {/* Admin */}
          <Route path="/operations" element={<ProtectedRoute user={user} path="/operations"><Operations /></ProtectedRoute>} />
          <Route path="/intelligence" element={<ProtectedRoute user={user} path="/intelligence"><Intelligence /></ProtectedRoute>} />
          <Route path="/simulation" element={<ProtectedRoute user={user} path="/simulation"><SimulationGroup /></ProtectedRoute>} />
          <Route path="/strategy" element={<ProtectedRoute user={user} path="/strategy"><Strategy /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute user={user} path="/settings"><SettingsPage /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute user={user} path="/admin/users"><UserManagement /></ProtectedRoute>} />

          {/* Doctor */}
          <Route path="/patient-management" element={<ProtectedRoute user={user} path="/patient-management"><PatientManagement /></ProtectedRoute>} />
          <Route path="/appointment-management" element={<ProtectedRoute user={user} path="/appointment-management"><AppointmentManagement /></ProtectedRoute>} />

          {/* Nurse */}
          <Route path="/patient-vitals" element={<ProtectedRoute user={user} path="/patient-vitals"><PatientVitals /></ProtectedRoute>} />
          <Route path="/register-patient" element={<ProtectedRoute user={user} path="/register-patient"><RegisterPatient /></ProtectedRoute>} />

          {/* Patient */}
          <Route path="/book-appointment" element={<ProtectedRoute user={user} path="/book-appointment"><AppointmentBooking /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute user={user} path="/profile"><PatientProfile /></ProtectedRoute>} />
          <Route path="/patient-queries" element={<ProtectedRoute user={user} path="/patient-queries"><PatientQueries /></ProtectedRoute>} />

          {/* AI Response Suggestions (Staff) */}
          <Route path="/response-suggestions" element={<ProtectedRoute user={user} path="/response-suggestions"><ResponseSuggestions /></ProtectedRoute>} />

          {/* Workflow Automation (Staff) */}
          <Route path="/workflow" element={<ProtectedRoute user={user} path="/workflow"><WorkflowAutomation /></ProtectedRoute>} />

          {/* Clinical Decision Support (Staff) */}
          <Route path="/cdss" element={<ProtectedRoute user={user} path="/cdss"><ClinicalDecisionSupport /></ProtectedRoute>} />

          {/* Shared */}
          <Route path="/reports" element={<Reports />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Sidebar user={user} onLogout={handleLogout} />
      <FloatingAssistant />
    </div>
  );
}
