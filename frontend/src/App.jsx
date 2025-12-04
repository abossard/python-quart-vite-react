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
import History from './features/history/History'
import MissingDevices from './features/missing/MissingDevices'

// Map routes to page keys for AppShell
const routeToPageMap = {
  '/dashboard': 'overview',
  '/history': 'history',
  '/missing': 'missing',
  '/devices': 'devices',
  '/users': 'users',
  '/departments': 'departments',
  '/amts': 'amts',
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
  const location = useLocation()
  const navigate = useNavigate()
  
  const currentPage = routeToPageMap[location.pathname] || 'overview'
  
  const handleNavigate = (pageKey) => {
    const route = pageToRouteMap[pageKey]
    if (route) {
      navigate(route)
    }
  }

  return (
    <AppShell currentPage={currentPage} onNavigate={handleNavigate}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/history" element={<History />} />
        <Route path="/missing" element={<MissingDevices />} />
        <Route path="/devices" element={<DeviceList />} />
        <Route path="/users" element={<UserList />} />
        <Route path="/departments" element={<DepartmentList />} />
        <Route path="/amts" element={<AmtList />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppShell>
  )
}
