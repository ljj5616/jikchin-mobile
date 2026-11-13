import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const icons = {
  add: ['add', 'plus'],
  arrow: ['arrow_forward', 'arrow.right'],
  back: ['arrow_back', 'arrow.left'],
  baseball: ['sports_baseball', 'baseball'],
  block: ['block', 'nosign'],
  calendar: ['calendar_today', 'calendar'],
  camera: ['photo_camera', 'camera'],
  chat: ['chat_bubble_outline', 'bubble.left'],
  check: ['check', 'checkmark'],
  chevron: ['chevron_right', 'chevron.right'],
  close: ['close', 'xmark'],
  edit: ['edit', 'pencil'],
  flag: ['flag', 'flag'],
  football: ['sports_soccer', 'soccerball'],
  location: ['location_on', 'mappin'],
  more: ['more_vert', 'ellipsis'],
  person: ['person_outline', 'person.crop.circle'],
  refresh: ['refresh', 'arrow.clockwise'],
  remove: ['remove', 'minus'],
  send: ['send', 'paperplane'],
  shield: ['shield', 'shield'],
  stadium: ['stadium', 'sportscourt'],
} as const satisfies Record<string, readonly [AndroidSymbol, SFSymbol]>;

export function AppIcon({ name, color, size = 20 }: { name: keyof typeof icons; color?: string; size?: number }) {
  const theme = useTheme();
  const [material, ios] = icons[name];
  return <SymbolView accessible={false} name={{ android: material, web: material, ios }} size={size} tintColor={color ?? theme.text} />;
}

export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <View style={[styles.mark, { width: size, height: size, borderRadius: size * 0.28 }]}>
      <AppIcon name="stadium" color={Brand.white} size={Math.round(size * 0.59)} />
    </View>
  );
}

export function PageHeader({ title, onBack, disabled }: { title: string; onBack: () => void; disabled?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.header, { borderColor: theme.border }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="뒤로 가기" onPress={onBack} disabled={disabled}
        style={({ pressed }) => [styles.headerAction, { backgroundColor: theme.backgroundElement }, (pressed || disabled) && styles.pressed]}>
        <AppIcon name="back" />
      </Pressable>
      <ThemedText accessibilityRole="header" numberOfLines={1} style={styles.headerTitle}>{title}</ThemedText>
    </View>
  );
}

export function Badge({ label, tone = 'blue' }: { label: string; tone?: 'blue' | 'green' | 'red' | 'neutral' }) {
  const theme = useTheme();
  const colors = {
    blue: [theme.backgroundSelected, theme.accentText],
    green: [theme.successSurface, theme.success],
    red: [theme.dangerSurface, theme.danger],
    neutral: [theme.backgroundElement, theme.textSecondary],
  } as const;
  const [backgroundColor, color] = colors[tone];
  return (
    <View style={[styles.badge, { backgroundColor }]}>
      <ThemedText style={[styles.badgeText, { color }]}>{label}</ThemedText>
    </View>
  );
}

export const ui = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18 },
  button: { minHeight: 50, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  buttonLabel: { fontWeight: '700' },
  white: { color: Brand.white },
});

const styles = StyleSheet.create({
  mark: { alignItems: 'center', justifyContent: 'center', backgroundColor: Brand.blue },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  headerAction: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, lineHeight: 25, fontWeight: '700' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99 },
  badgeText: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
  pressed: { opacity: 0.65 },
});
