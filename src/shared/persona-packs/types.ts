export type PersonaPackId = 'none' | 'streamer-free-v1'

export interface Scenario {
  id: string
  name: string
  /** HUD 短名 */
  shortName: string
  /** 越大越优先（并列或冲突时） */
  priority: number
  /** 关键词（在对方近期消息中匹配） */
  triggers: string[]
  /** 出现则否决本场景 */
  excludeTriggers?: string[]
  /**
   * 加强条件：至少命中其中一词（与 triggers 同时满足）
   * 用于约饭防误伤「吃了吗」
   */
  requireAny?: string[]
  goal: string
  tactics: string[]
  exampleReplies: string[]
  antiPatterns: string[]
  weight?: number
}

export interface PersonaPack {
  id: Exclude<PersonaPackId, 'none'>
  name: string
  blurb: string
  version: string
  defaultPersona: {
    title: string
    prompt: string
    tags: string[]
  }
  hardRules: string[]
  scenarios: Scenario[]
}

export interface PersonaPackOption {
  id: PersonaPackId
  name: string
  blurb: string
}
