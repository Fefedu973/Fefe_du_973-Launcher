import { ipcMain } from 'electron'
import { Maintenance } from 'eml-lib'
import type { Account } from 'eml-lib'
import logger from 'electron-log/main'
import { ADMINTOOL_URL } from '../const'

export function registerMaintenanceHandlers() {
  ipcMain.handle('maintenance:get', async (_event, account?: Account) => {
    const maintenance = new Maintenance(ADMINTOOL_URL, account)

    try {
      const status = await maintenance.getMaintenance()
      return status?.startTime && new Date(status.startTime) <= new Date() ? status : null
    } catch (err) {
      logger.error('Failed to fetch maintenance:', err)
      return null
    }
  })
}
