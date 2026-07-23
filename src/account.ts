import type { Account, IAvatar, ICape, ISkin } from 'eml-lib'
import { skin } from './ipc'

export interface AccountAssets {
  skins: ISkin[] | null
  capes: ICape[] | null
  avatar: IAvatar | null
}

function settledValue<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === 'fulfilled' ? result.value : null
}

export async function loadAccountAssets(account: Account): Promise<AccountAssets> {
  if (account.meta.type === 'crack') {
    const [skins] = await Promise.allSettled([skin.getSkin(account)])

    return {
      skins: settledValue(skins),
      capes: null,
      avatar: null
    }
  }

  await Promise.allSettled([skin.reload(account)])
  const [skins, capes, avatar] = await Promise.allSettled([skin.getSkin(account), skin.getCape(account), skin.getAvatar(account)])

  return {
    skins: settledValue(skins),
    capes: settledValue(capes),
    avatar: settledValue(avatar)
  }
}
