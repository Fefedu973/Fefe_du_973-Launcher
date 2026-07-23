import { setView, closeOverlay, logout as clearUser } from '../state'
import { auth, settings, system, skin } from '../ipc'
import { Dialog } from './dialog'
import type { IGameSettings } from '../../electron/handlers/settings'
import shared from '../shared'

const resolutionList = [
  { label: 'Automatique (par défaut)', value: '854x480', width: 854, height: 480 },
  { label: 'Plein écran', value: 'fullscreen', width: 854, height: 480 },
  { label: '2560x1440 (1440p)', value: '2560x1440', width: 2560, height: 1440 },
  { label: '1920x1080 (1080p)', value: '1920x1080', width: 1920, height: 1080 },
  { label: '1600x900', value: '1600x900', width: 1600, height: 900 },
  { label: '1366x768', value: '1366x768', width: 1366, height: 768 },
  { label: '1280x1024', value: '1280x1024', width: 1280, height: 1024 },
  { label: '1280x720 (720p)', value: '1280x720', width: 1280, height: 720 },
  { label: '1024x768', value: '1024x768', width: 1024, height: 768 },
  { label: '800x600', value: '800x600', width: 800, height: 600 }
]

let currentSettings: IGameSettings

export async function initSettings() {
  const sysInfo = await system.getInfo()
  currentSettings = await settings.get()

  initUIListeners()
  initDualSlider(sysInfo.totalMem)
  initFormValues(sysInfo.resolution)

  const versionElem = document.getElementById('version')
  if (versionElem) versionElem.innerText = `Fefe du 973 Launcher v${sysInfo.version}`
}

function initUIListeners() {
  const closeBtn = document.getElementById('btn-close-settings')
  const tabContents = document.querySelectorAll('.tab-content')
  const tabButtons = document.querySelectorAll('.nav-btn')
  const logoutBtn = document.getElementById('btn-logout')

  const addSkinUrlBtn = document.getElementById('btn-add-skin-url')!
  const addSkinFileBtn = document.getElementById('btn-add-skin-file')!

  const addSkinFileForm = document.getElementById('form-add-skin-file')!
  const addSkinFileInput = document.getElementById('input-add-skin-file') as HTMLInputElement
  const addSkinFileButton = document.getElementById('btn-add-skin-choose-file') as HTMLButtonElement
  const addSkinFileSelectedDiv = document.getElementById('div-add-skin-file-selected')!
  const addSkinFileSelectedName = document.getElementById('span-add-skin-file-name')!
  const addSkinFileResetBtn = document.getElementById('btn-selected-file-reset') as HTMLButtonElement

  const addSkinUrlForm = document.getElementById('form-add-skin-url')!
  const addSkinUrlInput = document.getElementById('input-add-skin-url') as HTMLInputElement

  const addSkinSubmitBtn = document.getElementById('btn-add-skin-submit') as HTMLButtonElement

  closeBtn?.addEventListener('click', async () => {
    await saveSettings()
    closeOverlay('settings')
  })

  logoutBtn?.addEventListener('click', async () => {
    if (
      await Dialog.show(
        'La session locale sera supprimée de cet appareil.',
        [
          { text: 'Annuler', type: 'cancel' },
          { text: 'Se déconnecter', type: 'danger' }
        ],
        'Se déconnecter ?'
      )
    ) {
      await auth.logout()
      clearUser()
      closeOverlay('settings')
      setView('login')
    }
  })

  addSkinUrlBtn?.addEventListener('click', () => {
    addSkinUrlBtn!.classList.add('active')
    addSkinFileBtn!.classList.remove('active')
    addSkinUrlForm!.style.display = 'block'
    addSkinFileForm!.style.display = 'none'
    addSkinFileInput.value = ''
    addSkinUrlInput.value = ''
    addSkinFileSelectedDiv.style.display = 'none'
    addSkinFileButton.style.display = 'block'
    addSkinSubmitBtn.disabled = true
  })

  addSkinFileBtn?.addEventListener('click', () => {
    addSkinFileBtn!.classList.add('active')
    addSkinUrlBtn!.classList.remove('active')
    addSkinUrlForm!.style.display = 'none'
    addSkinFileForm!.style.display = 'block'
    addSkinUrlInput.value = ''
    addSkinFileInput.value = ''
    addSkinFileSelectedDiv.style.display = 'none'
    addSkinFileButton.style.display = 'block'
    addSkinSubmitBtn.disabled = true
  })

  addSkinFileButton?.addEventListener('click', async () => {
    addSkinFileInput.click()
  })

  addSkinFileInput?.addEventListener('change', async () => {
    const file = addSkinFileInput.files?.[0]
    if (!file) {
      addSkinFileButton.style.display = 'block'
      addSkinSubmitBtn.disabled = true
      addSkinFileSelectedDiv.style.display = 'none'
      return
    }

    addSkinFileButton.style.display = 'none'
    addSkinSubmitBtn.disabled = false
    addSkinFileSelectedName.innerText = file.name
    addSkinFileSelectedDiv.style.display = 'block'
  })

  addSkinUrlInput?.addEventListener('input', () => {
    addSkinSubmitBtn.disabled = addSkinUrlInput.value.trim() === ''
  })

  addSkinFileResetBtn?.addEventListener('click', () => {
    addSkinFileInput.value = ''
    addSkinFileButton.style.display = 'block'
    addSkinSubmitBtn.disabled = true
    addSkinFileSelectedDiv.style.display = 'none'
  })

  addSkinSubmitBtn?.addEventListener('click', async () => {
    await addSkin()
    addSkinUrlInput.value = ''
    addSkinFileInput.value = ''
    addSkinFileButton.style.display = 'block'
    addSkinSubmitBtn.disabled = true
    addSkinFileSelectedDiv.style.display = 'none'
    document.getElementById('settings-content')?.scrollTo({ top: 0, behavior: 'smooth' })
  })

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabButtons.forEach((b) => b.classList.remove('active'))
      btn.classList.add('active')
      const targetTab = btn.getAttribute('data-tab')
      tabContents.forEach((c) => (c.id === `tab-${targetTab}` ? c.classList.add('active') : c.classList.remove('active')))
    })
  })
}

