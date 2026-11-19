/** 帮助页场景导览（与官网 lizhenning other/typenow 四能力口径对齐；内部清单 docs/ops-copy-sync.md） */

export type LocaleText = { zh: string; en: string }

export type HelpScenarioCard = {
  title: LocaleText
  desc: LocaleText
  tags: LocaleText[]
}

export type HelpScenarioGroup = {
  id: 'voice' | 'aiTalk' | 'reply' | 'screen'
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
    name: L('即刻对话', 'TalkNow'),
    tag: L('说比打快', 'Faster than typing'),
    how: L(
      '把光标放进输入框。点按快捷键 {hotkey} 开始/结束，贴的是你说的话（可去水词、改错别字，不会自动发送）。',
      'Focus an input field. Tap {hotkey} to start/stop and paste what you said (optional filler-strip / typo-fix; never auto-sends).'
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
        title: L('对着 Cursor 说，别敲', 'Speak into Cursor instead of typing'),
        desc: L(
          '在 Cursor、IDE 输入框里点按说话：注释、想改哪、给 AI 的一句指令，原话贴进去。这是贴原话，不是按住增强。',
          'Tap in Cursor or an IDE: comments, what to change, a one-line instruction. Pastes verbatim — not hold-to-enhance.'
        ),
        tags: [L('Cursor', 'Cursor'), L('IDE', 'IDE')]
      }
    ]
  },
  {
    id: 'aiTalk',
    name: L('与AI对话', 'Talk to AI'),
    tag: L('按住增强提示词', 'Hold to enhance prompts'),
    how: L(
      '对着 WorkBuddy、豆包、Cursor、ChatGPT 等输入框，按住快捷键 {hotkey} 说话，松手后把口语整理成能执行的提示词再贴入（不会自动发送）。首页第二行也可点按开始、再点结束。',
      'Focus WorkBuddy, Doubao, Cursor, or ChatGPT. Hold {hotkey} and speak; on release we turn speech into a prompt the AI can run (never auto-sends). The Home second row can tap to start / tap again to finish.'
    ),
    cards: [
      {
        title: L('做网站增强', 'Build a website faster'),
        desc: L(
          '对着 WorkBuddy、豆包、Cursor 按住说需求，松手后整理成可执行的开发提示词。',
          'Hold and speak into WorkBuddy, Doubao, or Cursor — spoken words become an executable build prompt.'
        ),
        tags: [L('WorkBuddy', 'WorkBuddy'), L('豆包', 'Doubao'), L('Cursor', 'Cursor')]
      },
      {
        title: L('做 PPT 增强', 'Make a better PPT brief'),
        desc: L(
          '口述大纲与重点，增强成「按页结构生成幻灯片」的清晰指令。',
          'Dictate the outline and key points; it becomes a clear “generate slides page by page” instruction.'
        ),
        tags: [L('PPT', 'PPT'), L('演示', 'Slides')]
      },
      {
        title: L('写代码 / 修 Bug', 'Write code / fix a bug'),
        desc: L(
          '口语报错、改哪、期望结果，整理成 AI 能直接动手的调试提示。',
          'Say the error, what to change, and the expected result — rewritten as a debug prompt the AI can act on.'
        ),
        tags: [L('代码', 'Code'), L('调试', 'Debug')]
      },
      {
        title: L('写方案 / 问 ChatGPT', 'Brief ChatGPT for a proposal'),
        desc: L(
          '对着 ChatGPT、WorkBuddy 按住说散乱想法，改写成带目标、约束、输出格式的完整 brief。',
          'Hold and dump messy ideas into ChatGPT or WorkBuddy; they become a brief with goal, constraints, and output format.'
        ),
        tags: [L('ChatGPT', 'ChatGPT'), L('WorkBuddy', 'WorkBuddy')]
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
      '按快捷键 {hotkey}，用语音说明要干什么。题目在屏幕上时可以说「请帮我看这道题选什么」。',
      'Press {hotkey} and say what you need. If a question is on screen, say something like “which option should I pick?”.'
    ),
    cards: [
      {
        title: L('看屏幕答题', 'Screen quiz'),
        desc: L(
          '触发看屏幕后说「请帮我看这道题选什么」，它读题并给出正确答案。',
          'After Screen Ask, say “which option should I pick?” — it reads the question and gives the answer.'
        ),
        tags: [L('答题', 'Quiz'), L('测验', 'Test')]
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
  }
]

export function pickLocaleText(text: LocaleText, locale: string): string {
  return locale.startsWith('en') ? text.en : text.zh
}
