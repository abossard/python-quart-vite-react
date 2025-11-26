/**
 * AI Chat Component
 *
 * Interactive chat interface for AI-assisted development
 * Connected to GitHub Copilot for efficient site development
 */

import { useState, useRef, useEffect } from 'react'
import {
  Card,
  CardHeader,
  Text,
  makeStyles,
  tokens,
  Textarea,
  Button,
  Spinner,
} from '@fluentui/react-components'
import { Bot24Regular, Send24Regular, Person24Regular } from '@fluentui/react-icons'

const useStyles = makeStyles({
  container: {
    padding: tokens.spacingVerticalL,
    backgroundColor: 'var(--bg-color)',
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    height: 'calc(100vh - 200px)',
  },
  header: {
    backgroundColor: 'var(--text-color)',
    padding: tokens.spacingVerticalL,
    border: '2px solid var(--bg-color)',
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: 'var(--bg-color)',
  },
  chatContainer: {
    flex: 1,
    backgroundColor: 'var(--text-color)',
    border: '2px solid var(--bg-color)',
    padding: tokens.spacingVerticalL,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  message: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
  },
  userMessage: {
    backgroundColor: 'var(--bg-color)',
    alignSelf: 'flex-end',
    maxWidth: '70%',
  },
  aiMessage: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignSelf: 'flex-start',
    maxWidth: '80%',
  },
  messageIcon: {
    color: 'var(--bg-color)',
    flexShrink: 0,
  },
  messageContent: {
    color: 'var(--bg-color)',
    flex: 1,
  },
  inputContainer: {
    backgroundColor: 'var(--text-color)',
    border: '2px solid var(--bg-color)',
    padding: tokens.spacingVerticalL,
    display: 'flex',
    gap: tokens.spacingHorizontalM,
  },
  textarea: {
    flex: 1,
    backgroundColor: 'var(--bg-color)',
    color: 'var(--text-color)',
  },
  sendButton: {
    backgroundColor: 'var(--button-bg)',
    color: 'var(--text-color)',
    alignSelf: 'flex-end',
  },
  welcomeMessage: {
    textAlign: 'center',
    color: 'var(--bg-color)',
    padding: tokens.spacingVerticalXXL,
  },
  suggestion: {
    padding: tokens.spacingVerticalS,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: tokens.borderRadiusSmall,
    color: 'var(--bg-color)',
    cursor: 'pointer',
    marginTop: tokens.spacingVerticalS,
    border: '1px solid var(--bg-color)',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
  },
})

const suggestions = [
  "Füge eine neue Komponente für Benutzerprofile hinzu",
  "Verbessere das Design der Task-Liste",
  "Erstelle einen Export-Button für alle Tasks als CSV",
  "Füge Dark/Light Mode Toggle hinzu",
  "Implementiere eine Suchfunktion für Tasks",
  "Erstelle Statistik-Diagramme mit Chart.js",
]

