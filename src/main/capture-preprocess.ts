import { NativeImage } from 'electron'
import type { Channel } from '../shared/types'

/** 视觉模型输入：长边上限（像素）— 聊天窗 ROI */
export const VISION_MAX_LONG_EDGE = 1024
/** 整屏问答/答题：更清晰，减轻密集文字错绑（校名↔人数） */
export const SCREEN_ASK_MAX_LONG_EDGE = 1600
/** 与AI对话读屏：轻量，避免 32B + 大图卡住 */
export const ENHANCE_MAX_LONG_EDGE = 1024
/** 截屏 thumbnail 长边上限（预处理前） */
export const CAPTURE_MAX_LONG_EDGE = 1600
/** JPEG 质量（聊天窗） */
export const VISION_JPEG_QUALITY = 75
/** 整屏 JPEG：略提高，方便读小字 */
export const SCREEN_ASK_JPEG_QUALITY = 88
/** 与AI对话整屏 JPEG：更小更快 */
export const ENHANCE_JPEG_QUALITY = 70

export type VisionImagePayload = {
  base64: string
  mime: 'image/jpeg'
}

/** 聊天区 ROI（相对整窗宽高比例）— 必须保留顶栏昵称，Mac 微信窗口标题常为「微信」 alone */
type RoiRatios = { left: number; top: number; right: number; bottom: number }

const CHAT_ROI: Record<'wechat' | 'qq' | 'default', RoiRatios> = {
  // 只裁左侧会话列表 + 底部输入框；顶栏（联系人名）保留给视觉识别
  wechat: { left: 0.22, top: 0, right: 0.01, bottom: 0.12 },
  qq: { left: 0.2, top: 0, right: 0.01, bottom: 0.13 },
  default: { left: 0.15, top: 0, right: 0.01, bottom: 0.1 }
}

function getChatRoi(channel: Channel): RoiRatios {
  if (channel === 'wechat' || channel === 'qq') return CHAT_ROI[channel]
  return CHAT_ROI.default
}

export function capThumbnailDimensions(
  width: number,
  height: number,
  maxLong = CAPTURE_MAX_LONG_EDGE
): { width: number; height: number } {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  const long = Math.max(w, h)
  if (long <= maxLong) return { width: w, height: h }
  const scale = maxLong / long
  return {
    width: Math.max(320, Math.round(w * scale)),
    height: Math.max(240, Math.round(h * scale))
  }
}

function cropByRatios(image: NativeImage, roi: RoiRatios): NativeImage {
  if (image.isEmpty()) return image
  const { width, height } = image.getSize()
  const x = Math.min(width - 1, Math.max(0, Math.round(width * roi.left)))
  const y = Math.min(height - 1, Math.max(0, Math.round(height * roi.top)))
  const w = Math.max(
    40,
    Math.min(width - x, Math.round(width * (1 - roi.left - roi.right)))
  )
  const h = Math.max(
    40,
    Math.min(height - y, Math.round(height * (1 - roi.top - roi.bottom)))
  )
  return image.crop({ x, y, width: w, height: h })
}

function resizeLongEdge(image: NativeImage, maxLong: number): NativeImage {
  if (image.isEmpty()) return image
  const { width, height } = image.getSize()
  const long = Math.max(width, height)
  if (long <= maxLong) return image
  const scale = maxLong / long
  return image.resize({
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    quality: 'good'
  })
}

/** 方案 B：裁聊天区 → 限长边 → JPEG，供视觉模型识别 */
export function preprocessCaptureForVision(
  image: NativeImage,
  channel: Channel
): VisionImagePayload {
  const roi = getChatRoi(channel)
  let next = cropByRatios(image, roi)
  next = resizeLongEdge(next, VISION_MAX_LONG_EDGE)
  return {
    base64: next.toJPEG(VISION_JPEG_QUALITY).toString('base64'),
    mime: 'image/jpeg'
  }
}

/** 全屏问答：不裁 ROI；更高清晰度，减轻「名称↔数字」错绑 */
export function preprocessFullScreenForVision(image: NativeImage): VisionImagePayload {
  const next = resizeLongEdge(image, SCREEN_ASK_MAX_LONG_EDGE)
  return {
    base64: next.toJPEG(SCREEN_ASK_JPEG_QUALITY).toString('base64'),
    mime: 'image/jpeg'
  }
}

/** 与AI对话：当前窗口轻量图，答题/看屏幕仍走 preprocessFullScreenForVision */
export function preprocessEnhanceFullScreen(image: NativeImage): VisionImagePayload {
  const next = resizeLongEdge(image, ENHANCE_MAX_LONG_EDGE)
  return {
    base64: next.toJPEG(ENHANCE_JPEG_QUALITY).toString('base64'),
    mime: 'image/jpeg'
  }
}
