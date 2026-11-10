import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useState, type PropsWithChildren } from 'react';

import type { CompleteProfileRequest } from '@/features/onboarding/profile';

export type SocialProvider = 'google' | 'kakao' | 'naver';

type Session =
  | { provider: SocialProvider; needProfile: true }
  | {
      provider: SocialProvider;
      needProfile: false;
      profile: CompleteProfileRequest;
      avatarUri: string | null;
    };

type StoredProfile = CompleteProfileRequest & { localAvatarUri?: string | null };
type MockProfiles = Partial<Record<SocialProvider, StoredProfile>>;

type MockSessionContextValue = {
  session: Session | null;
  signIn: (provider: SocialProvider) => Promise<void>;
  checkNickname: (nickname: string) => Promise<{ available: boolean }>;
  completeProfile: (profile: CompleteProfileRequest, avatarUri: string | null) => Promise<boolean>;
  updateProfile: (profile: CompleteProfileRequest, avatarUri: string | null) => Promise<boolean>;
  signOut: () => void;
};

const profilesKey = 'jikchin.mock-profiles.v1';
const MockSessionContext = createContext<MockSessionContextValue | null>(null);

async function readProfiles(): Promise<MockProfiles> {
  const stored = await AsyncStorage.getItem(profilesKey);
  return stored ? (JSON.parse(stored) as MockProfiles) : {};
}

function nicknameIsAvailable(profiles: MockProfiles, nickname: string) {
  return !Object.values(profiles).some(
    (profile) => profile.nickname.localeCompare(nickname, 'ko', { sensitivity: 'base' }) === 0,
  );
}

export function MockSessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);

  async function signIn(provider: SocialProvider) {
    if (!__DEV__) return;

    const profile = (await readProfiles())[provider];
    const nextSession: Session = profile
      ? { provider, needProfile: false, profile, avatarUri: profile.localAvatarUri ?? null }
      : { provider, needProfile: true };
    setSession((current) => current ?? nextSession);
  }

  async function checkNickname(nickname: string) {
    const profiles = await readProfiles();
    if (session && !session.needProfile) delete profiles[session.provider];
    return { available: nicknameIsAvailable(profiles, nickname) };
  }

  async function completeProfile(profile: CompleteProfileRequest, avatarUri: string | null) {
    if (!session?.needProfile) throw new Error('An onboarding session is required');

    const profiles = await readProfiles();
    if (!nicknameIsAvailable(profiles, profile.nickname)) return false;

    await AsyncStorage.setItem(profilesKey, JSON.stringify({ ...profiles, [session.provider]: { ...profile, localAvatarUri: avatarUri } }));
    setSession({ provider: session.provider, needProfile: false, profile, avatarUri });
    return true;
  }

  async function updateProfile(profile: CompleteProfileRequest, avatarUri: string | null) {
    if (!session || session.needProfile) throw new Error('A completed profile is required');
    const profiles = await readProfiles();
    const otherProfiles = { ...profiles };
    delete otherProfiles[session.provider];
    if (!nicknameIsAvailable(otherProfiles, profile.nickname)) return false;

    await AsyncStorage.setItem(profilesKey, JSON.stringify({ ...profiles, [session.provider]: { ...profile, localAvatarUri: avatarUri } }));
    setSession({ ...session, profile, avatarUri });
    return true;
  }

  return (
    <MockSessionContext.Provider
      value={{ session, signIn, checkNickname, completeProfile, updateProfile, signOut: () => setSession(null) }}>
      {children}
    </MockSessionContext.Provider>
  );
}

export function useMockSession() {
  const context = useContext(MockSessionContext);
  if (!context) throw new Error('MockSessionProvider is required');
  return context;
}
