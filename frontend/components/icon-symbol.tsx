// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<string, ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING = {
  // Navigation / Tabs
  "house.fill": "home",
  "clock.fill": "access-time",
  "creditcard.fill": "credit-card",
  "person.fill": "person",
  "dollarsign.circle.fill": "attach-money",
  "map.fill": "map",
  
  // Ride / Map
  "location.fill": "my-location",
  "location.north.fill": "navigation",
  "car.fill": "directions-car",
  "car.side.fill": "directions-car",
  "bolt.car.fill": "electric-car",
  "figure.walk": "directions-walk",
  "mappin.fill": "place",
  "mappin.and.ellipse": "location-on",
  
  // Actions
  "magnifyingglass": "search",
  "xmark": "close",
  "xmark.circle.fill": "cancel",
  "checkmark": "check",
  "checkmark.circle.fill": "check-circle",
  "chevron.right": "chevron-right",
  "chevron.left": "chevron-left",
  "chevron.down": "expand-more",
  "chevron.up": "expand-less",
  "arrow.left": "arrow-back",
  "arrow.right": "arrow-forward",
  "arrow.up": "arrow-upward",
  
  // Communication
  "phone.fill": "phone",
  "message.fill": "message",
  "bell.fill": "notifications",
  "bell.slash.fill": "notifications-off",
  
  // Payment
  "banknote.fill": "account-balance-wallet",
  "plus.circle.fill": "add-circle",
  "minus.circle.fill": "remove-circle",
  "tag.fill": "local-offer",
  
  // User / Profile
  "person.circle.fill": "account-circle",
  "star.fill": "star",
  "star": "star-border",
  "shield.fill": "security",
  "gearshape.fill": "settings",
  "questionmark.circle.fill": "help",
  "info.circle.fill": "info",
  
  // Status
  "power": "power-settings-new",
  "wifi": "wifi",
  "wifi.slash": "wifi-off",
  "bolt.fill": "bolt",
  "flame.fill": "local-fire-department",
  
  // Misc
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "list.bullet": "list",
  "square.grid.2x2.fill": "grid-view",
  "ellipsis": "more-horiz",
  "ellipsis.circle": "more-horiz",
  "trash.fill": "delete",
  "pencil": "edit",
  "camera.fill": "camera-alt",
  "photo.fill": "photo",
  "heart.fill": "favorite",
  "bookmark.fill": "bookmark",
  "share.fill": "share",
  "doc.text.fill": "description",
  "exclamationmark.triangle.fill": "warning",
  "hand.thumbsup.fill": "thumb-up",
  "hand.thumbsdown.fill": "thumb-down",
} as IconMapping;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: string;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  const iconName = MAPPING[name] ?? "help-outline";
  return <MaterialIcons color={color} size={size} name={iconName} style={style} />;
}
