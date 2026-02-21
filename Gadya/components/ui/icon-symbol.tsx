// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * SF Symbols to Material Icons mappings for Voice AI Assistant
 */
const MAPPING = {
  // Tab bar icons
  "house.fill": "home",
  "mic.fill": "mic",
  "doc.text.fill": "description",
  "gearshape.fill": "settings",
  
  // Voice UI icons
  "waveform": "graphic-eq",
  "speaker.wave.2.fill": "volume-up",
  "stop.fill": "stop",
  "play.fill": "play-arrow",
  "pause.fill": "pause",
  
  // Notes icons
  "folder.fill": "folder",
  "doc.fill": "insert-drive-file",
  "magnifyingglass": "search",
  "plus": "add",
  "trash.fill": "delete",
  "pencil": "edit",
  
  // Navigation
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "chevron.left": "chevron-left",
  "xmark": "close",
  
  // Actions
  "paperplane.fill": "send",
  "square.and.arrow.up": "share",
  "doc.on.doc": "content-copy",
  "arrow.counterclockwise": "undo",
  
  // Status
  "checkmark.circle.fill": "check-circle",
  "exclamationmark.triangle.fill": "warning",
  "info.circle.fill": "info",
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