function initDualSlider(maxRamSystem: number) {
  maxRamSystem = Math.min(maxRamSystem, 16)
  const minInput = document.getElementById('ram-min') as HTMLInputElement
  const maxInput = document.getElementById('ram-max') as HTMLInputElement
  const fill = document.getElementById('ram-track-fill')
  const minLabel = document.getElementById('ram-min-label')
  const maxLabel = document.getElementById('ram-max-label')

  if (!minInput || !maxInput || !fill) return

  minInput.max = maxRamSystem.toString()
  maxInput.max = maxRamSystem.toString()

  const gap = 0.5
  const updateSlider = (e?: Event) => {
    let minVal = parseFloat(minInput.value)
    let maxVal = parseFloat(maxInput.value)

    if (maxVal - minVal < gap) {
      if (e?.target === minInput) {
        minInput.value = (maxVal - gap).toString()
        minVal = parseFloat(minInput.value)
      } else {
        maxInput.value = (minVal + gap).toString()
        maxVal = parseFloat(maxInput.value)
      }
    }

    if (minLabel) minLabel.innerText = `${minVal} GB`
    if (maxLabel) maxLabel.innerText = `${maxVal} GB`

    const range = maxRamSystem - parseFloat(minInput.min)
    const minPercent = ((minVal - parseFloat(minInput.min)) / range) * 100
    const maxPercent = ((maxVal - parseFloat(maxInput.min)) / range) * 100

    fill.style.left = `${minPercent}%`
    fill.style.width = `${maxPercent - minPercent}%`
  }

  minInput.addEventListener('input', updateSlider)
  maxInput.addEventListener('input', updateSlider)
  updateSlider()
}

