import AsyncStorage from '@react-native-async-storage/async-storage';

import { getMockProfileSummaries, type SocialProvider } from '@/features/auth/mock-session';
import { blockedNickname, getMockBlocks, mockBlocksBetween } from '@/features/moderation/mock-moderation-store';

import { validateRoomRequest, type CreateRoomRequest } from './create-room';
import { getMockRooms } from './mock-rooms';
import { compareRoomSchedule, gameDateKey, listRecruitingRooms, type RoomResponse } from './room-list';

export const mockRoomUserIds: Record<SocialProvider, number> = {
  google: 1001,
  kakao: 1002,
  naver: 1003,
};

export const chatBodyMaxLength = 2000;

export type ChatMessageResponse = {
  id: number;
  roomId: number;
  chatThreadId: number;
  senderId: number;
  senderNickname: string | null;
  senderAvatarUrl: string;
  type: 'TEXT';
  body: string;
  clientMessageId: string | null;
  createdAt: string;
};

type StoredRoom = Omit<RoomResponse, 'participantCount'> & { creatorId?: number };
type RoomMember = { userId: number; afterMessageId: number; joinedAt?: string };

export type RoomParticipant = {
  userId: number;
  nickname: string | null;
  avatarUrl: string | null;
  host: boolean;
  joinedAt: string | null;
};

type RoomState = {
  createdRooms: StoredRoom[];
  members: Partial<Record<number, RoomMember[]>>;
  messages: Partial<Record<number, ChatMessageResponse[]>>;
  lastRoomId: number;
  lastChatThreadId: number;
};

type LegacyRoomState = Pick<RoomState, 'createdRooms' | 'messages'> & {
  joinedAfter: Partial<Record<number, Record<number, number>>>;
};

const storageKey = 'jikchin.mock-rooms.v1';
let pendingWrite: Promise<unknown> = Promise.resolve();

function migrateState(legacy: LegacyRoomState): RoomState {
  const members: RoomState['members'] = {};
  for (const [roomId, users] of Object.entries(legacy.joinedAfter)) {
    // Older records kept the message cutoff but did not save the join order.
    members[Number(roomId)] = Object.entries(users ?? {})
      .map(([userId, afterMessageId]) => ({ userId: Number(userId), afterMessageId }))
      .sort((first, second) => first.afterMessageId - second.afterMessageId || first.userId - second.userId);
  }
  for (const { id, hostId } of legacy.createdRooms) {
    members[id] = [{ userId: hostId, afterMessageId: 0 }, ...(members[id] ?? [])];
  }

  return {
    createdRooms: legacy.createdRooms,
    members,
    messages: legacy.messages,
    lastRoomId: legacy.createdRooms.reduce((max, room) => Math.max(max, room.id), 0),
    lastChatThreadId: legacy.createdRooms.reduce((max, room) => Math.max(max, room.chatThreadId), 0),
  };
}

async function readState(): Promise<RoomState> {
  const stored = await AsyncStorage.getItem(storageKey);
  if (!stored) return { createdRooms: [], members: {}, messages: {}, lastRoomId: 0, lastChatThreadId: 0 };

  const state = JSON.parse(stored) as RoomState | LegacyRoomState;
  return 'members' in state ? state : migrateState(state);
}

function writeState<T>(update: (state: RoomState) => T | Promise<T>): Promise<T> {
  const write = pendingWrite.then(async () => {
    const state = await readState();
    const result = await update(state);
    await AsyncStorage.setItem(storageKey, JSON.stringify(state));
    return result;
  });
  pendingWrite = write.catch(() => {});
  return write;
}

function roomsWithCounts(state: RoomState, today: Date) {
  const memberCount = (roomId: number) => state.members[roomId]?.length ?? 0;
  const samples = getMockRooms(today).map((room) => ({
    ...room,
    participantCount: room.participantCount + memberCount(room.id),
  }));
  const created = state.createdRooms.map((room) => ({
    ...room,
    participantCount: memberCount(room.id),
  }));
  return [...samples, ...created];
}

function findRoom(state: RoomState, roomId: number, today: Date) {
  const room = roomsWithCounts(state, today).find(({ id }) => id === roomId);
  if (!room) throw new Error('방을 찾을 수 없어요.');
  return room;
}

function memberChatStart(state: RoomState, roomId: number, userId: number) {
  return state.members[roomId]?.find((member) => member.userId === userId)?.afterMessageId;
}

