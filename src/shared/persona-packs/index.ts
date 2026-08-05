import { t } from '../i18n'
import { STREAMER_FREE_V1 } from './streamer-free-v1'
import type { PersonaPack, PersonaPackId, PersonaPackOption } from './types'

export type { PersonaPack, PersonaPackId, PersonaPackOption, Scenario } from './types'
export { matchScenario, formatScenarioPromptBlock, buildThemHaystack } from './match-scenario'

const PACKS: Record<Exclude<PersonaPackId, 'none'>, PersonaPack> = {
  'streamer-free-v1': STREAMER_FREE_V1
}

export function listPersonaPackOptions(): PersonaPackOption[] {
  return [
    {
      id: 'none',
      name: t('persona.none'),
      blurb: t('settings.persona.hint')
    },
    {
      id: STREAMER_FREE_V1.id,
      name: t('persona.streamerFree'),
      blurb: STREAMER_FREE_V1.blurb
    }
  ]
}

export function getPersonaPack(id: PersonaPackId | string | undefined | null): PersonaPack | null {
  if (!id || id === 'none') return null
  return PACKS[id as Exclude<PersonaPackId, 'none'>] ?? null
}

export function isPersonaPackId(v: unknown): v is PersonaPackId {
  return v === 'none' || v === 'streamer-free-v1'
}