function initFormValues(resolution: { width: number; height: number }) {
  if (!currentSettings) return

  const minInput = document.getElementById('ram-min') as HTMLInputElement
  const maxInput = document.getElementById('ram-max') as HTMLInputElement
  const resolutionSelect = document.getElementById('resolution-select') as HTMLSelectElement
  const launcherActionSelect = document.getElementById('launcher-action-select') as HTMLSelectElement
  const javaSelect = document.getElementById('java-select') as HTMLSelectElement

  if (minInput) minInput.value = currentSettings.memory.min + ''
  if (maxInput) maxInput.value = currentSettings.memory.max + ''
  if (resolutionSelect) {
    const availableResolutions = getAvailableResolutions(resolution)
    resolutionSelect.innerHTML = ''
    availableResolutions.forEach((res) => {
      const option = document.createElement('option')
      option.value = res.value
      option.innerText = res.label
      resolutionSelect.appendChild(option)
    })

    resolutionSelect.value = currentSettings.resolution.fullscreen
      ? 'fullscreen'
      : `${currentSettings.resolution.width}x${currentSettings.resolution.height}`
  }
  if (launcherActionSelect) launcherActionSelect.value = currentSettings.launcherAction
  if (javaSelect) javaSelect.value = currentSettings.java === 'bundled' ? 'bundled' : 'system'

  minInput.dispatchEvent(new Event('input'))
}

async function saveSettings() {
  const minInput = document.getElementById('ram-min') as HTMLInputElement
  const maxInput = document.getElementById('ram-max') as HTMLInputElement
  const launcherActionSelect = document.getElementById('launcher-action-select') as HTMLSelectElement
  const resolutionSelect = document.getElementById('resolution-select') as HTMLSelectElement
  const javaSelect = document.getElementById('java-select') as HTMLSelectElement

  const newSettings: IGameSettings = {
    ...currentSettings,
    memory: {
      min: parseFloat(minInput.value),
      max: parseFloat(maxInput.value)
    },
    resolution: {
      height: resolutionList.find((r) => r.value === resolutionSelect.value)?.height ?? 480,
      width: resolutionList.find((r) => r.value === resolutionSelect.value)?.width ?? 854,
      fullscreen: resolutionSelect.value === 'fullscreen'
    },
    java: javaSelect.value === 'bundled' ? 'bundled' : 'path',
    launcherAction: launcherActionSelect.value as 'close' | 'keep' | 'hide'
  }

  await settings.set(newSettings)
  currentSettings = newSettings
}

async function addSkin() {
  const addSkinUrlBtn = document.getElementById('btn-add-skin-url')!
  const addSkinFileBtn = document.getElementById('btn-add-skin-file')!
  const addSkinFileInput = document.getElementById('input-add-skin-file') as HTMLInputElement
  const addSkinUrlInput = document.getElementById('input-add-skin-url') as HTMLInputElement
  const addSkinSlimVariant = document.getElementById('input-add-skin-variant-slim') as HTMLInputElement

  let skinSource: string | ArrayBuffer | null = null
  let variant: 'classic' | 'slim' = 'classic'

  if (addSkinUrlBtn.classList.contains('active')) {
    skinSource = addSkinUrlInput.value.trim()
  } else if (addSkinFileBtn.classList.contains('active')) {
    const file = addSkinFileInput.files?.[0]
    if (file) {
      skinSource = await file.arrayBuffer()
    }
  }

  if (!skinSource) return

  if (addSkinSlimVariant.checked) variant = 'slim'

  try {
    const result = await skin.updateSkin(skinSource, variant)
    if (!result) {
      await Dialog.show("Impossible d'ajouter ce skin. Vérifie le fichier ou l'URL.", [{ text: 'Fermer', type: 'ok' }])
      return
    }

    shared.skins = result
    shared.resetMainView()
    shared.resetSkinViews()
  } catch (err) {
    await Dialog.show("Une erreur est survenue pendant l'ajout du skin.", [{ text: 'Fermer', type: 'ok' }])
    return
  }
}

function getAvailableResolutions(systemResolution: { width: number; height: number }) {
  return resolutionList.filter((res) => res.width <= systemResolution.width && res.height <= systemResolution.height)
}
