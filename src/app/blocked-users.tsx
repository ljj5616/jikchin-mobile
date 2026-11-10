import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useMockSession } from '@/features/auth/mock-session';
import { getMockBlocks, unblockMockUser } from '@/features/moderation/mock-moderation-store';
import { loadMockUserProfile, mockRoomUserIds } from '@/features/rooms/mock-room-store';
import { useTheme } from '@/hooks/use-theme';

type BlockedUser = { id: number; nickname: string | null; avatarUrl: string | null };

export default function BlockedUsersScreen() {
  const theme = useTheme();
  const { session } = useMockSession();
  const viewerId = session && !session.needProfile ? mockRoomUserIds[session.provider] : null;
  const [users, setUsers] = useState<BlockedUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<BlockedUser | null>(null);
  const [saving, setSaving] = useState(false);
  const requestId = useRef(0);
  const processing = useRef(false);

  const load = useCallback(async () => {
    if (!viewerId) return;
    const request = ++requestId.current;
    setError(null);
    try {
      const blocks = await getMockBlocks(viewerId);
      const result = await Promise.all(blocks.map(async ({ blockedId }) => {
        try { return await loadMockUserProfile(blockedId, viewerId); }
        catch { return { id: blockedId, nickname: null, avatarUrl: null }; }
      }));
      if (request === requestId.current) setUsers(result);
    } catch {
      if (request === requestId.current) setError('차단 목록을 불러오지 못했어요.');
    }
  }, [viewerId]);

  useFocusEffect(useCallback(() => {
    void load();
    return () => { requestId.current += 1; };
  }, [load]));

  async function unblock() {
    if (!selected || !viewerId || processing.current) return;
    processing.current = true;
    setSaving(true);
    try { await unblockMockUser(viewerId, selected.id); setSelected(null); await load(); }
    catch { setSelected(null); setError('차단을 해제하지 못했어요.'); }
    finally { processing.current = false; setSaving(false); }
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style="auto" />
      <FlatList data={users ?? []} keyExtractor={(user) => String(user.id)} style={styles.list} contentContainerStyle={styles.content}
        ListHeaderComponent={<View style={styles.heading}>
          <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/home')} style={styles.back}>
            <ThemedText type="smallBold" themeColor="textSecondary">‹ 뒤로</ThemedText>
          </Pressable>
          <ThemedText accessibilityRole="header" type="subtitle">차단한 사용자</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">차단 설정은 이 기기에 저장돼요.</ThemedText>
          {error && <ThemedText accessibilityRole="alert">{error}</ThemedText>}
        </View>}
        renderItem={({ item }) => <View style={[styles.row, { borderColor: theme.backgroundSelected }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${item.nickname ?? '사용자'} 프로필 보기`}
            onPress={() => router.push({ pathname: '/user-profile/[userId]', params: { userId: item.id } })} style={styles.identity}>
            <View style={styles.avatar}>{item.avatarUrl ? <Image source={item.avatarUrl} style={styles.photo} contentFit="cover" /> : <ThemedText style={styles.avatarText}>{(item.nickname ?? '?').slice(0, 1)}</ThemedText>}</View>
            <ThemedText style={styles.name}>{item.nickname ?? '알 수 없는 사용자'}</ThemedText>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setSelected(item)} style={[styles.button, { borderColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold">차단 해제</ThemedText>
          </Pressable>
        </View>}
        ListEmptyComponent={!error ? <ThemedText themeColor="textSecondary">{users === null ? '차단 목록을 불러오는 중이에요.' : '차단한 사용자가 없어요.'}</ThemedText> :
          <Pressable accessibilityRole="button" onPress={load} style={styles.back}><ThemedText type="smallBold">다시 시도</ThemedText></Pressable>}
      />
      <Modal visible={selected !== null} transparent animationType="fade" onRequestClose={() => { if (!saving) setSelected(null); }}>
        <View style={styles.overlay}><View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: theme.background }]}>
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
  content: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five },
  heading: { gap: Spacing.two, paddingBottom: Spacing.four },
  back: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  row: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth },
  identity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  name: { flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E6EDFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  avatarText: { color: '#2554DB', fontWeight: '700' },
  button: { minHeight: 44, paddingHorizontal: Spacing.two, borderWidth: 1, borderRadius: 10, justifyContent: 'center' },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.four, backgroundColor: 'rgba(0,0,0,0.45)' },
  dialog: { width: '100%', maxWidth: 360, padding: Spacing.four, gap: Spacing.three, borderRadius: 16 },
  dialogTitle: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: Spacing.two },
  dialogButton: { flex: 1, minHeight: 48, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
