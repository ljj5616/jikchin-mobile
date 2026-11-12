import type { CompleteProfileRequest, League, ProfilePhotoSelection, Team } from '@/features/onboarding/profile';

export type SocialProvider = 'google' | 'kakao' | 'naver';

export type AuthTokens = { accessToken: string; refreshToken: string };

type LoginResponse =
  | { needProfile: true; accessToken: string; refreshToken: null }
  | ({ needProfile: false } & AuthTokens);

export type AccountProfile = {
  id: number;
  nickname: string;
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

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
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

export function getAccountProfile(token: string, signal?: AbortSignal) {
  return request<AccountProfile>('/users/me/profile', {
    token, signal, errorMessages: { 404: '프로필을 찾을 수 없어요.' },
  });
}

export function updateAccountProfile(token: string, profile: CompleteProfileRequest) {
  return request<AccountProfile>('/users/me/profile', {
    token,
    method: 'PUT',
    json: profile,
    errorMessages: {
      400: '프로필 입력과 선택한 응원팀을 확인해 주세요.',
      404: '프로필을 찾을 수 없어요.',
      409: '이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해 주세요.',
    },
  });
}

export async function getAccountTeams(token: string): Promise<Record<League, Team[]>> {
  const [KBO, KLEAGUE] = await Promise.all([
    request<Team[]>('/api/teams?league=KBO', { token }),
    request<Team[]>('/api/teams?league=KLEAGUE', { token }),
  ]);
  return { KBO, KLEAGUE };
}

export function checkOnboardingNickname(token: string, nickname: string) {
  return request<{ available: boolean }>(`/auth/nickname-availability?nickname=${encodeURIComponent(nickname)}`, { token });
}

export function checkAccountNickname(token: string, nickname: string) {
  return request<{ available: boolean }>(`/users/me/nickname-availability?nickname=${encodeURIComponent(nickname)}`, { token });
}

function uploadAvatar(path: string, token: string, photo: ProfilePhotoSelection) {
  const form = new FormData();
  if (photo.file) form.append('file', photo.file, 'avatar.jpg');
  else form.append('file', { uri: photo.uri, name: 'avatar.jpg', type: 'image/jpeg' } as unknown as Blob);
  return request<{ avatarKey: string }>(path, {
    token,
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

export function uploadAccountAvatar(token: string, photo: ProfilePhotoSelection) {
  return uploadAvatar('/users/me/avatar', token, photo);
}

export async function completeAccountProfile(token: string, profile: CompleteProfileRequest): Promise<AuthTokens> {
  const result = await request<Partial<AuthTokens> | null>('/auth/complete-profile', { token, json: profile });
  if (isToken(result?.accessToken) && isToken(result?.refreshToken)) {
    return { accessToken: result.accessToken, refreshToken: result.refreshToken };
  }
  throw new AuthApiError('프로필 등록 응답에 로그인 정보가 없어요. 다시 로그인해 주세요.');
}

export function revokeSession(refreshToken: string) {
  return request<void>('/auth/logout', { json: { refreshToken } });
}

export function withdrawAccount(token: string) {
  return request<void>('/users/me', {
    token,
    method: 'DELETE',
    errorMessages: { 409: '참여 중인 방이 변경됐어요. 다시 탈퇴를 시도해 주세요.' },
  });
}
