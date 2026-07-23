import { ipcMain } from 'electron'
import { Profiles } from 'eml-lib'
import type { Account } from 'eml-lib'
import logger from 'electron-log/main'
import { ADMINTOOL_URL } from '../const'

export function registerProfilesHandlers() {
  ipcMain.handle('profiles:get', async (_event, account?: Account) => {
    const profiles = new Profiles(ADMINTOOL_URL, account)

    try {
      const list = await profiles.getProfiles()
      const defaultProfile = list.find((profile) => profile.isDefault)
      const sorted = defaultProfile ? [defaultProfile, ...list.filter((profile) => profile.id !== defaultProfile.id)] : list
      return sorted
    } catch (err) {
      logger.error('Failed to fetch profiles:', err)
      return []
    }
  })
}
