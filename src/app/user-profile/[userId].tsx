import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useMockSession } from '@/features/auth/mock-session';
import { getPublicProfile, setUserBlocked } from '@/features/moderation/moderation-api';
import { useTheme } from '@/hooks/use-theme';

type Profile = Awaited<ReturnType<typeof getPublicProfile>>;

export default function UserProfileScreen() {
  const theme = useTheme();
  const { userId: rawId } = useLocalSearchParams<{ userId: string }>();
  const targetId = Number(rawId);
  const { session } = useMockSession();
  const apiSession = session && !session.needProfile ? session.apiSession : null;
  const viewerId = session && !session.needProfile ? session.userId : null;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const requestId = useRef(0);
  const processing = useRef(false);

  const load = useCallback(async () => {
    const request = ++requestId.current;
    setError(null);
    if (!apiSession || !Number.isSafeInteger(targetId) || targetId <= 0) { setError('사용자를 찾을 수 없어요.'); return; }
    try {
      const next = await getPublicProfile(apiSession, targetId);
      if (request === requestId.current) setProfile(next);
    } catch (cause) {
      if (request === requestId.current) setError(cause instanceof Error ? cause.message : '프로필을 불러오지 못했어요.');
    }
  }, [targetId, apiSession]);

  useFocusEffect(useCallback(() => {
    void load();
    return () => { requestId.current += 1; };
  }, [load]));

  async function changeBlock() {
    if (!apiSession || !profile || processing.current) return;
    processing.current = true;
    setSaving(true);
    setError(null);
    try {
      await setUserBlocked(apiSession, targetId, !profile.blocked);
      setConfirm(false);
      await load();
    } catch { setError('차단 상태를 변경하지 못했어요.'); setConfirm(false); }
    finally { processing.current = false; setSaving(false); }
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/home')} style={styles.back}>
          <ThemedText type="smallBold" themeColor="textSecondary">‹ 뒤로</ThemedText>
        </Pressable>
        <ThemedText accessibilityRole="header" type="subtitle">프로필</ThemedText>
        {profile ? <>
          <View style={styles.identity}>
            <View style={styles.avatar}>
              {profile.avatarUrl ? <Image source={profile.avatarUrl} style={styles.photo} contentFit="cover" /> : (
                <ThemedText style={styles.avatarText}>{(profile.nickname ?? '?').slice(0, 1)}</ThemedText>
              )}
            </View>
            <ThemedText style={styles.name}>{profile.nickname ?? '알 수 없는 사용자'}</ThemedText>
            <ThemedText themeColor="textSecondary">{profile.bio || '아직 소개가 없어요.'}</ThemedText>
          </View>
          <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">응원팀</ThemedText>
            <ThemedText>KBO · {profile.favoriteKboTeam?.name ?? '선택한 팀이 없어요'}</ThemedText>
            <ThemedText>K리그1 · {profile.favoriteKleagueTeam?.name ?? '선택한 팀이 없어요'}</ThemedText>
          </View>
          {targetId !== viewerId && <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/report', params: { targetType: 'USER', targetId } })} style={[styles.button, { borderColor: theme.backgroundSelected }]}>
              <ThemedText type="smallBold">사용자 신고</ThemedText>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setConfirm(true)} style={[styles.button, { borderColor: theme.backgroundSelected }]}>
              <ThemedText type="smallBold" style={styles.danger}>{profile.blocked ? '차단 해제' : '사용자 차단'}</ThemedText>
            </Pressable>
          </View>}
        </> : !error && <ThemedText themeColor="textSecondary">프로필을 불러오는 중이에요.</ThemedText>}
        {error && <>
          <ThemedText accessibilityRole="alert">{error}</ThemedText>
          {!profile && <Pressable accessibilityRole="button" onPress={load} style={styles.back}><ThemedText type="smallBold">다시 시도</ThemedText></Pressable>}
        </>}
      </ScrollView>
      <Modal visible={confirm} transparent animationType="fade" onRequestClose={() => { if (!saving) setConfirm(false); }}>
        <View style={styles.overlay}>
          <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: theme.background }]}>
            <ThemedText accessibilityRole="header" style={styles.name}>{profile?.blocked ? '차단을 해제할까요?' : '이 사용자를 차단할까요?'}</ThemedText>
            <ThemedText themeColor="textSecondary">{profile?.blocked ? '상대방도 나를 차단한 경우 방 참여 제한은 유지돼요.' : '서로가 만든 방에 새로 참여할 수 없어요. 이미 참여한 방에서는 대화가 유지돼요.'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">현재 차단 설정은 이 기기에만 저장돼요.</ThemedText>
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" disabled={saving} onPress={() => setConfirm(false)} style={[styles.button, { borderColor: theme.backgroundSelected }]}><ThemedText type="smallBold">취소</ThemedText></Pressable>
              <Pressable accessibilityRole="button" disabled={saving} onPress={changeBlock} style={[styles.button, { borderColor: theme.backgroundSelected }]}><ThemedText type="smallBold" style={styles.danger}>{saving ? '처리 중' : profile?.blocked ? '차단 해제' : '차단하기'}</ThemedText></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: Spacing.four, paddingBottom: Spacing.five, gap: Spacing.four },
  back: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  identity: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.four },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#E6EDFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  avatarText: { color: '#2554DB', fontSize: 28, fontWeight: '700' },
  name: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  card: { padding: Spacing.four, borderRadius: 16, gap: Spacing.two },
  actions: { flexDirection: 'row', gap: Spacing.two },
  button: { flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  danger: { color: '#A82119' },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)', padding: Spacing.four },
  dialog: { width: '100%', maxWidth: 360, padding: Spacing.four, gap: Spacing.three, borderRadius: 16 },
});
