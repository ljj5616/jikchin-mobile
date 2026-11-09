export type RoomResponse = {
  id: number;
  chatThreadId: number;
  title: string;
  gameDate: string;
  stadium: string;
  homeTeamId: number;
  homeTeam: string;
  awayTeamId: number;
  awayTeam: string;
  capacity: number;
  hostId: number;
  participantCount: number;
};

const gameDateFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
  timeZone: 'UTC',
});

export function gameDateKey(date: Date, daysAhead = 0) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate() + daysAhead))
    .toISOString()
    .slice(0, 10);
}

export function formatGameDate(gameDate: string) {
  return gameDateFormatter.format(new Date(`${gameDate}T00:00:00Z`));
}

export function listRecruitingRooms(rooms: RoomResponse[], today: Date) {
  const firstDate = gameDateKey(today);

  return rooms
    .filter((room) => room.gameDate >= firstDate && room.participantCount < room.capacity)
    .sort((first, second) => first.gameDate.localeCompare(second.gameDate) || first.id - second.id);
}
