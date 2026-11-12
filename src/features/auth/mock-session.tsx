import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useState, type PropsWithChildren } from 'react';

import type { CompleteProfileRequest, League, Team } from '@/features/onboarding/profile';

import {
  AuthApiError,
  checkAccountNickname,
  completeAccountProfile,
  getAccountProfile,
  getAccountTeams,
  loginWithProvider,
  revokeSession,
  uploadOnboardingAvatar,
  type AuthTokens,
  type SocialProvider,
} from './auth-api';

export type { SocialProvider } from './auth-api';

type SessionBase = { provider: SocialProvider; teams: Record<League, Team[]> };

type Session = SessionBase & (
  | { needProfile: true; accessToken: string }
  | (AuthTokens & {
      needProfile: false;
      userId: number;
      profile: CompleteProfileRequest;
      avatarUri: string | null;
    })
);

type StoredProfile = CompleteProfileRequest & { localAvatarUri?: string | null };
type MockProfiles = Partial<Record<SocialProvider, StoredProfile>>;

type MockSessionContextValue = {
  session: Session | null;
  signIn: (provider: SocialProvider, providerToken: string) => Promise<void>;
  checkNickname: (nickname: string) => Promise<{ available: boolean }>;
  completeProfile: (profile: CompleteProfileRequest, avatarUri: string | null) => Promise<boolean>;
  updateProfile: (profile: CompleteProfileRequest, avatarUri: string | null) => Promise<boolean>;
  removeProfile: () => Promise<void>;
  signOut: () => void;
};

const profilesKey = 'jikchin.mock-profiles.v1';
const MockSessionContext = createContext<MockSessionContextValue | null>(null);

async function readProfiles(): Promise<MockProfiles> {
  const stored = await AsyncStorage.getItem(profilesKey);
  return stored ? (JSON.parse(stored) as MockProfiles) : {};
}

export async function getMockProfileSummaries(): Promise<Partial<Record<SocialProvider, CompleteProfileRequest & { avatarUrl: string | null }>>> {
  const profiles = await readProfiles();
  const summaries: Partial<Record<SocialProvider, CompleteProfileRequest & { avatarUrl: string | null }>> = {};
  for (const provider of ['google', 'kakao', 'naver'] as const) {
    const profile = profiles[provider];
    if (profile) summaries[provider] = { ...profile, avatarUrl: profile.localAvatarUri ?? null };
  }
  return summaries;
}

function nicknameIsAvailable(profiles: MockProfiles, nickname: string) {
  return !Object.values(profiles).some(
    (profile) => profile.nickname.localeCompare(nickname, 'ko', { sensitivity: 'base' }) === 0,
  );
}

export function MockSessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);

  async function signIn(provider: SocialProvider, providerToken: string) {
    const result = await loginWithProvider(provider, providerToken);

    try {
      if (result.needProfile) {
        const teams = await getAccountTeams(result.accessToken);
        setSession({ provider, teams, needProfile: true, accessToken: result.accessToken });
        return;
      }

      const [profile, teams] = await Promise.all([
        getAccountProfile(result.accessToken),
        getAccountTeams(result.accessToken),
      ]);
      setSession({
        ...result,
        provider,
        teams,
        userId: profile.id,
        avatarUri: profile.avatarUrl,
        profile: {
          nickname: profile.nickname,
          avatarKey: profile.avatarKey,
          bio: profile.bio,
          favoriteKboTeamId: profile.favoriteKboTeam?.id ?? null,
          favoriteKleagueTeamId: profile.favoriteKleagueTeam?.id ?? null,
        },
      });
    } catch (error) {
      if (result.refreshToken) void revokeSession(result.refreshToken).catch(() => {});
      throw error;
    }
  }

  async function checkNickname(nickname: string) {
    if (session?.needProfile) return checkAccountNickname(session.accessToken, nickname);
    const profiles = await readProfiles();
    if (session && !session.needProfile) delete profiles[session.provider];
    return { available: nicknameIsAvailable(profiles, nickname) };
  }

  async function completeProfile(profile: CompleteProfileRequest, avatarUri: string | null) {
    if (!session?.needProfile) throw new Error('An onboarding session is required');

    const { available } = await checkAccountNickname(session.accessToken, profile.nickname);
    if (!available) return false;
    const avatar = avatarUri ? await uploadOnboardingAvatar(session.accessToken, avatarUri) : null;
    const submittedProfile = { ...profile, avatarKey: avatar?.avatarKey ?? null };
    let tokens: AuthTokens;
    try {
      tokens = await completeAccountProfile(session.accessToken, submittedProfile);
    } catch (error) {
      if (error instanceof AuthApiError && error.status === 400) {
        const latest = await checkAccountNickname(session.accessToken, profile.nickname);
        if (!latest.available) return false;
      }
      throw error;
    }
    let account: Awaited<ReturnType<typeof getAccountProfile>>;
    try {
      account = await getAccountProfile(tokens.accessToken);
    } catch {
      void revokeSession(tokens.refreshToken).catch(() => {});
      throw new AuthApiError('프로필은 등록됐어요. 계정 정보를 불러오려면 다시 로그인해 주세요.');
    }
    setSession((current) => current === session
      ? { ...session, ...tokens, needProfile: false, userId: account.id, profile: submittedProfile, avatarUri }
      : current);
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

  async function removeProfile() {
    if (!session || session.needProfile) throw new Error('A completed profile is required');
    const profiles = await readProfiles();
    delete profiles[session.provider];
    await AsyncStorage.setItem(profilesKey, JSON.stringify(profiles));
    signOut();
  }

  function signOut() {
    setSession(null);
    if (session && !session.needProfile) void revokeSession(session.refreshToken).catch(() => {});
  }

  return (
    <MockSessionContext.Provider
      value={{ session, signIn, checkNickname, completeProfile, updateProfile, removeProfile, signOut }}>
      {children}
    </MockSessionContext.Provider>
  );
}

export function useMockSession() {
  const context = useContext(MockSessionContext);
  if (!context) throw new Error('MockSessionProvider is required');
  return context;
}
