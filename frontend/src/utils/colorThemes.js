/**
 * High Contrast Color Themes
 * White background with colorful text options
 */

export const colorThemes = [
  {
    name: 'Classic Black',
    background: '#FFFFFF',
    text: '#000000',
    button: '#4A4A4A'
  },
  {
    name: 'Deep Blue',
    background: '#FFFFFF',
    text: '#001F3F',
    button: '#1E90FF'
  },
  {
    name: 'Royal Purple',
    background: '#FFFFFF',
    text: '#4B0082',
    button: '#9370DB'
  },
  {
    name: 'Forest Green',
    background: '#FFFFFF',
    text: '#0A4A0A',
    button: '#32CD32'
  },
  {
    name: 'Chocolate Brown',
    background: '#FFFFFF',
    text: '#3E2723',
    button: '#8B4513'
  },
  {
    name: 'Slate Gray',
    background: '#FFFFFF',
    text: '#2C3E50',
    button: '#78909C'
  },
  {
    name: 'Wine Red',
    background: '#FFFFFF',
    text: '#8B0000',
    button: '#DC143C'
  },
  {
    name: 'Steel Blue',
    background: '#FFFFFF',
    text: '#263238',
    button: '#4169E1'
  },
  {
    name: 'Deep Teal',
    background: '#FFFFFF',
    text: '#004D4D',
    button: '#20B2AA'
  },
  {
    name: 'Navy Blue',
    background: '#FFFFFF',
    text: '#0D1B2A',
    button: '#4682B4'
  },
  {
    name: 'Emerald',
    background: '#FFFFFF',
    text: '#0D5028',
    button: '#2ECC71'
  },
  {
    name: 'Charcoal',
    background: '#FFFFFF',
    text: '#1C1C1C',
    button: '#696969'
  },
  {
    name: 'Crimson',
    background: '#FFFFFF',
    text: '#990000',
    button: '#FF6347'
  },
  {
    name: 'Midnight Blue',
    background: '#FFFFFF',
    text: '#191970',
    button: '#6495ED'
  },
  {
    name: 'Dark Olive',
    background: '#FFFFFF',
    text: '#3D3D00',
    button: '#808000'
  }
]

export function getRandomTheme() {
  const randomIndex = Math.floor(Math.random() * colorThemes.length)
  return colorThemes[randomIndex]
}

export function applyTheme(theme) {
  // Smooth color transition
  document.documentElement.style.transition = 'background-color 0.5s ease, color 0.5s ease'
  document.documentElement.style.setProperty('--bg-color', theme.background)
  document.documentElement.style.setProperty('--text-color', theme.text)
  document.documentElement.style.setProperty('--button-bg', theme.button)
}
