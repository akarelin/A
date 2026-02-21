/**
 * Voice AI Assistant Theme
 * Clean, professional iOS-style colors with voice UI accents
 */

import { Platform } from "react-native";

// Primary accent - iOS Blue for main actions
const tintColorLight = "#007AFF";
const tintColorDark = "#0A84FF";

// Voice UI specific colors
export const VoiceColors = {
  recording: "#34C759", // Green - active recording
  processing: "#FF9500", // Orange - processing
  speaking: "#5856D6", // Purple - TTS active
  error: "#FF3B30", // Red - errors
  waveform: "#007AFF", // Blue - waveform visualization
  waveformInactive: "#C7C7CC",
};

export const Colors = {
  light: {
    text: "#000000",
    textSecondary: "#8E8E93",
    textTertiary: "#C7C7CC",
    background: "#F2F2F7",
    card: "#FFFFFF",
    cardElevated: "#FFFFFF",
    tint: tintColorLight,
    icon: "#8E8E93",
    tabIconDefault: "#8E8E93",
    tabIconSelected: tintColorLight,
    border: "#E5E5EA",
    inputBackground: "#E5E5EA",
    success: "#34C759",
    warning: "#FF9500",
    error: "#FF3B30",
  },
  dark: {
    text: "#FFFFFF",
    textSecondary: "#8E8E93",
    textTertiary: "#48484A",
    background: "#000000",
    card: "#1C1C1E",
    cardElevated: "#2C2C2E",
    tint: tintColorDark,
    icon: "#8E8E93",
    tabIconDefault: "#8E8E93",
    tabIconSelected: tintColorDark,
    border: "#38383A",
    inputBackground: "#2C2C2E",
    success: "#30D158",
    warning: "#FF9F0A",
    error: "#FF453A",
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

// Typography scale
export const Typography = {
  largeTitle: {
    fontSize: 34,
    lineHeight: 41,
    fontWeight: "700" as const,
  },
  title1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700" as const,
  },
  title2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700" as const,
  },
  title3: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "400" as const,
  },
  callout: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "400" as const,
  },
  subhead: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "400" as const,
  },
  footnote: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400" as const,
  },
  caption1: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400" as const,
  },
  caption2: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "400" as const,
  },
};

// Spacing scale (8pt grid)
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

// Border radius
export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};
