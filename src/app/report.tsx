import { uuid } from 'expo';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon, PageHeader, ui } from '@/components/jikchin-ui';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useMockSession } from '@/features/auth/mock-session';
import { getPublicProfile, getReportOptions, submitReport, type ReportTarget } from '@/features/moderation/moderation-api';
import { getRoom } from '@/features/rooms/room-api';
import { useTheme } from '@/hooks/use-theme';

export default function ReportScreen() {
  const theme = useTheme();
  const { targetType: rawType, targetId: rawId } = useLocalSearchParams<{ targetType: string; targetId: string }>();
  const targetType: ReportTarget | null = rawType === 'USER' || rawType === 'ROOM' ? rawType : null;
  const targetId = Number(rawId);
  const { session } = useMockSession();
  const apiSession = session && !session.needProfile ? session.apiSession : null;
  const viewerId = session && !session.needProfile ? session.userId : null;
  const validTarget = !!targetType && !!apiSession && Number.isSafeInteger(targetId) && targetId > 0;
  const selfReport = targetType === 'USER' && targetId === viewerId;
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [form, setForm] = useState<{ name: string; options: Awaited<ReturnType<typeof getReportOptions>> } | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const saving = useRef(false);
  const pendingReport = useRef<{ reason: string; description: string; clientReportId: string } | null>(null);
  const options = form?.options;
  const title = targetType === 'ROOM' ? '방 신고' : '사용자 신고';
  const goBack = () => router.canGoBack() ? router.back() : router.replace('/home');

  useEffect(() => {
    let active = true;
    if (!targetType || !apiSession || !validTarget || selfReport) return;
    const targetName = targetType === 'USER'
      ? getPublicProfile(apiSession, targetId).then((profile) => profile.nickname ?? '알 수 없는 사용자')
      : getRoom(apiSession, targetId).then((room) => room.title);
    Promise.all([targetName, getReportOptions(apiSession, targetType)]).then(([name, options]) => {
      if (active) setForm({ name, options });
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : '신고 대상을 불러오지 못했어요.');
    });
    return () => { active = false; };
  }, [targetType, targetId, apiSession, validTarget, selfReport, loadAttempt]);

  async function submit() {
    if (!targetType || !apiSession || !options?.enabled || saving.current) return;
    if (!reason) { setError('신고 사유를 선택해 주세요.'); return; }
    const text = description.trim();
    if (options.descriptionRequired && !text) { setError('신고 내용을 입력해 주세요.'); return; }
    saving.current = true;
    setIsSaving(true);
    setError(null);
    try {
      const previous = pendingReport.current;
      const report = previous?.reason === reason && previous.description === text
        ? previous
        : { reason, description: text, clientReportId: uuid.v4() };
      pendingReport.current = report;
      await submitReport(apiSession, targetType, targetId, report);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '신고를 접수하지 못했어요.');
    } finally { saving.current = false; setIsSaving(false); }
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style="auto" />
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <PageHeader title={title} onBack={goBack} disabled={isSaving} />
          {saved ? (
            <View style={[ui.card, styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <AppIcon name="check" size={24} color={theme.success} />
              <ThemedText accessibilityRole="header" style={styles.sectionTitle}>신고가 접수됐어요.</ThemedText>
              <Pressable accessibilityRole="button" onPress={goBack} style={[ui.button, { backgroundColor: theme.accent }]}>
                <ThemedText style={[ui.buttonLabel, ui.white]}>확인</ThemedText>
              </Pressable>
            </View>
          ) : (
            <>
              {form && <ThemedText themeColor="textSecondary">신고 대상: {form.name}</ThemedText>}
              {!form && validTarget && !selfReport && !error && <ThemedText themeColor="textSecondary">신고 대상을 불러오는 중이에요.</ThemedText>}
              {options && !options.enabled && <ThemedText accessibilityRole="alert">신고 접수가 일시 중단됐어요.</ThemedText>}
              {options?.enabled && <>
                <View style={[ui.card, styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <ThemedText accessibilityRole="header" style={styles.sectionTitle}>신고 사유</ThemedText>
                  {options.reasons.map((item) => (
                    <Pressable key={item.code} accessibilityRole="radio" accessibilityState={{ checked: reason === item.code }}
                      disabled={isSaving} onPress={() => { setReason(item.code); setError(null); }}
                      style={[styles.option, { backgroundColor: theme.backgroundElement, borderColor: reason === item.code ? theme.accentText : theme.border }]}>
                      <ThemedText style={styles.reasonLabel}>{item.label}</ThemedText>
                      {reason === item.code && <AppIcon name="check" color={theme.accentText} size={18} />}
                    </Pressable>
                  ))}
                </View>
                <View style={[ui.card, styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <ThemedText type="smallBold">상세 내용 ({options.descriptionRequired ? '필수' : '선택'})</ThemedText>
                  <TextInput accessibilityLabel="신고 상세 내용" multiline editable={!isSaving} value={description} onChangeText={setDescription}
                    maxLength={options.descriptionMaxLength} placeholder="상황을 자세히 알려주세요" placeholderTextColor={theme.textSecondary}
                    style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]} />
                  <ThemedText type="small" themeColor="textSecondary">{description.length}/{options.descriptionMaxLength}자</ThemedText>
                </View>
              </>}
              {(error || !validTarget || selfReport) && <ThemedText accessibilityRole="alert" type="small" themeColor="danger">
                {error ?? (selfReport ? '본인은 신고할 수 없어요.' : '신고 대상을 찾을 수 없어요.')}
              </ThemedText>}
              {error && !form && validTarget && !selfReport && (
                <Pressable accessibilityRole="button" onPress={() => { setError(null); setLoadAttempt((attempt) => attempt + 1); }} style={styles.back}>
                  <ThemedText type="smallBold">다시 시도</ThemedText>
                </Pressable>
              )}
              {options?.enabled && <Pressable accessibilityRole="button" disabled={isSaving} onPress={submit}
                style={[ui.button, { backgroundColor: theme.accent }, isSaving && styles.disabled]}>
                <AppIcon name="flag" color={Brand.white} />
                <ThemedText style={[ui.buttonLabel, ui.white]}>{isSaving ? '접수 중' : '신고 접수'}</ThemedText>
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
  section: { gap: Spacing.two, padding: 14 },
  sectionTitle: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  option: { minHeight: 50, paddingHorizontal: Spacing.three, borderWidth: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  reasonLabel: { flex: 1 },
  input: { minHeight: 120, textAlignVertical: 'top', padding: Spacing.three, borderWidth: 1, borderRadius: 12, fontSize: 16 },
  disabled: { opacity: 0.5 },
});
