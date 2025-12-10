/**
 * Main Application Component - Grabit Design
 *
 * Uses new AppShell with:
 * - Sticky Header (Desktop/Tablet)
 * - Pill Navigation
 * - Hamburger Menu
 * - Custom Theme
 */

import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import AppShell from './components/AppShell'
import Dashboard from './features/dashboard/Dashboard'
import DeviceList from './features/devices/DeviceList'
import UserList from './features/users/UserList'
import DepartmentList from './features/departments/DepartmentList'
import AmtList from './features/amts/AmtList'
import LocationList from './features/locations/LocationList'
import History from './features/history/History'
import MissingDevices from './features/missing/MissingDevices'
import Login from './features/auth/Login'
import ProtectedRoute from './features/auth/ProtectedRoute'

// Map routes to page keys for AppShell
const routeToPageMap = {
  '/dashboard': 'overview',
  '/history': 'history',
  '/missing': 'missing',
  '/devices': 'devices',
  '/users': 'users',
  '/departments': 'departments',
  '/amts': 'amts',
  '/locations': 'locations',
}

const pageToRouteMap = {
  'overview': '/dashboard',
  'devices': '/devices',
  'users': '/users',
  'departments': '/departments',
  'amts': '/amts',
  'history': '/history',
  'missing': '/missing',
  'locations': '/locations',
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  const currentPage = routeToPageMap[location.pathname] || 'overview';

  const handleNavigate = (pageKey) => {
    const route = pageToRouteMap[pageKey];
    if (route) {
      navigate(route);
    }
  };

  // Servicedesk: Nur Dashboard erlauben
  // Rolle aus globalem State oder Auth-Kontext holen
  // Hier als Beispiel: window.grabitUser?.role
  const isServicedesk = window.grabitUser?.role === 'Servicedesk';

  return (
    <Routes>
      {/* Public Route - Login */}
      <Route path="/login" element={<Login />} />
      {/* Protected Routes - Require Authentication */}
      <Route path="/*" element={
        <ProtectedRoute>
          <AppShell currentPage={currentPage} onNavigate={handleNavigate}>
            {({ searchValue }) => (
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard searchValue={searchValue} />} />
                {!isServicedesk && <Route path="/history" element={<History searchValue={searchValue} />} />}
                {!isServicedesk && <Route path="/missing" element={<MissingDevices searchValue={searchValue} />} />}
                {!isServicedesk && <Route path="/devices" element={<DeviceList searchValue={searchValue} />} />}
                {!isServicedesk && <Route path="/users" element={<UserList searchValue={searchValue} />} />}
                {!isServicedesk && <Route path="/departments" element={<DepartmentList searchValue={searchValue} />} />}
                {!isServicedesk && <Route path="/amts" element={<AmtList searchValue={searchValue} />} />}
                {!isServicedesk && <Route path="/locations" element={<LocationList searchValue={searchValue} />} />}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            )}
          </AppShell>
        </ProtectedRoute>
      } />
    </Routes>
  );
}
