import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useMockSession, type SocialProvider } from '@/features/auth/mock-session';
import { getSocialToken } from '@/features/auth/social-sign-in';
import { useTheme } from '@/hooks/use-theme';

const loginOptions = [
  {
    provider: 'google',
    label: 'Google로 계속하기',
    backgroundColor: '#FFFFFF',
    borderColor: '#747775',
    textColor: '#1F1F1F',
  },
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
    backgroundColor: '#03A94D',
    borderColor: '#03A94D',
    textColor: '#FFFFFF',
  },
] as const;

export default function LoginScreen() {
  const { background } = useTheme();
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
    <SafeAreaView style={[styles.screen, { backgroundColor: background }]}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <View style={styles.mark}>
            <View style={styles.pitch}>
              <View style={styles.halfwayLine} />
              <View style={styles.centerCircle} />
            </View>
          </View>
          <ThemedText accessibilityRole="header" type="title" style={styles.centeredText}>
            직관친구
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.centeredText}>
            경기장에서 함께 응원할 친구를 만나요.
          </ThemedText>
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
              themeColor="textSecondary"
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
    gap: Spacing.five,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
  },
  intro: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.four,
  },
  mark: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: '#2554DB',
  },
  pitch: {
    width: 42,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: 5,
    borderColor: '#FFFFFF',
  },
  halfwayLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: '#FFFFFF',
  },
  centerCircle: {
    width: 12,
    height: 12,
    borderWidth: 1.5,
    borderRadius: 6,
    borderColor: '#FFFFFF',
  },
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
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  pressed: { opacity: 0.8 },
});
