import { request } from '@/features/auth/auth-api';
import type { Team } from '@/features/onboarding/profile';

export type ReportTarget = 'USER' | 'ROOM';

type ReportOptions = {
  enabled: boolean;
  descriptionRequired: boolean;
  descriptionMaxLength: number;
  reasons: { code: string; label: string }[];
};

type BlockedUser = {
  userId: number;
  nickname: string | null;
  avatarUrl: string;
};

type PublicProfile = {
  nickname: string | null;
  avatarUrl: string;
  bio: string | null;
  favoriteKboTeam: Team | null;
  favoriteKleagueTeam: Team | null;
  blocked: boolean;
};

export function getPublicProfile(token: string, userId: number) {
  return request<PublicProfile>(`/users/${userId}/profile`, {
    token,
    errorMessages: { 404: '사용자를 찾을 수 없어요.' },
  });
}

export function listBlockedUsers(token: string) {
  return request<BlockedUser[]>('/users/me/blocks', { token });
}

export function setUserBlocked(token: string, userId: number, blocked: boolean) {
  return request<void>(`/users/me/blocks/${userId}`, { token, method: blocked ? 'PUT' : 'DELETE' });
}

export function getReportOptions(token: string, targetType: ReportTarget) {
  return request<ReportOptions>(`/api/reports/reasons?targetType=${targetType}`, { token });
}

export function submitReport(
  token: string,
  targetType: ReportTarget,
  targetId: number,
  report: { reason: string; description: string; clientReportId: string },
) {
  const targets = targetType === 'ROOM' ? 'rooms' : 'users';
  return request<unknown>(`/api/reports/${targets}/${targetId}`, {
    token,
    json: report,
    errorMessages: {
      400: targetType === 'ROOM'
        ? '신고 사유를 확인해 주세요. 직접 만든 방은 신고할 수 없어요.'
        : '신고 사유와 내용을 확인해 주세요.',
      404: '신고 대상을 찾을 수 없어요.',
      503: '신고 접수가 일시 중단됐어요.',
    },
  });
}
