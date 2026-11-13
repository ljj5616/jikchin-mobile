import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon, PageHeader, ui } from '@/components/jikchin-ui';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { AuthApiError } from '@/features/auth/auth-api';
import { useMockSession } from '@/features/auth/mock-session';
import { bioMaxLength, nicknameMaxLength, type League, type ProfilePhotoSelection } from '@/features/onboarding/profile';
import { ProfilePhoto } from '@/features/onboarding/profile-photo';
import { TeamField } from '@/features/onboarding/team-field';
import { useTheme } from '@/hooks/use-theme';

export default function ProfileSetupScreen() {
  const theme = useTheme();
  const { session, checkNickname, completeProfile, signOut } = useMockSession();
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [photo, setPhoto] = useState<ProfilePhotoSelection | null>(null);
  const [favoriteKboTeamId, setFavoriteKboTeamId] = useState<number | null>(null);
  const [favoriteKleagueTeamId, setFavoriteKleagueTeamId] = useState<number | null>(null);
  const [expandedLeague, setExpandedLeague] = useState<League | null>(null);
  const [nicknameFeedback, setNicknameFeedback] = useState<{ value: string; message: string; available?: boolean } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const trimmedNickname = nickname.trim();
  const feedback = nicknameFeedback?.value === trimmedNickname ? nicknameFeedback : null;
  const inputColors = { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement };

  async function confirmNickname() {
    if (!trimmedNickname) {
      setNicknameFeedback({ value: trimmedNickname, message: '닉네임을 입력해 주세요.' });
      return;
    }

    setIsChecking(true);
    try {
      const { available } = await checkNickname(trimmedNickname);
      setNicknameFeedback({
        value: trimmedNickname,
        available,
        message: available ? '사용할 수 있는 닉네임이에요.' : '이미 사용 중인 닉네임이에요.',
      });
    } catch (error) {
      const message = error instanceof AuthApiError ? error.message : '닉네임을 확인하지 못했어요. 다시 시도해 주세요.';
      setNicknameFeedback({ value: trimmedNickname, message });
    } finally {
      setIsChecking(false);
    }
  }

  async function submitProfile() {
    if (isSaving) return;
    if (!trimmedNickname) {
      setSaveError('닉네임을 입력해 주세요.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      const profile = {
        nickname: trimmedNickname,
        avatarKey: null,
        bio: bio.trim() || null,
        favoriteKboTeamId,
        favoriteKleagueTeamId,
      };
      const saved = await completeProfile(profile, photo);
      if (!saved) setSaveError('이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해 주세요.');
    } catch (error) {
      setSaveError(error instanceof AuthApiError ? error.message : '프로필을 저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style="auto" />
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <PageHeader title="프로필 설정" onBack={signOut} disabled={isSaving} />
          <View style={styles.intro}>
            <ThemedText accessibilityRole="header" type="subtitle" style={styles.title}>프로필 완성</ThemedText>
            <ThemedText themeColor="textSecondary">직친에서 사용할 닉네임을 정해 주세요.</ThemedText>
          </View>

          <View style={[ui.card, styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.field}>
              <View style={styles.fieldHeading}>
                <ThemedText type="smallBold">닉네임 (필수)</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{nickname.length}/{nicknameMaxLength}자</ThemedText>
              </View>
              <View style={styles.nicknameRow}>
                <TextInput
                  accessibilityLabel="닉네임"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={nicknameMaxLength}
                  value={nickname}
                  onChangeText={(value) => {
                    setNickname(value);
                    setSaveError(null);
                  }}
                  placeholder="닉네임을 입력해 주세요"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, styles.nicknameInput, inputColors, feedback && { borderColor: feedback.available ? theme.success : theme.danger }]}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={isChecking || isSaving}
                  onPress={confirmNickname}
                  style={[styles.secondaryButton, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="smallBold" themeColor="accentText">{isChecking ? '확인 중' : '중복 확인'}</ThemedText>
                </Pressable>
              </View>
              {feedback && (
                <View style={[styles.feedback, { backgroundColor: feedback.available ? theme.successSurface : theme.dangerSurface }]}>
                  <ThemedText type="small" themeColor={feedback.available ? 'success' : 'danger'} accessibilityLiveRegion="polite">
                    {feedback.message}
                  </ThemedText>
                </View>
              )}
            </View>

            <ProfilePhoto uri={photo?.uri ?? null} onChange={setPhoto} disabled={isSaving} />

            <View style={styles.field}>
              <ThemedText type="smallBold">한 줄 소개 (선택)</ThemedText>
              <TextInput
                accessibilityLabel="한 줄 소개"
                multiline
                maxLength={bioMaxLength}
                value={bio}
                onChangeText={setBio}
                placeholder="예) 주말 경기 직관을 좋아해요."
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, styles.bioInput, inputColors]}
              />
              <ThemedText type="small" themeColor="textSecondary">{bio.length}/{bioMaxLength}자</ThemedText>
            </View>
          </View>

          <View style={[ui.card, styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.field}>
              <ThemedText accessibilityRole="header" style={styles.sectionTitle}>응원팀</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">리그마다 한 팀씩 선택할 수 있어요.</ThemedText>
            </View>
            <TeamField
              league="KBO"
              teams={session?.teams.KBO}
              label="KBO 응원팀"
              value={favoriteKboTeamId}
              expanded={expandedLeague === 'KBO'}
              onToggle={() => setExpandedLeague(expandedLeague === 'KBO' ? null : 'KBO')}
              onSelect={(teamId) => {
                setFavoriteKboTeamId(teamId);
                setExpandedLeague(null);
              }}
            />
            <TeamField
              league="KLEAGUE"
              teams={session?.teams.KLEAGUE}
              label="K리그1 응원팀"
              value={favoriteKleagueTeamId}
              expanded={expandedLeague === 'KLEAGUE'}
              onToggle={() => setExpandedLeague(expandedLeague === 'KLEAGUE' ? null : 'KLEAGUE')}
              onSelect={(teamId) => {
                setFavoriteKleagueTeamId(teamId);
                setExpandedLeague(null);
              }}
            />
          </View>

          <View style={styles.field}>
            {saveError && <ThemedText type="small" accessibilityRole="alert" themeColor="danger">{saveError}</ThemedText>}
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={submitProfile}
              style={({ pressed }) => [ui.button, { backgroundColor: theme.accent }, (pressed || isSaving) && styles.dimmed]}>
              <ThemedText style={[ui.buttonLabel, ui.white]}>{isSaving ? '저장 중' : '프로필 완성하기'}</ThemedText>
              {!isSaving && <AppIcon name="arrow" color="#FFFFFF" />}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 480,
    paddingHorizontal: 18,
    paddingBottom: Spacing.five,
    gap: 16,
  },
  intro: { gap: Spacing.two },
  title: { fontWeight: '800' },
  section: { gap: 16, padding: 15 },
  field: { gap: Spacing.two },
  fieldHeading: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 4 },
  feedback: { borderRadius: 10, paddingVertical: 7, paddingHorizontal: 10 },
  nicknameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  nicknameInput: { flex: 1, minWidth: 0 },
  input: {
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderRadius: 12,
    fontSize: 16,
  },
  bioInput: { minHeight: 80, textAlignVertical: 'top' },
  secondaryButton: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 12,
  },
  sectionTitle: { fontWeight: '700', fontSize: 20, lineHeight: 26 },
  dimmed: { opacity: 0.8 },
});
