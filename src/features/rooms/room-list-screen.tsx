import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Switch, View } from 'react-native';

import { AppIcon, Badge, ui } from '@/components/jikchin-ui';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useMockSession } from '@/features/auth/mock-session';
import type { League } from '@/features/onboarding/profile';
import { MatchCard } from '@/features/rooms/match-card';
import { listJoinedRooms, listRooms } from '@/features/rooms/room-api';
import { formatGameDate, type RoomResponse } from '@/features/rooms/room-list';
import { useTheme } from '@/hooks/use-theme';

const leagueFilters = [
  { key: 'all', label: '전체' },
  { key: 'KBO', label: 'KBO 야구', icon: 'baseball' },
  { key: 'KLEAGUE', label: 'K리그 축구', icon: 'football' },
] as const;

export function RoomCard({ room, joined, league, onPress }: { room: RoomResponse; joined: boolean; league?: League; onPress: () => void }) {
  const theme = useTheme();
  const remaining = Math.max(0, room.capacity - room.participantCount);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={joined ? '채팅방 열기' : '방 상세 보기'}
      onPress={onPress}
      style={({ pressed }) => [
        ui.card,
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
        pressed && styles.pressed,
      ]}>
      <View style={styles.badges}>
        {league && <Badge label={league === 'KBO' ? 'KBO' : 'K리그1'} />}
        <Badge label={joined ? '참여 중' : remaining ? '모집 중' : '모집 마감'} tone={joined || remaining ? 'green' : 'neutral'} />
        {!joined && remaining > 0 && <Badge label={`${remaining}자리 남음`} tone={remaining === 1 ? 'red' : 'blue'} />}
        {!joined && <ThemedText type="small" themeColor="textSecondary">{formatGameDate(room.gameDate)}</ThemedText>}
      </View>

      {joined ? <MatchCard room={room} /> : (
        <View style={[styles.match, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText style={styles.teamName}>{room.homeTeam}</ThemedText>
          <ThemedText type="smallBold" themeColor="accentText">VS</ThemedText>
          <ThemedText style={styles.teamName}>{room.awayTeam}</ThemedText>
        </View>
      )}

      <ThemedText style={styles.roomTitle}>{room.title}</ThemedText>
      {!joined && (
        <View style={styles.meta}>
          <AppIcon name="location" size={17} color={theme.accentText} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.stadium}>{room.stadium}</ThemedText>
        </View>
      )}
      <View style={[styles.cardFooter, { borderColor: theme.border }]}>
        <ThemedText type="smallBold" themeColor="textSecondary">{room.participantCount}/{room.capacity}명 참여</ThemedText>
        <View style={[styles.cardAction, { backgroundColor: joined ? theme.accent : theme.backgroundElement }]}>
          <ThemedText type="smallBold" style={{ color: joined ? Brand.white : theme.accentText }}>
            {joined ? '채팅방 바로가기' : '방 상세 보기'}
          </ThemedText>
          <AppIcon name={joined ? 'chat' : 'chevron'} size={18} color={joined ? Brand.white : theme.accentText} />
        </View>
      </View>
    </Pressable>
  );
}

