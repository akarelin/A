export type Auto = boolean

declare module 'claude-code' {
  interface PluginState {
    'read-aloud': { isAuto: Auto }
  }
}
