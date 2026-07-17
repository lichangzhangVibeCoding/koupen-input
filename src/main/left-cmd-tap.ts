/** 兼容旧引用：实际实现见 modifier-tap.ts */
export {
  startModifierTapListener as startLeftCommandTapListener,
  stopModifierTapListener as stopLeftCommandTapListener,
  startModifierTapListener,
  stopModifierTapListener,
  type ModifierTapHandlers as LeftCommandHandlers
} from './modifier-tap'
