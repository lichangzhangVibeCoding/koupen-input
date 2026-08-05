/** 帮助页场景导览（与官网 website/js/i18n.js scenarios.* 对齐） */

export type LocaleText = { zh: string; en: string }

export type HelpScenarioCard = {
  title: LocaleText
  desc: LocaleText
  tags: LocaleText[]
}

export type HelpScenarioGroup = {
  id: 'voice' | 'reply' | 'screen' | 'quiz'
  /** 对应 brand 能力名；页面用 brand.* 覆盖展示名 */
  name: LocaleText
  tag: LocaleText
  /** 应用内如何用（含快捷键占位 {hotkey}） */
  how: LocaleText
  cards?: HelpScenarioCard[]
  /** 答题等紧凑组用单段说明 */
  banner?: LocaleText
  bannerTags?: LocaleText[]
}

function L(zh: string, en: string): LocaleText {
  return { zh, en }
}

export const HELP_SCENARIO_GROUPS: HelpScenarioGroup[] = [
  {
    id: 'voice',
    name: L('语音转文字', 'Voice Input'),
    tag: L('说比打快', 'Faster than typing'),
    how: L(
      '把光标放进微信 / 邮件 / 文档输入框，按住快捷键 {hotkey} 说话，松手后文字自动贴入。',
      'Focus a WeChat / email / doc field, hold {hotkey} to speak, release to paste text.'
    ),
    cards: [
      {
        title: L('微信聊天懒得打字', 'WeChat without typing'),
        desc: L(
          '说一段话，自动变成消息文字贴进输入框，比一条条敲字快太多。',
          'Say a full sentence and it becomes message text — way faster than pecking at keys.'
        ),
        tags: [L('微信', 'WeChat')]
      },
      {
        title: L('口述回邮件', 'Dictate email replies'),
        desc: L(
          '对着麦克风说完整段，一键填进邮件正文，比手打效率高。',
          'Speak a whole paragraph into the mic, paste it into your email, done.'
        ),
        tags: [L('邮件', 'Email')]
      },
      {
        title: L('边想边说写初稿', 'Talk out your first draft'),
        desc: L(
          '写方案、写稿子时嘴巴比手快，说完就是一篇初稿。',
          'When writing a proposal, your mouth is faster than your hands. Speak it, get a draft.'
        ),
        tags: [L('写稿', 'Writing'), L('方案', 'Proposals')]
      },
      {
        title: L('随手记灵感', 'Capture ideas on the go'),
        desc: L(
          '走路、做饭、通勤时灵感来了，张口说，自动记成文字。',
          'Walking, cooking, commuting — talk and it auto-transcribes your ideas to text.'
        ),
        tags: [L('灵感', 'Ideas'), L('通勤', 'Commute')]
      }
    ]
  },
  {
    id: 'reply',
    name: L('帮我对话', 'Reply Helper'),
    tag: L('回不过来交给它', 'Let it draft for you'),
    how: L(
      '打开聊天窗口，按快捷键 {hotkey}。它会看当前对话画面，按联系人人设起草回复并贴入（不会自动发送）。',
      'Open a chat, press {hotkey}. It reads the chat window, drafts a reply with the contact persona, and pastes it (never auto-sends).'
    ),
    cards: [
      {
        title: L('工作消息秒回', 'Instant work replies'),
        desc: L(
          '微信、飞书、钉钉里消息回不过来，AI 先帮你拟一版，你改改就发。',
          'WeChat, Feishu, DingTalk messages piling up? AI drafts a reply — you tweak and send.'
        ),
        tags: [L('微信', 'WeChat'), L('飞书', 'Feishu'), L('钉钉', 'DingTalk')]
      },
      {
        title: L('不知道咋回得体', 'When you are stuck for words'),
        desc: L(
          'QQ 群、同学群里不好接的话，交给它起草，帮你拿捏分寸。',
          'QQ groups, class chats — tricky messages you do not know how to answer? Let it draft.'
        ),
        tags: [L('QQ', 'QQ'), L('同学群', 'Class chat')]
      },
      {
        title: L('交友破冰不尴尬', 'Break the ice'),
        desc: L(
          'Soul、处对象等社交软件上，帮你想话题、写破冰白，提高交友技能。',
          'Soul, dating apps — AI helps you come up with topics and openers that actually work.'
        ),
        tags: [L('Soul', 'Soul'), L('交友', 'Dating')]
      },
      {
        title: L('邮件回复不犯愁', 'Email replies without dread'),
        desc: L(
          '收到邮件不知道怎么回，它看完上下文直接帮你写好回信。',
          "Got an email you don't know how to answer? It reads the context and writes the reply."
        ),
        tags: [L('邮件', 'Email')]
      }
    ]
  },
  {
    id: 'screen',
    name: L('看屏幕', 'Screen Reader'),
    tag: L('屏幕上啥都能问', 'Ask anything on screen'),
    how: L(
      '按快捷键 {hotkey}，用语音说明要干什么（比价、翻译、解释……）。它看着整屏按你说的办。',
      'Press {hotkey} and say what you need (price check, translate, explain…). It looks at the whole screen and follows.'
    ),
    cards: [
      {
        title: L('商品比价', 'Price check'),
        desc: L(
          '屏幕上看到某个商品，问一句「这价格咋样」，AI 帮你看一眼。',
          'See a product on screen? Ask "is this a good price?" and AI takes a look.'
        ),
        tags: [L('比价', 'Pricing'), L('购物', 'Shopping')]
      },
      {
        title: L('即时翻译', 'Instant translation'),
        desc: L(
          '页面上一大段英文，让 AI 当场翻译成中文，不用复制来复制去。',
          'A wall of English on a page? AI translates it on the spot — no copy-pasting.'
        ),
        tags: [L('翻译', 'Translate'), L('英文', 'English')]
      },
      {
        title: L('论文解读', 'Paper explainer'),
        desc: L(
          '学术论文里高亮的段落，让 AI 展开解释一下到底啥意思。',
          'Highlight a paragraph in a paper? AI expands and explains what it means.'
        ),
        tags: [L('论文', 'Papers'), L('学术', 'Academic')]
      },
      {
        title: L('作业检查', 'Homework check'),
        desc: L(
          '拍下孩子的作业，让 AI 看看哪几题做错了，省心省力。',
          "Snap your kid's homework — AI checks which answers are wrong. Effortless."
        ),
        tags: [L('作业', 'Homework'), L('教育', 'Education')]
      }
    ]
  },
  {
    id: 'quiz',
    name: L('看屏幕答题', 'Quiz Solver'),
    tag: L('看一眼就出答案', 'Look and answer'),
    how: L(
      '题目开在屏幕上，按快捷键 {hotkey}。它读题后直接给出正确答案（可结合本机知识库）。',
      'With the question on screen, press {hotkey}. It reads the question and gives the answer (optional local knowledge base).'
    ),
    banner: L(
      '网课测验、选择判断、限时抢答——让 AI 看一眼屏幕，直接给你答案。',
      'Online quizzes, multiple choice, timed tests — let AI look at the screen and give you the answer.'
    ),
    bannerTags: [L('网课', 'Courses'), L('测验', 'Quizzes'), L('抢答', 'Timed')]
  }
]

export function pickLocaleText(text: LocaleText, locale: string): string {
  return locale.startsWith('en') ? text.en : text.zh
}
