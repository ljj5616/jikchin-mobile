import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppIcon, Badge, ui } from '@/components/jikchin-ui';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
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
    <ScrollView style={[styles.screen, { backgroundColor: theme.background }]} contentContainerStyle={styles.content}>
      <View style={styles.heading}>
        <ThemedText accessibilityRole="header" type="subtitle" style={styles.title}>마이페이지</ThemedText>
        {profileError && (
          <>
            <ThemedText type="small" accessibilityRole="alert">{profileError}</ThemedText>
            <Pressable accessibilityRole="button" onPress={loadProfile} style={styles.accountAction}>
              <ThemedText type="smallBold">다시 시도</ThemedText>
            </Pressable>
          </>
        )}
      </View>
      <View style={[ui.card, styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.profileRow}>
          <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
            {profile.avatarUrl ? <Image source={profile.avatarUrl} style={styles.photo} contentFit="cover" /> : (
              <ThemedText style={styles.avatarInitial} themeColor="accentText">{profile.nickname.slice(0, 1)}</ThemedText>
            )}
          </View>
          <View style={styles.profileText}>
            <ThemedText accessibilityRole="header" style={styles.nickname}>{profile.nickname}</ThemedText>
            <ThemedText themeColor="textSecondary">{profile.bio || '아직 소개가 없어요.'}</ThemedText>
          </View>
        </View>
        <Pressable accessibilityRole="button" disabled={refreshing || Boolean(profileError)}
          onPress={() => router.push('/edit-profile')} style={[ui.button, { backgroundColor: theme.backgroundElement }]}>
          <AppIcon name="edit" color={theme.accentText} />
          <ThemedText type="smallBold" themeColor="accentText">{refreshing ? '프로필 불러오는 중' : '프로필 수정'}</ThemedText>
        </Pressable>
      </View>
      <View style={[ui.card, styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <ThemedText accessibilityRole="header" style={styles.cardTitle}>나의 응원팀</ThemedText>
        {([
          ['KBO', profile.favoriteKboTeam],
          ['K리그1', profile.favoriteKleagueTeam],
        ] as const).map(([label, team]) => (
          <View key={label} style={[styles.teamRow, { backgroundColor: theme.backgroundElement }]}>
            <Badge label={label} tone={label === 'KBO' ? 'blue' : 'green'} />
            <ThemedText style={styles.teamName}>{team?.name ?? '선택한 팀이 없어요'}</ThemedText>
          </View>
        ))}
      </View>
      <Pressable accessibilityRole="button" onPress={() => router.push('/blocked-users')} style={[ui.card, styles.settingsRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={[styles.settingsIcon, { backgroundColor: theme.backgroundElement }]}>
          <AppIcon name="block" color={theme.accentText} />
        </View>
        <ThemedText type="smallBold">차단한 사용자</ThemedText>
        <View style={styles.settingsChevron}><AppIcon name="chevron" color={theme.textSecondary} /></View>
      </Pressable>
      <View style={styles.accountActions}>
        <Pressable accessibilityRole="button" onPress={signOut} style={styles.accountAction}>
          <ThemedText type="smallBold" themeColor="textSecondary">로그아웃</ThemedText>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => { setWithdrawError(null); setShowWithdraw(true); }} style={styles.accountAction}>
          <ThemedText type="smallBold" themeColor="danger">회원 탈퇴</ThemedText>
        </Pressable>
      </View>
    </ScrollView>
    <Modal visible={showWithdraw} transparent animationType="fade" onRequestClose={() => { if (!withdrawing) setShowWithdraw(false); }}>
      <View style={styles.overlay}>
        <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: theme.surface }]}>
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
  content: { alignSelf: 'center', width: '100%', maxWidth: 520, padding: 18, gap: 14 },
  heading: { gap: Spacing.one },
  title: { fontWeight: '800' },
  card: { padding: 16, gap: 12 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  profileText: { flex: 1, gap: Spacing.one },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarInitial: { fontSize: 26, lineHeight: 32, fontWeight: '800' },
  photo: { width: '100%', height: '100%' },
  nickname: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  cardTitle: { fontSize: 18, lineHeight: 25, fontWeight: '700' },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12 },
  teamName: { flex: 1, fontSize: 15, lineHeight: 22, fontWeight: '700' },
  accountActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  accountAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.two },
  settingsRow: { minHeight: 62, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  settingsIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingsChevron: { flex: 1, alignItems: 'flex-end' },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  dialog: { width: '100%', maxWidth: 360, padding: Spacing.four, gap: Spacing.three, borderRadius: 16 },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two },
  dialogButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.three, borderRadius: 10 },
  withdrawButton: { backgroundColor: Brand.red },
  withdrawText: { color: '#FFFFFF' },
  disabled: { opacity: 0.5 },
});
