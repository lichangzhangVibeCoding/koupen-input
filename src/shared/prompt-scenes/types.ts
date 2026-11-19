export type PromptSceneId = 'website' | 'ppt' | 'debug' | 'brief' | 'generic'

export type PromptScenePack = {
  id: PromptSceneId
  /** 与官网「与AI对话」卡对齐；generic 无卡 */
  siteCard: string | null
  name: string
  /** 口述命中词 */
  triggers: string[]
  /** 屏幕摘要命中词（报错、代码等） */
  screenTriggers?: string[]
  excludeTriggers?: string[]
  priority: number
  weight: number
  /** 注入线上模型的角色：本轮只扮演这一类任务代理 */
  agentInstruction: string
  /** 注入文字模型的场景约定 */
  outputSkeleton: string
  allowFill: string
  forbid: string
}

export type PromptGoldTest = {
  id: string
  spoken: string
  screenNotes?: string
  expect: PromptSceneId
}
