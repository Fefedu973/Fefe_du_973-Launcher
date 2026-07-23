import type { Account, IAvatar, ICape, ISkin } from 'eml-lib'
import { SkinViewer, WalkingAnimation } from 'skinview3d'
import { skin } from './ipc'
import { Dialog } from './views/dialog'
import logger from 'electron-log/renderer'

const DEFAULT_SKIN = {
  id: 'steve',
  url: 'https://textures.minecraft.net/texture/d5c4ee5ce20aed9e33e866c66caa37178606234b3721084bf01d13320fb2eb3f',
  variant: 'classic',
  state: 'active'
}

const shared = {
  account: null as Account | null,
  skins: null as ISkin[] | null,
  capes: null as ICape[] | null,
  avatar: null as IAvatar | null,
  mainSkinViewer: null as SkinViewer | null,
  auxiliarySkinViewer: null as SkinViewer | null,
  cachedSkinThumbnails: new Map<string, string>(),
  cachedCapeThumbnails: new Map<string, string>(),
  /**
   * `skins` should be updated before calling this function.
   */
  resetMainView: async () => {
    const skinCanvasSettingsEl = document.getElementById('skin-container') as HTMLCanvasElement

    const activeSkin = shared.skins?.find((s) => s.state === 'active') ?? DEFAULT_SKIN
    const activeCape = shared.capes?.find((c) => c.state === 'active')

    if (!shared.mainSkinViewer) {
      shared.mainSkinViewer = new SkinViewer({
        canvas: skinCanvasSettingsEl,
        width: 530,
        height: 250,
        preserveDrawingBuffer: true
      })

      shared.mainSkinViewer.animation = new WalkingAnimation()
      shared.mainSkinViewer.animation!.speed = 0.3
      shared.mainSkinViewer.camera.position.set(-20, -2, 35)
      shared.mainSkinViewer.controls.enableZoom = false
      shared.mainSkinViewer.controls.enablePan = false
      shared.mainSkinViewer.controls.rotateSpeed = 0.3
    }

    shared.mainSkinViewer.loadSkin(activeSkin.url, { model: activeSkin.variant === 'slim' ? 'slim' : 'default' })
    if (activeCape) shared.mainSkinViewer.loadCape(activeCape.url)
    else shared.mainSkinViewer.resetCape()
  },
  /**
   * `skins` should be updated before calling this function.
   */
  resetSkinViews: async () => {
    const skinGallerySettingsEl = document.getElementById('skin-gallery')!

    skinGallerySettingsEl.innerHTML = ''

    if (!shared.auxiliarySkinViewer) {
      shared.auxiliarySkinViewer = new SkinViewer({
        canvas: document.createElement('canvas'),
        width: 159.3,
        height: 180
      })

      shared.auxiliarySkinViewer.animation = new WalkingAnimation()
      shared.auxiliarySkinViewer.animation!.progress = 0.5
      shared.auxiliarySkinViewer.animation!.speed = 0
      shared.auxiliarySkinViewer.zoom = 0.8
      shared.auxiliarySkinViewer.camera.position.set(-20, -2, 35)
      shared.auxiliarySkinViewer.controls.enabled = false
    }

    for (const s of shared.skins ?? []) {
      const skinDiv = document.createElement('div')
      skinDiv.classList.add('skin-preview')
      if (s.state === 'active') skinDiv.classList.add('active')
      skinDiv.addEventListener('click', async () => {
        if (s.state === 'active') return
        try {
          shared.skins = await skin.updateSkin(s.url, s.variant)
          shared.resetMainView()
          shared.resetSkinViews()
          document.getElementById('settings-content')?.scrollTo({ top: 0, behavior: 'smooth' })
        } catch (err) {
          logger.error('Error occurred while changing the skin:', err)
          await Dialog.show('An error occurred while changing the skin. Please try again in few minutes.', [{ text: 'Close', type: 'ok' }])
        }
      })

      if (s.state === 'inactive' && s.id !== 'steve' && s.id !== 'alex') {
        const deleteBtn = document.createElement('button')
        deleteBtn.classList.add('btn-delete-skin', 'btn', 'btn-secondary')
        deleteBtn.innerHTML = '<i class="fa-solid fa-times"></i>'
        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation()
          try {
            shared.skins = await skin.deleteSkin(s.id)
            shared.resetMainView()
            shared.resetSkinViews()
          } catch (err) {
            logger.error('Error occurred while deleting the skin:', err)
            await Dialog.show('An error occurred while deleting the skin.', [{ text: 'OK', type: 'ok' }])
          }
        })

        skinDiv.appendChild(deleteBtn)
      }

      const source = `${s.url}-${s.variant}`
      const skinImg = document.createElement('img') as HTMLImageElement
      if (shared.cachedSkinThumbnails.has(source)) {
        skinImg.src = shared.cachedSkinThumbnails.get(source)!
        skinDiv.appendChild(skinImg)
        skinGallerySettingsEl?.appendChild(skinDiv)
      } else {
        await shared.auxiliarySkinViewer.loadSkin(s.url, { model: s.variant === 'slim' ? 'slim' : 'default' })
        shared.auxiliarySkinViewer.render()

        skinImg.src = shared.auxiliarySkinViewer.canvas.toDataURL()
        shared.cachedSkinThumbnails.set(source, skinImg.src)
      }

      skinDiv.appendChild(skinImg)
      skinGallerySettingsEl?.appendChild(skinDiv)
    }
  },
  /**
   * `capes` should be updated before calling this function.
   */
  resetCapesViews: async () => {
    const capeGallerySettingsEl = document.getElementById('cape-gallery')!
    const inactive = !shared.capes?.some((c) => c.state === 'active')

    capeGallerySettingsEl.innerHTML = ''

    const capeDiv = document.createElement('div')
    capeDiv.classList.add('cape-preview')
    if (inactive) capeDiv.classList.add('active')
    capeDiv.addEventListener('click', async () => {
      if (!inactive) {
        try {
          shared.capes = await skin.hideCape()
          shared.resetMainView()
          shared.resetCapesViews()
          document.getElementById('settings-content')?.scrollTo({ top: 0, behavior: 'smooth' })
        } catch (err) {
          logger.error('Error occurred while unequipping the cape:', err)
          await Dialog.show('An error occurred while unequipping the cape. Please try again in few minutes.', [{ text: 'Close', type: 'ok' }])
        }
      }
    })

    const capeSpan = document.createElement('span')
    capeSpan.innerHTML = '<i class="fa-solid fa-ban" style="display: block; font-size: 54px; color: #525252; position: relative; top: -5px;"></i>'
    capeDiv.appendChild(capeSpan)
    capeGallerySettingsEl?.appendChild(capeDiv)

    for (const c of shared.capes ?? []) {
      const capeDiv = document.createElement('div')
      capeDiv.classList.add('cape-preview')
      if (c.state === 'active') capeDiv.classList.add('active')
      capeDiv.addEventListener('click', async () => {
        if (c.state === 'active') return
        try {
          shared.capes = await skin.switchCape(c.id)
          shared.resetMainView()
          shared.resetCapesViews()
          document.getElementById('settings-content')?.scrollTo({ top: 0, behavior: 'smooth' })
        } catch (err) {
          logger.error('Error occurred while changing the cape:', err)
          await Dialog.show('An error occurred while changing the cape. Please try again in few minutes.', [{ text: 'Close', type: 'ok' }])
        }
      })

      const capeImg = document.createElement('img') as HTMLImageElement
      const capeSpan = document.createElement('span')
      if (shared.cachedCapeThumbnails.has(c.url)) {
        capeImg.src = shared.cachedCapeThumbnails.get(c.url)!
        capeDiv.appendChild(capeImg)
        capeGallerySettingsEl?.appendChild(capeDiv)
      } else {
        const req = await fetch(c.url)
        const blob = await req.blob()
        const img = await createImageBitmap(blob)

        const canvas = document.createElement('canvas')
        canvas.width = 100
        canvas.height = 160

        const ctx = canvas.getContext('2d')!
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(img, 1, 1, 10, 16, 0, 0, 100, 160)

        capeImg.src = canvas.toDataURL()
        shared.cachedCapeThumbnails.set(c.url, capeImg.src)
      }

      capeSpan.innerHTML = c.alias
      capeDiv.appendChild(capeImg)
      capeDiv.appendChild(capeSpan)
      capeGallerySettingsEl?.appendChild(capeDiv)
    }
  }
}

export default shared
