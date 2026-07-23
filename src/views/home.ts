import { setView, getUser } from '../state'
import { game, news, server, settings, profiles } from '../ipc'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import logger from 'electron-log/renderer'
import { Dialog } from './dialog'
import type { INews, INewsTag, IProfile } from 'eml-lib'

marked.use({
  renderer: {
    link(link) {
      const href = link.href ?? '#'
      const titleAttr = link.title ? ` title="${link.title}"` : ''
      return `<a href="${href}" target="_blank" rel="noopener noreferrer"${titleAttr}>${link.text}</a>`
    }
  }
})

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

const parseNews = (rawContent: string) =>
  DOMPurify.sanitize(marked.parse(rawContent) as string, {
    ADD_ATTR: ['target']
  })

const normalizeColor = (color: string) => (/^#[0-9a-f]{6}$/i.test(color) ? color : '#7dd3fc')

const backgroundColor = (rawColor: string) => {
  const color = normalizeColor(rawColor)
  const r = parseInt(color.slice(1, 3), 16)
  const g = parseInt(color.slice(3, 5), 16)
  const b = parseInt(color.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, 0.1)`
}

type NewsItem = Omit<INews, 'tags'> & {
  image?: string | null
  tags?: Array<INewsTag & { name?: string }>
}

function createNewsArticle(item: NewsItem) {
  const article = document.createElement('article')
  article.className = 'news-article'

  const meta = document.createElement('div')
  meta.className = 'article-meta'

  const author = document.createElement('div')
  author.className = 'author'
  author.innerHTML = '<i class="fa-solid fa-user-shield" aria-hidden="true"></i>'
  const authorName = document.createElement('span')
  authorName.textContent = item.author?.username ?? 'Équipe du serveur'
  author.appendChild(authorName)
  meta.appendChild(author)

  const dateSeparator = document.createElement('span')
  dateSeparator.className = 'separator'
  dateSeparator.textContent = '•'
  meta.appendChild(dateSeparator)

  const date = document.createElement('span')
  date.className = 'date'
  date.textContent = formatDate(String(item.createdAt))
  meta.appendChild(date)

  if (item.tags?.length) {
    const tagSeparator = dateSeparator.cloneNode(true)
    const tags = document.createElement('div')
    tags.className = 'tags-container'

    item.tags.forEach((tag) => {
      const color = normalizeColor(tag.color)
      const tagElement = document.createElement('span')
      tagElement.className = 'tag'
      tagElement.style.color = color
      tagElement.style.backgroundColor = backgroundColor(color)
      tagElement.textContent = tag.name ?? tag.title
      tags.appendChild(tagElement)
    })

    meta.append(tagSeparator, tags)
  }

  const title = document.createElement('h3')
  title.textContent = item.title

  article.append(meta, title)

  if (item.image && /^https:\/\//i.test(item.image)) {
    const image = document.createElement('img')
    image.src = item.image
    image.alt = `Illustration de l’actualité « ${item.title} »`
    image.addEventListener('error', () => image.remove())
    article.appendChild(image)
  }

  const content = document.createElement('div')
  content.className = 'article-content'
  content.innerHTML = parseNews(item.content)
  article.appendChild(content)

  return article
}

export function initHome() {
  const body = document.body
  const playBtn = document.getElementById('btn-play')
  const settingsBtn = document.getElementById('btn-settings')
  const progressContainer = document.getElementById('launch-progress-container')
  const progressBar = document.getElementById('launch-progress-bar')
  const progressLabel = document.getElementById('launch-progress-label')
  const progressPercent = document.getElementById('launch-progress-percent')
  const statusDot = document.getElementById('server-status-dot')
  const statusText = document.getElementById('server-status-text')
  const playerCount = document.getElementById('player-count')
  const newsList = document.getElementById('news-list')
  const profileSelector = document.getElementById('profile-selector')
  const profileDropdown = document.getElementById('profile-dropdown')
  const currentProfileName = document.getElementById('current-profile-name')

  let selectedProfile: IProfile | null = null
  let allProfiles: IProfile[] = []
  let totalToDownload = 0
  let totalDownloadedByType: { type: string; size: number }[] = []

  const loadProfiles = async () => {
    const account = getUser()
    if (!account) return

    if (playBtn instanceof HTMLButtonElement) playBtn.disabled = true
    allProfiles = await profiles.get(account)
    if (allProfiles.length > 0) {
      selectProfile(allProfiles[0])
      renderDropdown()
      if (playBtn instanceof HTMLButtonElement) playBtn.disabled = false
      return
    }

    selectedProfile = null
    if (currentProfileName) currentProfileName.innerText = 'Profil indisponible'
    if (statusText) statusText.innerText = 'Services indisponibles'
    if (statusDot) {
      statusDot.classList.remove('online', 'pinging')
      statusDot.classList.add('offline')
    }
  }

  const renderDropdown = () => {
    if (!profileDropdown) return
    profileDropdown.replaceChildren()

    allProfiles.forEach((profile) => {
      const option = document.createElement('button')
      option.type = 'button'
      option.className = `profile-option ${selectedProfile?.id === profile.id ? 'active' : ''}`
      option.dataset.slug = profile.slug
      option.textContent = profile.name
      option.addEventListener('click', () => {
        const selected = allProfiles.find((candidate) => candidate.slug === option.dataset.slug)
        if (selected) selectProfile(selected)
        profileSelector?.classList.remove('open')
      })
      profileDropdown.appendChild(option)
    })
  }

  const selectProfile = (profile: IProfile) => {
    selectedProfile = profile
    if (currentProfileName) currentProfileName.innerText = profile.name
    renderDropdown()
    updateServerStatus()
  }

  const updateServerStatus = async () => {
    if (statusDot) {
      statusDot.classList.remove('online', 'offline')
      statusDot.classList.add('pinging')
    }
    if (statusText) statusText.textContent = 'Vérification...'
    if (playerCount) playerCount.replaceChildren()

    const status = selectedProfile?.ip ? await server.getStatus(selectedProfile.ip, selectedProfile.port || 25565) : null

    if (status) {
      if (statusDot) {
        statusDot.classList.remove('pinging', 'offline')
        statusDot.classList.add('online')
      }
      if (statusText) statusText.textContent = 'En ligne'

      if (playerCount) {
        const icon = document.createElement('i')
        icon.className = 'fa-fw fa-solid fa-users'
        const count = document.createElement('span')
        count.textContent = `${status.players.online.toLocaleString('fr-FR')} / ${status.players.max.toLocaleString('fr-FR')}`
        playerCount.append(icon, count)
      }
    } else {
      if (statusDot) {
        statusDot.classList.remove('pinging', 'online')
        statusDot.classList.add('offline')
      }
      if (statusText) statusText.textContent = 'Hors ligne'
      if (playerCount) playerCount.replaceChildren()
    }
  }

  const loadNews = async () => {
    if (!newsList) return
    newsList.innerHTML = '<div class="empty-state">Chargement des actualités...</div>'
    const feed = await news.getNews()

    newsList.innerHTML = ''

    if (!feed || feed.length === 0) {
      newsList.innerHTML = '<div class="empty-state">Aucune actualité publiée pour le moment.</div>'
      return
    }

    feed.forEach((item) => newsList.appendChild(createNewsArticle(item as NewsItem)))
  }

  document.addEventListener('launcher:user-ready', () => {
    void Promise.all([loadProfiles(), loadNews()])
  })

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

  settingsBtn?.addEventListener('click', () => {
    setView('settings')
  })

  playBtn?.addEventListener('click', async () => {
    if (!selectedProfile) {
      await Dialog.show('Aucun profil de jeu n’est disponible.', [{ text: 'Fermer', type: 'ok' }], 'Services indisponibles')
      return
    }

    setIndeterminate(true)
    if (playBtn) playBtn.style.display = 'none'
    if (progressContainer) progressContainer.classList.remove('hidden')
    if (progressBar) progressBar.style.width = '0%'
    if (progressPercent) progressPercent.innerText = '0%'

    const user = getUser()
    if (!user) return

    const config = await settings.get()

    logger.log('Lancement demandé', {
      profile: selectedProfile?.slug,
      account: user.name,
      memory: config.memory,
      java: config.java,
      resolution: config.resolution,
      launcherAction: config.launcherAction
    })
    totalDownloadedByType = []
    const result = await game.launch({ account: user, settings: config, profileSlug: selectedProfile.slug })
    if (!result.success) {
      if (playBtn) playBtn.style.display = 'block'
      progressContainer?.classList.add('hidden')
      await Dialog.show(result.error ?? 'Le lancement a échoué.', [{ text: 'Fermer', type: 'ok' }], 'Impossible de lancer Minecraft')
    }
  })

  profileSelector?.querySelector('.selected-profile')?.addEventListener('click', () => {
    profileSelector.classList.toggle('open')
  })

  body.addEventListener('click', (e) => {
    if (!profileSelector?.contains(e.target as Node)) {
      profileSelector?.classList.remove('open')
    }
  })

  game.launchComputeDownload(() => {
    setIndeterminate(true)
    if (progressLabel) progressLabel.innerText = 'Préparation du téléchargement...'
    if (progressPercent) progressPercent.innerText = ''
  })
  game.launchDownload((download) => {
    setIndeterminate(false)
    totalToDownload = download.total.size
    if (progressLabel) progressLabel.innerText = 'Téléchargement des fichiers...'
  })
  game.downloadProgress((progress) => {
    if (!totalDownloadedByType.find((t) => t.type === progress.type)) {
      totalDownloadedByType.push({ type: progress.type, size: progress.downloaded.size })
    } else {
      totalDownloadedByType[totalDownloadedByType.findIndex((t) => t.type === progress.type)].size = progress.downloaded.size
    }
    if (progressBar && progressLabel && progressPercent) {
      const downloadedSum = totalDownloadedByType.reduce((acc, curr) => acc + curr.size, 0)
      progressBar.style.width = `${Math.min((downloadedSum / totalToDownload) * 100, 100)}%`
      progressLabel.innerText = progress.type === 'JAVA' ? 'Téléchargement de Java...' : 'Téléchargement du jeu...'
      progressPercent.innerText = `${Math.round(Math.min((downloadedSum / totalToDownload) * 100, 100))}%`
    }
  })
  game.launchInstallLoader(() => {
    setIndeterminate(true)
    if (progressLabel) progressLabel.innerText = 'Extraction des fichiers...'
    if (progressPercent) progressPercent.innerText = ''
  })
  game.launchExtractNatives(() => {
    setIndeterminate(true)
    if (progressLabel) progressLabel.innerText = 'Extraction des fichiers...'
  })
  game.launchCopyAssets(() => {
    setIndeterminate(true)
    if (progressLabel) progressLabel.innerText = 'Extraction des fichiers...'
  })
  game.launchPatchLoader(() => {
    setIndeterminate(true)
    if (progressLabel) progressLabel.innerText = 'Finalisation de la configuration...'
  })
  game.launchLaunch(() => {
    setIndeterminate(true)
    if (progressLabel) progressLabel.innerText = 'Lancement de Minecraft...'
  })
  game.launched(() => {
    setTimeout(() => {
      if (playBtn) playBtn.style.display = 'block'
      if (progressContainer) progressContainer.classList.add('hidden')
      if (progressBar) progressBar.style.width = '0%'
      if (progressPercent) progressPercent.innerText = ''
    }, 10000)
  })
  game.launchError(async (message) => {
    if (playBtn) playBtn.style.display = 'block'
    progressContainer?.classList.add('hidden')
    await Dialog.show(message, [{ text: 'Fermer', type: 'ok' }], 'Impossible de lancer Minecraft')
  })
}
