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

import { AppIcon, PageHeader, ui } from '@/components/jikchin-ui';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
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

function RoomInput({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  const theme = useTheme();

  return (
    <View style={styles.field}>
      <View style={styles.fieldHeading}>
        <ThemedText type="smallBold">{label}</ThemedText>
        {hint && <ThemedText type="small" themeColor="textSecondary">{hint}</ThemedText>}
      </View>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
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
  const capacityValue = /^\d{1,3}$/.test(capacity) ? Number(capacity) : NaN;

  function stepCapacity(delta: number) {
    setCapacity((current) => {
      const number = /^\d{1,3}$/.test(current) ? Number(current) : roomCapacity.min;
      return String(Math.max(roomCapacity.min, Math.min(roomCapacity.max, number + delta)));
    });
  }

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
        capacity: capacityValue,
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
          <PageHeader title="방 생성" onBack={() => router.dismissTo('/home')} disabled={isSaving} />
          <View style={styles.field}>
            <ThemedText accessibilityRole="header" type="subtitle" style={styles.title}>
              직관방 만들기
            </ThemedText>
            <ThemedText themeColor="textSecondary">함께 볼 경기와 모집 인원을 정해 주세요.</ThemedText>
          </View>

          <View style={[ui.card, styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <RoomInput
              label="방 제목"
              hint={`${title.length}/${roomTextMaxLength}자`}
              value={title}
              onChangeText={setTitle}
              maxLength={roomTextMaxLength}
              placeholder="예) 잠실에서 야구 같이 봐요"
            />
          </View>

          <View style={[ui.card, styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ThemedText accessibilityRole="header" style={styles.sectionTitle}>경기 정보</ThemedText>
            <View style={styles.field}>
              <ThemedText type="smallBold">종목 / 리그</ThemedText>
              <View style={[styles.leagues, { backgroundColor: theme.backgroundElement }]}>
                {leagues.map(({ code, label }) => {
                  const selected = league === code;
                  const color = selected ? Brand.white : theme.accentText;
                  return (
                    <Pressable key={code} accessibilityRole="radio" accessibilityState={{ checked: selected }}
                      onPress={() => changeLeague(code)} style={[styles.leagueButton, selected && { backgroundColor: theme.accent }]}>
                      <AppIcon name={code === 'KBO' ? 'baseball' : 'football'} size={18} color={color} />
                      <ThemedText type="smallBold" style={{ color }}>{label}</ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
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
          </View>

          <View style={[ui.card, styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.fieldHeading}>
              <ThemedText accessibilityRole="header" style={styles.sectionTitle}>모집 정원</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">방장 포함 {roomCapacity.min}~{roomCapacity.max}명</ThemedText>
            </View>
            <View style={[styles.stepper, { backgroundColor: theme.backgroundElement }]}>
              <Pressable accessibilityRole="button" accessibilityLabel="모집 정원 줄이기" onPress={() => stepCapacity(-1)}
                disabled={isSaving || capacityValue <= roomCapacity.min}
                style={[styles.stepButton, { backgroundColor: theme.surface }, capacityValue <= roomCapacity.min && styles.dimmed]}>
                <AppIcon name="remove" color={theme.accentText} />
              </Pressable>
              <TextInput accessibilityLabel="모집 정원" editable={!isSaving} value={capacity} onChangeText={setCapacity}
                inputMode="numeric" maxLength={3} style={[styles.stepInput, { color: theme.accentText }]} />
              <Pressable accessibilityRole="button" accessibilityLabel="모집 정원 늘리기" onPress={() => stepCapacity(1)}
                disabled={isSaving || capacityValue >= roomCapacity.max}
                style={[styles.stepButton, { backgroundColor: theme.surface }, capacityValue >= roomCapacity.max && styles.dimmed]}>
                <AppIcon name="add" color={theme.accentText} />
              </Pressable>
            </View>
          </View>

          <View style={styles.field}>
            {error && <ThemedText type="small" accessibilityRole="alert" themeColor="danger">{error}</ThemedText>}
            <Pressable
              accessibilityRole="button"
              onPress={submit}
              disabled={isSaving}
              style={({ pressed }) => [ui.button, { backgroundColor: theme.accent }, (pressed || isSaving) && styles.dimmed]}>
              <AppIcon name="stadium" color={Brand.white} />
              <ThemedText style={[ui.buttonLabel, ui.white]}>{isSaving ? '방 생성 중' : '직관방 개설하기'}</ThemedText>
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
  field: { gap: Spacing.two },
  fieldHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  title: { fontWeight: '800' },
  section: { gap: 14, padding: 15 },
  sectionTitle: { fontSize: 18, lineHeight: 24, fontWeight: '800' },
  input: {
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderRadius: 12,
    fontSize: 16,
  },
  leagues: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, padding: 4, borderRadius: 13 },
  leagueButton: {
    minHeight: 44,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: Spacing.two,
    borderRadius: 12,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', padding: 6, borderRadius: 13 },
  stepButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  stepInput: { flex: 1, minHeight: 44, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  dimmed: { opacity: 0.8 },
});
