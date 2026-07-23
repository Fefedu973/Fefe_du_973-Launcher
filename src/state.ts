import type { Account, IAvatar, ICape, ISkin } from 'eml-lib'
import logger from 'electron-log/renderer'
import shared from './shared'

export type ViewName = 'loading' | 'login' | 'home' | 'settings'
export type BlockingViewName = 'maintenance' | 'update'

export function getUser() {
  return shared.account
}

export async function setUser(account: Account, assets: { skins: ISkin[] | null; capes: ICape[] | null; avatar: IAvatar | null }) {
  shared.account = account
  shared.skins = assets.skins ?? []
  shared.capes = assets.capes
  shared.avatar = assets.avatar
  await updateUserInterface()
  document.dispatchEvent(new CustomEvent('launcher:user-ready', { detail: account }))
}

export function logout() {
  shared.account = null
  shared.skins = null
  shared.capes = null
  shared.avatar = null
  const nameEl = document.getElementById('user-name')
  if (nameEl) nameEl.innerText = ''
}

async function updateUserInterface() {
  if (!shared.account) return

  logger.log('Updating UI for user:', shared.account.name)

  const nameEl = document.getElementById('user-name')
  const avatarEl = document.getElementById('user-avatar') as HTMLImageElement
  const nameSettingsEl = document.getElementById('settings-user-name')
  const uuidSettingsEl = document.getElementById('settings-user-uuid')
  const typeSettingsEl = document.getElementById('settings-user-type')
  const avatarSettingsEl = document.getElementById('settings-user-avatar') as HTMLImageElement
  const rankEl = document.querySelector('.rank-badge')
  const skinTabButton = document.querySelector('[data-tab="skin"]') as HTMLButtonElement | null
  const xboxAccountLink = document.getElementById('manage-xbox-account')
  const isOffline = shared.account.meta.type === 'crack'
  const avatarUrl = shared.avatar?.url ?? ''

  if (nameEl) nameEl.innerText = shared.account.name
  if (avatarEl) {
    avatarEl.onerror = () => {
      avatarEl.hidden = true
    }
    avatarEl.src = avatarUrl
    avatarEl.hidden = avatarUrl === ''
  }
  if (rankEl) rankEl.textContent = isOffline ? 'Compte local' : 'Compte Microsoft'
  if (nameSettingsEl) nameSettingsEl.innerText = shared.account.name
  if (uuidSettingsEl) uuidSettingsEl.innerText = `UUID: ${shared.account.uuid}`
  if (typeSettingsEl) typeSettingsEl.innerHTML = getAccountIcon(shared.account.meta.type)
  if (avatarSettingsEl) {
    avatarSettingsEl.onerror = () => {
      avatarSettingsEl.hidden = true
    }
    avatarSettingsEl.src = avatarUrl
    avatarSettingsEl.hidden = avatarUrl === ''
  }
  if (skinTabButton) skinTabButton.hidden = isOffline
  if (xboxAccountLink) xboxAccountLink.hidden = isOffline
  document.body.dataset.accountType = shared.account.meta.type

  shared.resetMainView()
  if (!isOffline) {
    shared.resetSkinViews()
    shared.resetCapesViews()
  }
}

export function setView(view: ViewName) {
  const target = document.querySelector(`.view[data-view="${view}"]`) as HTMLElement
  if (!target) return logger.error(`View ${view} not found`)

  const isOverlay = target.classList.contains('overlay')

  if (view === 'settings') resetSettingsTab()

  if (!isOverlay) {
    document.querySelectorAll('.view').forEach((el) => {
      if (!el.classList.contains('overlay')) {
        el.classList.remove('active')
      }
    })
  }

  target.classList.add('active')
}

export function setBlockingView(view: BlockingViewName) {
  setTimeout(() => {
    document.querySelector('div#view-loading')?.classList.add('loaded')
  }, 400)
  setTimeout(() => {
    document.querySelector(`div#view-${view}`)?.classList.add('loaded')
  }, 200)
}

export function closeOverlay(view: ViewName) {
  const target = document.querySelector(`.view[data-view="${view}"]`)
  target?.classList.remove('active')
}

function getAccountIcon(type: 'msa' | 'yggdrasil' | 'azuriom' | 'crack') {
  switch (type) {
    case 'msa':
      return '<i class="fa-brands fa-microsoft"></i>Compte Microsoft'
    case 'yggdrasil':
      return '<i class="fa-solid fa-user"></i>Compte Yggdrasil'
    case 'azuriom':
      return '<i class="fa-brands fa-globe"></i>Compte Azuriom'
    case 'crack':
      return '<i class="fa-solid fa-user"></i>Compte local'
    default:
      return 'Type de compte inconnu'
  }
}

function resetSettingsTab() {
  const tabButtons = document.querySelectorAll('.nav-btn')
  const tabContents = document.querySelectorAll('.tab-content')
  tabButtons.forEach((b) => b.classList.remove('active'))
  tabContents.forEach((content) => content.classList.remove('active'))

  tabButtons[0].classList.add('active')
  tabContents[0].classList.add('active')
}
