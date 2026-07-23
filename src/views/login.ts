import { setUser, setView } from '../state'
import { auth } from '../ipc'
import { Dialog } from './dialog'
import logger from 'electron-log/renderer'
import { loadAccountAssets } from '../account'
import type { IAuthResponse } from '../../electron/handlers/auth'

export function initLogin() {
  const microsoftButton = document.getElementById('btn-login-ms') as HTMLButtonElement | null
  const offlineForm = document.getElementById('offline-login-form') as HTMLFormElement | null
  const offlineInput = document.getElementById('offline-username') as HTMLInputElement | null
  const offlineButton = document.getElementById('btn-login-offline') as HTMLButtonElement | null

  const completeLogin = async (session: IAuthResponse) => {
    if (!session.success) {
      logger.error(session.error)
      await Dialog.show(session.error || 'La connexion a échoué.', [{ text: 'Fermer', type: 'ok' }])
      return
    }

    const assets = await loadAccountAssets(session.account)
    await setUser(session.account, assets)
    setView('home')
  }

  microsoftButton?.addEventListener('click', async () => {
    const originalText = microsoftButton.innerHTML
    microsoftButton.disabled = true
    microsoftButton.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i><span>Connexion...</span>'
    try {
      await completeLogin(await auth.loginMicrosoft())
    } catch (err) {
      logger.error(err)
      await Dialog.show('Une erreur est survenue pendant la connexion Microsoft.', [{ text: 'Fermer', type: 'ok' }])
    } finally {
      microsoftButton.disabled = false
      microsoftButton.innerHTML = originalText
    }
  })

  offlineForm?.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (!offlineInput || !offlineButton) return

    const originalText = offlineButton.innerHTML
    offlineButton.disabled = true
    offlineInput.disabled = true
    offlineButton.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i><span>Connexion...</span>'
    try {
      await completeLogin(await auth.loginOffline(offlineInput.value.trim()))
    } catch (err) {
      logger.error(err)
      await Dialog.show('Une erreur est survenue pendant la connexion.', [{ text: 'Fermer', type: 'ok' }])
    } finally {
      offlineButton.disabled = false
      offlineInput.disabled = false
      offlineButton.innerHTML = originalText
    }
  })
}
