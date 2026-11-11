import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useMockSession } from '@/features/auth/mock-session';
import { withdrawMockModeration } from '@/features/moderation/mock-moderation-store';
import type { League } from '@/features/onboarding/profile';
import { mockRoomUserIds, withdrawMockRooms } from '@/features/rooms/mock-room-store';
import { useTheme } from '@/hooks/use-theme';

export function MyPage() {
  const theme = useTheme();
  const { session, signOut, removeProfile } = useMockSession();
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const inProgress = useRef(false);
  if (!session || session.needProfile) return null;

  const { profile, avatarUri } = session;
  const teamName = (league: League, id: number | null) =>
    session.teams[league].find((team) => team.id === id)?.name ?? '선택한 팀이 없어요';

  async function withdraw() {
    if (!session || session.needProfile || inProgress.current) return;
    inProgress.current = true;
    setWithdrawing(true);
    setWithdrawError(null);
    try {
      const userId = mockRoomUserIds[session.provider];
      const retiredId = -Date.now();
      await withdrawMockRooms(userId, retiredId);
      await withdrawMockModeration(userId, retiredId);
      await removeProfile();
    } catch {
      setWithdrawError('일부 정보가 정리되었을 수 있어요. 다시 시도해 주세요.');
    } finally {
      inProgress.current = false;
      setWithdrawing(false);
    }
  }

  return (
    <>
    <ScrollView style={[styles.screen, { backgroundColor: theme.backgroundElement }]} contentContainerStyle={styles.content}>
      <ThemedText type="smallBold">직관친구</ThemedText>
      <View style={styles.heading}>
        <ThemedText accessibilityRole="header" type="subtitle" style={styles.title}>마이페이지</ThemedText>
        <ThemedText themeColor="textSecondary">나의 프로필과 응원팀을 확인해 보세요.</ThemedText>
      </View>
      <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            {avatarUri ? <Image source={avatarUri} style={styles.photo} contentFit="cover" /> : (
              <ThemedText style={styles.avatarInitial}>{profile.nickname.slice(0, 1)}</ThemedText>
            )}
          </View>
          <View style={styles.profileText}>
            <ThemedText accessibilityRole="header" style={styles.nickname}>{profile.nickname}</ThemedText>
            <ThemedText themeColor="textSecondary">{profile.bio || '아직 소개가 없어요.'}</ThemedText>
          </View>
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/edit-profile')} style={[styles.editButton, { borderColor: theme.backgroundSelected }]}>
          <ThemedText type="smallBold">프로필 수정</ThemedText>
        </Pressable>
      </View>
      <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
        <ThemedText accessibilityRole="header" style={styles.cardTitle}>나의 응원팀</ThemedText>
        {([
          ['KBO', 'KBO', profile.favoriteKboTeamId],
          ['K리그1', 'KLEAGUE', profile.favoriteKleagueTeamId],
        ] as const).map(([label, league, id]) => (
          <View key={league} style={[styles.teamRow, { borderColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold" themeColor="textSecondary">{label}</ThemedText>
            <ThemedText style={styles.teamName}>{teamName(league, id)}</ThemedText>
          </View>
        ))}
      </View>
      <Pressable accessibilityRole="button" onPress={() => router.push('/blocked-users')} style={[styles.settingsRow, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
        <ThemedText type="smallBold">차단한 사용자</ThemedText>
        <ThemedText themeColor="textSecondary">›</ThemedText>
      </Pressable>
      <View style={styles.accountActions}>
        <Pressable accessibilityRole="button" onPress={signOut} style={styles.accountAction}>
          <ThemedText type="smallBold" themeColor="textSecondary">로그아웃</ThemedText>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => { setWithdrawError(null); setShowWithdraw(true); }} style={styles.accountAction}>
          <ThemedText type="smallBold" themeColor="textSecondary">회원 탈퇴</ThemedText>
        </Pressable>
      </View>
    </ScrollView>
    <Modal visible={showWithdraw} transparent animationType="fade" onRequestClose={() => { if (!withdrawing) setShowWithdraw(false); }}>
      <View style={styles.overlay}>
        <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: theme.background }]}>
          <ThemedText accessibilityRole="header" style={styles.cardTitle}>회원 탈퇴할까요?</ThemedText>
          <ThemedText themeColor="textSecondary">프로필과 차단 정보가 삭제되고 참여 중인 방에서 나가게 돼요. 남은 방의 대화는 탈퇴한 회원으로 표시돼요.</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">현재는 이 기기의 임시 계정만 삭제돼요. 실제 서버 계정 탈퇴는 연결되어 있지 않아요.</ThemedText>
          {withdrawError && <ThemedText accessibilityRole="alert" type="small">{withdrawError}</ThemedText>}
          <View style={styles.dialogActions}>
            <Pressable accessibilityRole="button" disabled={withdrawing} onPress={() => setShowWithdraw(false)}
              style={[styles.dialogButton, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold">취소</ThemedText>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={withdrawing} onPress={withdraw}
              style={[styles.dialogButton, styles.withdrawButton, withdrawing && styles.disabled]}>
              <ThemedText type="smallBold" style={styles.withdrawText}>{withdrawing ? '처리 중' : '탈퇴하기'}</ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { alignSelf: 'center', width: '100%', maxWidth: 520, padding: Spacing.four, gap: Spacing.four },
  heading: { gap: Spacing.one },
  title: { fontWeight: '700' },
  card: { padding: Spacing.four, gap: Spacing.four, borderWidth: 1, borderRadius: 16 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  profileText: { flex: 1, gap: Spacing.one },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#E6EDFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarInitial: { color: '#2554DB', fontSize: 26, fontWeight: '700' },
  photo: { width: '100%', height: '100%' },
  nickname: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  cardTitle: { fontSize: 18, lineHeight: 25, fontWeight: '700' },
  editButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 10 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingTop: Spacing.three, borderTopWidth: StyleSheet.hairlineWidth },
  teamName: { flex: 1, textAlign: 'right' },
  accountActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  accountAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.two },
  settingsRow: { minHeight: 56, paddingHorizontal: Spacing.four, borderWidth: 1, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  dialog: { width: '100%', maxWidth: 360, padding: Spacing.four, gap: Spacing.three, borderRadius: 16 },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two },
  dialogButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.three, borderRadius: 10 },
  withdrawButton: { backgroundColor: '#A82119' },
  withdrawText: { color: '#FFFFFF' },
  disabled: { opacity: 0.5 },
});
