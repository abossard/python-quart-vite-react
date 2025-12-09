/**
 * Login Page - Zentrale Anmeldeseite für Grabit
 * 
 * Gatekeeper für das gesamte System.
 * Unangemeldete Benutzer sehen nur diese Seite.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  makeStyles,
  tokens,
  Input,
  Button,
  Checkbox,
  MessageBar,
  MessageBarBody,
  Spinner,
} from '@fluentui/react-components'
import {
  Eye24Regular,
  EyeOff24Regular,
  Shield24Regular,
} from '@fluentui/react-icons'

const useStyles = makeStyles({
  container: {
    minHeight: '100vh',
    backgroundColor: '#F8F9FA',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacingVerticalXXL,
  },
  
  card: {
    width: '100%',
    maxWidth: '440px',
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    padding: '48px',
  },
  
  logoContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '32px',
  },
  
  iconWrapper: {
    width: '80px',
    height: '80px',
    backgroundColor: '#F8F9FA',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  
  icon: {
    fontSize: '48px',
    color: '#DC3545',
  },
  
  brandText: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#0D6EFD',
    marginBottom: '8px',
  },
  
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#111111',
    marginBottom: '8px',
    textAlign: 'center',
  },
  
  subtitle: {
    fontSize: '14px',
    color: '#6C757D',
    textAlign: 'center',
    marginBottom: '32px',
  },
  
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  
  fieldContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#111111',
  },
  
  inputWrapper: {
    position: 'relative',
  },
  
  input: {
    width: '100%',
    fontSize: '14px',
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #D2D2D2',
    ':focus': {
      borderTopColor: '#0D6EFD',
      borderRightColor: '#0D6EFD',
      borderBottomColor: '#0D6EFD',
      borderLeftColor: '#0D6EFD',
      outline: 'none',
    },
  },
  
  passwordInput: {
    width: '100%',
    fontSize: '14px',
    padding: '10px 40px 10px 12px',
    borderRadius: '6px',
    border: '1px solid #D2D2D2',
    ':focus': {
      borderTopColor: '#0D6EFD',
      borderRightColor: '#0D6EFD',
      borderBottomColor: '#0D6EFD',
      borderLeftColor: '#0D6EFD',
      outline: 'none',
    },
  },
  
  eyeButton: {
    position: 'absolute',
    right: '8px',
    top: '50%',
    transform: 'translateY(-50%)',
    minWidth: '32px',
    height: '32px',
    padding: 0,
    border: 'none',
    backgroundColor: 'transparent',
    color: '#6C757D',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ':hover': {
      backgroundColor: '#F8F9FA',
      color: '#111111',
    },
  },
  
  rememberMe: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  
  loginButton: {
    width: '100%',
    height: '44px',
    fontSize: '16px',
    fontWeight: '600',
    backgroundColor: '#0D6EFD',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    ':hover': {
      backgroundColor: '#0B5ED7',
    },
    ':active': {
      backgroundColor: '#0A58CA',
    },
    ':disabled': {
      backgroundColor: '#D2D2D2',
      cursor: 'not-allowed',
    },
  },
  
  footer: {
    marginTop: '32px',
    textAlign: 'center',
    fontSize: '12px',
    color: '#6C757D',
  },
  
  errorMessage: {
    marginBottom: '16px',
  },
  
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
})

export default function Login() {
  const styles = useStyles()
  const navigate = useNavigate()
  
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      console.log('Attempting login with username:', username)
      
      const response = await fetch('http://localhost:5001/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          username,
          password,
          remember_me: rememberMe,
        }),
      })

      console.log('Login response status:', response.status)
      
      const data = await response.json()
      console.log('Login response data:', data)

      if (!response.ok) {
        throw new Error(data.error || 'Login fehlgeschlagen')
      }

      // Erfolgreicher Login - Session ist im Cookie gespeichert
      console.log('Login successful, redirecting to dashboard')
      
      // Kurz warten, damit Cookie gesetzt wird
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Redirect zur Dashboard-Seite
      navigate('/', { replace: true })
    } catch (err) {
      console.error('Login error:', err)
      setError(err.message || 'Ein Fehler ist aufgetreten')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* Logo & Branding */}
        <div className={styles.logoContainer}>
          <div className={styles.iconWrapper}>
            <img 
              src="/images/logo-mobile.svg" 
              alt="Grabit Logo" 
              style={{ width: '64px', height: '64px' }}
            />
          </div>
          <div className={styles.brandText}>Grabit</div>
          <div className={styles.title}>Anmelden</div>
          <div className={styles.subtitle}>Melde dich bei Grabit an</div>
        </div>

        {/* Error Message */}
        {error && (
          <MessageBar intent="error" className={styles.errorMessage}>
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Benutzername */}
          <div className={styles.fieldContainer}>
            <label htmlFor="username" className={styles.label}>
              Benutzername
            </label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Benutzername eingeben"
              required
              disabled={loading}
              className={styles.input}
            />
          </div>

          {/* Passwort */}
          <div className={styles.fieldContainer}>
            <label htmlFor="password" className={styles.label}>
              Passwort
            </label>
            <div className={styles.inputWrapper}>
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Passwort eingeben"
                required
                disabled={loading}
                className={styles.passwordInput}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={styles.eyeButton}
                aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                disabled={loading}
              >
                {showPassword ? <EyeOff24Regular /> : <Eye24Regular />}
              </button>
            </div>
          </div>

          {/* Remember Me */}
          <div className={styles.rememberMe}>
            <Checkbox
              id="rememberMe"
              checked={rememberMe}
              onChange={(e, data) => setRememberMe(data.checked)}
              label="Angemeldet bleiben"
              disabled={loading}
            />
          </div>

          {/* Login Button */}
          <Button
            type="submit"
            appearance="primary"
            disabled={loading || !username || !password}
            className={styles.loginButton}
          >
            {loading ? (
              <div className={styles.loadingContainer}>
                <Spinner size="tiny" />
                <span>Anmelden...</span>
              </div>
            ) : (
              'Login'
            )}
          </Button>
        </form>

        {/* Footer */}
        <div className={styles.footer}>© 2025 Grabit</div>
      </div>
    </div>
  )
}