export async function listMockRooms(userId: number) {
  const today = new Date();
  const state = await readState();
  const rooms = roomsWithCounts(state, today);
  const isMember = (room: RoomResponse) => memberChatStart(state, room.id, userId) !== undefined;

  return {
    joined: rooms.filter(isMember).sort(compareRoomSchedule),
    recruiting: listRecruitingRooms(rooms.filter((room) => !isMember(room)), today),
  };
}

export async function loadMockRoomDetail(roomId: number, userId: number) {
  const [state, profiles, blocks] = await Promise.all([readState(), getMockProfileSummaries(), getMockBlocks(userId)]);
  const today = new Date();
  const room = findRoom(state, roomId, today);
  const fixture = getMockRooms(today).find((sample) => sample.id === roomId);
  const sampleParticipants: RoomParticipant[] = fixture ? Array.from({ length: fixture.participantCount }, (_, index) => ({
    userId: index === 0 ? fixture.hostId : 10000 + fixture.id * 100 + index,
    nickname: `직관친구 ${index + 1}`,
    avatarUrl: null,
    host: index === 0,
    joinedAt: null,
  })) : [];
  const storedParticipants: RoomParticipant[] = (state.members[roomId] ?? []).map((member) => {
    const provider = (Object.keys(mockRoomUserIds) as SocialProvider[]).find((key) => mockRoomUserIds[key] === member.userId);
    const profile = provider ? profiles[provider] : undefined;
    return {
      userId: member.userId,
      nickname: profile?.nickname ?? null,
      avatarUrl: profile?.avatarUrl ?? null,
      host: member.userId === room.hostId,
      joinedAt: member.joinedAt ?? null,
    };
  });
  const blockedIds = new Set(blocks.map((block) => block.blockedId));
  const participants = [...sampleParticipants, ...storedParticipants].map((participant) => ({
    ...participant, nickname: blockedNickname(participant.nickname, blockedIds.has(participant.userId)),
  }));
  const creatorId = state.createdRooms.find((created) => created.id === roomId)?.creatorId ?? room.hostId;
  return { room, participants, creatorId, joined: memberChatStart(state, roomId, userId) !== undefined };
}

export async function loadMockUserProfile(targetId: number, viewerId: number) {
  const [profiles, blocks] = await Promise.all([getMockProfileSummaries(), getMockBlocks(viewerId)]);
  const provider = (Object.keys(mockRoomUserIds) as SocialProvider[]).find((key) => mockRoomUserIds[key] === targetId);
  const profile = provider ? profiles[provider] : undefined;
  const fixture = getMockRooms(new Date()).flatMap((room) => Array.from({ length: room.participantCount }, (_, index) => ({
    id: index === 0 ? room.hostId : 10000 + room.id * 100 + index, nickname: `직관친구 ${index + 1}`,
  }))).find((person) => person.id === targetId);
  if (!profile && !fixture) throw new Error('사용자를 찾을 수 없어요.');
  const blocked = blocks.some((block) => block.blockedId === targetId);
  return { id: targetId, nickname: blockedNickname(profile?.nickname ?? fixture?.nickname ?? null, blocked),
    avatarUrl: profile?.avatarUrl ?? null, bio: profile?.bio ?? null,
    favoriteKboTeamId: profile?.favoriteKboTeamId ?? null, favoriteKleagueTeamId: profile?.favoriteKleagueTeamId ?? null, blocked };
}

export function createMockRoom(userId: number, request: CreateRoomRequest) {
  return writeState((state) => {
    const today = new Date();
    const { request: details, homeTeam, awayTeam } = validateRoomRequest(request, today);
    const rooms = roomsWithCounts(state, today);
    const id = rooms.reduce((max, room) => Math.max(max, room.id), state.lastRoomId) + 1;
    const chatThreadId = rooms.reduce((max, room) => Math.max(max, room.chatThreadId), state.lastChatThreadId) + 1;
    const room = { ...details, homeTeam, awayTeam, id, chatThreadId, hostId: userId, creatorId: userId };
    state.createdRooms.push(room);
    state.members[id] = [{ userId, afterMessageId: 0, joinedAt: new Date().toISOString() }];
    state.lastRoomId = id;
    state.lastChatThreadId = chatThreadId;
    return { ...room, participantCount: 1 };
  });
}

