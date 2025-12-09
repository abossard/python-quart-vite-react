/**
 * ProtectedRoute - Auth Guard für geschützte Routen
 * 
 * Leitet unangemeldete Benutzer zur Login-Seite um.
 * Zeigt nur freigegebene Inhalte basierend auf Benutzerrolle.
 */

import { Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Spinner } from '@fluentui/react-components'

export default function ProtectedRoute({ children, requiredRole = null }) {
  const location = useLocation()
  const [authState, setAuthState] = useState({
    loading: true,
    authenticated: false,
    user: null,
  })

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      console.log('Checking authentication...')
      
      const response = await fetch('http://localhost:5001/api/auth/session', {
        credentials: 'include',
      })

      console.log('Auth check response status:', response.status)

      if (response.ok) {
        const data = await response.json()
        console.log('Auth check successful, user:', data.user?.username)
        setAuthState({
          loading: false,
          authenticated: true,
          user: data.user,
        })
      } else {
        console.log('Auth check failed, not authenticated')
        setAuthState({
          loading: false,
          authenticated: false,
          user: null,
        })
      }
    } catch (error) {
      console.error('Auth check error:', error)
      setAuthState({
        loading: false,
        authenticated: false,
        user: null,
      })
    }
  }

  // Noch beim Laden
  if (authState.loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
      }}>
        <Spinner size="large" label="Wird geladen..." />
      </div>
    )
  }

  // Nicht authentifiziert -> Login
  if (!authState.authenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Rollenprüfung falls erforderlich
  if (requiredRole && authState.user?.role !== requiredRole) {
    // User hat nicht die erforderliche Rolle
    return <Navigate to="/" replace />
  }

  // Authentifiziert und berechtigt -> Inhalt anzeigen
  return children
}
