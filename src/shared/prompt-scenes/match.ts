import { GENERIC_PACK, PROMPT_SCENE_PACKS } from './packs'
import type { PromptScenePack } from './types'

function normalize(s: string): string {
  return s.trim().toLowerCase()
}

function countHits(haystack: string, words: string[] | undefined): number {
  if (!words?.length) return 0
  let n = 0
  for (const w of words) {
    const t = normalize(w)
    if (t && haystack.includes(t)) n += 1
  }
  return n
}

function scorePack(spoken: string, screen: string, pack: PromptScenePack): number {
  const spokenN = normalize(spoken)
  const screenN = normalize(screen)
  const all = `${spokenN}\n${screenN}`

  if (pack.excludeTriggers?.length) {
    for (const ex of pack.excludeTriggers) {
      if (all.includes(normalize(ex))) return 0
    }
  }

  const spokenHits = countHits(spokenN, pack.triggers)
  const screenHits = countHits(screenN, pack.screenTriggers)
  const total = spokenHits + screenHits
  if (total <= 0) return 0
  return total * (pack.weight ?? 1)
}

/** 根据口述 + 屏幕摘要选场景包；无人命中则 generic */
export function matchPromptScene(spoken: string, screenNotes: string): PromptScenePack {
  let best: PromptScenePack | null = null
  let bestScore = 0
  let bestPriority = -1

  for (const pack of PROMPT_SCENE_PACKS) {
    const score = scorePack(spoken, screenNotes, pack)
    if (score <= 0) continue
    if (
      score > bestScore ||
      (score === bestScore && pack.priority > bestPriority)
    ) {
      best = pack
      bestScore = score
      bestPriority = pack.priority
    }
  }

  return best ?? GENERIC_PACK
}

export function formatPromptSceneBlock(pack: PromptScenePack): string {
  return `【本轮代理：${pack.name}（${pack.id}）】
${pack.agentInstruction}
输出骨架：${pack.outputSkeleton}
允许补全：${pack.allowFill}
禁止：${pack.forbid}`
}
