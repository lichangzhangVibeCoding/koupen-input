import type { Message } from '../types'
import type { PersonaPack, Scenario } from './types'

const THEM_LOOKBACK = 6

function normalize(s: string): string {
  return s.trim().toLowerCase()
}

/** 只取对方（them）最近若干条，拼成匹配文本 */
export function buildThemHaystack(history: Message[], limit = THEM_LOOKBACK): string {
  const them = history
    .filter((m) => m.role === 'them')
    .slice(-limit)
    .map((m) => m.contentText)
  return normalize(them.join('\n'))
}

function countHits(haystack: string, words: string[]): number {
  let n = 0
  for (const w of words) {
    const t = normalize(w)
    if (t && haystack.includes(t)) n += 1
  }
  return n
}

function scoreScenario(haystack: string, scenario: Scenario): number {
  if (!haystack) return 0

  if (scenario.excludeTriggers?.length) {
    for (const ex of scenario.excludeTriggers) {
      if (haystack.includes(normalize(ex))) return 0
    }
  }

  const triggerHits = countHits(haystack, scenario.triggers)
  if (triggerHits <= 0) return 0

  if (scenario.requireAny?.length) {
    const reqHits = countHits(haystack, scenario.requireAny)
    if (reqHits <= 0) return 0
  }

  return triggerHits * (scenario.weight ?? 1)
}

/** 从性格包中匹配最高分场景；无命中返回 null */
export function matchScenario(
  pack: PersonaPack | null | undefined,
  history: Message[]
): Scenario | null {
  if (!pack?.scenarios?.length) return null
  const haystack = buildThemHaystack(history)

  let best: Scenario | null = null
  let bestScore = 0
  let bestPriority = -1

  for (const s of pack.scenarios) {
    const score = scoreScenario(haystack, s)
    if (score <= 0) continue
    if (
      score > bestScore ||
      (score === bestScore && (s.priority ?? 0) > bestPriority)
    ) {
      best = s
      bestScore = score
      bestPriority = s.priority ?? 0
    }
  }

  return best
}

export function formatScenarioPromptBlock(scenario: Scenario): string {
  const tactics = scenario.tactics.map((t) => `- ${t}`).join('\n')
  const examples = scenario.exampleReplies.map((t) => `- ${t}`).join('\n')
  const anti = scenario.antiPatterns.map((t) => `- ${t}`).join('\n')
  return `【当前命中场景：${scenario.name}】
目标：${scenario.goal}
技巧：
${tactics}
可参考语气（勿照抄）：
${examples}
千万不要：
${anti}`
}
