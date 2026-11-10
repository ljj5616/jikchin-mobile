import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useMockSession } from '@/features/auth/mock-session';
import { getMockReportOptions, submitMockReport, type ReportTarget } from '@/features/moderation/mock-moderation-store';
import { loadMockRoomDetail, loadMockUserProfile, mockRoomUserIds } from '@/features/rooms/mock-room-store';
import { useTheme } from '@/hooks/use-theme';

export default function ReportScreen() {
  const theme = useTheme();
  const { targetType: rawType, targetId: rawId } = useLocalSearchParams<{ targetType: string; targetId: string }>();
  const targetType: ReportTarget | null = rawType === 'USER' || rawType === 'ROOM' ? rawType : null;
  const targetId = Number(rawId);
  const { session } = useMockSession();
  const viewerId = session && !session.needProfile ? mockRoomUserIds[session.provider] : null;
  const validTarget = !!targetType && !!viewerId && Number.isSafeInteger(targetId) && targetId > 0;
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [targetName, setTargetName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const saving = useRef(false);
  const options = targetType ? getMockReportOptions(targetType) : null;

  useEffect(() => {
    let active = true;
    if (!targetType || !viewerId || !validTarget) return;
    const load = targetType === 'USER'
      ? loadMockUserProfile(targetId, viewerId).then((profile) => {
        if (targetId === viewerId) throw new Error('본인은 신고할 수 없어요.');
        return profile.nickname ?? '알 수 없는 사용자';
      })
      : loadMockRoomDetail(targetId, viewerId).then((detail) => {
        if (detail.creatorId === viewerId) throw new Error('내가 만든 방은 신고할 수 없어요.');
        return detail.room.title;
      });
    load.then((name) => { if (active) setTargetName(name); }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : '신고 대상을 불러오지 못했어요.');
    });
    return () => { active = false; };
  }, [targetType, targetId, viewerId, validTarget]);

  async function submit() {
    if (!targetType || !viewerId || !targetName || saving.current) return;
    if (!reason) { setError('신고 사유를 선택해 주세요.'); return; }
    if (targetType === 'USER' && !description.trim()) { setError('신고 내용을 입력해 주세요.'); return; }
    saving.current = true;
    setIsSaving(true);
    setError(null);
    try {
      await submitMockReport(viewerId, targetType, targetId, reason, description);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '신고 내용을 저장하지 못했어요.');
    } finally { saving.current = false; setIsSaving(false); }
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style="auto" />
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/home')} disabled={isSaving} style={styles.back}>
            <ThemedText type="smallBold" themeColor="textSecondary">‹ 뒤로</ThemedText>
          </Pressable>
          <ThemedText accessibilityRole="header" type="subtitle">{targetType === 'ROOM' ? '방 신고' : '사용자 신고'}</ThemedText>
          <View style={[styles.notice, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">개발용 신고 화면</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">신고 내용은 이 기기에만 저장되며 실제 서버에 접수되지 않아요.</ThemedText>
          </View>
          {saved ? (
            <View style={styles.section}>
              <ThemedText accessibilityRole="header" style={styles.sectionTitle}>신고 내용을 저장했어요.</ThemedText>
              <ThemedText themeColor="textSecondary">실제 신고 접수는 서버 연결 후 사용할 수 있어요.</ThemedText>
              <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/home')} style={styles.primary}>
                <ThemedText style={styles.primaryText}>확인</ThemedText>
              </Pressable>
            </View>
          ) : (
            <>
              {targetName && <ThemedText themeColor="textSecondary">신고 대상: {targetName}</ThemedText>}
              {!targetName && validTarget && !error && <ThemedText themeColor="textSecondary">신고 대상을 불러오는 중이에요.</ThemedText>}
              {targetName && options && <>
                <View style={styles.section}>
                  <ThemedText accessibilityRole="header" style={styles.sectionTitle}>신고 사유</ThemedText>
                  {options.reasons.map((item) => (
                    <Pressable key={item.code} accessibilityRole="radio" accessibilityState={{ checked: reason === item.code }}
                      onPress={() => { setReason(item.code); setError(null); }} style={[styles.option, { borderColor: reason === item.code ? '#2554DB' : theme.backgroundSelected }]}>
                      <ThemedText style={styles.reasonLabel}>{item.label}</ThemedText>
                      <ThemedText type="smallBold" style={{ color: reason === item.code ? '#2554DB' : theme.textSecondary }}>{reason === item.code ? '선택됨' : '선택'}</ThemedText>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.section}>
                  <ThemedText type="smallBold">상세 내용 ({options.descriptionRequired ? '필수' : '선택'})</ThemedText>
                  <TextInput accessibilityLabel="신고 상세 내용" multiline value={description} onChangeText={setDescription}
                    maxLength={options.descriptionMaxLength} placeholder="상황을 자세히 알려주세요" placeholderTextColor={theme.textSecondary}
                    style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]} />
                  <ThemedText type="small" themeColor="textSecondary">{description.length}/{options.descriptionMaxLength}자</ThemedText>
                </View>
              </>}
              {(error || !validTarget) && <ThemedText accessibilityRole="alert" type="small">{error ?? '신고 대상을 찾을 수 없어요.'}</ThemedText>}
              {targetName && <Pressable accessibilityRole="button" disabled={isSaving} onPress={submit} style={[styles.primary, isSaving && styles.disabled]}>
                <ThemedText style={styles.primaryText}>{isSaving ? '저장 중' : '신고 내용 저장'}</ThemedText>
              </Pressable>}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: Spacing.four, paddingBottom: Spacing.five, gap: Spacing.four },
  back: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  notice: { padding: Spacing.three, borderRadius: 12, gap: Spacing.one },
  section: { gap: Spacing.two },
  sectionTitle: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  option: { minHeight: 50, paddingHorizontal: Spacing.three, borderWidth: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  reasonLabel: { flex: 1 },
  input: { minHeight: 120, textAlignVertical: 'top', padding: Spacing.three, borderWidth: 1, borderRadius: 12, fontSize: 16 },
  primary: { minHeight: 52, borderRadius: 12, backgroundColor: '#2554DB', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
