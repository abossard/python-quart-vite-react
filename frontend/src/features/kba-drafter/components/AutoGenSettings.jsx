/**
 * AutoGenSettings Component
 * 
 * Settings panel for automatic KBA draft generation configuration.
 * Allows users to enable/disable auto-generation and set daily limits.
 */

import { useState, useEffect } from 'react';
import { getAutoGenSettings, updateAutoGenSettings } from '../../../services/api';
import { ChevronDown20Regular, ChevronRight20Regular } from '@fluentui/react-icons';
import './AutoGenSettings.css';

export default function AutoGenSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAutoGenSettings();
      setSettings(data);
    } catch (err) {
      setError('Fehler beim Laden der Einstellungen: ' + err.message);
      console.error('Failed to load auto-gen settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (enabled) => {
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage('');
      
      const updated = await updateAutoGenSettings({ enabled });
      setSettings(updated);
      
      setSuccessMessage(
        enabled 
          ? 'Automatische Generierung aktiviert' 
          : 'Automatische Generierung deaktiviert'
      );
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Fehler beim Speichern: ' + err.message);
      console.error('Failed to update settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDailyLimitChange = async (newLimit) => {
    const limit = parseInt(newLimit, 10);
    
    // Validate range
    if (limit < 1 || limit > 50) {
      setError('Die Anzahl muss zwischen 1 und 50 liegen');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage('');
      
      const updated = await updateAutoGenSettings({ daily_limit: limit });
      setSettings(updated);
      
      setSuccessMessage('Tägliches Limit aktualisiert');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Fehler beim Speichern: ' + err.message);
      console.error('Failed to update daily limit:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="auto-gen-settings loading">
        <div className="spinner"></div>
        <p>Lade Einstellungen...</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="auto-gen-settings error">
        <p>⚠️ Einstellungen konnten nicht geladen werden</p>
        <button onClick={loadSettings}>Erneut versuchen</button>
      </div>
    );
  }

  return (
    <div className={`auto-gen-settings ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div 
        className="settings-header" 
        onClick={() => setIsExpanded(!isExpanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <div className="settings-header-content">
          <h3>⚙️ Automatische KBA-Generierung</h3>
          <span className="status-badge-compact">
            {settings.enabled ? '🟢' : '⚫'}
          </span>
        </div>
        <div className="chevron-icon">
          {isExpanded ? <ChevronDown20Regular /> : <ChevronRight20Regular />}
        </div>
      </div>

      {isExpanded && (
        <div className="settings-collapsible-content">
          <p className="settings-description">
            KBA-Drafts werden täglich um {settings.schedule_time} Uhr automatisch aus 
            resolved/closed Tickets generiert.
          </p>

          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="alert alert-success">
              ✓ {successMessage}
            </div>
          )}

          <div className="settings-controls">
            <div className="setting-row">
              <label className="toggle-label">
                <span className="toggle-label-text">
                  Automatische Generierung
                </span>
                <button
                  className={`toggle-switch ${settings.enabled ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggle(!settings.enabled);
                  }}
                  disabled={saving}
                  aria-pressed={settings.enabled}
                >
                  <span className="toggle-slider"></span>
                </button>
              </label>
              <span className="status-badge">
                {settings.enabled ? '🟢 Aktiviert' : '⚫ Deaktiviert'}
              </span>
            </div>

            <div className="setting-row">
              <label htmlFor="daily-limit">
                Anzahl Drafts pro Tag:
              </label>
              <input
                id="daily-limit"
                type="number"
                min="1"
                max="50"
                value={settings.daily_limit}
                onChange={(e) => handleDailyLimitChange(e.target.value)}
                disabled={saving}
                className="daily-limit-input"
              />
            </div>

            {settings.last_run_at && (
              <div className="last-run-info">
                <p>
                  <strong>Letzte Ausführung:</strong>{' '}
                  {new Date(settings.last_run_at).toLocaleString('de-DE')}
                </p>
                {settings.last_run_count !== null && (
                  <p>
                    <strong>Generierte Drafts:</strong> {settings.last_run_count}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="settings-info">
            <p>
              ℹ️ <strong>Hinweis:</strong> Nur Tickets mit Status "Resolved" oder "Closed" 
              werden berücksichtigt. Tickets mit bestehenden Drafts werden übersprungen.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
