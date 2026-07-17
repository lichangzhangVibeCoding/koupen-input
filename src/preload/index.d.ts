import type { VipChatApi } from './index'

declare global {
  interface Window {
    vipChat: VipChatApi
  }
}

export {}
