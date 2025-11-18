/**
 * About Component
 *
 * Information about the project and technologies used
 * Demonstrates FluentUI Accordion and Link components
 */

import {
  Card,
  Text,
  makeStyles,
  tokens,
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Link,
  Body1,
} from '@fluentui/react-components'
import { Code24Regular } from '@fluentui/react-icons'

const useStyles = makeStyles({
  container: {
    padding: tokens.spacingVerticalL,
  },
  card: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: tokens.spacingVerticalXL,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalL,
  },
  section: {
    marginBottom: tokens.spacingVerticalL,
  },
  techList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  techItem: {
    padding: tokens.spacingVerticalS,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
  },
  codeBlock: {
    backgroundColor: tokens.colorNeutralBackground5,
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    fontFamily: 'monospace',
    fontSize: '14px',
    overflowX: 'auto',
  },
})

export default function About() {
  const styles = useStyles()

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <div className={styles.header}>
          <Code24Regular fontSize={32} />
          <Text size={600} weight="semibold">
            About This Project
          </Text>
        </div>

        <div className={styles.section}>
          <Body1>
            This is a modern full-stack web application demonstrating best practices in
            software development. It combines a Python Quart backend with a React frontend
            using Microsoft's FluentUI component library.
          </Body1>
        </div>

        <Accordion multiple collapsible>
          <AccordionItem value="technologies">
            <AccordionHeader>Technologies Used</AccordionHeader>
            <AccordionPanel>
              <ul className={styles.techList}>
                <li className={styles.techItem}>
                  <Text weight="semibold">Backend:</Text>
                  <Text> Python Quart (async web framework)</Text>
                </li>
                <li className={styles.techItem}>
                  <Text weight="semibold">Frontend:</Text>
                  <Text> React 18 with Vite build tool</Text>
                </li>
                <li className={styles.techItem}>
                  <Text weight="semibold">UI Framework:</Text>
                  <Text> FluentUI v9 (Microsoft Design System)</Text>
                </li>
                <li className={styles.techItem}>
                  <Text weight="semibold">Testing:</Text>
                  <Text> Playwright for E2E tests</Text>
                </li>
              </ul>
            </AccordionPanel>
          </AccordionItem>

          <AccordionItem value="features">
            <AccordionHeader>Features Demonstrated</AccordionHeader>
            <AccordionPanel>
              <ul className={styles.techList}>
                <li className={styles.techItem}>
                  <Text weight="semibold">Server-Sent Events (SSE):</Text>
                  <Text> Real-time time updates from server</Text>
                </li>
                <li className={styles.techItem}>
                  <Text weight="semibold">RESTful API:</Text>
                  <Text> Full CRUD operations for task management</Text>
                </li>
                <li className={styles.techItem}>
                  <Text weight="semibold">FluentUI Components:</Text>
                  <Text> Cards, DataGrid, Dialogs, Tabs, Forms</Text>
                </li>
                <li className={styles.techItem}>
                  <Text weight="semibold">Clean Architecture:</Text>
                  <Text> Separation of concerns, pure functions</Text>
                </li>
              </ul>
            </AccordionPanel>
          </AccordionItem>

          <AccordionItem value="principles">
            <AccordionHeader>Design Principles</AccordionHeader>
            <AccordionPanel>
              <Text weight="semibold" block style={{ marginBottom: '12px' }}>
                This project follows principles from:
              </Text>
              <ul className={styles.techList}>
                <li className={styles.techItem}>
                  <Text weight="semibold">Grokking Simplicity:</Text>
                  <ul style={{ marginTop: '8px', marginLeft: '20px' }}>
                    <li>Separate actions (I/O) from calculations (pure functions)</li>
                    <li>Keep data immutable where possible</li>
                    <li>Make side effects explicit and isolated</li>
                  </ul>
                </li>
                <li className={styles.techItem}>
                  <Text weight="semibold">A Philosophy of Software Design:</Text>
                  <ul style={{ marginTop: '8px', marginLeft: '20px' }}>
                    <li>Deep modules with simple interfaces</li>
                    <li>Information hiding and abstraction</li>
                    <li>Clear module boundaries</li>
                  </ul>
                </li>
              </ul>
            </AccordionPanel>
          </AccordionItem>

          <AccordionItem value="api">
            <AccordionHeader>API Endpoints</AccordionHeader>
            <AccordionPanel>
              <div className={styles.codeBlock}>
                <Text block>GET /api/health - Health check</Text>
                <Text block>GET /api/date - Current server date/time</Text>
                <Text block>GET /api/time-stream - SSE time stream</Text>
                <Text block style={{ marginTop: '12px' }}>
                  GET /api/tasks - List all tasks
                </Text>
                <Text block>POST /api/tasks - Create new task</Text>
                <Text block>GET /api/tasks/:id - Get specific task</Text>
                <Text block>PUT /api/tasks/:id - Update task</Text>
                <Text block>DELETE /api/tasks/:id - Delete task</Text>
              </div>
            </AccordionPanel>
          </AccordionItem>

          <AccordionItem value="resources">
            <AccordionHeader>Learning Resources</AccordionHeader>
            <AccordionPanel>
              <ul className={styles.techList}>
                <li className={styles.techItem}>
                  <Link href="https://quart.palletsprojects.com/" target="_blank">
                    Quart Documentation
                  </Link>
                </li>
                <li className={styles.techItem}>
                  <Link href="https://react.dev/" target="_blank">
                    React Documentation
                  </Link>
                </li>
                <li className={styles.techItem}>
                  <Link
                    href="https://react.fluentui.dev/?path=/docs/concepts-introduction--page"
                    target="_blank"
                  >
                    FluentUI Documentation
                  </Link>
                </li>
                <li className={styles.techItem}>
                  <Link href="https://vitejs.dev/" target="_blank">
                    Vite Documentation
                  </Link>
                </li>
                <li className={styles.techItem}>
                  <Link href="https://playwright.dev/" target="_blank">
                    Playwright Documentation
                  </Link>
                </li>
              </ul>
            </AccordionPanel>
          </AccordionItem>
        </Accordion>
      </Card>
    </div>
  )
}
