import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';

import type { CompleteProfileRequest, League, ProfilePhotoSelection, Team } from '@/features/onboarding/profile';

import {
  AuthApiError,
  AuthenticatedSession,
  checkAccountNickname,
  checkOnboardingNickname,
  completeAccountProfile,
  getAccountProfile,
  getAccountTeams,
  getSessionStatus,
  loginWithProvider,
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
  | {
      needProfile: false;
      apiSession: AuthenticatedSession;
      userId: number;
      profile: AccountProfile;
    }
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

export function MockSessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const apiSession = session?.needProfile === false ? session.apiSession : null;
  const profileRevision = useRef(0);

  const endSession = useCallback((ended: AuthenticatedSession) => {
    setSession((current) => current?.needProfile === false && current.apiSession === ended ? null : current);
  }, []);

  useEffect(() => {
    if (!apiSession) return;

    let sessionCheck: AbortController | undefined;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      sessionCheck?.abort();
      const controller = new AbortController();
      sessionCheck = controller;
      void getSessionStatus(apiSession, controller.signal).then(async (needProfile) => {
        if (needProfile && !controller.signal.aborted) await apiSession.signOut();
      }).catch(() => {});
    });

    return () => {
      subscription.remove();
      sessionCheck?.abort();
    };
  }, [apiSession]);

  const refreshProfile = useCallback(async (signal: AbortSignal) => {
    if (!apiSession) return;
    const revision = profileRevision.current;
    const profile = await getAccountProfile(apiSession, signal);
    if (revision !== profileRevision.current) return;
    setSession((current) => !signal.aborted && current?.needProfile === false && current.apiSession === apiSession
      ? { ...current, profile }
      : current);
  }, [apiSession]);

  async function signIn(provider: SocialProvider, providerToken: string) {
    const result = await loginWithProvider(provider, providerToken);
    if (result.needProfile) {
      await confirmSessionStatus(result.accessToken, true);
      const teams = await getAccountTeams(result.accessToken);
      setSession({ provider, teams, needProfile: true, accessToken: result.accessToken });
      return;
    }

    const accountSession = new AuthenticatedSession(result, endSession);
    try {
      await confirmSessionStatus(accountSession, false);
      const [profile, teams] = await Promise.all([
        getAccountProfile(accountSession),
        getAccountTeams(accountSession),
      ]);
      setSession({
        provider,
        teams,
        needProfile: false,
        apiSession: accountSession,
        userId: profile.id,
        profile,
      });
    } catch (error) {
      void accountSession.signOut().catch(() => {});
      throw error;
    }
  }

  async function checkNickname(nickname: string) {
    if (!session) throw new Error('A session is required');
    return session.needProfile
      ? checkOnboardingNickname(session.accessToken, nickname)
      : checkAccountNickname(session.apiSession, nickname);
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
    const accountSession = new AuthenticatedSession(tokens, endSession);
    let account: AccountProfile;
    try {
      await confirmSessionStatus(accountSession, false);
      account = await getAccountProfile(accountSession);
    } catch {
      void accountSession.signOut().catch(() => {});
      throw new AuthApiError('프로필은 등록됐어요. 계정 정보를 불러오려면 다시 로그인해 주세요.');
    }
    setSession((current) => current === session
      ? {
          provider: session.provider,
          teams: session.teams,
          needProfile: false,
          apiSession: accountSession,
          userId: account.id,
          profile: account,
        }
      : current);
    return true;
  }

  async function updateProfile(profile: CompleteProfileRequest) {
    if (!apiSession) throw new Error('A completed profile is required');
    const savedProfile = await updateAccountProfile(apiSession, profile);
    profileRevision.current += 1;
    setSession((current) => current?.needProfile === false && current.apiSession === apiSession
      ? { ...current, profile: savedProfile }
      : current);
  }

  async function withdraw() {
    if (!apiSession) throw new Error('A completed profile is required');
    await withdrawAccount(apiSession);
    apiSession.end();
  }

  function signOut() {
    if (apiSession) void apiSession.signOut().catch(() => {});
    else setSession((current) => current === session ? null : current);
  }

  return (
    <MockSessionContext.Provider
      value={{ session, signIn, checkNickname, completeProfile, refreshProfile, updateProfile, withdraw, signOut }}>
      {children}
    </MockSessionContext.Provider>
  );
}

async function confirmSessionStatus(session: string | AuthenticatedSession, expectedNeedProfile: boolean) {
  if (await getSessionStatus(session) !== expectedNeedProfile) {
    throw new AuthApiError('계정 상태가 변경됐어요. 다시 로그인해 주세요.');
  }
}

export function useMockSession() {
  const context = useContext(MockSessionContext);
  if (!context) throw new Error('MockSessionProvider is required');
  return context;
}
