import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useRef, useState, type PropsWithChildren } from 'react';

import type { CompleteProfileRequest, League, ProfilePhotoSelection, Team } from '@/features/onboarding/profile';

import {
  AuthApiError,
  checkAccountNickname,
  checkOnboardingNickname,
  completeAccountProfile,
  getAccountProfile,
  getAccountTeams,
  getCurrentUser,
  loginWithProvider,
  revokeSession,
  updateAccountProfile,
  uploadOnboardingAvatar,
  withdrawAccount,
  type AccountProfile,
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
      profile: AccountProfile;
    })
);

type StoredProfile = CompleteProfileRequest & { localAvatarUri?: string | null };
type MockProfiles = Partial<Record<SocialProvider, StoredProfile>>;

type MockSessionContextValue = {
  session: Session | null;
  signIn: (provider: SocialProvider, providerToken: string) => Promise<void>;
  checkNickname: (nickname: string) => Promise<{ available: boolean }>;
  completeProfile: (profile: CompleteProfileRequest, photo: ProfilePhotoSelection | null) => Promise<boolean>;
  refreshProfile: (signal: AbortSignal) => Promise<void>;
  updateProfile: (profile: CompleteProfileRequest) => Promise<void>;
  withdraw: () => Promise<void>;
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

async function loadAccount(token: string): Promise<AccountProfile> {
  const [account, profile] = await Promise.all([getCurrentUser(token), getAccountProfile(token)]);
  return { ...profile, id: account.id, nickname: account.nickname };
}

export function MockSessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const profileToken = session?.needProfile === false ? session.accessToken : null;
  const profileRevision = useRef(0);

  const refreshProfile = useCallback(async (signal: AbortSignal) => {
    if (!profileToken) return;
    const revision = profileRevision.current;
    const profile = await getAccountProfile(profileToken, signal);
    if (revision !== profileRevision.current) return;
    setSession((current) => !signal.aborted && current?.needProfile === false && current.accessToken === profileToken
      ? { ...current, profile }
      : current);
  }, [profileToken]);

  async function signIn(provider: SocialProvider, providerToken: string) {
    const result = await loginWithProvider(provider, providerToken);

    try {
      if (result.needProfile) {
        const teams = await getAccountTeams(result.accessToken);
        setSession({ provider, teams, needProfile: true, accessToken: result.accessToken });
        return;
      }

      const [profile, teams] = await Promise.all([
        loadAccount(result.accessToken),
        getAccountTeams(result.accessToken),
      ]);
      setSession({
        ...result,
        provider,
        teams,
        userId: profile.id,
        profile,
      });
    } catch (error) {
      if (result.refreshToken) void revokeSession(result.refreshToken).catch(() => {});
      throw error;
    }
  }

  async function checkNickname(nickname: string) {
    if (!session) throw new Error('A session is required');
    return session.needProfile
      ? checkOnboardingNickname(session.accessToken, nickname)
      : checkAccountNickname(session.accessToken, nickname);
  }

  async function completeProfile(profile: CompleteProfileRequest, photo: ProfilePhotoSelection | null) {
    if (!session?.needProfile) throw new Error('An onboarding session is required');

    const { available } = await checkOnboardingNickname(session.accessToken, profile.nickname);
    if (!available) return false;
    const avatar = photo ? await uploadOnboardingAvatar(session.accessToken, photo) : null;
    const submittedProfile = { ...profile, avatarKey: avatar?.avatarKey ?? null };
    let tokens: AuthTokens;
    try {
      tokens = await completeAccountProfile(session.accessToken, submittedProfile);
    } catch (error) {
      if (error instanceof AuthApiError && error.status === 400) {
        const latest = await checkOnboardingNickname(session.accessToken, profile.nickname);
        if (!latest.available) return false;
      }
      throw error;
    }
    let account: AccountProfile;
    try {
      account = await loadAccount(tokens.accessToken);
    } catch {
      void revokeSession(tokens.refreshToken).catch(() => {});
      throw new AuthApiError('프로필은 등록됐어요. 계정 정보를 불러오려면 다시 로그인해 주세요.');
    }
    setSession((current) => current === session
      ? { ...session, ...tokens, needProfile: false, userId: account.id, profile: account }
      : current);
    return true;
  }

  async function updateProfile(profile: CompleteProfileRequest) {
    if (!profileToken) throw new Error('A completed profile is required');
    const savedProfile = await updateAccountProfile(profileToken, profile);
    profileRevision.current += 1;
    setSession((current) => current?.needProfile === false && current.accessToken === profileToken
      ? { ...current, profile: savedProfile }
      : current);
  }

  async function withdraw() {
    if (!profileToken) throw new Error('A completed profile is required');
    await withdrawAccount(profileToken);
    setSession((current) => current?.accessToken === profileToken ? null : current);
  }

  function signOut() {
    setSession(null);
    if (session && !session.needProfile) void revokeSession(session.refreshToken).catch(() => {});
  }

  return (
    <MockSessionContext.Provider
      value={{ session, signIn, checkNickname, completeProfile, refreshProfile, updateProfile, withdraw, signOut }}>
      {children}
    </MockSessionContext.Provider>
  );
}

export function useMockSession() {
  const context = useContext(MockSessionContext);
  if (!context) throw new Error('MockSessionProvider is required');
  return context;
}
