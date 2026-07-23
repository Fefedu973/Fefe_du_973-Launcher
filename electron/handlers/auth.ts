import { ipcMain, app, safeStorage } from 'electron'
import { CrackAuth, MicrosoftAuth } from 'eml-lib'
import type { Account } from 'eml-lib'
import logger from 'electron-log/main'
import * as fs from 'node:fs'
import * as path from 'node:path'

const sessionPath = path.join(app.getPath('userData'), 'session.dat')

type StoredSession = { version: 1; type: 'offline'; account: Account } | { version: 1; type: 'encrypted'; payload: string }

export type IAuthResponse = { success: true; account: Account } | { success: false; error: string }

function getMicrosoftLoginError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)

  if (/cancelled/i.test(message)) {
    return 'Connexion Microsoft annulée.'
  }
  if (/minecraft not owned/i.test(message)) {
    return 'Ce compte Microsoft ne possède pas Minecraft: Java Edition.'
  }
  if (/xsts|xbox privacy/i.test(message)) {
    return 'La connexion Xbox a été refusée. Vérifie les paramètres de confidentialité et le profil Xbox de ce compte.'
  }
  if (/too many requests|http 429/i.test(message)) {
    return 'Microsoft limite temporairement les connexions. Réessaie dans quelques minutes.'
  }
  if (/fetch|network|econn|timed? ?out/i.test(message)) {
    return 'Impossible de joindre Microsoft. Vérifie ta connexion Internet puis réessaie.'
  }

  return 'La connexion Microsoft a échoué. Réessaie dans quelques instants.'
}

function saveSession(account: Account) {
  let stored: StoredSession

  if (account.meta.type === 'crack') {
    stored = { version: 1, type: 'offline', account }
  } else {
    if (!safeStorage.isEncryptionAvailable()) {
      logger.warn('Secure storage is unavailable; the Microsoft session will not be persisted.')
      return
    }

    const payload = safeStorage.encryptString(JSON.stringify(account)).toString('base64')
    stored = { version: 1, type: 'encrypted', payload }
  }

  fs.writeFileSync(sessionPath, JSON.stringify(stored), { mode: 0o600 })
}

function readSession(): Account | null {
  if (!fs.existsSync(sessionPath)) return null

  try {
    const stored = JSON.parse(fs.readFileSync(sessionPath, 'utf8')) as StoredSession
    if (stored.version !== 1) return null
    if (stored.type === 'offline') return stored.account
    if (!safeStorage.isEncryptionAvailable()) return null

    return JSON.parse(safeStorage.decryptString(Buffer.from(stored.payload, 'base64'))) as Account
  } catch (error) {
    logger.warn('The saved session is unreadable and will be removed.', error)
    fs.rmSync(sessionPath, { force: true })
    return null
  }
}

export function registerAuthHandlers(mainWindow: Electron.BrowserWindow) {
  const microsoftAuth = new MicrosoftAuth(mainWindow)
  const offlineAuth = new CrackAuth()

  ipcMain.handle('auth:login_microsoft', async () => {
    try {
      const account = await microsoftAuth.auth()
      saveSession(account)
      return { success: true, account } as IAuthResponse
    } catch (err: unknown) {
      logger.error('Microsoft login failed:', err)
      return { success: false, error: getMicrosoftLoginError(err) }
    }
  })

  ipcMain.handle('auth:login_offline', async (_event, username: unknown) => {
    if (typeof username !== 'string' || !/^[A-Za-z0-9_]{3,16}$/.test(username)) {
      return {
        success: false,
        error: 'Le pseudo doit contenir entre 3 et 16 lettres, chiffres ou underscores.'
      } as IAuthResponse
    }

    try {
      const account = offlineAuth.auth(username)
      saveSession(account)
      return { success: true, account } as IAuthResponse
    } catch (err: any) {
      logger.error('Offline login failed:', err)
      return { success: false, error: 'Impossible de créer la session locale.' }
    }
  })

  ipcMain.handle('auth:refresh', async () => {
    try {
      const savedSession = readSession()
      if (!savedSession) return { success: false, error: 'Aucune session enregistrée.' } as IAuthResponse

      if (savedSession.meta.type === 'crack') {
        const account = offlineAuth.auth(savedSession.name)
        saveSession(account)
        return { success: true, account } as IAuthResponse
      }

      if (savedSession && savedSession.uuid) {
        const valid = await microsoftAuth.validate(savedSession)
        if (valid) {
          return { success: true, account: savedSession } as IAuthResponse
        }
        const account = await microsoftAuth.refresh(savedSession)
        saveSession(account)
        return { success: true, account } as IAuthResponse
      }
      return { success: false, error: 'La session enregistrée est invalide.' } as IAuthResponse
    } catch (err: any) {
      logger.error('Failed to refresh session:', err)
      return { success: false, error: 'La session enregistrée a expiré.' } as IAuthResponse
    }
  })

  ipcMain.handle('auth:logout', async () => {
    fs.rmSync(sessionPath, { force: true })
    return { success: true }
  })
}
