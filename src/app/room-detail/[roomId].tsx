import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useMockSession } from '@/features/auth/mock-session';
import { getRoomDetail, joinRoom } from '@/features/rooms/room-api';
import { formatGameDate, gameDateKey } from '@/features/rooms/room-list';
import { useTheme } from '@/hooks/use-theme';

type Detail = Awaited<ReturnType<typeof getRoomDetail>>;

export default function RoomDetailScreen() {
  const theme = useTheme();
  const { roomId: roomParam, fromChat } = useLocalSearchParams<{ roomId: string; fromChat?: string }>();
  const roomId = Number(roomParam);
  const { session } = useMockSession();
  const apiSession = session && !session.needProfile ? session.apiSession : null;
  const userId = session && !session.needProfile ? session.userId : null;
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const requestId = useRef(0);
  const joining = useRef(false);

  const loadDetail = useCallback(async () => {
    const current = ++requestId.current;
    setDetail(null);
    setLoadError(null);
    setActionError(null);
    if (!apiSession || !Number.isSafeInteger(roomId) || roomId <= 0) {
      setLoadError('방을 찾을 수 없어요.');
      return;
    }
    try {
      const result = await getRoomDetail(apiSession, roomId);
      if (requestId.current === current) setDetail(result);
    } catch (error) {
      if (requestId.current === current) setLoadError(error instanceof Error ? error.message : '방 정보를 불러오지 못했어요.');
    }
  }, [roomId, apiSession]);

  useFocusEffect(useCallback(() => {
    void loadDetail();
    return () => { requestId.current += 1; };
  }, [loadDetail]));

  const joined = detail?.participants.some((participant) => participant.userId === userId) ?? false;

  async function openChat() {
    if (!detail || !apiSession || joining.current) return;
    const current = requestId.current;
    joining.current = true;
    setIsJoining(true);
    setActionError(null);
    try {
      if (!joined) await joinRoom(apiSession, roomId);
      if (requestId.current !== current) return;
      if (fromChat === 'true' && joined && router.canGoBack()) router.back();
      else router.replace({ pathname: '/room-chat/[roomId]', params: { roomId } });
    } catch (error) {
      if (requestId.current === current) setActionError(error instanceof Error ? error.message : '방에 참여하지 못했어요.');
    } finally {
      joining.current = false;
      setIsJoining(false);
    }
  }

  const isPast = detail ? detail.room.gameDate < gameDateKey(new Date()) : false;
  const isFull = detail ? detail.room.participantCount >= detail.room.capacity : false;
  const cannotJoin = !detail || (!joined && (isPast || isFull));
  const buttonLabel = joined ? '채팅방 입장' : isPast ? '경기가 종료된 방이에요' : isFull ? '모집이 마감됐어요' : '참여하기';

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style="auto" />
      <View style={styles.container}>
        <View style={styles.toolbar}>
          <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/home')} style={styles.back}>
            <ThemedText type="smallBold" themeColor="textSecondary">‹ 뒤로</ThemedText>
          </Pressable>
          <ThemedText type="smallBold">방 상세</ThemedText>
          {detail ? (
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/report', params: { targetType: 'ROOM', targetId: roomId } })} style={styles.back}>
              <ThemedText type="smallBold" themeColor="textSecondary">신고</ThemedText>
            </Pressable>
          ) : <View style={styles.toolbarSpacer} />}
        </View>
        {detail ? (
          <>
            <ScrollView contentContainerStyle={styles.content}>
              <View style={styles.intro}>
                <View style={styles.badge}><ThemedText type="smallBold" style={styles.badgeText}>{joined ? '참여 중' : isPast ? '경기 종료' : isFull ? '모집 마감' : '모집 중'}</ThemedText></View>
                <ThemedText accessibilityRole="header" style={styles.title}>{detail.room.title}</ThemedText>
              </View>
              <View style={[styles.matchCard, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="smallBold" themeColor="textSecondary">경기 정보</ThemedText>
                <ThemedText style={styles.match}>{detail.room.homeTeam} <ThemedText type="small" themeColor="textSecondary">vs</ThemedText> {detail.room.awayTeam}</ThemedText>
                <ThemedText themeColor="textSecondary">{formatGameDate(detail.room.gameDate)}</ThemedText>
                <ThemedText themeColor="textSecondary">{detail.room.stadium}</ThemedText>
              </View>
              <View style={styles.participants}>
                <View style={styles.sectionHeader}>
                  <ThemedText accessibilityRole="header" style={styles.sectionTitle}>참여자</ThemedText>
                  <ThemedText type="smallBold" themeColor="textSecondary">{detail.room.participantCount}/{detail.room.capacity}명</ThemedText>
                </View>
                {detail.participants.map((participant) => (
                  <Pressable key={participant.userId} accessibilityRole="button" accessibilityLabel={`${participant.nickname ?? '사용자'} 프로필 보기`}
                    onPress={() => router.push({ pathname: '/user-profile/[userId]', params: { userId: participant.userId } })}
                    style={[styles.participant, { borderColor: theme.backgroundSelected }]}>
                    <View style={styles.avatar}>
                      {participant.avatarUrl ? <Image source={participant.avatarUrl} style={styles.avatarImage} contentFit="cover" /> : (
                        <ThemedText style={styles.avatarText}>{(participant.nickname ?? '?').slice(0, 1)}</ThemedText>
                      )}
                    </View>
                    <ThemedText style={styles.participantName}>{participant.nickname ?? '알 수 없는 사용자'}</ThemedText>
                    {participant.userId === userId && <ThemedText type="small" themeColor="textSecondary">나</ThemedText>}
                    {participant.host && <View style={styles.hostBadge}><ThemedText type="smallBold" style={styles.hostText}>방장</ThemedText></View>}
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <View style={[styles.footer, { borderColor: theme.backgroundSelected }]}>
              {actionError && <ThemedText accessibilityRole="alert" type="small">{actionError}</ThemedText>}
              <Pressable accessibilityRole="button" disabled={cannotJoin || isJoining} onPress={openChat}
                style={({ pressed }) => [styles.primary, (cannotJoin || isJoining || pressed) && styles.dimmed]}>
                <ThemedText style={styles.primaryText}>{isJoining ? '입장 중' : buttonLabel}</ThemedText>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.message}>
            <ThemedText accessibilityLiveRegion="polite" themeColor="textSecondary">{loadError ?? '방 정보를 불러오는 중이에요.'}</ThemedText>
            {loadError && <Pressable accessibilityRole="button" onPress={loadDetail} style={styles.back}><ThemedText type="smallBold">다시 시도</ThemedText></Pressable>}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center' },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.four },
  back: { minWidth: 56, minHeight: 48, justifyContent: 'center' },
  toolbarSpacer: { width: 56 },
  content: { padding: Spacing.four, gap: Spacing.five },
  intro: { alignItems: 'flex-start', gap: Spacing.two },
  badge: { backgroundColor: '#E7F5ED', borderRadius: 8, paddingHorizontal: Spacing.two, paddingVertical: Spacing.half },
  badgeText: { color: '#17623E' },
  title: { fontSize: 26, lineHeight: 34, fontWeight: '700' },
  matchCard: { padding: Spacing.four, borderRadius: 16, gap: Spacing.two },
  match: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  participants: { gap: Spacing.two },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: Spacing.one },
  sectionTitle: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  participant: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E6EDFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: '#2554DB', fontWeight: '700' },
  participantName: { flex: 1 },
  hostBadge: { borderRadius: 8, backgroundColor: '#E6EDFF', paddingHorizontal: Spacing.two, paddingVertical: Spacing.half },
  hostText: { color: '#2554DB' },
  footer: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, borderTopWidth: StyleSheet.hairlineWidth, gap: Spacing.two },
  primary: { minHeight: 52, borderRadius: 12, backgroundColor: '#2554DB', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontWeight: '700' },
  dimmed: { opacity: 0.5 },
  message: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
});
