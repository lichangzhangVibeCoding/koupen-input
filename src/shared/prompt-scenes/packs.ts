import type { PromptGoldTest, PromptScenePack } from './types'

export const WEBSITE_PACK: PromptScenePack = {
  id: 'website',
  siteCard: '做网站增强',
  name: '做网站',
  triggers: ['官网', '网站', '网页', '建站', '落地页', '网店'],
  excludeTriggers: ['ppt', '幻灯', '幻灯片', '课件'],
  priority: 20,
  weight: 1,
  outputSkeleton:
    '写成「请做一个…网站」的祈使任务；按页面或功能模块编号（如首页、关于、产品、联系）。',
  allowFill:
    '用户点到的功能按模块展开。可补导航、简洁易用、响应式、适配手机和电脑。不要把未提到的行业示例写成默认模块。',
  forbid: '不要写成 HTML 幻灯分页稿，不要写成纯分析 brief，不要编造用户没提的品牌和数字。'
}

export const PPT_PACK: PromptScenePack = {
  id: 'ppt',
  siteCard: '做 PPT 增强',
  name: '做 PPT',
  triggers: [
    'ppt',
    'PPT',
    '幻灯',
    '幻灯片',
    '课件',
    '演示文稿',
    '做十页',
    '做几页',
    'slides',
    'powerpoint'
  ],
  priority: 40,
  weight: 2,
  outputSkeleton:
    '写成「请按页生成 HTML 幻灯片」：每一页是一屏 HTML（可用简单翻页），必须用「第 N 页」列出标题和 3～5 条要点，覆盖用户提到的章节。明确要求输出 HTML 幻灯，不要 .ppt / .pptx 文件。',
  allowFill:
    '用户没说页数时可给一个合理页数（约 8～12 页）并说明可改。统一风格、少大段正文。可约定单文件 HTML、键盘或点击翻页。',
  forbid:
    '禁止生成或要求下载 PowerPoint / .ppt / .pptx。不要写成网站/App 功能清单，不要输出无关后台系统。'
}

export const DEBUG_PACK: PromptScenePack = {
  id: 'debug',
  siteCard: '写代码 / 修 Bug',
  name: '写代码 / 修 Bug',
  triggers: [
    '修这个',
    '修一下',
    '报错',
    'bug',
    'Bug',
    '崩溃',
    '调试',
    '改代码',
    '写代码',
    '这个错',
    '红字'
  ],
  screenTriggers: [
    'error',
    'Error',
    'Exception',
    'Traceback',
    'TypeError',
    'failed',
    '失败',
    'panic',
    'undefined'
  ],
  priority: 50,
  weight: 2,
  outputSkeleton:
    '按「现象 → 复现 → 期望结果 → 允许改动的范围」写成调试指令；屏幕上的报错、文件名必须原文写入。',
  allowFill: '可要求先定位再改、列出将改哪些文件、不要动无关目录。',
  forbid: '不要新开网站/PPT/方案需求，不要编造屏幕上没有的路径或报错，不要写成购物车类功能清单。'
}

export const BRIEF_PACK: PromptScenePack = {
  id: 'brief',
  siteCard: '写方案 / 问 ChatGPT',
  name: '写方案 / 问 ChatGPT',
  triggers: [
    '方案',
    '周报',
    '策划',
    '分析',
    '帮我想',
    '出一份',
    'brief',
    '提纲',
    '结构',
    '问chatgpt',
    '问 ChatGPT'
  ],
  excludeTriggers: ['官网', '网站', 'ppt', '幻灯', '报错', '修这个'],
  priority: 15,
  weight: 1,
  outputSkeleton:
    '写成完整 brief，必须含三块：**目标**、**约束**、**输出格式**（例如分点、表格、字数）。',
  allowFill: '可补读者是谁、不要写什么、先给大纲再展开。',
  forbid: '不要写成代码补丁，不要写成整站或 PowerPoint 文件，也不要写成 HTML 幻灯实现稿。'
}

export const GENERIC_PACK: PromptScenePack = {
  id: 'generic',
  siteCard: null,
  name: '通用任务',
  triggers: [],
  priority: 0,
  weight: 1,
  outputSkeleton: '改成对 Agent 的祈使任务，口语拆成可执行编号条目。',
  allowFill: '轻度补全该类任务常见的一层要求（验收、不要做什么）。按语境修口误。',
  forbid:
    '不要默认套用建站电商模块。不要编造用户没提的行业、品牌、路径、报错、数字。'
}

export const PROMPT_SCENE_PACKS: PromptScenePack[] = [
  DEBUG_PACK,
  PPT_PACK,
  WEBSITE_PACK,
  BRIEF_PACK
]

/** 加包必过的口试（文档与回归共用） */
export const PROMPT_GOLD_TESTS: PromptGoldTest[] = [
  {
    id: 'website-company',
    spoken: '我想做一个公司官网，要有产品介绍和联系我们',
    expect: 'website'
  },
  {
    id: 'ppt-fundraising',
    spoken: '做十页融资 PPT，讲市场、产品、团队',
    expect: 'ppt'
  },
  {
    id: 'debug-fix-this',
    spoken: '修这个',
    screenNotes: 'TypeError: Cannot read properties of undefined\nsrc/main/llm.ts',
    expect: 'debug'
  },
  {
    id: 'brief-weekly',
    spoken: '帮我想周报结构',
    expect: 'brief'
  },
  {
    id: 'generic-vague',
    spoken: '帮我弄一下这个',
    screenNotes: '无相关上下文',
    expect: 'generic'
  }
]
