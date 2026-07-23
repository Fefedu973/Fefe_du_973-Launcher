import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import electronPath from 'electron'
import { _electron as electron } from 'playwright-core'

const projectRoot = path.resolve(import.meta.dirname, '..')
const artifactsDir = path.join(projectRoot, '.artifacts')
const userDataDir = await mkdtemp(path.join(tmpdir(), 'fefe-launcher-ui-'))
const errors = []
const packaged = process.argv.includes('--packaged')
const online = process.argv.includes('--online')
const packagedExecutable = path.join(projectRoot, 'release', 'win-unpacked', 'Fefe du 973 Launcher.exe')
const adminToolUrl = online ? 'https://eml-launcher.mc.fefe-du-973.fr' : 'http://127.0.0.1:9'

await mkdir(artifactsDir, { recursive: true })

const application = await electron.launch({
  cwd: projectRoot,
  executablePath: packaged ? packagedExecutable : electronPath,
  args: packaged ? [`--user-data-dir=${userDataDir}`] : ['.', `--user-data-dir=${userDataDir}`],
  env: {
    ...process.env,
    EML_ADMINTOOL_URL: adminToolUrl
  }
})

try {
  const page = await application.firstWindow()
  page.on('console', (message) => {
    const text = message.text()
    const expectedOfflineError = /Failed to (fetch background|fetch maintenance|fetch profiles|fetch news)/.test(text)
    const expectedServerStatusError = /Failed to get server status/.test(text)
    if (message.type() === 'error' && !expectedServerStatusError && (online || !expectedOfflineError)) errors.push(`console: ${text}`)
  })
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`))

  await page.locator('#view-login.active').waitFor({ timeout: 15_000 })
  await page.locator('body.loaded').waitFor()
  await page.waitForTimeout(700)
  const screenshotSuffix = `${online ? 'online' : 'offline'}${packaged ? '-packaged' : ''}`
  await page.screenshot({ path: path.join(artifactsDir, `login-${screenshotSuffix}.png`) })

  await page.locator('#offline-username').fill('TestPlayer')
  await page.locator('#btn-login-offline').click()
  await page.locator('#view-home.active').waitFor({ timeout: 10_000 })
  if (online) {
    await page.locator('#current-profile-name').getByText('Better Minecraft', { exact: true }).waitFor({ timeout: 15_000 })
    await page.waitForFunction(() => {
      const playButton = document.querySelector('#btn-play')
      return playButton instanceof HTMLButtonElement && !playButton.disabled
    })
    await page.waitForFunction(() => document.querySelector('#server-status-text')?.textContent !== 'Vérification...', undefined, { timeout: 20_000 })
  }
  await page.screenshot({ path: path.join(artifactsDir, `home-${screenshotSuffix}.png`) })

  if (errors.length > 0) {
    throw new Error(errors.join('\n'))
  }
} finally {
  await application.close()
  await rm(userDataDir, { recursive: true, force: true })
}
