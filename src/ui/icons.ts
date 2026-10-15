import {
  Basket,
  Bank,
  ChargingStation,
  Coffee,
  FirstAidKit,
  ForkKnife,
  GasPump,
  MapPin,
  Pill,
  ShieldCheck,
  Toilet,
  type Icon,
} from '@phosphor-icons/react'

/**
 * Phosphor icons (fill / duotone weights read like SF Symbols) for each category.
 * Keys are the icon names stored in src/js/categories.js.
 */
export const CATEGORY_ICONS: Record<string, Icon> = {
  Pill,
  Hospital: FirstAidKit,
  Banknote: Bank,
  Toilet,
  UtensilsCrossed: ForkKnife,
  Coffee,
  ShoppingBasket: Basket,
  Fuel: GasPump,
  ShieldAlert: ShieldCheck,
  PlugZap: ChargingStation,
}

export function iconFor(iconName: string | undefined): Icon {
  return (iconName && CATEGORY_ICONS[iconName]) || MapPin
}

export type { Icon }
