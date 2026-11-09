import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useMockSession } from '@/features/auth/mock-session';
import { useTheme } from '@/hooks/use-theme';

export default function HomeScreen() {
  const theme = useTheme();
  const { session, signOut } = useMockSession();
  if (!session || session.needProfile) return null;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style="auto" />
      <View style={styles.content}>
        <ThemedText accessibilityRole="header" type="subtitle">임시 홈</ThemedText>
        {session.avatarUri && <Image source={session.avatarUri} style={styles.photo} contentFit="cover" />}
        <ThemedText>{session.profile.nickname}님, 환영해요!</ThemedText>
        <Pressable
          accessibilityRole="button"
          onPress={signOut}
          style={[styles.button, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">로그아웃</ThemedText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  photo: { width: 72, height: 72, borderRadius: 36 },
  button: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 12,
  },
});
