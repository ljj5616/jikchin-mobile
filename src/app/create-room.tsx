import { router } from 'expo-router';
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
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useMockSession } from '@/features/auth/mock-session';
import type { League } from '@/features/onboarding/profile';
import { TeamField } from '@/features/onboarding/team-field';
import { roomCapacity, roomTextMaxLength, validateRoomRequest } from '@/features/rooms/create-room';
import { createRoom } from '@/features/rooms/room-api';
import { gameDateKey } from '@/features/rooms/room-list';
import { useTheme } from '@/hooks/use-theme';

const leagues = [
  { code: 'KBO', label: 'KBO' },
  { code: 'KLEAGUE', label: 'K리그1' },
] as const;

function RoomInput({ label, ...props }: TextInputProps & { label: string }) {
  const theme = useTheme();

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
      />
    </View>
  );
}

export default function CreateRoomScreen() {
  const theme = useTheme();
  const { session } = useMockSession();
  const [title, setTitle] = useState('');
  const [gameDate, setGameDate] = useState(() => gameDateKey(new Date()));
  const [stadium, setStadium] = useState('');
  const [capacity, setCapacity] = useState('4');
  const [league, setLeague] = useState<League>('KBO');
  const [homeTeamId, setHomeTeamId] = useState<number | null>(null);
  const [awayTeamId, setAwayTeamId] = useState<number | null>(null);
  const [expandedTeam, setExpandedTeam] = useState<'home' | 'away' | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);

  function changeLeague(code: League) {
    if (league === code) return;
    setLeague(code);
    setHomeTeamId(null);
    setAwayTeamId(null);
    setExpandedTeam(null);
  }

  async function submit() {
    if (!session || session.needProfile || saving.current) return;
    saving.current = true;
    setIsSaving(true);
    setError(null);

    try {
      const { request } = validateRoomRequest({
        title,
        gameDate: gameDate.trim(),
        stadium,
        homeTeamId: homeTeamId ?? 0,
        awayTeamId: awayTeamId ?? 0,
        capacity: /^\d{1,3}$/.test(capacity) ? Number(capacity) : NaN,
      }, new Date(), session.teams);
      const room = await createRoom(session.apiSession, request);
      router.replace({ pathname: '/room-chat/[roomId]', params: { roomId: room.id } });
    } catch (error) {
      setError(error instanceof Error ? error.message : '방을 만들지 못했어요. 다시 시도해 주세요.');
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style="auto" />
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={styles.field}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.dismissTo('/home')}
              disabled={isSaving}
              style={styles.back}>
              <ThemedText type="smallBold" themeColor="textSecondary">방 목록</ThemedText>
            </Pressable>
            <ThemedText accessibilityRole="header" type="subtitle" style={styles.title}>
              방 생성
            </ThemedText>
            <ThemedText themeColor="textSecondary">함께 볼 경기와 모집 인원을 정해 주세요.</ThemedText>
          </View>

          <RoomInput
            label="방 제목"
            value={title}
            onChangeText={setTitle}
            maxLength={roomTextMaxLength}
            placeholder="예) 잠실에서 야구 같이 봐요"
          />
          <View style={styles.field}>
            <RoomInput
              label="경기 날짜"
              value={gameDate}
              onChangeText={setGameDate}
              maxLength={10}
              autoCorrect={false}
              placeholder="YYYY-MM-DD"
            />
            <ThemedText type="small" themeColor="textSecondary">YYYY-MM-DD · 오늘 또는 이후</ThemedText>
          </View>
          <RoomInput
            label="경기장"
            value={stadium}
            onChangeText={setStadium}
            maxLength={roomTextMaxLength}
            placeholder="예) 잠실야구장"
          />

          <View style={styles.field}>
            <ThemedText type="smallBold">리그</ThemedText>
            <View style={styles.leagues}>
              {leagues.map(({ code, label }) => (
                <Pressable
                  key={code}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: league === code }}
                  onPress={() => changeLeague(code)}
                  style={[styles.leagueButton, {
                    backgroundColor: league === code ? theme.backgroundSelected : theme.backgroundElement,
                  }]}>
                  <ThemedText type="smallBold">{label}</ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
          <TeamField
            league={league}
            teams={session?.teams[league] ?? []}
            label="홈 팀"
            required
            value={homeTeamId}
            expanded={expandedTeam === 'home'}
            onToggle={() => setExpandedTeam(expandedTeam === 'home' ? null : 'home')}
            onSelect={(teamId) => {
              setHomeTeamId(teamId);
              setExpandedTeam(null);
            }}
          />
          <TeamField
            league={league}
            teams={session?.teams[league] ?? []}
            label="원정 팀"
            required
            value={awayTeamId}
            expanded={expandedTeam === 'away'}
            onToggle={() => setExpandedTeam(expandedTeam === 'away' ? null : 'away')}
            onSelect={(teamId) => {
              setAwayTeamId(teamId);
              setExpandedTeam(null);
            }}
          />

          <View style={styles.field}>
            <RoomInput
              label="모집 정원"
              value={capacity}
              onChangeText={setCapacity}
              inputMode="numeric"
              placeholder={`${roomCapacity.min}~${roomCapacity.max}`}
            />
            <ThemedText type="small" themeColor="textSecondary">
              방장 포함 {roomCapacity.min}~{roomCapacity.max}명
            </ThemedText>
          </View>

          <View style={styles.field}>
            {error && <ThemedText type="small" accessibilityRole="alert">{error}</ThemedText>}
            <Pressable
              accessibilityRole="button"
              onPress={submit}
              disabled={isSaving}
              style={({ pressed }) => [styles.submit, (pressed || isSaving) && styles.dimmed]}>
              <ThemedText style={styles.submitLabel}>{isSaving ? '방 생성 중' : '방 생성 완료'}</ThemedText>
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
  field: { gap: Spacing.two },
  back: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  title: { fontWeight: '700' },
  input: {
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderRadius: 12,
    fontSize: 16,
  },
  leagues: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  leagueButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 12,
  },
  submit: {
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.two,
    borderRadius: 12,
    backgroundColor: '#2554DB',
  },
  submitLabel: { color: '#FFFFFF', fontWeight: '700' },
  dimmed: { opacity: 0.8 },
});
