import { ipcMain } from 'electron'
import { Background } from 'eml-lib'
import logger from 'electron-log/main'
import { ADMINTOOL_URL } from '../const'

export function registerBackgroundHandlers() {
  ipcMain.handle('background:get', async () => {
    const background = new Background(ADMINTOOL_URL)

    try {
      const currentBackground = await background.getBackground()
      return currentBackground
    } catch (err) {
      logger.error('Failed to fetch background:', err)
      return null
    }
  })
}
