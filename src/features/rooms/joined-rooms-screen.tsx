import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { AppIcon, Badge, ui } from '@/components/jikchin-ui';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useMockSession } from '@/features/auth/mock-session';
import { listJoinedRooms } from '@/features/rooms/room-api';
import { RoomCard } from '@/features/rooms/room-list-screen';
import { gameDateKey, type RoomResponse } from '@/features/rooms/room-list';
import { useTheme } from '@/hooks/use-theme';

const filters = [
  { key: 'all', label: '전체' },
  { key: 'upcoming', label: '예정 경기' },
  { key: 'past', label: '지난 경기' },
] as const;

export function JoinedRoomsScreen({ active, onBrowseRooms }: { active: boolean; onBrowseRooms: () => void }) {
  const theme = useTheme();
  const { session } = useMockSession();
  const apiSession = session && !session.needProfile ? session.apiSession : null;
  const [rooms, setRooms] = useState<RoomResponse[] | null>(null);
  const [filter, setFilter] = useState<(typeof filters)[number]['key']>('all');
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const loadRooms = useCallback(async () => {
    if (!apiSession) return;
    const current = ++requestId.current;
    setRooms(null);
    setError(null);
    try {
      const result = await listJoinedRooms(apiSession);
      if (requestId.current === current) setRooms(result);
    } catch (error) {
      if (requestId.current === current) setError(error instanceof Error ? error.message : '참여 중인 방을 불러오지 못했어요.');
    }
  }, [apiSession]);

  useFocusEffect(useCallback(() => {
    if (!active) return;
    void loadRooms();
    return () => { requestId.current += 1; };
  }, [active, loadRooms]));

  const today = gameDateKey(new Date());
  const visibleRooms = rooms?.filter((room) =>
    filter === 'all' || (filter === 'upcoming' ? room.gameDate >= today : room.gameDate < today),
  ) ?? [];

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <FlatList
        data={visibleRooms}
        keyExtractor={(room) => String(room.id)}
        renderItem={({ item }) => (
          <RoomCard room={item} joined onPress={() => router.push({ pathname: '/room-chat/[roomId]', params: { roomId: item.id } })} />
        )}
        style={styles.list}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.intro}>
              <ThemedText accessibilityRole="header" type="subtitle" style={styles.title}>참여 중인 방</ThemedText>
              <ThemedText themeColor="textSecondary">참여한 방의 대화를 이어가 보세요.</ThemedText>
            </View>
            <View style={styles.filters}>
              {filters.map(({ key, label }) => (
                <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: filter === key }}
                  onPress={() => setFilter(key)}
                  style={[styles.filter, { backgroundColor: filter === key ? theme.accent : theme.backgroundElement }]}>
                  <ThemedText type="smallBold" style={filter === key ? ui.white : { color: theme.accentText }}>{label}</ThemedText>
                </Pressable>
              ))}
            </View>
            {rooms && <Badge label={`${visibleRooms.length}개`} />}
          </View>
        }
        ListEmptyComponent={
          error ? (
            <View style={[ui.card, styles.empty, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <ThemedText accessibilityRole="alert">{error}</ThemedText>
              <Pressable accessibilityRole="button" onPress={loadRooms} style={styles.action}>
                <ThemedText type="smallBold" themeColor="accentText">다시 시도</ThemedText>
              </Pressable>
            </View>
          ) : rooms === null ? (
            <ThemedText accessibilityLiveRegion="polite" themeColor="textSecondary">참여 중인 방을 불러오는 중이에요.</ThemedText>
          ) : (
            <View style={[ui.card, styles.empty, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <AppIcon name="chat" size={28} color={theme.accentText} />
              <ThemedText type="smallBold">{rooms.length ? '이 조건에 맞는 방이 없어요.' : '아직 참여한 방이 없어요.'}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">직관방에서 함께 볼 경기를 찾아보세요.</ThemedText>
              <Pressable accessibilityRole="button" onPress={onBrowseRooms} style={styles.action}>
                <ThemedText type="smallBold" themeColor="accentText">직관방 둘러보기</ThemedText>
              </Pressable>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: 520 },
  content: { paddingHorizontal: 18, paddingTop: Spacing.three, paddingBottom: Spacing.five },
  header: { gap: 12, marginBottom: Spacing.three },
  intro: { gap: Spacing.one },
  title: { fontWeight: '800' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filter: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 24 },
  separator: { height: Spacing.two + Spacing.one },
  empty: { gap: Spacing.two, padding: Spacing.four, alignItems: 'center' },
  action: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
});
