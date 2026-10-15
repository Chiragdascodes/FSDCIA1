import {
  Banknote,
  Coffee,
  Fuel,
  Hospital,
  MapPin,
  Pill,
  PlugZap,
  ShieldAlert,
  ShoppingBasket,
  Toilet,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'

/** Lucide icon for each category id (names come from src/js/categories.js). */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Pill,
  Hospital,
  Banknote,
  Toilet,
  UtensilsCrossed,
  Coffee,
  ShoppingBasket,
  Fuel,
  ShieldAlert,
  PlugZap,
}

export function iconFor(iconName: string | undefined): LucideIcon {
  return (iconName && CATEGORY_ICONS[iconName]) || MapPin
}