export function joinMockRoom(roomId: number, userId: number) {
  return writeState(async (state) => {
    const today = new Date();
    const room = findRoom(state, roomId, today);
    if (memberChatStart(state, roomId, userId) !== undefined) return;
    const creatorId = state.createdRooms.find((created) => created.id === roomId)?.creatorId ?? room.hostId;
    if (await mockBlocksBetween(userId, creatorId)) throw new Error('차단 관계로 이 방에 참여할 수 없어요.');
    if (room.gameDate < gameDateKey(today)) throw new Error('경기 날짜가 지난 방이에요.');
    if (room.participantCount >= room.capacity) throw new Error('방 정원이 가득 찼어요.');

    const afterMessageId = state.messages[roomId]?.at(-1)?.id ?? 0;
    state.members[roomId] = [...(state.members[roomId] ?? []), { userId, afterMessageId, joinedAt: new Date().toISOString() }];
  });
}

export function leaveMockRoom(roomId: number, userId: number) {
  return writeState((state) => {
    const room = findRoom(state, roomId, new Date());
    const members = state.members[roomId] ?? [];
    const remaining = members.filter((member) => member.userId !== userId);
    if (remaining.length === members.length) return;

    if (remaining.length) state.members[roomId] = remaining;
    else delete state.members[roomId];

    if (room.hostId !== userId) return;

    const successor = remaining[0];
    if (successor) {
      state.createdRooms = state.createdRooms.map((created) => (
        created.id === roomId ? { ...created, hostId: successor.userId } : created
      ));
    } else {
      state.createdRooms = state.createdRooms.filter(({ id }) => id !== roomId);
      delete state.messages[roomId];
    }
  });
}

export function withdrawMockRooms(userId: number, retiredId: number) {
  return writeState((state) => {
    const rooms = roomsWithCounts(state, new Date());
    for (const room of rooms) {
      const members = state.members[room.id] ?? [];
      if (!members.some((member) => member.userId === userId)) continue;
      const remaining = members.filter((member) => member.userId !== userId);
      if (remaining.length) state.members[room.id] = remaining;
      else delete state.members[room.id];

      if (room.hostId === userId) {
        if (remaining.length) {
          state.createdRooms = state.createdRooms.map((created) => created.id === room.id
            ? { ...created, creatorId: created.creatorId ?? userId, hostId: remaining[0].userId } : created);
        } else {
          state.createdRooms = state.createdRooms.filter((created) => created.id !== room.id);
          delete state.messages[room.id];
        }
      }
    }
    state.createdRooms = state.createdRooms.map((room) => room.creatorId === userId
      ? { ...room, creatorId: retiredId } : room);
    for (const [roomId, messages] of Object.entries(state.messages)) {
      state.messages[Number(roomId)] = messages?.map((message) => message.senderId === userId
        ? { ...message, senderId: retiredId, senderNickname: '탈퇴한 회원', senderAvatarUrl: '' } : message);
    }
  });
}

export async function loadMockRoomChat(roomId: number, userId: number) {
  const [state, blocks] = await Promise.all([readState(), getMockBlocks(userId)]);
  const room = findRoom(state, roomId, new Date());
  const start = memberChatStart(state, roomId, userId);
  if (start === undefined) throw new Error('참여한 방의 채팅만 열 수 있어요.');

  const blockedIds = new Set(blocks.map((block) => block.blockedId));
  const messages = (state.messages[roomId] ?? []).filter(({ id }) => id > start).map((message) => ({
    ...message, senderNickname: blockedNickname(message.senderNickname, blockedIds.has(message.senderId)),
  }));
  return { room, messages };
}

export function sendMockRoomMessage(roomId: number, sender: { id: number; nickname: string }, body: string) {
  return writeState((state) => {
    const now = new Date();
    const room = findRoom(state, roomId, now);
    if (memberChatStart(state, roomId, sender.id) === undefined) {
      throw new Error('참여한 방에서만 메시지를 보낼 수 있어요.');
    }
    if (!body.trim() || body.length > chatBodyMaxLength) {
      throw new Error(`메시지를 ${chatBodyMaxLength}자 이내로 입력해 주세요.`);
    }

    const messages = state.messages[roomId] ?? [];
    const message: ChatMessageResponse = {
      id: (messages.at(-1)?.id ?? 0) + 1,
      roomId,
      chatThreadId: room.chatThreadId,
      senderId: sender.id,
      senderNickname: sender.nickname,
      senderAvatarUrl: '',
      type: 'TEXT',
      body,
      clientMessageId: null,
      createdAt: new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, -1),
    };
    state.messages[roomId] = [...messages, message];
    return message;
  });
}
