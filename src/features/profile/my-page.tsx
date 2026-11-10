import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useMockSession } from '@/features/auth/mock-session';
import { onboardingTeams, type League } from '@/features/onboarding/profile';
import { useTheme } from '@/hooks/use-theme';

export function MyPage() {
  const theme = useTheme();
  const { session, signOut } = useMockSession();
  if (!session || session.needProfile) return null;

  const { profile, avatarUri } = session;
  const teamName = (league: League, id: number | null) =>
    onboardingTeams[league].find((team) => team.id === id)?.name ?? '선택한 팀이 없어요';

  return (
    <ScrollView style={[styles.screen, { backgroundColor: theme.backgroundElement }]} contentContainerStyle={styles.content}>
      <ThemedText type="smallBold">직관친구</ThemedText>
      <View style={styles.heading}>
        <ThemedText accessibilityRole="header" type="subtitle" style={styles.title}>마이페이지</ThemedText>
        <ThemedText themeColor="textSecondary">나의 프로필과 응원팀을 확인해 보세요.</ThemedText>
      </View>
      <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            {avatarUri ? <Image source={avatarUri} style={styles.photo} contentFit="cover" /> : (
              <ThemedText style={styles.avatarInitial}>{profile.nickname.slice(0, 1)}</ThemedText>
            )}
          </View>
          <View style={styles.profileText}>
            <ThemedText accessibilityRole="header" style={styles.nickname}>{profile.nickname}</ThemedText>
            <ThemedText themeColor="textSecondary">{profile.bio || '아직 소개가 없어요.'}</ThemedText>
          </View>
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/edit-profile')} style={[styles.editButton, { borderColor: theme.backgroundSelected }]}>
          <ThemedText type="smallBold">프로필 수정</ThemedText>
        </Pressable>
      </View>
      <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
        <ThemedText accessibilityRole="header" style={styles.cardTitle}>나의 응원팀</ThemedText>
        {([
          ['KBO', 'KBO', profile.favoriteKboTeamId],
          ['K리그1', 'KLEAGUE', profile.favoriteKleagueTeamId],
        ] as const).map(([label, league, id]) => (
          <View key={league} style={[styles.teamRow, { borderColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold" themeColor="textSecondary">{label}</ThemedText>
            <ThemedText style={styles.teamName}>{teamName(league, id)}</ThemedText>
          </View>
        ))}
      </View>
      <Pressable accessibilityRole="button" onPress={signOut} style={styles.signOut}>
        <ThemedText type="smallBold" themeColor="textSecondary">로그아웃</ThemedText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { alignSelf: 'center', width: '100%', maxWidth: 520, padding: Spacing.four, gap: Spacing.four },
  heading: { gap: Spacing.one },
  title: { fontWeight: '700' },
  card: { padding: Spacing.four, gap: Spacing.four, borderWidth: 1, borderRadius: 16 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  profileText: { flex: 1, gap: Spacing.one },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#E6EDFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarInitial: { color: '#2554DB', fontSize: 26, fontWeight: '700' },
  photo: { width: '100%', height: '100%' },
  nickname: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  cardTitle: { fontSize: 18, lineHeight: 25, fontWeight: '700' },
  editButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 10 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingTop: Spacing.three, borderTopWidth: StyleSheet.hairlineWidth },
  teamName: { flex: 1, textAlign: 'right' },
  signOut: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.two },
});
