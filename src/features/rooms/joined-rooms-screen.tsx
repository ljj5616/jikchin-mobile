import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useMockSession } from '@/features/auth/mock-session';
import { listJoinedRooms } from '@/features/rooms/room-api';
import { RoomCard } from '@/features/rooms/room-list-screen';
import type { RoomResponse } from '@/features/rooms/room-list';
import { useTheme } from '@/hooks/use-theme';

export function JoinedRoomsScreen({ active, onBrowseRooms }: { active: boolean; onBrowseRooms: () => void }) {
  const theme = useTheme();
  const { session } = useMockSession();
  const apiSession = session && !session.needProfile ? session.apiSession : null;
  const [rooms, setRooms] = useState<RoomResponse[] | null>(null);
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

  return (
    <View style={[styles.screen, { backgroundColor: theme.backgroundElement }]}>
      <FlatList
        data={rooms ?? []}
        keyExtractor={(room) => String(room.id)}
        renderItem={({ item }) => (
          <RoomCard room={item} joined accessibilityHint="채팅방 열기" onPress={() => router.push({ pathname: '/room-chat/[roomId]', params: { roomId: item.id } })} />
        )}
        style={styles.list}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <ThemedText type="smallBold">직관친구</ThemedText>
            <View style={styles.intro}>
              <ThemedText accessibilityRole="header" type="subtitle" style={styles.title}>참여 중인 방</ThemedText>
              <ThemedText themeColor="textSecondary">참여한 방의 대화를 이어가 보세요.</ThemedText>
            </View>
            {rooms && <ThemedText type="smallBold" themeColor="textSecondary">참여한 방 {rooms.length}개</ThemedText>}
          </View>
        }
        ListEmptyComponent={
          error ? (
            <View style={[styles.empty, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
              <ThemedText accessibilityRole="alert">{error}</ThemedText>
              <Pressable accessibilityRole="button" onPress={loadRooms} style={styles.action}>
                <ThemedText type="smallBold" style={styles.actionText}>다시 시도</ThemedText>
              </Pressable>
            </View>
          ) : rooms === null ? (
            <ThemedText accessibilityLiveRegion="polite" themeColor="textSecondary">참여 중인 방을 불러오는 중이에요.</ThemedText>
          ) : (
            <View style={[styles.empty, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
              <ThemedText type="smallBold">아직 참여한 방이 없어요.</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">직관방에서 함께 볼 경기를 찾아보세요.</ThemedText>
              <Pressable accessibilityRole="button" onPress={onBrowseRooms} style={styles.action}>
                <ThemedText type="smallBold" style={styles.actionText}>직관방 둘러보기</ThemedText>
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
  content: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two, paddingBottom: Spacing.five },
  header: { gap: Spacing.four, marginBottom: Spacing.three },
  intro: { gap: Spacing.one },
  title: { fontWeight: '700' },
  separator: { height: Spacing.two + Spacing.one },
  empty: { gap: Spacing.two, padding: Spacing.four, borderWidth: 1, borderRadius: 16 },
  action: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  actionText: { color: '#2554DB' },
});
