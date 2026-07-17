import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BRAND } from '../../../shared/brand'
import {
  DOUBLE_ALT_HOTKEY,
  DOUBLE_COMMAND_HOTKEY,
  formatHotkeyLabel,
  formatVoiceTriggerLabel,
  isModifierDoubleHotkey
} from '../../../shared/hotkey'
import { AppSettings, DEFAULT_SETTINGS } from '../../../shared/types'

export default function SettingsPage() {
  const [platform, setPlatform] = useState('darwin')
  const [form, setForm] = useState<AppSettings>({ ...DEFAULT_SETTINGS })
  const [status, setStatus] = useState<{ type: '' | 'ok' | 'err'; text: string }>({
    type: '',
    text: ''
  })
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState('')
  const [includeSecrets, setIncludeSecrets] = useState(false)

  const isWin = platform === 'win32'
  const defaultDouble = isWin ? DOUBLE_ALT_HOTKEY : DOUBLE_COMMAND_HOTKEY
  const doubleLabel = isWin ? '快速双击 Alt（推荐）' : '快速双击左 Command（推荐）'
  const doubleHint = isWin
    ? '约 0.4 秒内连按两次 Alt'
    : '约 0.4 秒内连按两次空格键左侧的 Command'
  const customFallback = isWin ? 'Control+Shift+V' : 'Command+8'
  const customPlaceholder = isWin ? '例如 Control+Shift+V' : '例如 Command+8'

  useEffect(() => {
    void window.vipChat.getPlatform().then(setPlatform)
    void window.vipChat.getSettings().then(setForm)
  }, [])

  async function onSave() {
    setSaving(true)
    setStatus({ type: '', text: '' })
    try {
      const res = await window.vipChat.saveSettings(form)
      setStatus({
        type: res.ok ? 'ok' : 'err',
        text: res.ok
          ? `已保存，帮你口喷：${formatHotkeyLabel(res.hotkey, platform)}`
          : `已保存，但快捷键注册失败：${formatHotkeyLabel(res.hotkey, platform)}`
      })
    } catch (e) {
      setStatus({ type: 'err', text: e instanceof Error ? e.message : String(e) })
    } finally {
      setSaving(false)
    }
  }

  async function onExport() {
    setBusy('export')
    setStatus({ type: '', text: '' })
    try {
      const res = await window.vipChat.exportSettings(includeSecrets)
      if ('canceled' in res && res.canceled) {
        setStatus({ type: '', text: '' })
        return
      }
      if (res.ok) {
        setStatus({
          type: 'ok',
          text: `已导出到：${res.path}${includeSecrets ? '（含 API Key，请妥善保管）' : '（不含 API Key）'}`
        })
      } else {
        setStatus({
          type: 'err',
          text: 'error' in res ? res.error : '导出失败'
        })
      }
    } catch (e) {
      setStatus({ type: 'err', text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy('')
    }
  }

  async function onReset() {
    const ok = window.confirm(
      '确定还原默认配置？\n\n会清除：快捷键、模型偏好、API Key 等设置。\n不会删除：联系人列表与聊天记录。'
    )
    if (!ok) return
    setBusy('reset')
    setStatus({ type: '', text: '' })
    try {
      const res = await window.vipChat.resetSettingsDefaults()
      setForm(res.settings)
      setStatus({
        type: res.ok ? 'ok' : 'err',
        text: res.ok
          ? `已还原默认配置：${formatHotkeyLabel(res.hotkey, platform)}（联系人与聊天未动）`
          : `已还原配置，但快捷键注册失败：${formatHotkeyLabel(res.hotkey, platform)}`
      })
    } catch (e) {
      setStatus({ type: 'err', text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy('')
    }
  }

  return (
    <section>
      <h2 className="page-title">设置</h2>
      <p className="page-desc">
        快捷键与开关。模型请到 <Link to="/models">模型</Link> 页配置。
      </p>

      <div className="panel">
        <div className="field">
          <label>
            {BRAND.reply.name} · 快捷键
          </label>
          <p className="status" style={{ marginTop: 0 }}>
            {BRAND.reply.blurb}
          </p>
          <select
            value={isModifierDoubleHotkey(form.hotkey) ? defaultDouble : 'custom'}
            onChange={(e) => {
              if (e.target.value === defaultDouble) {
                setForm({ ...form, hotkey: defaultDouble })
              } else {
                setForm({
                  ...form,
                  hotkey: isModifierDoubleHotkey(form.hotkey) ? customFallback : form.hotkey
                })
              }
            }}
          >
            <option value={defaultDouble}>{doubleLabel}</option>
            <option value="custom">自定义快捷键</option>
          </select>
          {!isModifierDoubleHotkey(form.hotkey) ? (
            <input
              style={{ marginTop: 8 }}
              value={form.hotkey}
              onChange={(e) => setForm({ ...form, hotkey: e.target.value })}
              placeholder={customPlaceholder}
            />
          ) : (
            <p className="status">{doubleHint}</p>
          )}
        </div>

        <div className="field">
          <label>
            <input
              type="checkbox"
              checked={form.voiceInputEnabled}
              onChange={(e) => setForm({ ...form, voiceInputEnabled: e.target.checked })}
            />{' '}
            启用 {BRAND.voice.name}
          </label>
          <p className="status">{BRAND.voice.blurb}</p>
          <p className="status">
            触发：{formatVoiceTriggerLabel(platform)}（勿与双击混淆）
          </p>
        </div>

        <div className="field">
          <label>回复上下文条数（最近 N 条）</label>
          <input
            type="number"
            min={10}
            max={200}
            value={form.contextWindowSize}
            onChange={(e) =>
              setForm({ ...form, contextWindowSize: Number(e.target.value) || 40 })
            }
          />
        </div>

        <div className="row">
          <button className="btn" disabled={saving} onClick={() => void onSave()}>
            {saving ? '保存中…' : '保存'}
          </button>
          <Link className="btn secondary" to="/models">
            去配置模型
          </Link>
        </div>
        {status.text ? <p className={`status ${status.type}`}>{status.text}</p> : null}
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <h3 style={{ marginTop: 0 }}>配置与数据</h3>
        <p className="status">
          个性化配置单独保存在本机配置文件；联系人与聊天在业务数据库，互不影响。
        </p>
        <div className="field">
          <label>
            <input
              type="checkbox"
              checked={includeSecrets}
              onChange={(e) => setIncludeSecrets(e.target.checked)}
            />{' '}
            导出时包含 API Key（默认不包含，勾选后请勿外传）
          </label>
        </div>
        <div className="row">
          <button
            className="btn secondary"
            disabled={Boolean(busy)}
            onClick={() => void onExport()}
          >
            {busy === 'export' ? '导出中…' : '导出配置…'}
          </button>
          <button
            className="btn secondary"
            disabled={Boolean(busy)}
            onClick={() => void onReset()}
          >
            {busy === 'reset' ? '还原中…' : '还原默认配置'}
          </button>
        </div>
        <p className="status" style={{ marginTop: 10 }}>
          「还原默认配置」只清设置，不会删除联系人与聊天。
        </p>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <h3 style={{ marginTop: 0 }}>{isWin ? 'Windows 提示' : 'Mac 权限'}</h3>
        {isWin ? (
          <>
            <p className="status">请允许本应用使用：</p>
            <ul className="perm-list">
              <li>麦克风 — {BRAND.voice.name}</li>
              <li>屏幕捕获 — {BRAND.reply.name}</li>
              <li>若粘贴失败，请以管理员以外的普通权限运行，并确认前台窗口可接收 Ctrl+V</li>
            </ul>
          </>
        ) : (
          <>
            <p className="status">系统设置 → 隐私与安全性，请允许本应用：</p>
            <ul className="perm-list">
              <li>麦克风 — {BRAND.voice.name}</li>
              <li>屏幕录制 — {BRAND.reply.name}</li>
              <li>辅助功能 — 粘贴文字、监听左 Command</li>
            </ul>
          </>
        )}
      </div>
    </section>
  )
}
