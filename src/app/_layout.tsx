import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';

import { MockSessionProvider, useMockSession } from '@/features/auth/mock-session';
import { useColorScheme } from '@/hooks/use-color-scheme';

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
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <MockSessionProvider>
        <AppStack />
      </MockSessionProvider>
    </ThemeProvider>
  );
}
