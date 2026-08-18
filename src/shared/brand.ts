import { getBrand, t } from './i18n'

/** 对外官网（已购域名；DNS 正式启用前亦可作为品牌锚点） */
export const BRAND_SITE = 'https://www.talknow.cn'
export const BRAND_SITE_HOST = 'www.talknow.cn'

/** 中英产品名（内部包名仍为 typenow / com.typenow.app） */
export const BRAND_NAME_ZH = '即刻对话'
export const BRAND_NAME_EN = 'TalkNow'

/**
 * 用户可见品牌（随当前 UI 语言变化）。
 * zh-CN：即刻对话；en-US：TalkNow。
 * 新代码优先 `getBrand()` / `t('brand.*')`。
 */
export const BRAND = {
  get name(): string {
    return t('brand.name')
  },
  get nameZh(): string {
    return BRAND_NAME_ZH
  },
  get nameEn(): string {
    return BRAND_NAME_EN
  },
  /** 双语文案：即刻对话 TalkNow */
  get dualName(): string {
    return `${BRAND_NAME_ZH} ${BRAND_NAME_EN}`
  },
  get site(): string {
    return BRAND_SITE
  },
  get siteHost(): string {
    return BRAND_SITE_HOST
  },
  get tagline(): string {
    return t('brand.tagline')
  },
  get voice(): { name: string; blurb: string } {
    return getBrand().voice
  },
  get aiTalk(): { name: string; blurb: string } {
    return getBrand().aiTalk
  },
  get reply(): { name: string; blurb: string } {
    return getBrand().reply
  },
  get screenAsk(): { name: string; blurb: string } {
    return getBrand().screenAsk
  },
  get screenQuiz(): { name: string; blurb: string } {
    return getBrand().screenQuiz
  }
} as const

export { getBrand }
