/**
 * 看屏幕口述/打字是否走答题两步流水线（视觉读题 + 文字模型对照知识库）。
 * 宁缺勿滥：普通「帮我看看屏幕」不得误判。
 */
const ZH_HINTS = [
  '这道题',
  '这题',
  '选什么',
  '选哪个',
  '选择题',
  '判断题',
  '填空题',
  '单选',
  '多选',
  '正确答案',
  '哪个选项',
  '哪一个对',
  '帮我看题',
  '看这道题',
  '答题',
  '答案是什么',
  '该选',
  '怎么选'
]

const EN_HINTS = [
  'which option',
  'which answer',
  'correct answer',
  'multiple choice',
  'what should i pick',
  'what should i choose',
  'what should i select',
  'quiz'
]

export function isScreenQuizIntent(raw: string): boolean {
  const q = raw.trim()
  if (!q) return false
  if (ZH_HINTS.some((k) => q.includes(k))) return true
  const s = q.toLowerCase()
  return EN_HINTS.some((k) => s.includes(k))
}
