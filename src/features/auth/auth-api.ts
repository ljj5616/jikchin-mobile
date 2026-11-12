import type { CompleteProfileRequest, League, ProfilePhotoSelection, Team } from '@/features/onboarding/profile';

export type SocialProvider = 'google' | 'kakao' | 'naver';

export type AuthTokens = { accessToken: string; refreshToken: string };

type LoginResponse =
  | { needProfile: true; accessToken: string; refreshToken: null }
  | ({ needProfile: false } & AuthTokens);

type AccountIdentity = {
  id: number;
  nickname: string;
};

export type AccountProfile = AccountIdentity & {
  avatarKey: string | null;
  avatarUrl: string | null;
  bio: string | null;
  favoriteKboTeam: Team | null;
  favoriteKleagueTeam: Team | null;
};

export class AuthApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'AuthApiError';
  }
}

type RequestOptions = {
  token?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  json?: object;
  form?: FormData;
  signal?: AbortSignal;
  errorMessages?: Partial<Record<number, string>>;
};

type SessionRequestOptions = Omit<RequestOptions, 'token'>;

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
  if (!baseUrl) throw new AuthApiError('API 주소가 설정되지 않았어요. EXPO_PUBLIC_API_URL을 확인해 주세요.');

  const { token, json, form, signal } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json) headers['Content-Type'] = 'application/json';

  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 15000);

  try {
    if (controller.signal.aborted) throw new Error('Request cancelled');
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? (json || form ? 'POST' : 'GET'),
      headers,
      body: json ? JSON.stringify(json) : form,
      signal: controller.signal,
    });

    if (!response.ok) {
      let message = '요청을 처리하지 못했어요. 다시 시도해 주세요.';
      if (response.status === 401) {
        message = path.endsWith('/login')
          ? '서버에서 소셜 인증을 확인하지 못했어요. 계정 설정을 확인한 뒤 다시 시도해 주세요.'
          : '로그인 시간이 만료됐어요. 다시 로그인해 주세요.';
      }
      if (response.status === 403) message = '이 계정으로 요청할 수 없어요.';
      if (response.status >= 500) message = '서버에 문제가 발생했어요. 잠시 후 다시 시도해 주세요.';
      message = options.errorMessages?.[response.status] ?? message;
      throw new AuthApiError(`${message} (HTTP ${response.status})`, response.status);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof AuthApiError) throw error;
    if (controller.signal.aborted) {
      throw new AuthApiError('서버 응답 시간이 초과됐어요. 백엔드 실행 상태를 확인해 주세요.');
    }
    if (error instanceof SyntaxError) throw new AuthApiError('서버 응답 형식을 확인할 수 없어요.');
    throw new AuthApiError('백엔드에 연결할 수 없어요. 서버 실행 상태와 API 주소를 확인해 주세요.');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

