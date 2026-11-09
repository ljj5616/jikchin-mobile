import { onboardingTeams, type League } from '@/features/onboarding/profile';

import { gameDateKey, type RoomResponse } from './room-list';

function mockMatch(league: League, homeShortName: string, awayShortName: string) {
  const teams = onboardingTeams[league];
  const home = teams.find((team) => team.shortName === homeShortName);
  const away = teams.find((team) => team.shortName === awayShortName);

  if (!home || !away) throw new Error('Unknown team in mock room');

  return { homeTeamId: home.id, homeTeam: home.name, awayTeamId: away.id, awayTeam: away.name };
}

const roomFixtures = [
  {
    id: 1,
    chatThreadId: 101,
    hostId: 201,
    title: '잠실에서 야구 같이 봐요',
    daysAhead: 0,
    stadium: '잠실야구장',
    ...mockMatch('KBO', 'LG', '두산'),
    capacity: 4,
    participantCount: 2,
  },
  {
    id: 2,
    chatThreadId: 102,
    hostId: 202,
    title: '상암에서 축구 직관해요',
    daysAhead: 2,
    stadium: '서울월드컵경기장',
    ...mockMatch('KLEAGUE', '서울', '포항'),
    capacity: 6,
    participantCount: 5,
  },
  {
    id: 3,
    chatThreadId: 103,
    hostId: 203,
    title: '사직에서 함께 응원해요',
    daysAhead: 4,
    stadium: '사직야구장',
    ...mockMatch('KBO', '롯데', '삼성'),
    capacity: 5,
    participantCount: 3,
  },
  {
    id: 4,
    chatThreadId: 104,
    hostId: 204,
    title: '전주 경기 같이 보실 분',
    daysAhead: 7,
    stadium: '전주월드컵경기장',
    ...mockMatch('KLEAGUE', '전북', '울산'),
    capacity: 8,
    participantCount: 4,
  },
  {
    id: 5,
    chatThreadId: 105,
    hostId: 205,
    title: '수원 직관 모임',
    daysAhead: 1,
    stadium: '수원 KT 위즈 파크',
    ...mockMatch('KBO', 'KT', 'NC'),
    capacity: 4,
    participantCount: 4,
  },
];

export function getMockRooms(today: Date): RoomResponse[] {
  return roomFixtures.map(({ daysAhead, ...room }) => ({
    ...room,
    gameDate: gameDateKey(today, daysAhead),
  }));
}
