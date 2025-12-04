/**
 * Custom Fluent UI Theme für Grabit
 * 
 * Basiert auf webLightTheme mit Overrides für:
 * - Border Radius: 8px für Cards/Buttons
 * - Shadows: Stärkere Schatten für Tiefenwirkung
 * - Status-Backgrounds: Subtle danger/success/warning
 */

import { webLightTheme, createLightTheme } from '@fluentui/react-components'

// Status-Background-Farben (subtle)
export const statusBackgrounds = {
  dangerSubtle: '#FEF0F0',      // sehr helles rot/rosa
  successSubtle: '#F0F9F4',     // sehr helles grün
  warningSubtle: '#FFF9E6',     // sehr helles gelb
  neutralSubtle: '#F5F5F5',     // sehr hellgrau für Card-Header
}

// Custom Theme mit Token-Overrides
export const grabitTheme = {
  ...webLightTheme,
  
  // Border Radius: 8px für moderne, weiche Ecken
  borderRadiusSmall: '6px',
  borderRadiusMedium: '8px',
  borderRadiusLarge: '12px',
  borderRadiusXLarge: '16px',
  
  // Stärkere Shadows für mehr Tiefe (dezent aber erkennbar)
  shadow4: '0 2px 4px rgba(0, 0, 0, 0.08)',
  shadow8: '0 4px 8px rgba(0, 0, 0, 0.1)',
  shadow16: '0 8px 16px rgba(0, 0, 0, 0.12)',
  shadow28: '0 14px 28px rgba(0, 0, 0, 0.14)',
  shadow64: '0 32px 64px rgba(0, 0, 0, 0.16)',
  
  // Spacing: Konsistente, großzügige Abstände
  spacingHorizontalXS: '4px',
  spacingHorizontalS: '8px',
  spacingHorizontalM: '12px',
  spacingHorizontalL: '16px',
  spacingHorizontalXL: '24px',
  spacingHorizontalXXL: '32px',
  spacingHorizontalXXXL: '48px',
  
  spacingVerticalXS: '4px',
  spacingVerticalS: '8px',
  spacingVerticalM: '12px',
  spacingVerticalL: '16px',
  spacingVerticalXL: '24px',
  spacingVerticalXXL: '32px',
  spacingVerticalXXXL: '48px',
  
  // Farben
  colorNeutralBackground1: '#FFFFFF',           // App Background
  colorNeutralBackground2: '#FAFAFA',           // Card Background
  colorNeutralBackground3: statusBackgrounds.neutralSubtle, // Card Header
  
  // Status-spezifische Farben sind in statusBackgrounds definiert
  // und werden direkt in Komponenten verwendet
}

// Breakpoints für Responsive Design
export const breakpoints = {
  mobile: '768px',
  tablet: '1200px',
  desktop: '1200px',
}

// Helper für Media Queries
export const mediaQueries = {
  mobile: `@media (max-width: ${breakpoints.mobile})`,
  tablet: `@media (min-width: ${breakpoints.mobile}) and (max-width: ${breakpoints.tablet})`,
  desktop: `@media (min-width: ${breakpoints.desktop})`,
  notMobile: `@media (min-width: ${breakpoints.mobile})`,
}