export default function AIChat() {
  const styles = useStyles()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const chatEndRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isThinking) return

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsThinking(true)

    // Simulate AI response
    setTimeout(() => {
      const aiResponse = generateAIResponse(userMessage.content)
      const aiMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: aiResponse,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, aiMessage])
      setIsThinking(false)
    }, 1500)
  }

  const generateAIResponse = (userInput) => {
    const input = userInput.toLowerCase()

    if (input.includes('komponente') || input.includes('component')) {
      return `Natürlich! Um eine neue Komponente zu erstellen:

1. Erstelle eine neue Datei in \`frontend/src/features/[feature-name]/[ComponentName].jsx\`
2. Importiere die benötigten FluentUI Komponenten
3. Verwende die CSS-Variablen (var(--bg-color), var(--text-color)) für konsistentes Theming
4. Füge die Route in \`App.jsx\` hinzu
5. Registriere einen neuen Tab in der Navigation

Möchtest du, dass ich dir ein konkretes Beispiel generiere?`
    }

    if (input.includes('design') || input.includes('style')) {
      return `Für Design-Verbesserungen empfehle ich:

1. **FluentUI Tokens**: Nutze die vordefinierten Design-Tokens für Abstände und Größen
2. **CSS-Variablen**: Alle Farben sind bereits als CSS-Variablen definiert
3. **Responsive Grid**: Verwende CSS Grid oder Flexbox für responsive Layouts
4. **makeStyles**: FluentUI's makeStyles Hook für typsichere Styles

Welchen spezifischen Bereich möchtest du verbessern?`
    }

    if (input.includes('export') || input.includes('csv')) {
      return `CSV-Export implementieren:

\`\`\`javascript
// In services/api.js
export function exportTasksAsCSV(tasks) {
  const headers = ['ID', 'Title', 'Priority', 'Status', 'Created']
  const rows = tasks.map(t => [
    t.id, t.title, t.priority, 
    t.completed ? 'Done' : 'Pending',
    new Date(t.created_at).toLocaleDateString()
  ])
  
  const csv = [headers, ...rows]
    .map(row => row.join(','))
    .join('\\n')
  
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'tasks.csv'
  a.click()
}
\`\`\`

Soll ich das in die TaskList-Komponente integrieren?`
    }

    if (input.includes('dark') || input.includes('mode') || input.includes('theme')) {
      return `Das Theme-System ist bereits implementiert! 🎨

Aktuell gibt es 15 verschiedene Farbthemen mit weißem Hintergrund, die beim Laden zufällig ausgewählt werden.

Um ein manuelles Theme-Switching hinzuzufügen:
1. Erstelle einen Theme-Selector in der Header-Komponente
2. Verwende die \`applyTheme()\` Funktion aus \`utils/colorThemes.js\`
3. Speichere die Auswahl im localStorage

Möchtest du einen Theme-Switcher Button?`
    }

    if (input.includes('such') || input.includes('search') || input.includes('filter')) {
      return `Suchfunktion für Tasks:

Die TaskList hat bereits Filter für Status (All/Completed/Pending) und Sortierung.

Für eine Volltext-Suche:
1. Füge ein SearchBox Component hinzu
2. Filtere Tasks basierend auf \`task.title\` und \`task.description\`
3. Nutze \`toLowerCase()\` für case-insensitive Suche
4. Zeige die Anzahl der gefundenen Ergebnisse

\`\`\`javascript
const searchResults = tasks.filter(t => 
  t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
  t.description.toLowerCase().includes(searchTerm.toLowerCase())
)
\`\`\`

Soll ich das implementieren?`
    }

    if (input.includes('chart') || input.includes('diagram') || input.includes('graph')) {
      return `Statistik-Diagramme hinzufügen:

1. Installiere: \`npm install recharts\`
2. Erstelle ein Dashboard-Widget für Charts
3. Nutze die \`getTaskOverview()\` API für Daten

Beispiel-Komponenten:
- PieChart für Priority-Verteilung
- BarChart für Completed vs Pending
- LineChart für Tasks über Zeit

Die Daten sind bereits über \`/api/tasks/overview\` verfügbar!

Möchtest du ein konkretes Diagramm?`
    }

    if (input.includes('backend') || input.includes('api') || input.includes('endpoint')) {
      return `Backend-Entwicklung mit Quart & Pydantic:

**Neuen Endpoint hinzufügen:**
1. Definiere ein Pydantic Model in \`backend/tasks.py\`
2. Erstelle eine \`@operation\` in \`backend/app.py\`
3. Füge die REST-Route hinzu
4. Die Validierung erfolgt automatisch!

**Aktuell verfügbare Endpoints:**
- GET /api/tasks - Liste Tasks
- POST /api/tasks - Erstelle Task
- PUT /api/tasks/{id} - Update Task
- DELETE /api/tasks/{id} - Lösche Task
- GET /api/tasks/stats - Statistiken
- GET /api/tasks/overview - Detaillierte Übersicht

Was möchtest du erweitern?`
    }

    // Default response
    return `Ich bin dein AI-Entwicklungsassistent! 🤖

Ich kann dir helfen mit:
- Neue Komponenten und Features erstellen
- Design und UX verbessern
- Backend-Endpoints erweitern
- Code-Optimierungen vorschlagen
- Best Practices erklären

**Aktuelle Tech-Stack:**
- Frontend: React + FluentUI + Vite
- Backend: Python Quart + Pydantic
- Styling: CSS Variables für dynamisches Theming

Stelle mir eine konkrete Frage oder wähle einen Vorschlag unten!`
  }

  const handleSuggestionClick = (suggestion) => {
    setInput(suggestion)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className={styles.container}>
      <Card className={styles.header}>
        <div className={styles.headerTitle}>
          <Bot24Regular style={{ fontSize: '32px' }} />
          <div>
            <Text weight="bold" size={600} style={{ color: 'var(--bg-color)' }}>
              AI Entwicklungs-Assistent
            </Text>
            <Text size={300} style={{ color: 'var(--bg-color)', display: 'block' }}>
              Powered by GitHub Copilot - Stelle Fragen zur Weiterentwicklung
            </Text>
          </div>
        </div>
      </Card>

      <div className={styles.chatContainer}>
        {messages.length === 0 ? (
          <div className={styles.welcomeMessage}>
            <Bot24Regular style={{ fontSize: '64px', marginBottom: '16px' }} />
            <Text size={600} weight="bold" style={{ color: 'var(--bg-color)', display: 'block', marginBottom: '16px' }}>
              Willkommen beim AI Entwicklungs-Chat!
            </Text>
            <Text size={400} style={{ color: 'var(--bg-color)', display: 'block', marginBottom: '24px' }}>
              Ich helfe dir bei der effizienten Weiterentwicklung dieser Anwendung.
            </Text>
            <Text size={300} weight="semibold" style={{ color: 'var(--bg-color)', display: 'block', marginBottom: '8px' }}>
              Vorschläge zum Starten:
            </Text>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '8px', marginTop: '16px' }}>
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className={styles.suggestion}
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`${styles.message} ${
                  message.type === 'user' ? styles.userMessage : styles.aiMessage
                }`}
              >
                {message.type === 'user' ? (
                  <Person24Regular className={styles.messageIcon} />
                ) : (
                  <Bot24Regular className={styles.messageIcon} />
                )}
                <div className={styles.messageContent}>
                  <Text style={{ color: 'var(--bg-color)', whiteSpace: 'pre-wrap' }}>
                    {message.content}
                  </Text>
                </div>
              </div>
            ))}
            {isThinking && (
              <div className={`${styles.message} ${styles.aiMessage}`}>
                <Bot24Regular className={styles.messageIcon} />
                <Spinner label="AI denkt nach..." />
              </div>
            )}
            <div ref={chatEndRef} />
          </>
        )}
      </div>

      <Card className={styles.inputContainer}>
        <Textarea
          className={styles.textarea}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Frage nach neuen Features, Verbesserungen, Code-Beispielen..."
          rows={3}
          resize="vertical"
        />
        <Button
          appearance="primary"
          icon={<Send24Regular />}
          onClick={handleSend}
          disabled={!input.trim() || isThinking}
          className={styles.sendButton}
        >
          Senden
        </Button>
      </Card>
    </div>
  )
}