export function RoomListScreen() {
  const theme = useTheme();
  const { session } = useMockSession();
  const apiSession = session && !session.needProfile ? session.apiSession : null;
  const [rooms, setRooms] = useState<RoomResponse[] | null>(null);
  const [league, setLeague] = useState<League | 'all'>('all');
  const [recruitingOnly, setRecruitingOnly] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestId = useRef(0);

  const loadRooms = useCallback(async () => {
    if (!apiSession) return;
    const request = ++requestId.current;
    setLoadError(null);
    try {
      const [upcoming, joined] = await Promise.all([listRooms(apiSession), listJoinedRooms(apiSession)]);
      const joinedIds = new Set(joined.map((room) => room.id));
      if (requestId.current === request) {
        setRooms(upcoming.filter((room) => !joinedIds.has(room.id)));
      }
    } catch (error) {
      if (requestId.current === request) setLoadError(error instanceof Error ? error.message : '방 목록을 불러오지 못했어요.');
    }
  }, [apiSession]);

  useFocusEffect(useCallback(() => {
    void loadRooms();
    return () => { requestId.current += 1; };
  }, [loadRooms]));

  if (!session || session.needProfile) return null;

  const leagueByTeam = new Map<number, League>([
    ...session.teams.KBO.map((team) => [team.id, 'KBO'] as const),
    ...session.teams.KLEAGUE.map((team) => [team.id, 'KLEAGUE'] as const),
  ]);
  const visibleRooms = rooms?.filter((room) =>
    (league === 'all' || leagueByTeam.get(room.homeTeamId) === league) &&
    (!recruitingOnly || room.participantCount < room.capacity),
  ) ?? [];

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <FlatList
        data={visibleRooms}
        keyExtractor={(room) => String(room.id)}
        renderItem={({ item }) => (
          <RoomCard room={item} joined={false} league={leagueByTeam.get(item.homeTeamId)}
            onPress={() => router.push({ pathname: '/room-detail/[roomId]', params: { roomId: item.id } })} />
        )}
        style={styles.list}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.heading}>
              <ThemedText accessibilityRole="header" type="subtitle" style={styles.headingTitle}>직관방</ThemedText>
              <Pressable accessibilityRole="button" onPress={() => router.push('/create-room')}
                style={({ pressed }) => [ui.button, styles.createButton, { backgroundColor: theme.accent }, pressed && styles.pressed]}>
                <AppIcon name="add" color={Brand.white} size={18} />
                <ThemedText type="smallBold" style={ui.white}>방 생성</ThemedText>
              </Pressable>
            </View>
            <ThemedText themeColor="textSecondary">같이 볼 경기를 찾아보세요.</ThemedText>
            <View style={styles.badges}>
              {leagueFilters.map((filter) => {
                const selected = league === filter.key;
                const color = selected ? Brand.white : theme.accentText;
                return (
                  <Pressable key={filter.key} accessibilityRole="button" accessibilityState={{ selected }}
                    onPress={() => setLeague(filter.key)}
                    style={[styles.filter, { backgroundColor: selected ? theme.accent : theme.backgroundElement }]}>
                    {'icon' in filter && <AppIcon name={filter.icon} size={17} color={color} />}
                    <ThemedText type="smallBold" style={{ color }}>{filter.label}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.heading}>
              <View style={styles.badges}>
                <ThemedText accessibilityRole="header" style={styles.sectionHeading}>{recruitingOnly ? '모집 중인 방' : '전체 직관방'}</ThemedText>
                {rooms && <Badge label={`${visibleRooms.length}개`} />}
              </View>
              <View style={styles.meta}>
                <ThemedText type="small" themeColor="textSecondary">모집 중만</ThemedText>
                <Switch accessibilityLabel="모집 중인 방만 보기" value={recruitingOnly} onValueChange={setRecruitingOnly}
                  trackColor={{ true: theme.accent, false: theme.backgroundSelected }} />
              </View>
            </View>

            {loadError && (
              <View>
                <ThemedText accessibilityRole="alert" type="small">{loadError}</ThemedText>
                <Pressable accessibilityRole="button" onPress={loadRooms} style={ui.button}>
                  <ThemedText type="smallBold" themeColor="accentText">다시 시도</ThemedText>
                </Pressable>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={loadError ? undefined : (
          <View style={[ui.card, styles.empty, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <AppIcon name="stadium" color={theme.accentText} size={28} />
            <ThemedText accessibilityLiveRegion="polite" type="small" themeColor="textSecondary" style={styles.emptyText}>
              {rooms ? '조건에 맞는 직관방이 없어요.' : '방 목록을 불러오는 중이에요.'}
            </ThemedText>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: 520 },
  content: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 28,
  },
  header: { gap: 12, marginBottom: 12 },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  headingTitle: { flexShrink: 1 },
  createButton: { minHeight: 44, borderRadius: 24 },
  pressed: { opacity: 0.75 },
  sectionHeading: { fontSize: 17, fontWeight: '800', lineHeight: 24 },
  separator: { height: 12 },
  card: { gap: 12, padding: 15 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  filter: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 44, paddingHorizontal: 12, borderRadius: 24 },
  match: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', padding: 10, borderRadius: 10, gap: 8 },
  teamName: { flexShrink: 1, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  roomTitle: { fontSize: 18, lineHeight: 25, fontWeight: '700' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stadium: { flex: 1 },
  cardFooter: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  cardAction: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10 },
  empty: { alignItems: 'center', gap: 10, padding: 24 },
  emptyText: { textAlign: 'center' },
});
