/** 与AI对话读屏：按前台窗口识别常见 AI / IDE，少让视觉模型在整桌面里找。 */

export type EnhanceTargetApp =
  | 'cursor'
  | 'ide'
  | 'workbuddy'
  | 'doubao'
  | 'chatgpt'
  | 'claude'
  | 'kimi'
  | 'browser'
  | 'unknown'

export function detectEnhanceTargetApp(appName: string, windowTitle: string): EnhanceTargetApp {
  const app = appName.trim().toLowerCase()
  const title = windowTitle.trim().toLowerCase()
  const hay = `${app} ${title}`

  if (hay.includes('cursor')) return 'cursor'
  if (
    hay.includes('workbuddy') ||
    hay.includes('work buddy') ||
    hay.includes('工作搭子')
  ) {
    return 'workbuddy'
  }
  if (hay.includes('doubao') || hay.includes('豆包')) return 'doubao'
  if (hay.includes('chatgpt') || hay.includes('openai')) return 'chatgpt'
  if (hay.includes('claude') || hay.includes('anthropic')) return 'claude'
  if (hay.includes('kimi') || hay.includes('moonshot')) return 'kimi'
  if (
    /\b(visual studio code|vscode|vscodium|windsurf|trae|zed|antigravity)\b/.test(hay) ||
    app === 'code' ||
    app === 'visual studio code'
  ) {
    return 'ide'
  }
  if (
    /\b(chrome|chromium|safari|firefox|edge|arc|brave|orion)\b/.test(hay) ||
    app.includes('google chrome') ||
    app.includes('microsoft edge')
  ) {
    return 'browser'
  }
  return 'unknown'
}

/** 给视觉模型的短布局说明：已是当前窗口，不要扫桌面。 */
export function enhanceAppVisionHint(
  kind: EnhanceTargetApp,
  appName: string,
  windowTitle: string
): string {
  const who = [appName.trim() || '未知应用', windowTitle.trim()].filter(Boolean).join('｜')
  const head = `当前已激活窗口：${who}`
  switch (kind) {
    case 'cursor':
      return `${head}
这是 Cursor。看中间编辑器或 Agent/Composer 对话：报错红字、可见代码、上一句 AI 回复。忽略左侧文件树、顶栏、与任务无关的其它标签。`
    case 'ide':
      return `${head}
这是代码编辑器。看中间编辑区与问题面板：报错、路径、选中代码。忽略左侧文件树，除非文件名就是任务对象。`
    case 'workbuddy':
      return `${head}
这是 WorkBuddy。看主对话区最后一轮助手回复、输入框草稿、可见预览。忽略左侧会话列表。`
    case 'doubao':
      return `${head}
这是豆包。看主栏最后一轮问答与输入框，忽略侧栏历史和推荐卡片。`
    case 'chatgpt':
      return `${head}
这是 ChatGPT。看主栏最后一条助手回复与底部输入框，忽略左侧聊天列表。`
    case 'claude':
      return `${head}
这是 Claude。看主栏对话与输入框，忽略侧栏工程/历史。`
    case 'kimi':
      return `${head}
这是 Kimi。看主对话与输入框，忽略侧栏会话。`
    case 'browser':
      return `${head}
这是浏览器当前标签。看页面正文（对话、文档、报错），忽略书签栏、其它标签、地址栏广告。`
    default:
      return `${head}
只看这个窗口内部。忽略窗外桌面、菜单栏、其它应用。`
  }
}

export function formatEnhanceWindowLine(appName: string, windowTitle: string): string {
  const kind = detectEnhanceTargetApp(appName, windowTitle)
  const label =
    kind === 'cursor'
      ? 'Cursor'
      : kind === 'ide'
        ? '代码编辑器'
        : kind === 'workbuddy'
          ? 'WorkBuddy'
          : kind === 'doubao'
            ? '豆包'
            : kind === 'chatgpt'
              ? 'ChatGPT'
              : kind === 'claude'
                ? 'Claude'
                : kind === 'kimi'
                  ? 'Kimi'
                  : kind === 'browser'
                    ? '浏览器'
                    : appName.trim() || '当前窗口'
  const title = windowTitle.trim()
  return title ? `[窗口] ${label}｜${title}` : `[窗口] ${label}`
}
