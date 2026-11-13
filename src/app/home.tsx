import { StatusBar } from 'expo-status-bar';
import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon, BrandMark } from '@/components/jikchin-ui';
import { ThemedText } from '@/components/themed-text';
import { useMockSession } from '@/features/auth/mock-session';
import { MyPage } from '@/features/profile/my-page';
import { JoinedRoomsScreen } from '@/features/rooms/joined-rooms-screen';
import { RoomListScreen } from '@/features/rooms/room-list-screen';
import { useTheme } from '@/hooks/use-theme';

const tabs = [
  { label: '직관방', icon: 'stadium' },
  { label: '참여 중인 방', icon: 'chat' },
  { label: '마이페이지', icon: 'person' },
] as const;

export default function HomeScreen() {
  const theme = useTheme();
  const { session } = useMockSession();
  const pager = useRef<ComponentRef<typeof ScrollView>>(null);
  const [width, setWidth] = useState(0);
  const [activeTab, setActiveTab] = useState(0);

  function changeTab(index: number) {
    setActiveTab(index);
    pager.current?.scrollTo({ x: index * width, animated: true });
  }
  function onLayout(event: LayoutChangeEvent) {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth !== width) {
      setWidth(nextWidth);
      requestAnimationFrame(() => pager.current?.scrollTo({ x: activeTab * nextWidth, animated: false }));
    }
  }
  function onPageSettled(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (width) setActiveTab(Math.max(0, Math.min(tabs.length - 1, Math.round(event.nativeEvent.contentOffset.x / width))));
  }
  if (!session || session.needProfile) return null;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style="auto" />
      <View style={[styles.header, { borderColor: theme.border }]}>
        <BrandMark />
        <ThemedText style={styles.brand}>직친</ThemedText>
      </View>
      <View style={styles.pagerContainer} onLayout={onLayout}>
        {width > 0 && (
          <ScrollView ref={pager} horizontal pagingEnabled bounces={false} showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onPageSettled} style={styles.screen}>
            <View style={{ width }}><RoomListScreen /></View>
            <View style={{ width }}><JoinedRoomsScreen active={activeTab === 1} onBrowseRooms={() => changeTab(0)} /></View>
            <View style={{ width }}><MyPage active={activeTab === 2} /></View>
          </ScrollView>
        )}
      </View>
      <View accessibilityRole="tablist" style={[styles.tabs, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        {tabs.map(({ label, icon }, index) => {
          const selected = activeTab === index;
          const color = selected ? theme.accentText : theme.textSecondary;
          return (
            <Pressable key={label} accessibilityRole="tab" accessibilityState={{ selected }}
              onPress={() => changeTab(index)} style={styles.tab}>
              <View style={[styles.tabIcon, selected && { backgroundColor: theme.backgroundElement }]}>
                <AppIcon name={icon} color={color} size={23} />
              </View>
              <ThemedText style={[styles.tabLabel, { color }]}>{label}</ThemedText>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { minHeight: 60, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  brand: { fontSize: 22, lineHeight: 28, fontWeight: '800' },
  pagerContainer: { flex: 1 },
  tabs: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, minHeight: 64, paddingVertical: 5, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabIcon: { width: 50, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  tabLabel: { fontSize: 12, lineHeight: 17, fontWeight: '700', textAlign: 'center' },
});
