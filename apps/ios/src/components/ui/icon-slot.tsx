/**
 * Shared "icon slot" renderer for the ui primitives (Button, Pill, EmptyState
 * actions). Web passes `<Plus className="size-4" />` children that inherit the
 * button's text colour via `currentColor`; lucide-react-native SVGs do NOT
 * inherit Text colour, so primitives resolve the colour explicitly here.
 *
 * Accepted shapes:
 *  - a lucide component (`Plus`)          → rendered at `size` in `color`
 *  - a React element (`<Plus />`)         → `color` injected unless it sets one
 *  - a string / number (emoji, glyph)     → rendered as <Text>
 */
import {
  cloneElement,
  isValidElement,
  type ComponentType,
  type ReactElement,
  type ReactNode,
} from "react";
import { Text } from "react-native";
import type { LucideIcon } from "lucide-react-native";

export type IconSlot = ReactNode | LucideIcon;

/** True for a component type (lucide icons are forwardRef objects). */
export function isIconComponent(
  icon: unknown,
): icon is ComponentType<{ size?: number; color?: string; strokeWidth?: number }> {
  if (icon == null || isValidElement(icon)) return false;
  if (typeof icon === "function") return true;
  return typeof icon === "object" && "$$typeof" in (icon as object);
}

export function renderIconSlot(
  icon: IconSlot,
  color: string,
  size: number,
  strokeWidth = 2,
): ReactNode {
  if (icon == null || typeof icon === "boolean") return null;
  if (typeof icon === "string" || typeof icon === "number") {
    return <Text style={{ fontSize: size, color }}>{icon}</Text>;
  }
  if (isIconComponent(icon)) {
    const Icon = icon;
    return <Icon size={size} color={color} strokeWidth={strokeWidth} />;
  }
  if (isValidElement(icon)) {
    const el = icon as ReactElement<{ color?: string }>;
    return el.props.color == null ? cloneElement(el, { color }) : el;
  }
  return icon as ReactNode;
}
