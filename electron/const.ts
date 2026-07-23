const withoutTrailingSlash = (value: string) => value.replace(/\/+$/, '')

export const APP_TITLE = 'Fefe du 973 Launcher'
export const ADMINTOOL_URL = withoutTrailingSlash(process.env.EML_ADMINTOOL_URL ?? 'https://launcher.mc.fefe-du-973.fr')
export const GAME_ROOT = 'fefedu973'
export const MINECRAFT_SERVER = {
  host: 'mc.fefe-du-973.fr',
  port: 25565
} as const
export const LINKS = {
  website: 'https://fefe-du-973.fr',
  launcher: 'https://launcher.mc.fefe-du-973.fr',
  github: 'https://github.com/Fefedu973/Fefe_du_973-Launcher'
} as const
