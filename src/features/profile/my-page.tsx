import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { AuthApiError } from '@/features/auth/auth-api';
import { useMockSession } from '@/features/auth/mock-session';
import { useTheme } from '@/hooks/use-theme';

export function MyPage({ active }: { active: boolean }) {
  const theme = useTheme();
  const { session, signOut, refreshProfile, withdraw } = useMockSession();
  const [refreshing, setRefreshing] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const refreshRequest = useRef<AbortController | null>(null);
  const inProgress = useRef(false);

  const loadProfile = useCallback(() => {
    refreshRequest.current?.abort();
    const controller = new AbortController();
    refreshRequest.current = controller;
    setRefreshing(true);
    setProfileError(null);
    void refreshProfile(controller.signal)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setProfileError(error instanceof AuthApiError ? error.message : '프로필을 불러오지 못했어요.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setRefreshing(false);
      });
  }, [refreshProfile]);

  useFocusEffect(useCallback(() => {
    if (!active) return;
    loadProfile();
    return () => refreshRequest.current?.abort();
  }, [active, loadProfile]));

  if (!session || session.needProfile) return null;

  const { profile } = session;

  async function confirmWithdrawal() {
    if (!session || session.needProfile || inProgress.current) return;
    inProgress.current = true;
    setWithdrawing(true);
    setWithdrawError(null);
    try {
      await withdraw();
    } catch (error) {
      setWithdrawError(error instanceof AuthApiError ? error.message : '회원 탈퇴를 처리하지 못했어요. 다시 시도해 주세요.');
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
        {profileError && (
          <>
            <ThemedText type="small" accessibilityRole="alert">{profileError}</ThemedText>
            <Pressable accessibilityRole="button" onPress={loadProfile} style={styles.accountAction}>
              <ThemedText type="smallBold">다시 시도</ThemedText>
            </Pressable>
          </>
        )}
      </View>
      <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            {profile.avatarUrl ? <Image source={profile.avatarUrl} style={styles.photo} contentFit="cover" /> : (
              <ThemedText style={styles.avatarInitial}>{profile.nickname.slice(0, 1)}</ThemedText>
            )}
          </View>
          <View style={styles.profileText}>
            <ThemedText accessibilityRole="header" style={styles.nickname}>{profile.nickname}</ThemedText>
            <ThemedText themeColor="textSecondary">{profile.bio || '아직 소개가 없어요.'}</ThemedText>
          </View>
        </View>
        <Pressable accessibilityRole="button" disabled={refreshing || Boolean(profileError)}
          onPress={() => router.push('/edit-profile')} style={[styles.editButton, { borderColor: theme.backgroundSelected }]}>
          <ThemedText type="smallBold">{refreshing ? '프로필 불러오는 중' : '프로필 수정'}</ThemedText>
        </Pressable>
      </View>
      <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
        <ThemedText accessibilityRole="header" style={styles.cardTitle}>나의 응원팀</ThemedText>
        {([
          ['KBO', profile.favoriteKboTeam],
          ['K리그1', profile.favoriteKleagueTeam],
        ] as const).map(([label, team]) => (
          <View key={label} style={[styles.teamRow, { borderColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold" themeColor="textSecondary">{label}</ThemedText>
            <ThemedText style={styles.teamName}>{team?.name ?? '선택한 팀이 없어요'}</ThemedText>
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
          <ThemedText themeColor="textSecondary">프로필과 직관 기록이 삭제되고 참여 중인 방에서 나가요. 탈퇴한 계정은 복구할 수 없어요.</ThemedText>
          {withdrawError && <ThemedText accessibilityRole="alert" type="small">{withdrawError}</ThemedText>}
          <View style={styles.dialogActions}>
            <Pressable accessibilityRole="button" disabled={withdrawing} onPress={() => setShowWithdraw(false)}
              style={[styles.dialogButton, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold">취소</ThemedText>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={withdrawing} onPress={confirmWithdrawal}
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
