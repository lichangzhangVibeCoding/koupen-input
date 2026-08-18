import { BrowserWindow } from 'electron'

export type SkillGuideStepId = 'voice' | 'aiTalk' | 'reply' | 'screenAsk'

export type SkillGuidePayload = {
  id: SkillGuideStepId
  ok: boolean
}

/** 快捷键路径跑完（贴上或 HUD 出答案）后通知训练场；UI / 硬件备用不要调 */
export function notifySkillGuideStep(id: SkillGuideStepId, ok = true): void {
  const payload: SkillGuidePayload = { id, ok }
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    win.webContents.send('skill-guide:step', payload)
  }
}
