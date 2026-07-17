import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BRAND } from '../../../shared/brand'
import type { Contact } from '../../../shared/types'

const channelLabel: Record<string, string> = {
  wechat: '微信',
  qq: 'QQ',
  unknown: '未知'
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])

  useEffect(() => {
    void window.vipChat.listContacts().then(setContacts)
  }, [])

  return (
    <section>
      <h2 className="page-title">联系人</h2>
      <p className="page-desc">
        {BRAND.reply.name} 识别后会自动建档。点进详情可为每个人设置独立人设；生成回复时只使用当前联系人的人设。
      </p>

      {contacts.length === 0 ? (
        <div className="panel empty">
          还没有联系人。打开聊天窗口后按「帮你口喷」快捷键即可自动创建。
        </div>
      ) : (
        <div className="contact-list">
          {contacts.map((c) => (
            <Link key={c.id} className="contact-item" to={`/contacts/${c.id}`}>
              <div>
                <h3>{c.displayName}</h3>
                <p>
                  <span className="badge">{channelLabel[c.channel] || c.channel}</span>
                  {c.personaTitle ? ` · ${c.personaTitle}` : ' · 未设置人设'}
                  {c.tags ? ` · ${c.tags}` : ''}
                </p>
              </div>
              <div className="status">编辑</div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
