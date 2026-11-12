import { onboardingTeams, type League, type Team } from '@/features/onboarding/profile';

import { gameDateKey } from './room-list';

export const roomTextMaxLength = 100;
export const roomCapacity = { min: 2, max: 100 } as const;

export type CreateRoomRequest = {
  title: string;
  gameDate: string;
  stadium: string;
  homeTeamId: number;
  awayTeamId: number;
  capacity: number;
};

export function validateRoomRequest(request: CreateRoomRequest, today: Date, availableTeams: Record<League, Team[]> = onboardingTeams) {
  const title = request.title.trim();
  const stadium = request.stadium.trim();
  if (!title || request.title.length > roomTextMaxLength) {
    throw new Error(`방 제목을 ${roomTextMaxLength}자 이내로 입력해 주세요.`);
  }
  if (!stadium || request.stadium.length > roomTextMaxLength) {
    throw new Error(`경기장을 ${roomTextMaxLength}자 이내로 입력해 주세요.`);
  }

  const { gameDate } = request;
  const date = new Date(`${gameDate}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(gameDate) || Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== gameDate) {
    throw new Error('경기 날짜를 YYYY-MM-DD 형식으로 입력해 주세요.');
  }
  if (gameDate < gameDateKey(today)) {
    throw new Error('경기 날짜는 오늘 또는 이후로 선택해 주세요.');
  }

  const teams = Object.values(availableTeams).find((league) =>
    league.some((team) => team.id === request.homeTeamId),
  );
  const home = teams?.find((team) => team.id === request.homeTeamId);
  const away = teams?.find((team) => team.id === request.awayTeamId);
  if (!home || !away || home.id === away.id) {
    throw new Error('같은 리그의 서로 다른 홈 팀과 원정 팀을 선택해 주세요.');
  }

  const { capacity } = request;
  if (!Number.isInteger(capacity) || capacity < roomCapacity.min || capacity > roomCapacity.max) {
    throw new Error(`방장 포함 ${roomCapacity.min}~${roomCapacity.max}명으로 입력해 주세요.`);
  }

  return { request: { ...request, title, stadium }, homeTeam: home.name, awayTeam: away.name };
}
