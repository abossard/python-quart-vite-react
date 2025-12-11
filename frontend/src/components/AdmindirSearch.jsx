/**
 * AdmindirSearch Component
 * 
 * Autocomplete search for users in admindir.verzeichnisse.admin.ch
 */

import { useState, useEffect, useRef } from 'react'
import {
  makeStyles,
  tokens,
  Input,
  Spinner,
  Text,
} from '@fluentui/react-components'
import { Search24Regular, Dismiss24Regular, Person24Regular } from '@fluentui/react-icons'
import { searchAdmindirUsers } from '../services/api'

const useStyles = makeStyles({
  container: {
    position: 'relative',
    width: '100%',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  input: {
    width: '100%',
    paddingRight: '60px',
  },
  searchIcon: {
    position: 'absolute',
    right: '36px',
    color: tokens.colorNeutralForeground3,
    pointerEvents: 'none',
  },
  clearButton: {
    position: 'absolute',
    right: '8px',
    minWidth: '24px',
    height: '24px',
    padding: 0,
    border: 'none',
    backgroundColor: 'transparent',
    color: tokens.colorNeutralForeground3,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.borderRadiusCircular,
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      color: tokens.colorNeutralForeground1,
    },
  },
  spinner: {
    position: 'absolute',
    right: '12px',
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    maxHeight: '300px',
    overflowY: 'auto',
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow16,
    zIndex: 1000,
  },
  dropdownItem: {
    padding: tokens.spacingVerticalM,
    cursor: 'pointer',
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    alignItems: 'flex-start',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
    ':last-child': {
      borderBottom: 'none',
    },
  },
  dropdownItemSelected: {
    padding: tokens.spacingVerticalM,
    cursor: 'pointer',
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    alignItems: 'flex-start',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorBrandBackground2,
    ':last-child': {
      borderBottom: 'none',
    },
  },
  personIcon: {
    marginTop: '2px',
    color: tokens.colorBrandForeground1,
  },
  itemContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
  },
  itemName: {
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  itemDetails: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  noResults: {
    padding: tokens.spacingVerticalL,
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
  },
})

export default function AdmindirSearch({ onSelect, placeholder = 'Benutzer suchen...' }) {
  const styles = useStyles()
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [error, setError] = useState(null)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const containerRef = useRef(null)
  const debounceTimer = useRef(null)

  // Handle search with debounce
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    if (searchTerm.trim().length < 2) {
      setResults([])
      setShowDropdown(false)
      return
    }

    debounceTimer.current = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await searchAdmindirUsers(searchTerm)
        // Transform the API response into a flat list of persons (email is already included from backend)
        const persons = data.persons || []
        setResults(persons)
        setSelectedIndex(-1) // Reset selection when new results arrive
        setShowDropdown(true)
      } catch (err) {
        setError(err.message)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 500)

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [searchTerm])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = async (person) => {
    setLoading(true)
    try {
      // Fetch full person details from admindir
      const response = await fetch(`http://localhost:5001/api/admindir/person/${person.id}`, {
        credentials: 'include',
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('Full person details from admindir:', data)
        
        // Extract person from result array
        const personDetails = data.result && data.result[0] ? data.result[0] : data
        
        // Generate username from first 2 letters of surname + first 2 letters of givenName
        // Example: Alessandro Roschi -> roal (ro from Roschi, al from Alessandro)
        const generateUsername = (surname, givenName) => {
          const surnamePrefix = (surname || '').substring(0, 2).toLowerCase()
          const givenNamePrefix = (givenName || '').substring(0, 2).toLowerCase()
          return surnamePrefix + givenNamePrefix
        }
        
        // Extract and normalize person data from new API format
        const normalizedPerson = {
          id: personDetails.id || person.id,
          firstname: personDetails.givenName || '',
          lastname: personDetails.surname || '',
          name: `${personDetails.givenName || ''} ${personDetails.surname || ''}`.trim() || person.result,
          email: personDetails.email || '',
          phone: personDetails.phone || '',
          mobile: personDetails.mobile || '',
          // Organization structure from new API
          department: personDetails.department?.nameAbbr?.german || personDetails.department?.name?.german || '',
          organization: personDetails.organization?.nameAbbr?.german || personDetails.organization?.name?.german || '',
          division: personDetails.division?.nameAbbr?.german || personDetails.division?.name?.german || '',
          title: personDetails.function?.german || '',
          // Username: first 2 letters of surname + first 2 letters of givenName
          username: generateUsername(personDetails.surname, personDetails.givenName),
        }
        
        onSelect(normalizedPerson)
      } else {
        // Fallback: just pass the basic info
        onSelect({
          name: person.result,
          id: person.id,
        })
      }
    } catch (err) {
      console.error('Failed to fetch person details:', err)
      // Fallback: just pass the basic info
      onSelect({
        name: person.result,
        id: person.id,
      })
    } finally {
      setLoading(false)
      setSearchTerm('')
      setShowDropdown(false)
      setResults([])
    }
  }

  const handleClear = () => {
    setSearchTerm('')
    setResults([])
    setShowDropdown(false)
    setError(null)
    setSelectedIndex(-1)
  }

  const handleKeyDown = (e) => {
    if (!showDropdown || results.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelect(results[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowDropdown(false)
        setSelectedIndex(-1)
        break
      default:
        break
    }
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.inputWrapper}>
        <Input
          className={styles.input}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
        />
        {!loading && <Search24Regular className={styles.searchIcon} />}
        {loading && <Spinner size="tiny" className={styles.spinner} />}
        {searchTerm && !loading && (
          <button className={styles.clearButton} onClick={handleClear} aria-label="Clear">
            <Dismiss24Regular />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className={styles.dropdown}>
          {error && (
            <div className={styles.noResults}>
              <Text>{error}</Text>
            </div>
          )}
          {!error && results.length === 0 && !loading && (
            <div className={styles.noResults}>
              <Text>Keine Ergebnisse gefunden</Text>
            </div>
          )}
          {!error && results.length > 0 && results.map((person, index) => (
            <div
              key={person.id || index}
              className={index === selectedIndex ? styles.dropdownItemSelected : styles.dropdownItem}
              onClick={() => handleSelect(person)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <Person24Regular className={styles.personIcon} />
              <div className={styles.itemContent}>
                <div className={styles.itemName}>
                  {person.result}
                </div>
                <div className={styles.itemDetails}>
                  <div>{person.email || 'Keine E-Mail verfügbar'}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
