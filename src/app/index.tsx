import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon, BrandMark, ui } from '@/components/jikchin-ui';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useMockSession, type SocialProvider } from '@/features/auth/mock-session';
import { getSocialToken } from '@/features/auth/social-sign-in';
import { useTheme } from '@/hooks/use-theme';

const loginOptions = [
  {
    provider: 'kakao',
    label: '카카오 로그인',
    backgroundColor: '#FEE500',
    borderColor: '#FEE500',
    textColor: '#191919',
  },
  {
    provider: 'naver',
    label: '네이버 로그인',
    backgroundColor: '#00843D',
    borderColor: '#00843D',
    textColor: '#FFFFFF',
  },
  {
    provider: 'google',
    label: 'Google로 계속하기',
    backgroundColor: '#FFFFFF',
    borderColor: '#DCE2EE',
    textColor: '#1F1F1F',
  },
] as const;

export default function LoginScreen() {
  const theme = useTheme();
  const { signIn } = useMockSession();
  const inProgress = useRef(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startSignIn(provider: SocialProvider) {
    if (inProgress.current) return;

    inProgress.current = true;
    setIsSigningIn(true);
    setError(null);
    try {
      const token = await getSocialToken(provider);
      if (token) await signIn(provider, token);
    } catch (error) {
      setError(error instanceof Error ? error.message : '로그인하지 못했어요. 다시 시도해 주세요.');
    } finally {
      inProgress.current = false;
      setIsSigningIn(false);
    }
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <BrandMark size={80} />
          <ThemedText accessibilityRole="header" type="title" style={styles.centeredText}>
            직친
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.centeredText}>
            경기장에서 함께 응원할{'\n'}직관 친구를 만나보세요.
          </ThemedText>
        </View>

        <View style={[ui.card, styles.leagues, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <View style={styles.league}>
            <AppIcon name="baseball" color={theme.accentText} size={23} />
            <ThemedText type="smallBold" themeColor="accentText">KBO 야구</ThemedText>
          </View>
          <View style={[styles.leagueDivider, { backgroundColor: theme.border }]} />
          <View style={styles.league}>
            <AppIcon name="football" color={theme.success} size={23} />
            <ThemedText type="smallBold" themeColor="success">K리그 축구</ThemedText>
          </View>
        </View>

        <View style={styles.signIn}>
          <ThemedText accessibilityRole="header" type="smallBold" style={styles.centeredText}>
            소셜 계정으로 시작하기
          </ThemedText>
          <View style={styles.buttons}>
            {loginOptions.map(({ provider, label, backgroundColor, borderColor, textColor }) => (
              <Pressable
                key={provider}
                accessibilityRole="button"
                accessibilityState={{ disabled: isSigningIn, busy: isSigningIn }}
                disabled={isSigningIn}
                onPress={() => startSignIn(provider)}
                style={({ pressed }) => [
                  styles.button,
                  { backgroundColor, borderColor },
                  pressed && styles.pressed,
                ]}>
                <ThemedText style={[styles.buttonLabel, { color: textColor }]}>{label}</ThemedText>
              </Pressable>
            ))}
          </View>
          {(error || isSigningIn) && (
            <ThemedText
              accessibilityRole={error ? 'alert' : undefined}
              accessibilityLiveRegion="polite"
              selectable={error !== null}
              themeColor={error ? 'danger' : 'textSecondary'}
              type="small"
              style={styles.centeredText}>
              {error ?? '로그인 중이에요.'}
            </ThemedText>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 480,
    justifyContent: 'center',
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
  },
  intro: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  leagues: { minHeight: 72, padding: 14, flexDirection: 'row', gap: 10 },
  league: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  leagueDivider: { width: StyleSheet.hairlineWidth },
  centeredText: {
    textAlign: 'center',
  },
  signIn: {
    gap: Spacing.three,
  },
  buttons: {
    gap: Spacing.two,
  },
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderRadius: 12,
  },
  buttonLabel: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '700',
    textAlign: 'center',
  },
  pressed: { opacity: 0.8 },
});
