import { setBlockingView, setUser, setView } from './state'
import { auth, background, bootstraps, maintenance } from './ipc'
import logger from 'electron-log/renderer'
import { loadAccountAssets } from './account'
import defaultBackgroundUrl from './static/images/server-background.png?url'

const DEFAULT_BACKGROUND = defaultBackgroundUrl
const dateFormatOptions: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
}

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image()
    img.src = url
    img.onload = () => resolve()
    img.onerror = () => resolve()
  })
}

export async function bootstrap() {
  logger.log('Initializing Launcher...')

  const bgElement = document.querySelector('.app-background') as HTMLElement
  const maintenanceDates = document.getElementById('maintenance-dates')!
  const maintenanceReason = document.getElementById('maintenance-reason')!
  const progressBar = document.getElementById('update-progress-bar')
  const progressLabel = document.getElementById('update-progress-label')
  const progressPercent = document.getElementById('update-progress-percent')

  const setIndeterminate = (active: boolean) => {
    if (!progressBar || !progressPercent) return

    if (active) {
      progressBar.classList.add('indeterminate')
      progressPercent.style.display = 'none'
    } else {
      progressBar.classList.remove('indeterminate')
      progressPercent.style.display = 'block'
    }
  }

  const up = await bootstraps.check()
  const bg = await background.get()
  const bgUrl = bg?.file?.url ?? DEFAULT_BACKGROUND

  if (up.updateAvailable) {
    setIndeterminate(false)
    progressBar!.style.width = '0%'
    progressLabel!.innerText = 'Préparation de la mise à jour...'
    progressPercent!.innerText = '0%'
    setBlockingView('update')
    await new Promise((r) => setTimeout(r, 500))
    bootstraps.downloadProgress((value) => {
      progressLabel!.innerText = 'Téléchargement de la mise à jour...'
      const percent = ((value.downloaded.size / value.total.amount) * 100).toFixed(2)
      progressPercent!.innerText = `${percent}%`
      progressBar!.style.width = `${percent}%`
    })
    bootstraps.downloadEnd(async () => {
      setIndeterminate(true)
      progressLabel!.innerText = 'Installation...'
      await bootstraps.install()
    })
    bootstraps.error((err) => {
      logger.error('Error while downloading bootstraps:', err)
    })
    await bootstraps.download()
    logger.log('Update installed, restarting launcher...')
    setTimeout(() => {
      window.location.reload()
    }, 1000)

    return
  }

  try {
    const [_, session] = await Promise.all([preloadImage(bgUrl), auth.refresh()])

    if (bgElement) bgElement.style.backgroundImage = `url('${bgUrl}')`

    const mn = await maintenance.get(session.success ? session.account : undefined)
    if (mn) {
      const start = new Date(mn.startTime as Date)
      const end = new Date(mn.endTime as Date)
      maintenanceDates.innerText = `Du ${start.toLocaleString('fr-FR', dateFormatOptions)} au ${end.toLocaleString('fr-FR', dateFormatOptions)}`
      maintenanceReason.innerText = mn.message ?? 'Merci de réessayer plus tard.'
      setBlockingView('maintenance')
      return
    }

    if (session.success) {
      const assets = await loadAccountAssets(session.account)
      await setUser(session.account, assets)
      setView('home')
    } else {
      setView('login')
    }
  } catch (err) {
    logger.error('Error while initializing launcher:', err)
    if (bgElement) bgElement.style.backgroundImage = `url('${DEFAULT_BACKGROUND}')`
    setView('login')
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 400))
    document.querySelector('div#view-loading')?.classList.add('loaded')
    await new Promise((resolve) => setTimeout(resolve, 200))
    document.body.classList.add('loaded')
  }
}
