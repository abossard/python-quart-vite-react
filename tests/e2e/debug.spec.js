import { test } from '@playwright/test'

test('debug - check what loads', async ({ page }) => {
  // Capture all console messages
  page.on('console', msg => {
    console.log(`[${msg.type()}] ${msg.text()}`)
  })

  // Capture page errors
  page.on('pageerror', error => {
    console.log(`[PAGE ERROR] ${error.message}`)
  })

  // Go to the page
  console.log('Navigating to http://localhost:3000')
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' })

  // Wait a bit
  await page.waitForTimeout(5000)

  // Get the HTML
  const html = await page.content()
  console.log('Page HTML length:', html.length)
  console.log('Page title:', await page.title())

  // Take a screenshot
  await page.screenshot({ path: 'debug-screenshot.png', fullPage: true })

  console.log('Screenshot saved to debug-screenshot.png')
})
