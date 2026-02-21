import React from "react";
import Svg, { Path, Circle } from "react-native-svg";

interface GadyaMicIconProps {
  size?: number;
  color?: string;
  eyeColor?: string;
}

/**
 * Custom Гадя microphone icon with cute face
 * Based on user-provided SVG design
 */
export function GadyaMicIcon({
  size = 48,
  color = "#007AFF",
  eyeColor = "#FFFFFF",
}: GadyaMicIconProps) {
  // Original viewBox is 0 0 384 512, aspect ratio ~0.75
  const width = size * 0.75;
  const height = size;

  return (
    <Svg width={width} height={height} viewBox="0 0 384 512">
      {/* Main microphone body with mouth cutout */}
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M96 96c0-53 43-96 96-96 50.3 0 91.6 38.7 95.7 88L232 88c-13.3 0-24 10.7-24 24s10.7 24 24 24l56 0 0 48-56 0c-13.3 0-24 10.7-24 24s10.7 24 24 24l55.7 0c-4.1 49.3-45.3 88-95.7 88-53 0-96-43-96-96L96 96zM24 160c13.3 0 24 10.7 24 24l0 40c0 79.5 64.5 144 144 144s144-64.5 144-144l0-40c0-13.3 10.7-24 24-24s24 10.7 24 24l0 40c0 97.9-73.3 178.7-168 190.5l0 49.5 48 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-144 0c-13.3 0-24-10.7-24-24s10.7-24 24-24l48 0 0-49.5C73.3 402.7 0 321.9 0 224l0-40c0-13.3 10.7-24 24-24z"
        fill={color}
      />
      {/* Left eye */}
      <Circle cx="155" cy="70" r="12" fill={eyeColor} />
      {/* Right eye */}
      <Circle cx="205" cy="70" r="12" fill={eyeColor} />
    </Svg>
  );
}

/**
 * Animated version with color states for different voice modes
 */
interface AnimatedGadyaMicIconProps extends GadyaMicIconProps {
  status?: "idle" | "listening" | "processing" | "speaking";
}

export function AnimatedGadyaMicIcon({
  size = 48,
  status = "idle",
  ...props
}: AnimatedGadyaMicIconProps) {
  // Color scheme based on status
  const getColors = () => {
    switch (status) {
      case "listening":
        return { color: "#34C759", eyeColor: "#FFFFFF" }; // Green when listening
      case "processing":
        return { color: "#FF9500", eyeColor: "#FFFFFF" }; // Orange when thinking
      case "speaking":
        return { color: "#5856D6", eyeColor: "#FFFFFF" }; // Purple when speaking
      default:
        return { color: "#007AFF", eyeColor: "#FFFFFF" }; // Blue when idle
    }
  };

  const colors = getColors();

  return (
    <GadyaMicIcon
      size={size}
      color={colors.color}
      eyeColor={colors.eyeColor}
      {...props}
    />
  );
}
