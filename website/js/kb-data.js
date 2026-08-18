/**
 * 即刻对话 · 产品知识库与规划路径（官网展示数据）
 * 更新约定：完成/取消任务时改 status，并同步 docs/CHANGELOG.md
 *
 * status: done | building | deferred | planned
 */
window.TALKNOW_KB = {
  updatedAt: '2026-08-18',
  product: {
    zh: {
      name: '即刻对话',
      nameEn: 'TalkNow',
      tagline: '本机对话助手——少打字、快回人',
      versionNote: '当前主线约 v0.5.x；用户数据本机存储，粘贴不代发',
      principles: [
        '本地优先：联系人、人设、聊天记忆存在本机',
        '双轨模型：自配 Key / 本地永久免费；官方会员免配 Key、扣统一积分',
        '先文档后代码：docs/ 为规格源，官网知识库同步关键决策',
        '不照抄竞品：统一积分（非时长+积分双账本）；线下入账优先于在线支付',
        '与AI对话：管道冻结，场景包可扩展（website/ppt/debug/brief），这是增强提示词的长期竞争力'
      ]
    },
    en: {
      name: 'TalkNow',
      nameEn: '即刻对话',
      tagline: 'On-device chat assistant — less typing, faster replies',
      versionNote: 'Mainline ~v0.5.x; data stays local; paste only, never auto-send',
      principles: [
        'Local-first: contacts, personas, and chat memory stay on device',
        'Dual track: BYOK/local forever free; official membership = no key + unified credits',
        'Docs first: docs/ is the spec; this KB mirrors key decisions',
        'Not a clone: unified credits (not hours+credits); offline top-up before online pay',
        'Talk-to-AI: freeze the pipe, grow scene packs (website/ppt/debug/brief) — that’s the prompt-enhance moat'
      ]
    }
  },
  capabilities: [
    {
      id: 'voice',
      status: 'done',
      zh: { title: '即刻对话（语音）', desc: '口述 → 转写 → 贴入当前输入框' },
      en: { title: 'TalkNow Voice', desc: 'Speak → transcribe → paste into focused field' }
    },
    {
      id: 'reply',
      status: 'done',
      zh: { title: '帮我对话', desc: '截聊天窗 → 联系人/人设 → 生成回复并粘贴' },
      en: { title: 'Reply Assist', desc: 'Capture chat → persona → draft reply & paste' }
    },
    {
      id: 'screen',
      status: 'done',
      zh: { title: '看屏幕 / 看屏幕答题', desc: '整屏问答；答题走知识库两步流水线' },
      en: { title: 'Screen Ask / Quiz', desc: 'Full-screen Q&A; quiz uses two-step + KB' }
    },
    {
      id: 'contacts',
      status: 'done',
      zh: { title: '联系人与人设', desc: '按人建档、画像、历史；性格包场景技巧' },
      en: { title: 'Contacts & Personas', desc: 'Per-contact memory; persona packs + scenarios' }
    },
    {
      id: 'models',
      status: 'done',
      zh: { title: '三槽模型', desc: '语音 / 视觉 / 文本；硅基一键或本地套件' },
      en: { title: '3 Model Slots', desc: 'ASR / vision / chat; SiliconFlow or local suite' }
    },
    {
      id: 'membership',
      status: 'done',
      zh: { title: '官方会员（首版）', desc: '账号、统一积分、管理后台、薄代理、线下入账' },
      en: { title: 'Official Membership (v1)', desc: 'Auth, credits, admin, thin proxy, offline top-up' }
    },
    {
      id: 'i18n',
      status: 'done',
      zh: { title: '中英界面 / 宣传站', desc: 'App i18n + talknow.cn 双语站' },
      en: { title: 'ZH/EN UI & Site', desc: 'App i18n + bilingual marketing site' }
    },
    {
      id: 'prompt-enhance',
      status: 'building',
      zh: {
        title: '与AI对话（按住增强）',
        desc: '管道冻结；场景包 website / ppt / debug / brief 路由后扩写；generic 回落。核心竞争力是持续加包'
      },
      en: {
        title: 'Talk-to-AI (hold to enhance)',
        desc: 'Frozen pipe; scene packs website/ppt/debug/brief; generic fallback. Moat = more packs'
      }
    }
  ],
  roadmap: [
    {
      id: 'p0',
      phase: 'P0',
      status: 'done',
      zh: {
        title: '积分单价与档位',
        detail: '统一积分；Free/Pro/Max；语音/帮我对话/看屏幕扣费表与成本草案'
      },
      en: {
        title: 'Credit pricing & tiers',
        detail: 'Unified credits; Free/Pro/Max; voice/reply/screen rates + cost sketch'
      }
    },
    {
      id: 'p1',
      phase: 'P1',
      status: 'done',
      zh: {
        title: '账号与管理后台',
        detail: '手机号登录、套餐、积分发放、流水、线下开单备注'
      },
      en: {
        title: 'Accounts & admin',
        detail: 'Phone login, plans, credit grants, ledger, offline orders'
      }
    },
    {
      id: 'p2',
      phase: 'P2',
      status: 'done',
      zh: {
        title: '薄代理（第三方上游）',
        detail: '鉴权→扣积分→转发硅基流动；后台可改 Base URL / Key / 模型'
      },
      en: {
        title: 'Thin proxy (3rd-party upstream)',
        detail: 'Auth → charge → forward to SiliconFlow; admin-editable routes'
      }
    },
    {
      id: 'p3',
      phase: 'P3',
      status: 'done',
      zh: {
        title: '客户端双路由与会员页',
        detail: 'byok | membership；积分预检；兑换码与线下意向'
      },
      en: {
        title: 'Client dual-route + Membership UI',
        detail: 'byok | membership; credit gates; redeem + offline intent'
      }
    },
    {
      id: 'p4',
      phase: 'P4',
      status: 'done',
      zh: {
        title: '线下收款运营闭环',
        detail: 'SOP、运营文案、兑换码/试用；见 docs/ops-offline-membership.md'
      },
      en: {
        title: 'Offline ops loop',
        detail: 'SOP, ops copy, redeem/trial; see docs/ops-offline-membership.md'
      }
    },
    {
      id: 'p5',
      phase: 'P5',
      status: 'deferred',
      zh: {
        title: '在线支付（微信/支付宝）',
        detail: '单次购买与连续包月/包年；等公司主体与商户号。API 已预留 501'
      },
      en: {
        title: 'Online payments (WeChat/Alipay)',
        detail: 'One-shot + subscriptions after legal entity. Routes return 501 for now'
      }
    },
    {
      id: 'p6',
      phase: 'P6',
      status: 'done',
      zh: {
        title: '文档与官网定价',
        detail: 'design-membership.md + /pricing/ 线下引导'
      },
      en: {
        title: 'Docs & pricing page',
        detail: 'design-membership.md + /pricing/ offline guidance'
      }
    },
    {
      id: 'prompt-scenes-p0',
      phase: '产品',
      status: 'building',
      zh: {
        title: '与AI对话场景包 P0',
        detail: '管道冻结；路由 website/ppt/debug/brief/generic。ppt 为 HTML 幻灯不是 .ppt 文件。黄金口试：公司官网→website。见 docs/design-prompt-enhance.md 与 src/shared/prompt-scenes/'
      },
      en: {
        title: 'Talk-to-AI scene packs P0',
        detail: 'Frozen pipe; route website/ppt/debug/brief/generic. PPT pack = HTML slides, not .ppt files. Gold test: company site → website. See design-prompt-enhance.md'
      }
    }
  ],
  backlog: [
    {
      id: 'prompt-scenes-p1',
      status: 'planned',
      zh: {
        title: '场景包 P1：跟进句',
        detail: '屏幕上已有上一轮 AI 回复时走 followup：补约束，不重开项目'
      },
      en: {
        title: 'Scene packs P1: follow-up',
        detail: 'If the screen already shows the last AI reply, tighten constraints instead of starting a new project'
      }
    },
    {
      id: 'prompt-scenes-p2',
      status: 'planned',
      zh: {
        title: '场景包持续加包',
        detail: '翻译/汇总等新包；每包两条黄金口试；未过口试不上官网卡。这是与AI对话的长期竞争力'
      },
      en: {
        title: 'Keep adding scene packs',
        detail: 'Translate/summarize/etc. Two gold tests per pack; no site card until tests pass. This is the long-term moat'
      }
    },
    {
      id: 'skills',
      status: 'planned',
      zh: {
        title: '沟通场景「技能」',
        detail: '可开关场景规则（对标竞品技能，但绑定联系人/性格包，不做烂 Markdown 墙）'
      },
      en: {
        title: 'Communication skills',
        detail: 'Toggleable scenario rules — better UX than competitor SKILL.md walls'
      }
    },
    {
      id: 'pack-import',
      status: 'planned',
      zh: {
        title: '性格包导入 / 更多场景',
        detail: 'W3：用户导入包、场景编辑；商城后置'
      },
      en: {
        title: 'Persona pack import',
        detail: 'W3: import packs, scenario editor; marketplace later'
      }
    },
    {
      id: 'sms-prod',
      status: 'planned',
      zh: {
        title: '生产短信验证码',
        detail: '替换开发固定码；接入正规短信通道'
      },
      en: {
        title: 'Production SMS OTP',
        detail: 'Replace fixed dev code with real SMS provider'
      }
    },
    {
      id: 'relay-partner',
      status: 'planned',
      zh: {
        title: '折扣中转站合作',
        detail: '后台换 upstream，统一采购算差价；不自建完整中转站'
      },
      en: {
        title: 'Discounted relay partner',
        detail: 'Swap upstream in admin; margin without owning a full gateway'
      }
    },
    {
      id: 'legal',
      status: 'building',
      zh: {
        title: '公司主体与协议',
        detail: '执照约一个月；正式收款前替换用户协议/隐私主体'
      },
      en: {
        title: 'Legal entity & ToS',
        detail: '~1 month for company; swap ToS/privacy before paid launch'
      }
    }
  ],
  links: [
    { href: '../pricing/', zh: '定价页', en: 'Pricing' },
    { href: '../changelog/', zh: '更新日志', en: 'Changelog' },
    {
      href: 'https://github.com/lichangzhangVibeCoding/koupen-input/blob/main/docs/design-prompt-enhance.md',
      zh: '与AI对话 / 按住增强',
      en: 'Talk-to-AI / hold enhance',
      external: true
    },
    {
      href: 'https://github.com/lichangzhangVibeCoding/koupen-input/blob/main/docs/design-membership.md',
      zh: '会员设计文档',
      en: 'Membership design',
      external: true
    },
    {
      href: 'https://github.com/lichangzhangVibeCoding/koupen-input/blob/main/docs/mvp-v1.md',
      zh: 'MVP 功能规格',
      en: 'MVP spec',
      external: true
    },
    {
      href: 'https://github.com/lichangzhangVibeCoding/koupen-input/tree/main/server',
      zh: '会员服务端 server/',
      en: 'Membership server/',
      external: true
    }
  ]
}
