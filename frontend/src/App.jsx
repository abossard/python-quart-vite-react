/**
 * Main Application Component - Grabit Design
 *
 * Uses new AppShell with:
 * - Sticky Header (Desktop/Tablet)
 * - Pill Navigation
 * - Hamburger Menu
 * - Custom Theme
 */

import { useState, useEffect } from 'react'
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
import LogList from './features/logs/LogList'
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
  '/logs': 'logs',
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
  'logs': '/logs',
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
                <Route path="/history" element={<History searchValue={searchValue} />} />
                <Route path="/missing" element={<MissingDevices searchValue={searchValue} />} />
                <Route path="/devices" element={<DeviceList searchValue={searchValue} />} />
                <Route path="/users" element={<UserList searchValue={searchValue} />} />
                <Route path="/departments" element={<DepartmentList searchValue={searchValue} />} />
                <Route path="/amts" element={<AmtList searchValue={searchValue} />} />
                <Route path="/locations" element={<LocationList searchValue={searchValue} />} />
                <Route path="/logs" element={<LogList searchValue={searchValue} />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            )}
          </AppShell>
        </ProtectedRoute>
      } />
    </Routes>
  );
}
