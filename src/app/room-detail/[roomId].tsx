import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon, Badge, ui } from '@/components/jikchin-ui';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useMockSession } from '@/features/auth/mock-session';
import { MatchCard } from '@/features/rooms/match-card';
import { getRoomDetail, joinRoom } from '@/features/rooms/room-api';
import { gameDateKey } from '@/features/rooms/room-list';
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
  const remaining = detail ? Math.max(0, detail.room.capacity - detail.room.participantCount) : 0;
  const cannotJoin = !detail || (!joined && (isPast || isFull));
  const buttonLabel = joined ? '채팅방 입장' : isPast ? '경기 날짜가 지난 방이에요' : isFull ? '모집이 마감됐어요' : `참여하기 · ${remaining}자리 남음`;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style="auto" />
      <View style={styles.container}>
        <View style={[styles.toolbar, { borderColor: theme.border }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="뒤로 가기" onPress={() => router.canGoBack() ? router.back() : router.replace('/home')} style={styles.back}>
            <AppIcon name="back" size={23} />
          </Pressable>
          <ThemedText accessibilityRole="header" style={styles.sectionTitle}>직관방 상세</ThemedText>
          {detail ? (
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/report', params: { targetType: 'ROOM', targetId: roomId } })} style={styles.back}>
              <ThemedText type="smallBold" themeColor="accentText">신고</ThemedText>
            </Pressable>
          ) : <View style={styles.toolbarSpacer} />}
        </View>
        {detail ? (
          <>
            <ScrollView contentContainerStyle={styles.content}>
              <MatchCard room={detail.room} featured />
              <View style={[ui.card, styles.intro, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Badge label={joined ? '참여 중' : isPast ? '지난 경기' : isFull ? '모집 마감' : '모집 중'}
                  tone={joined || (!isFull && !isPast) ? 'green' : 'neutral'} />
                <ThemedText accessibilityRole="header" style={styles.title}>{detail.room.title}</ThemedText>
              </View>
              <View style={[ui.card, styles.participants, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.sectionHeader}>
                  <ThemedText accessibilityRole="header" style={styles.sectionTitle}>참여자</ThemedText>
                  <Badge label={`${detail.room.participantCount}/${detail.room.capacity}명`} />
                </View>
                {detail.participants.map((participant) => (
                  <Pressable key={participant.userId} accessibilityRole="button" accessibilityLabel={`${participant.nickname ?? '사용자'} 프로필 보기`}
                    onPress={() => router.push({ pathname: '/user-profile/[userId]', params: { userId: participant.userId } })}
                    style={[styles.participant, { backgroundColor: theme.backgroundElement }]}>
                    <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
                      {participant.avatarUrl ? <Image source={participant.avatarUrl} style={styles.avatarImage} contentFit="cover" /> : (
                        <ThemedText type="smallBold" themeColor="accentText">{(participant.nickname ?? '?').slice(0, 1)}</ThemedText>
                      )}
                    </View>
                    <ThemedText style={styles.participantName}>{participant.nickname ?? '알 수 없는 사용자'}</ThemedText>
                    {participant.userId === userId && <ThemedText type="small" themeColor="textSecondary">나</ThemedText>}
                    {participant.host && <Badge label="방장" />}
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <View style={[styles.footer, { borderColor: theme.border, backgroundColor: theme.surface }]}>
              {actionError && <ThemedText accessibilityRole="alert" type="small" themeColor="danger">{actionError}</ThemedText>}
              <Pressable accessibilityRole="button" disabled={cannotJoin || isJoining} onPress={openChat}
                style={({ pressed }) => [ui.button, { backgroundColor: theme.accent }, (cannotJoin || isJoining || pressed) && styles.dimmed]}>
                <AppIcon name={joined ? 'chat' : 'person'} color="#FFFFFF" />
                <ThemedText style={[ui.buttonLabel, ui.white, styles.actionLabel]}>{isJoining ? '입장 중' : buttonLabel}</ThemedText>
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
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { minWidth: 56, minHeight: 50, justifyContent: 'center', alignItems: 'center' },
  toolbarSpacer: { width: 56 },
  content: { padding: 18, gap: 14 },
  intro: { alignItems: 'flex-start', gap: Spacing.two, padding: 16 },
  title: { fontSize: 22, lineHeight: 30, fontWeight: '800' },
  participants: { gap: Spacing.two, padding: 16 },
  sectionHeader: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center', justifyContent: 'space-between', paddingBottom: Spacing.one },
  sectionTitle: { fontSize: 18, lineHeight: 26, fontWeight: '800' },
  participant: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: 12, padding: 8 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  participantName: { flex: 1 },
  footer: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, borderTopWidth: StyleSheet.hairlineWidth, gap: Spacing.two },
  actionLabel: { flexShrink: 1, textAlign: 'center' },
  dimmed: { opacity: 0.5 },
  message: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
});
