import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon, Badge, PageHeader, ui } from '@/components/jikchin-ui';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useMockSession } from '@/features/auth/mock-session';
import { listBlockedUsers, setUserBlocked } from '@/features/moderation/moderation-api';
import { useTheme } from '@/hooks/use-theme';

type BlockedUser = Awaited<ReturnType<typeof listBlockedUsers>>[number];

const blockedDateFormatter = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });

export default function BlockedUsersScreen() {
  const theme = useTheme();
  const { session } = useMockSession();
  const apiSession = session && !session.needProfile ? session.apiSession : null;
  const [users, setUsers] = useState<BlockedUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<BlockedUser | null>(null);
  const [saving, setSaving] = useState(false);
  const requestId = useRef(0);
  const processing = useRef(false);

  const load = useCallback(async () => {
    if (!apiSession) return;
    const request = ++requestId.current;
    setError(null);
    try {
      const result = await listBlockedUsers(apiSession);
      if (request === requestId.current) setUsers(result);
    } catch {
      if (request === requestId.current) setError('차단 목록을 불러오지 못했어요.');
    }
  }, [apiSession]);

  useFocusEffect(useCallback(() => {
    void load();
    return () => { requestId.current += 1; };
  }, [load]));

  async function unblock() {
    if (!selected || !apiSession || processing.current) return;
    processing.current = true;
    setSaving(true);
    try { await setUserBlocked(apiSession, selected.userId, false); setSelected(null); await load(); }
    catch { setSelected(null); setError('차단을 해제하지 못했어요.'); }
    finally { processing.current = false; setSaving(false); }
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style="auto" />
      <FlatList data={users ?? []} keyExtractor={(user) => String(user.userId)} style={styles.list} contentContainerStyle={styles.content}
        ListHeaderComponent={<View style={styles.heading}>
          <PageHeader title="차단 관리" onBack={() => router.canGoBack() ? router.back() : router.replace('/home')} />
          <View style={styles.titleRow}>
            <ThemedText accessibilityRole="header" type="subtitle">차단한 사용자</ThemedText>
            {users && <Badge label={`${users.length}명`} />}
          </View>
          <View style={[styles.notice, { backgroundColor: theme.backgroundElement }]}>
            <AppIcon name="shield" color={theme.accentText} size={24} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.noticeText}>
              차단한 사용자와는 서로 만든 방에 새로 참여할 수 없어요.
            </ThemedText>
          </View>
          {error && <ThemedText accessibilityRole="alert" themeColor="danger">{error}</ThemedText>}
        </View>}
        renderItem={({ item }) => {
          const blockedDate = item.blockedAt ? new Date(item.blockedAt) : null;
          return (
          <View style={[ui.card, styles.row, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${item.nickname ?? '사용자'} 프로필 보기`}
            onPress={() => router.push({ pathname: '/user-profile/[userId]', params: { userId: item.userId } })} style={styles.identity}>
            <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
              {item.avatarUrl ? <Image source={item.avatarUrl} style={styles.photo} contentFit="cover" />
                : <ThemedText type="smallBold" themeColor="accentText">{(item.nickname ?? '?').slice(0, 1)}</ThemedText>}
            </View>
            <View style={styles.name}>
              <ThemedText type="smallBold">{item.nickname ?? '알 수 없는 사용자'}</ThemedText>
              {blockedDate && !Number.isNaN(blockedDate.getTime()) && (
                <ThemedText type="small" themeColor="textSecondary">{blockedDateFormatter.format(blockedDate)} 차단</ThemedText>
              )}
            </View>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setSelected(item)} style={[styles.button, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold" themeColor="accentText">차단 해제</ThemedText>
          </Pressable>
          </View>
          );
        }}
        ListEmptyComponent={!error ? <ThemedText themeColor="textSecondary">{users === null ? '차단 목록을 불러오는 중이에요.' : '차단한 사용자가 없어요.'}</ThemedText> :
          <Pressable accessibilityRole="button" onPress={load} style={styles.back}><ThemedText type="smallBold">다시 시도</ThemedText></Pressable>}
      />
      <Modal visible={selected !== null} transparent animationType="fade" onRequestClose={() => { if (!saving) setSelected(null); }}>
        <View style={styles.overlay}><View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: theme.surface }]}>
          <ThemedText accessibilityRole="header" style={styles.dialogTitle}>차단을 해제할까요?</ThemedText>
          <ThemedText themeColor="textSecondary">상대방도 나를 차단한 경우 방 참여 제한은 유지돼요.</ThemedText>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" disabled={saving} onPress={() => setSelected(null)} style={[styles.dialogButton, { borderColor: theme.backgroundSelected }]}><ThemedText type="smallBold">취소</ThemedText></Pressable>
            <Pressable accessibilityRole="button" disabled={saving} onPress={unblock} style={[styles.dialogButton, { borderColor: theme.backgroundSelected }]}><ThemedText type="smallBold">{saving ? '처리 중' : '차단 해제'}</ThemedText></Pressable>
          </View>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { width: '100%', maxWidth: 520, alignSelf: 'center' },
  content: { paddingHorizontal: 18, paddingBottom: Spacing.five },
  heading: { gap: 14, paddingBottom: 14 },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: 14 },
  noticeText: { flex: 1 },
  back: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 10, gap: Spacing.two },
  identity: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  name: { flex: 1 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  button: { minHeight: 44, paddingHorizontal: 10, borderRadius: 10, justifyContent: 'center' },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.four, backgroundColor: 'rgba(0,0,0,0.45)' },
  dialog: { width: '100%', maxWidth: 360, padding: Spacing.four, gap: Spacing.three, borderRadius: 16 },
  dialogTitle: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: Spacing.two },
  dialogButton: { flex: 1, minHeight: 48, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
