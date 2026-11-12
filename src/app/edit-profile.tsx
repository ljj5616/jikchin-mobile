import { router, useNavigation } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
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

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { AuthApiError, uploadAccountAvatar } from '@/features/auth/auth-api';
import { useMockSession } from '@/features/auth/mock-session';
import { bioMaxLength, nicknameMaxLength, type League, type ProfilePhotoSelection } from '@/features/onboarding/profile';
import { ProfilePhoto } from '@/features/onboarding/profile-photo';
import { TeamField } from '@/features/onboarding/team-field';
import { useTheme } from '@/hooks/use-theme';

export default function EditProfileScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { session, checkNickname, updateProfile } = useMockSession();
  const current = session && !session.needProfile ? session : null;
  const [nickname, setNickname] = useState(current?.profile.nickname ?? '');
  const [bio, setBio] = useState(current?.profile.bio ?? '');
  const [photo, setPhoto] = useState<ProfilePhotoSelection | null>();
  const [favoriteKboTeamId, setFavoriteKboTeamId] = useState<number | null>(current?.profile.favoriteKboTeam?.id ?? null);
  const [favoriteKleagueTeamId, setFavoriteKleagueTeamId] = useState<number | null>(current?.profile.favoriteKleagueTeam?.id ?? null);
  const [expandedLeague, setExpandedLeague] = useState<League | null>(null);
  const [nicknameFeedback, setNicknameFeedback] = useState<{ value: string; message: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saving = useRef(false);
  const uploadedAvatar = useRef<{ photo: ProfilePhotoSelection; key: string } | null>(null);

  const trimmedNickname = nickname.trim();
  const inputColors = { color: theme.text, borderColor: theme.backgroundSelected };
  const avatarUri = photo === undefined ? current?.profile.avatarUrl ?? null : photo?.uri ?? null;

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/home');
  }

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
    if (!current || saving.current) return;
    if (!trimmedNickname) {
      setSaveError('닉네임을 입력해 주세요.');
      return;
    }

    saving.current = true;
    setIsSaving(true);
    setSaveError(null);
    try {
      let avatarKey = photo === null ? null : current.profile.avatarKey;
      if (photo) {
        if (uploadedAvatar.current?.photo !== photo) {
          const upload = await uploadAccountAvatar(current.apiSession, photo);
          uploadedAvatar.current = { photo, key: upload.avatarKey };
        }
        avatarKey = uploadedAvatar.current.key;
      }
      await updateProfile({
        nickname: trimmedNickname,
        avatarKey,
        bio: bio.trim() || null,
        favoriteKboTeamId,
        favoriteKleagueTeamId,
      });
      if (navigation.isFocused()) goBack();
    } catch (error) {
      setSaveError(error instanceof AuthApiError ? error.message : '프로필을 저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  }

  if (!current) return null;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style="auto" />
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={styles.intro}>
            <Pressable accessibilityRole="button" disabled={isSaving} onPress={goBack} style={styles.back}>
              <ThemedText type="smallBold" themeColor="textSecondary">마이페이지로 돌아가기</ThemedText>
            </Pressable>
            <ThemedText accessibilityRole="header" type="subtitle" style={styles.title}>프로필 수정</ThemedText>
            <ThemedText themeColor="textSecondary">나를 소개하고 응원팀을 선택해 주세요.</ThemedText>
          </View>

          <View style={styles.section}>
            <View style={styles.field}>
              <ThemedText type="smallBold">닉네임 (필수)</ThemedText>
              <View style={styles.nicknameRow}>
                <TextInput
                  accessibilityLabel="닉네임"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isSaving}
                  maxLength={nicknameMaxLength}
                  value={nickname}
                  onChangeText={(value) => {
                    setNickname(value);
                    setSaveError(null);
                  }}
                  placeholder="닉네임을 입력해 주세요"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, styles.nicknameInput, inputColors]}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={isChecking || isSaving}
                  onPress={confirmNickname}
                  style={[styles.secondaryButton, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="smallBold">{isChecking ? '확인 중' : '중복 확인'}</ThemedText>
                </Pressable>
              </View>
              <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
                {nicknameFeedback?.value === trimmedNickname
                  ? nicknameFeedback.message
                  : `${nickname.length}/${nicknameMaxLength}자`}
              </ThemedText>
            </View>

            <ProfilePhoto uri={avatarUri} onChange={setPhoto} disabled={isSaving} />

            <View style={styles.field}>
              <ThemedText type="smallBold">한 줄 소개 (선택)</ThemedText>
              <TextInput
                accessibilityLabel="한 줄 소개"
                multiline
                editable={!isSaving}
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

          <View style={[styles.section, styles.teamSection, { borderColor: theme.backgroundSelected }]}>
            <View style={styles.field}>
              <ThemedText accessibilityRole="header" style={styles.sectionTitle}>응원팀</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">리그마다 한 팀씩 선택할 수 있어요.</ThemedText>
            </View>
            <TeamField
              league="KBO"
              teams={current.teams.KBO}
              disabled={isSaving}
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
              teams={current.teams.KLEAGUE}
              disabled={isSaving}
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
            {saveError && <ThemedText type="small" accessibilityRole="alert">{saveError}</ThemedText>}
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={submitProfile}
              style={({ pressed }) => [styles.primaryButton, (pressed || isSaving) && styles.dimmed]}>
              <ThemedText style={styles.primaryLabel}>{isSaving ? '저장 중' : '저장하기'}</ThemedText>
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
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.four,
  },
  intro: { gap: Spacing.two },
  back: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  title: { fontWeight: '700' },
  section: { gap: Spacing.four },
  field: { gap: Spacing.two },
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
  teamSection: { paddingTop: Spacing.four, borderTopWidth: StyleSheet.hairlineWidth },
  sectionTitle: { fontWeight: '700', fontSize: 20, lineHeight: 26 },
  primaryButton: {
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.two,
    borderRadius: 12,
    backgroundColor: '#2554DB',
  },
  primaryLabel: { color: '#FFFFFF', fontWeight: '700' },
  dimmed: { opacity: 0.8 },
});
