/** 用户可见品牌与能力名（对外名 + 一句话解释必须成对使用） */
export const BRAND = {
  name: '口喷输入',
  tagline: '本机对话助手：记人设、攒记忆，帮你少打字',
  voice: {
    name: '我来口喷',
    blurb: '你说，我转成字并贴进当前输入框'
  },
  reply: {
    name: '帮你口喷',
    blurb: '看当前聊天截图，按人设生成回复并填入（不发送）'
  }
} as const