function isToken(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isUnauthorized(error: unknown) {
  return error instanceof AuthApiError && error.status === 401;
}

async function refreshAccountTokens(refreshToken: string): Promise<AuthTokens> {
  const result = await request<Partial<AuthTokens> | null>('/auth/refresh', { json: { refreshToken } });
  if (isToken(result?.accessToken) && isToken(result?.refreshToken)) {
    return { accessToken: result.accessToken, refreshToken: result.refreshToken };
  }
  throw new AuthApiError('세션 갱신 응답에 로그인 정보가 없어요.');
}

export class AuthenticatedSession {
  private refreshInFlight: Promise<void> | undefined;
  private ended = false;

  constructor(private tokens: AuthTokens, private readonly onEnd: (session: AuthenticatedSession) => void) {}

  async request<T>(path: string, options: SessionRequestOptions = {}): Promise<T> {
    this.ensureActive();
    if (this.refreshInFlight) await this.refreshInFlight;
    this.ensureActive();

    const sentTokens = this.tokens;
    let result: T;
    try {
      result = await request<T>(path, { ...options, token: sentTokens.accessToken });
    } catch (error) {
      if (!isUnauthorized(error) || options.signal?.aborted || this.ended) throw error;

      // Other requests may have already rotated the pair while this request was in flight.
      if (sentTokens === this.tokens) this.refreshInFlight ??= this.rotateTokens();
      if (this.refreshInFlight) await this.refreshInFlight;
      this.ensureActive();

      const retryTokens = this.tokens;
      try {
        result = await request<T>(path, { ...options, token: retryTokens.accessToken });
      } catch (retryError) {
        if (isUnauthorized(retryError) && retryTokens === this.tokens && !options.signal?.aborted) this.end();
        throw retryError;
      }
    }
    this.ensureActive();
    return result;
  }

  end() {
    if (this.ended) return;
    this.ended = true;
    this.onEnd(this);
  }

  async signOut() {
    this.end();
    // Revoke the newest refresh token if a rotation was already in progress.
    await this.refreshInFlight?.catch(() => {});
    await request<void>('/auth/logout', { json: { refreshToken: this.tokens.refreshToken } });
  }

  private ensureActive() {
    if (this.ended) throw new AuthApiError('로그인 시간이 만료됐어요. 다시 로그인해 주세요.', 401);
  }

  private async rotateTokens() {
    try {
      this.tokens = await refreshAccountTokens(this.tokens.refreshToken);
    } catch (error) {
      if (isUnauthorized(error)) this.end();
      throw error;
    } finally {
      this.refreshInFlight = undefined;
    }
  }
}

function requestWithSession<T>(path: string, session: string | AuthenticatedSession, options: SessionRequestOptions = {}) {
  return typeof session === 'string'
    ? request<T>(path, { ...options, token: session })
    : session.request<T>(path, options);
}

export async function getSessionStatus(session: string | AuthenticatedSession, signal?: AbortSignal) {
  const result = await requestWithSession<{ needProfile?: boolean } | null>('/auth/session', session, { signal });
  if (typeof result?.needProfile !== 'boolean') throw new AuthApiError('서버 세션 상태를 확인할 수 없어요.');
  return result.needProfile;
}

export async function loginWithProvider(provider: SocialProvider, providerToken: string): Promise<LoginResponse> {
  const result = await request<Partial<LoginResponse> | null>(`/auth/${provider}/login`, {
    json: { accessToken: providerToken },
  });
  if (result?.needProfile === true && isToken(result.accessToken)) {
    return { needProfile: true, accessToken: result.accessToken, refreshToken: null };
  }
  if (result?.needProfile === false && isToken(result.accessToken) && isToken(result.refreshToken)) {
    return { needProfile: false, accessToken: result.accessToken, refreshToken: result.refreshToken };
  }
  throw new AuthApiError('서버 로그인 응답에 필요한 정보가 없어요.');
}

export function getCurrentUser(session: AuthenticatedSession) {
  return session.request<AccountIdentity>('/users/me', {
    errorMessages: { 404: '내 계정 정보를 찾을 수 없어요.' },
  });
}

export function getAccountProfile(session: AuthenticatedSession, signal?: AbortSignal) {
  return session.request<AccountProfile>('/users/me/profile', {
    signal,
    errorMessages: { 404: '프로필을 찾을 수 없어요.' },
  });
}

export function updateAccountProfile(session: AuthenticatedSession, profile: CompleteProfileRequest) {
  return session.request<AccountProfile>('/users/me/profile', {
    method: 'PUT',
    json: profile,
    errorMessages: {
      400: '프로필 입력과 선택한 응원팀을 확인해 주세요.',
      404: '프로필을 찾을 수 없어요.',
      409: '이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해 주세요.',
    },
  });
}

export async function getAccountTeams(session: string | AuthenticatedSession): Promise<Record<League, Team[]>> {
  const [KBO, KLEAGUE] = await Promise.all([
    requestWithSession<Team[]>('/api/teams?league=KBO', session),
    requestWithSession<Team[]>('/api/teams?league=KLEAGUE', session),
  ]);
  return { KBO, KLEAGUE };
}

export function checkOnboardingNickname(token: string, nickname: string) {
  return request<{ available: boolean }>(`/auth/nickname-availability?nickname=${encodeURIComponent(nickname)}`, { token });
}

export function checkAccountNickname(session: AuthenticatedSession, nickname: string) {
  return session.request<{ available: boolean }>(`/users/me/nickname-availability?nickname=${encodeURIComponent(nickname)}`);
}

function uploadAvatar(path: string, session: string | AuthenticatedSession, photo: ProfilePhotoSelection) {
  const form = new FormData();
  if (photo.file) form.append('file', photo.file, 'avatar.jpg');
  else form.append('file', { uri: photo.uri, name: 'avatar.jpg', type: 'image/jpeg' } as unknown as Blob);
  return requestWithSession<{ avatarKey: string }>(path, session, {
    form,
    errorMessages: {
      400: '5MB 이하, 가로·세로 4096px 이하인 JPEG 사진을 선택해 주세요.',
      413: '5MB 이하의 사진을 선택해 주세요.',
    },
  });
}

export function uploadOnboardingAvatar(token: string, photo: ProfilePhotoSelection) {
  return uploadAvatar('/auth/avatar', token, photo);
}

export function uploadAccountAvatar(session: AuthenticatedSession, photo: ProfilePhotoSelection) {
  return uploadAvatar('/users/me/avatar', session, photo);
}

export async function completeAccountProfile(token: string, profile: CompleteProfileRequest): Promise<AuthTokens> {
  const result = await request<Partial<AuthTokens> | null>('/auth/complete-profile', { token, json: profile });
  if (isToken(result?.accessToken) && isToken(result?.refreshToken)) {
    return { accessToken: result.accessToken, refreshToken: result.refreshToken };
  }
  throw new AuthApiError('프로필 등록 응답에 로그인 정보가 없어요. 다시 로그인해 주세요.');
}

export function withdrawAccount(session: AuthenticatedSession) {
  return session.request<void>('/users/me', {
    method: 'DELETE',
    errorMessages: { 409: '참여 중인 방이 변경됐어요. 다시 탈퇴를 시도해 주세요.' },
  });
}
