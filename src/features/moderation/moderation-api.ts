import type { AuthenticatedSession } from '@/features/auth/auth-api';
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

export function getPublicProfile(session: AuthenticatedSession, userId: number) {
  return session.request<PublicProfile>(`/users/${userId}/profile`, {
    errorMessages: { 404: '사용자를 찾을 수 없어요.' },
  });
}

export function listBlockedUsers(session: AuthenticatedSession) {
  return session.request<BlockedUser[]>('/users/me/blocks');
}

export function setUserBlocked(session: AuthenticatedSession, userId: number, blocked: boolean) {
  return session.request<void>(`/users/me/blocks/${userId}`, { method: blocked ? 'PUT' : 'DELETE' });
}

export function getReportOptions(session: AuthenticatedSession, targetType: ReportTarget) {
  return session.request<ReportOptions>(`/api/reports/reasons?targetType=${targetType}`);
}

export function submitReport(
  session: AuthenticatedSession,
  targetType: ReportTarget,
  targetId: number,
  report: { reason: string; description: string; clientReportId: string },
) {
  const targets = targetType === 'ROOM' ? 'rooms' : 'users';
  return session.request<unknown>(`/api/reports/${targets}/${targetId}`, {
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
