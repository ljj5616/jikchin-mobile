import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';

import { MockSessionProvider, useMockSession } from '@/features/auth/mock-session';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

function AppStack() {
  const { session } = useMockSession();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={session === null}>
        <Stack.Screen name="index" />
        <Stack.Screen name="explore" options={{ headerShown: true }} />
      </Stack.Protected>
      <Stack.Protected guard={session?.needProfile === true}>
        <Stack.Screen name="profile-setup" />
      </Stack.Protected>
      <Stack.Protected guard={session?.needProfile === false}>
        <Stack.Screen name="home" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="create-room" />
        <Stack.Screen name="room-detail/[roomId]" />
        <Stack.Screen name="user-profile/[userId]" />
        <Stack.Screen name="blocked-users" />
        <Stack.Screen name="report" />
        <Stack.Screen name="room-chat/[roomId]" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const colors = useTheme();
  const navigationTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider value={{
      ...navigationTheme,
      colors: {
        ...navigationTheme.colors,
        background: colors.background,
        card: colors.surface,
        border: colors.border,
        primary: colors.accentText,
        text: colors.text,
      },
    }}>
      <MockSessionProvider>
        <AppStack />
      </MockSessionProvider>
    </ThemeProvider>
  );
}
