import type { Account, IAvatar, ICape, ISkin } from 'eml-lib'
import { skin } from './ipc'

export interface AccountAssets {
  skins: ISkin[] | null
  capes: ICape[] | null
  avatar: IAvatar | null
}

export async function loadAccountAssets(account: Account): Promise<AccountAssets> {
  if (account.meta.type === 'crack') {
    return {
      skins: await skin.getSkin(account),
      capes: null,
      avatar: null
    }
  }

  await skin.reload(account)
  const [skins, capes, avatar] = await Promise.all([skin.getSkin(account), skin.getCape(account), skin.getAvatar(account)])

  return { skins, capes, avatar }
}
