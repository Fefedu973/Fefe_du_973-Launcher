import { app, ipcMain } from 'electron'
import { type Account, type ISkin, Skin } from 'eml-lib'
import path from 'node:path'
import fs from 'node:fs'
import logger from 'electron-log/main'

let skin: Skin | null = null
let skinAccountId: string | null = null
const skinPath = path.join(app.getPath('userData'), 'skins.json')
const DEFAULT_SKINS: ISkin[] = [
  {
    id: 'steve',
    url: 'https://textures.minecraft.net/texture/31f477eb1a7beee631c2ca64d06f8f68fa93a3386d04452ab27f43acdf1b60cb',
    variant: 'classic',
    state: 'inactive'
  },
  {
    id: 'alex',
    url: 'https://textures.minecraft.net/texture/46acd06e8483b176e8ea39fc12fe105eb3a2a4970f5100057e9d84d4b60bdfa7',
    variant: 'slim',
    state: 'inactive'
  }
]

function getSkinManager(account?: Account) {
  if (!account || account.meta.type === 'crack') return null

  if (!skin || skinAccountId !== account.uuid) {
    skin = new Skin(account)
    skinAccountId = account.uuid
  }

  return skin
}

function getOfflineSkins(): ISkin[] {
  return DEFAULT_SKINS.map((item, index) => ({
    ...item,
    state: index === 0 ? 'active' : 'inactive'
  }))
}

export function registerSkinHandlers() {
  ipcMain.handle('skin:reload', async (_event, account?: Account) => {
    const manager = getSkinManager(account)
    if (!manager) return null
    await manager.reload()
  })

  ipcMain.handle('skin:get_skin', async (_event, account?: Account) => {
    if (account?.meta.type === 'crack') return getOfflineSkins()
    const manager = getSkinManager(account)
    if (!manager && !skin) return null

    return await getSkins()
  })

  ipcMain.handle('skin:get_cape', async (_event, account?: Account) => {
    const manager = getSkinManager(account)
    if (!manager) return null
    return await manager.getCapes()
  })

  ipcMain.handle('skin:get_avatar', async (_event, account?: Account) => {
    const manager = getSkinManager(account)
    if (!manager) return null

    try {
      const avatar = await manager.getAvatar()
      return avatar
    } catch (err) {
      logger.error('Failed to get avatar:', err)
      return null
    }
  })

  ipcMain.handle('skin:update_skin', async (_event, source: string | ArrayBuffer, model?: 'classic' | 'slim') => {
    if (!skin) {
      return { success: false, error: 'No skin loaded' }
    }

    let skinSource: string | Blob

    if (source instanceof ArrayBuffer) {
      skinSource = new Blob([source])
    } else if (typeof source === 'string' && source.startsWith('data:')) {
      const res = await fetch(source)
      skinSource = await res.blob()
    } else {
      skinSource = source
    }

    try {
      await skin.updateSkin(skinSource, model)
    } catch (err: any) {
      logger.error('Failed to update skin:', err)
      return null
    }

    const newSkins = await skin.getSkins()

    await appendSkin(...newSkins)

    return await getSkins(true, newSkins)
  })

  ipcMain.handle('skin:delete_skin', async (_event, id: string) => {
    if (!fs.existsSync(skinPath)) {
      return null
    }

    try {
      const data = JSON.parse(fs.readFileSync(skinPath, 'utf-8'))
      const newSkins = data.filter((s: ISkin) => s.id !== id || s.state === 'active')
      fs.writeFileSync(skinPath, JSON.stringify(newSkins, null, 2))
      return await getSkins(true, newSkins)
    } catch (err: any) {
      logger.error('Failed to delete skin from cache:', err)
      return null
    }
  })

  // ipcMain.handle('skin:update_cape', async (_event, source: string | Blob) => {
  // }) --- Not implemented with Microsoft accounts ---

  ipcMain.handle('skin:switch_cape', async (_event, id: string) => {
    if (!skin) {
      return { success: false, error: 'No skin loaded' }
    }

    try {
      await skin.switchCape(id)
      return skin.getCapes()
    } catch (err: any) {
      logger.error('Failed to switch cape:', err)
      return null
    }
  })

  // ipcMain.handle('skin:delete_cape', async (_event) => {
  // }) --- Not implemented with Microsoft accounts ---

  ipcMain.handle('skin:hide_cape', async (_event) => {
    if (!skin) {
      return { success: false, error: 'No skin loaded' }
    }

    try {
      await skin.hideCape()
      return skin.getCapes()
    } catch (err: any) {
      logger.error('Failed to hide cape:', err)
      return null
    }
  })
}

/**
 * If `skipFetch` is `true`, `inject` must include the active skin.
 */
async function getSkins(skipFetch = false, inject: ISkin[] = []) {
  let skins: ISkin[] = inject

  if (!skipFetch) {
    try {
      const data = (await skin!.getSkins()) as ISkin[] // must and should contain an active skin
      skins = skins.concat(data.filter((s: ISkin) => !skins.some((existingSkin) => existingSkin.url === s.url && existingSkin.variant === s.variant)))
    } catch (err) {
      logger.warn('Failed to get skins:', err)
    }
  }

  try {
    if (fs.existsSync(skinPath)) {
      const data = JSON.parse(fs.readFileSync(skinPath, 'utf-8') || '[]').map((s: ISkin) => {
        return {
          id: s.id,
          url: s.url,
          state: 'inactive' as const,
          variant: s.variant
        }
      }) as ISkin[]
      skins = skins.concat(data.filter((s: ISkin) => !skins.some((existingSkin) => existingSkin.url === s.url && existingSkin.variant === s.variant)))
    } else {
      fs.writeFileSync(skinPath, JSON.stringify(skins, null, 2))
    }
  } catch (err) {
    logger.warn('Failed to read skins from cache:', err)
  }

  skins = skins.concat(DEFAULT_SKINS.filter((s) => !skins.some((existingSkin) => existingSkin.url === s.url && existingSkin.variant === s.variant)))

  return skins
}

async function appendSkin(...skins: ISkin[]) {
  const isActive: boolean = skins.some((s) => s.state === 'active')
  if (!fs.existsSync(skinPath)) {
    try {
      fs.writeFileSync(skinPath, JSON.stringify(skins, null, 2))
    } catch (err: any) {
      logger.error('Failed to write skin to cache:', err)
    }
  } else {
    try {
      const data = JSON.parse(fs.readFileSync(skinPath, 'utf-8')).map((s: ISkin) => {
        return {
          id: s.id,
          url: s.url,
          state: isActive ? 'inactive' : (s.state as 'active' | 'inactive'),
          variant: s.variant
        }
      })
      const newSkins = skins.concat(
        data.filter((s: ISkin) => !skins.some((existingSkin) => existingSkin.url === s.url && existingSkin.variant === s.variant))
      )
      fs.writeFileSync(skinPath, JSON.stringify(newSkins, null, 2))
    } catch (err: any) {
      logger.error('Failed to update skin cache:', err)
    }
  }
}
