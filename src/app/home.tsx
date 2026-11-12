import { StatusBar } from 'expo-status-bar';
import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useMockSession } from '@/features/auth/mock-session';
import { MyPage } from '@/features/profile/my-page';
import { JoinedRoomsScreen } from '@/features/rooms/joined-rooms-screen';
import { RoomListScreen } from '@/features/rooms/room-list-screen';
import { useTheme } from '@/hooks/use-theme';

const tabs = ['직관방', '참여 중인 방', '마이페이지'] as const;

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
      <View accessibilityRole="tablist" style={[styles.tabs, { borderColor: theme.backgroundSelected }]}>
        {tabs.map((label, index) => (
          <Pressable key={label} accessibilityRole="tab" accessibilityState={{ selected: activeTab === index }}
            onPress={() => changeTab(index)} style={styles.tab}>
            <View style={[styles.tabIndicator, { backgroundColor: activeTab === index ? '#2554DB' : 'transparent' }]} />
            <ThemedText type="smallBold" style={{ color: activeTab === index ? '#2554DB' : theme.textSecondary }}>
              {label}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  pagerContainer: { flex: 1 },
  tabs: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 7 },
  tabIndicator: { width: 24, height: 3, borderRadius: 2 },
});
