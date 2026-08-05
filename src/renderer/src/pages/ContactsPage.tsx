import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Contact } from '../../../shared/types'
import { useI18n } from '../i18n'

export default function ContactsPage() {
  const { t, brand } = useI18n()
  const [contacts, setContacts] = useState<Contact[]>([])

  useEffect(() => {
    void window.vipChat.listContacts().then(setContacts)
  }, [])

  function channelLabel(channel: string): string {
    if (channel === 'wechat') return t('contacts.channelWechat')
    if (channel === 'qq') return t('contacts.channelQq')
    return t('contacts.channelOther')
  }

  return (
    <section>
      <h2 className="page-title">{t('contacts.title')}</h2>
      <p className="page-desc">{t('contacts.pageDesc', { reply: brand.reply.name })}</p>

      {contacts.length === 0 ? (
        <div className="panel empty">
          {t('contacts.emptyFull', { reply: brand.reply.name })}
        </div>
      ) : (
        <div className="contact-list">
          {contacts.map((c) => (
            <Link key={c.id} className="contact-item" to={`/contacts/${c.id}`}>
              <div>
                <h3>{c.displayName}</h3>
                <p>
                  <span className="badge">{channelLabel(c.channel)}</span>
                  {c.personaTitle ? ` · ${c.personaTitle}` : ` · ${t('contacts.noPersona')}`}
                  {c.tags ? ` · ${c.tags}` : ''}
                </p>
              </div>
              <div className="status">{t('contacts.edit')}</div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
