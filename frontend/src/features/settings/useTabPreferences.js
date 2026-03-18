/**
 * useTabPreferences — Custom hook for persisting tab customization.
 *
 * Stores in localStorage: { hidden: string[], order: string[], icons: Record<string, string> }
 * Provides: visibleTabs (filtered+sorted), toggle, reorder, setIcon, reset.
 */

import { createElement, useCallback, useMemo, useState } from 'react'
import { ICON_MAP } from './iconMap'

const STORAGE_KEY = 'tabPreferences'

function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function savePrefs(prefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
}

/**
 * @param {Array} allTabs - The full unfiltered tabs array from App.jsx
 *   Each tab: { value, label, icon, path, testId, defaultIconName }
 */
export default function useTabPreferences(allTabs) {
  const [prefs, setPrefs] = useState(loadPrefs)

  const hidden = prefs.hidden || []
  const order = prefs.order || []
  const icons = prefs.icons || {}

  const update = useCallback((fn) => {
    setPrefs((prev) => {
      const next = fn(prev)
      savePrefs(next)
      return next
    })
  }, [])

  const toggleHidden = useCallback((tabValue) => {
    update((p) => {
      const h = p.hidden || []
      const next = h.includes(tabValue) ? h.filter((v) => v !== tabValue) : [...h, tabValue]
      return { ...p, hidden: next }
    })
  }, [update])

  const setOrder = useCallback((newOrder) => {
    update((p) => ({ ...p, order: newOrder }))
  }, [update])

  const setIcon = useCallback((tabValue, iconName) => {
    update((p) => ({
      ...p,
      icons: { ...p.icons, [tabValue]: iconName },
    }))
  }, [update])

  const resetAll = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setPrefs({})
  }, [])

  // Apply preferences: resolve icon overrides, filter hidden, sort by order
  const visibleTabs = useMemo(() => {
    const withIcons = allTabs.map((tab) => {
      const overrideKey = icons[tab.value]
      if (overrideKey && ICON_MAP[overrideKey]) {
        return { ...tab, icon: createElement(ICON_MAP[overrideKey]) }
      }
      return tab
    })

    const filtered = withIcons.filter((t) => !hidden.includes(t.value))

    if (order.length === 0) return filtered

    return [...filtered].sort((a, b) => {
      const ai = order.indexOf(a.value)
      const bi = order.indexOf(b.value)
      if (ai === -1 && bi === -1) return 0
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
  }, [allTabs, hidden, order, icons])

  return {
    visibleTabs,
    allTabs,
    hidden,
    order,
    icons,
    toggleHidden,
    setOrder,
    setIcon,
    resetAll,
  }
}
