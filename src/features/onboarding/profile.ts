export const nicknameMaxLength = 20;
export const bioMaxLength = 160;

export type CompleteProfileRequest = {
  nickname: string;
  avatarKey: string | null;
  bio: string | null;
  favoriteKboTeamId: number | null;
  favoriteKleagueTeamId: number | null;
};

export type League = 'KBO' | 'KLEAGUE';

type Team = {
  id: number;
  name: string;
  shortName: string;
  logoUrl: string;
};

function mockTeams(firstId: number, names: [name: string, shortName: string][]): Team[] {
  return names.map(([name, shortName], index) => ({
    id: firstId + index,
    name,
    shortName,
    logoUrl: '',
  }));
}

// Club names follow V3__onboarding_teams.sql. These IDs belong to the local fixture.
export const onboardingTeams: Record<League, Team[]> = {
  KBO: mockTeams(1, [
    ['KIA 타이거즈', 'KIA'],
    ['KT 위즈', 'KT'],
    ['LG 트윈스', 'LG'],
    ['NC 다이노스', 'NC'],
    ['SSG 랜더스', 'SSG'],
    ['두산 베어스', '두산'],
    ['롯데 자이언츠', '롯데'],
    ['삼성 라이온즈', '삼성'],
    ['키움 히어로즈', '키움'],
    ['한화 이글스', '한화'],
  ]),
  KLEAGUE: mockTeams(11, [
    ['FC 서울', '서울'],
    ['FC 안양', '안양'],
    ['강원 FC', '강원'],
    ['광주 FC', '광주'],
    ['김천상무', '김천'],
    ['대전하나시티즌', '대전'],
    ['부천 FC', '부천'],
    ['울산 HD', '울산'],
    ['인천유나이티드', '인천'],
    ['전북현대', '전북'],
    ['제주 SK', '제주'],
    ['포항스틸러스', '포항'],
  ]),
};
