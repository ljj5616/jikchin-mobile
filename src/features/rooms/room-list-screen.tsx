import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useMockSession } from '@/features/auth/mock-session';
import { listJoinedRooms, listRooms } from '@/features/rooms/room-api';
import { formatGameDate, type RoomResponse } from '@/features/rooms/room-list';
import { useTheme } from '@/hooks/use-theme';

type RoomSection = { key: string; title: string; joined: boolean; data: RoomResponse[] };

export function RoomCard({ room, joined, onPress, accessibilityHint = '방 상세 보기' }: { room: RoomResponse; joined: boolean; onPress: () => void; accessibilityHint?: string }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.background, borderColor: theme.backgroundSelected },
        pressed && styles.pressed,
      ]}>
      <View style={styles.cardRow}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {formatGameDate(room.gameDate)}
        </ThemedText>
        <View style={styles.vacancyBadge}>
          <ThemedText type="smallBold" style={styles.vacancyText}>
            {joined ? '참여 중' : `${room.capacity - room.participantCount}자리 남음`}
          </ThemedText>
        </View>
      </View>

      <View style={styles.match}>
        <ThemedText accessibilityRole="header" style={styles.roomTitle}>{room.title}</ThemedText>
        <ThemedText type="small">{room.homeTeam} vs {room.awayTeam}</ThemedText>
      </View>

      <View style={[styles.cardRow, styles.cardFooter, { borderColor: theme.backgroundSelected }]}>
        <ThemedText type="small" themeColor="textSecondary">{room.stadium}</ThemedText>
        <ThemedText type="smallBold">{room.participantCount}/{room.capacity}명 참여</ThemedText>
      </View>
    </Pressable>
  );
}

export function RoomListScreen() {
  const theme = useTheme();
  const { session } = useMockSession();
  const token = session && !session.needProfile ? session.accessToken : null;
  const [rooms, setRooms] = useState<RoomResponse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestId = useRef(0);

  const loadRooms = useCallback(async () => {
    if (!token) return;
    const request = ++requestId.current;
    setLoadError(null);
    try {
      const [upcoming, joined] = await Promise.all([listRooms(token), listJoinedRooms(token)]);
      const joinedIds = new Set(joined.map((room) => room.id));
      if (requestId.current === request) {
        setRooms(upcoming.filter((room) => room.participantCount < room.capacity && !joinedIds.has(room.id)));
      }
    } catch (error) {
      if (requestId.current === request) setLoadError(error instanceof Error ? error.message : '방 목록을 불러오지 못했어요.');
    }
  }, [token]);

  useFocusEffect(useCallback(() => {
    void loadRooms();
    return () => { requestId.current += 1; };
  }, [loadRooms]));

  if (!session || session.needProfile) return null;

  const sections = rooms ? [
    { key: 'recruiting', title: '모집 중인 방', joined: false, data: rooms },
  ] : [];

  return (
    <View style={[styles.screen, { backgroundColor: theme.backgroundElement }]}>
      <SectionList<RoomResponse, RoomSection>
        sections={sections}
        keyExtractor={(room) => String(room.id)}
        renderItem={({ item, section }) => (
          <RoomCard room={item} joined={section.joined} onPress={() => router.push({ pathname: '/room-detail/[roomId]', params: { roomId: item.id } })} />
        )}
        renderSectionHeader={({ section }) => (
          <ThemedText accessibilityRole="header" type="smallBold" style={styles.sectionHeading}>
            {section.title} {section.data.length}개
          </ThemedText>
        )}
        renderSectionFooter={({ section }) => !section.data.length ? (
          <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
            <ThemedText themeColor="textSecondary">지금 모집 중인 방이 없어요.</ThemedText>
          </View>
        ) : null}
        stickySectionHeadersEnabled={false}
        style={styles.list}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.toolbar}>
              <ThemedText type="smallBold">직관친구</ThemedText>
              <View style={styles.account}>
                {session.profile.avatarUrl && (
                  <Image
                    source={session.profile.avatarUrl}
                    accessibilityLabel={`${session.profile.nickname}님의 프로필 사진`}
                    style={styles.photo}
                    contentFit="cover"
                  />
                )}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/create-room')}
                  style={({ pressed }) => [styles.button, styles.createButton, pressed && styles.pressed]}>
                  <ThemedText type="smallBold" style={styles.createLabel}>방 생성</ThemedText>
                </Pressable>
              </View>
            </View>

            <View style={styles.intro}>
              <ThemedText accessibilityRole="header" type="subtitle" style={styles.title}>
                직관방
              </ThemedText>
              <ThemedText themeColor="textSecondary">같이 볼 경기를 찾아보세요.</ThemedText>
            </View>

            {loadError && (
              <View>
                <ThemedText accessibilityRole="alert" type="small">{loadError}</ThemedText>
                <Pressable accessibilityRole="button" onPress={loadRooms} style={styles.button}>
                  <ThemedText type="smallBold">다시 시도</ThemedText>
                </Pressable>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={loadError || rooms ? undefined : (
          <ThemedText themeColor="textSecondary">방 목록을 불러오는 중이에요.</ThemedText>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: 520 },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.five,
  },
  header: { gap: Spacing.four, marginBottom: Spacing.two },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  account: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  photo: { width: 32, height: 32, borderRadius: 16 },
  button: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 12,
  },
  createButton: { backgroundColor: '#2554DB' },
  createLabel: { color: '#FFFFFF' },
  pressed: { opacity: 0.8 },
  intro: { gap: Spacing.one },
  title: { fontWeight: '700' },
  sectionHeading: { marginTop: Spacing.three, marginBottom: Spacing.two },
  separator: { height: Spacing.two + Spacing.one },
  card: {
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
  },
  cardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  vacancyBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 8,
    backgroundColor: '#E7F5ED',
  },
  vacancyText: { color: '#17623E' },
  match: { gap: Spacing.one },
  roomTitle: { fontSize: 18, lineHeight: 25, fontWeight: '700' },
  cardFooter: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.two },
});
