import React, { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { VoiceColors, Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { GadyaMicIcon, AnimatedGadyaMicIcon } from "@/components/gadya-mic-icon";
import type { VoiceStatus } from "@/hooks/use-voice";

interface VoiceButtonProps {
  status: VoiceStatus;
  onPress: () => void;
  size?: number;
  disabled?: boolean;
}

export function VoiceButton({ status, onPress, size = 120, disabled = false }: VoiceButtonProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  // Animation values
  const scale = useSharedValue(1);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.3);
  const rotation = useSharedValue(0);

  // Get status-specific colors
  const getStatusColor = () => {
    switch (status) {
      case "listening":
        return VoiceColors.recording;
      case "processing":
        return VoiceColors.processing;
      case "speaking":
        return VoiceColors.speaking;
      default:
        return colors.tint;
    }
  };

  // Pulse animation for listening state
  useEffect(() => {
    if (status === "listening") {
      pulseScale.value = withRepeat(
        withTiming(1.4, { duration: 1000, easing: Easing.out(Easing.ease) }),
        -1,
        true
      );
      pulseOpacity.value = withRepeat(
        withTiming(0, { duration: 1000, easing: Easing.out(Easing.ease) }),
        -1,
        true
      );
    } else {
      cancelAnimation(pulseScale);
      cancelAnimation(pulseOpacity);
      pulseScale.value = withTiming(1);
      pulseOpacity.value = withTiming(0.3);
    }
  }, [status, pulseScale, pulseOpacity]);

  // Rotation animation for processing state
  useEffect(() => {
    if (status === "processing") {
      rotation.value = withRepeat(
        withTiming(360, { duration: 1500, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      cancelAnimation(rotation);
      rotation.value = withTiming(0);
    }
  }, [status, rotation]);

  // Handle press
  const handlePress = () => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  // Handle press in/out for scale animation
  const handlePressIn = () => {
    scale.value = withSpring(0.95);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  // Animated styles
  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const statusColor = getStatusColor();
  const isActive = status !== "idle";

  // Map VoiceStatus to AnimatedGadyaMicIcon status
  const getIconStatus = (): "idle" | "listening" | "processing" | "speaking" => {
    switch (status) {
      case "listening":
        return "listening";
      case "processing":
        return "processing";
      case "speaking":
        return "speaking";
      default:
        return "idle";
    }
  };

  // Render the appropriate icon based on status
  const renderIcon = () => {
    const iconSize = size * 0.5;
    const iconStatus = getIconStatus();
    
    // Use animated Гадя mic icon with status-based colors
    // White icon when button is active (has colored background)
    const iconColor = isActive ? "#FFFFFF" : undefined;
    const eyeColor = isActive ? statusColor : "#FFFFFF";
    
    if (status === "processing") {
      return (
        <Animated.View style={iconAnimatedStyle}>
          <AnimatedGadyaMicIcon 
            size={iconSize} 
            status={iconStatus}
            color={iconColor}
            eyeColor={eyeColor}
          />
        </Animated.View>
      );
    }

    return (
      <AnimatedGadyaMicIcon 
        size={iconSize} 
        status={iconStatus}
        color={iconColor}
        eyeColor={eyeColor}
      />
    );
  };

  return (
    <View style={[styles.container, { width: size + 40, height: size + 40 }]}>
      {/* Pulse ring for listening state */}
      {status === "listening" && (
        <Animated.View
          style={[
            styles.pulseRing,
            pulseAnimatedStyle,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: statusColor,
            },
          ]}
        />
      )}

      {/* Main button */}
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
      >
        <Animated.View
          style={[
            styles.button,
            buttonAnimatedStyle,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: isActive ? statusColor : colors.card,
              borderColor: isActive ? statusColor : colors.tint,
              borderWidth: isActive ? 0 : 3,
              opacity: disabled ? 0.5 : 1,
            },
          ]}
        >
          {renderIcon()}
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRing: {
    position: "absolute",
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
});
