import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BRAND } from '../../../shared/brand'
import { formatHotkeyLabel, formatVoiceTriggerLabel } from '../../../shared/hotkey'

export default function HomePage() {
  const [platform, setPlatform] = useState('darwin')
  const [hotkeyLabel, setHotkeyLabel] = useState('快速双击左 Command')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    void (async () => {
      const [p, s] = await Promise.all([
        window.vipChat.getPlatform(),
        window.vipChat.getSettings()
      ])
      setPlatform(p)
      setHotkeyLabel(formatHotkeyLabel(s.hotkey, p))
    })()
  }, [])

  async function trigger() {
    setBusy(true)
    setMsg('')
    try {
      await window.vipChat.runPipeline()
      setMsg('已触发帮你口喷：请看屏幕下方状态提示')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const isWin = platform === 'win32'

  return (
    <section className="home-hero">
      <h1>{BRAND.name}</h1>
      <p className="home-tagline">{BRAND.tagline}</p>

      <div className="capability-grid">
        <div className="capability-card">
          <h2>{BRAND.voice.name}</h2>
          <p className="capability-blurb">{BRAND.voice.blurb}</p>
          <p className="status">
            触发：<span className="kbd">{formatVoiceTriggerLabel(platform)}</span>
          </p>
          <button
            className="btn secondary"
            onClick={() => void window.vipChat.toggleVoiceInput()}
          >
            手动开始 / 结束
          </button>
        </div>
        <div className="capability-card">
          <h2>{BRAND.reply.name}</h2>
          <p className="capability-blurb">{BRAND.reply.blurb}</p>
          <p className="status">
            触发：打开聊天窗口，<span className="kbd">{hotkeyLabel}</span>
          </p>
          <button className="btn" disabled={busy} onClick={() => void trigger()}>
            {busy ? '处理中…' : '手动触发一次'}
          </button>
        </div>
      </div>

      <p className="status" style={{ marginTop: 18 }}>
        新用户请先到 <Link to="/models">模型</Link> 页，用「硅基推荐」或「本地套件」把两件事跑通。
      </p>
      <div className="row" style={{ marginTop: 12 }}>
        <Link className="btn secondary" to="/models">
          配置模型
        </Link>
        <Link className="btn secondary" to="/settings">
          设置
        </Link>
        <Link className="btn secondary" to="/contacts">
          联系人
        </Link>
      </div>
      {msg ? <p className={`status ${msg.includes('失败') || msg.includes('Error') ? 'err' : 'ok'}`}>{msg}</p> : null}
      <p className="status">
        {isWin
          ? 'Windows 需允许麦克风与屏幕捕获。详见'
          : 'macOS 需授予：屏幕录制、麦克风、辅助功能。详见'}{' '}
        <Link to="/settings">设置</Link>。
      </p>
    </section>
  )
}
