import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SocialProvider } from '@/features/auth/mock-session';

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

type StoredRoom = Omit<RoomResponse, 'participantCount'>;
type RoomMember = { userId: number; afterMessageId: number };

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

function writeState<T>(update: (state: RoomState) => T): Promise<T> {
  const write = pendingWrite.then(async () => {
    const state = await readState();
    const result = update(state);
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

export function createMockRoom(userId: number, request: CreateRoomRequest) {
  return writeState((state) => {
    const today = new Date();
    const details = validateRoomRequest(request, today);
    const rooms = roomsWithCounts(state, today);
    const id = rooms.reduce((max, room) => Math.max(max, room.id), state.lastRoomId) + 1;
    const chatThreadId = rooms.reduce((max, room) => Math.max(max, room.chatThreadId), state.lastChatThreadId) + 1;
    const room = { ...details, id, chatThreadId, hostId: userId };
    state.createdRooms.push(room);
    state.members[id] = [{ userId, afterMessageId: 0 }];
    state.lastRoomId = id;
    state.lastChatThreadId = chatThreadId;
    return { ...room, participantCount: 1 };
  });
}

export function joinMockRoom(roomId: number, userId: number) {
  return writeState((state) => {
    const today = new Date();
    const room = findRoom(state, roomId, today);
    if (memberChatStart(state, roomId, userId) !== undefined) return;
    if (room.gameDate < gameDateKey(today)) throw new Error('경기 날짜가 지난 방이에요.');
    if (room.participantCount >= room.capacity) throw new Error('방 정원이 가득 찼어요.');

    const afterMessageId = state.messages[roomId]?.at(-1)?.id ?? 0;
    state.members[roomId] = [...(state.members[roomId] ?? []), { userId, afterMessageId }];
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

export async function loadMockRoomChat(roomId: number, userId: number) {
  const state = await readState();
  const room = findRoom(state, roomId, new Date());
  const start = memberChatStart(state, roomId, userId);
  if (start === undefined) throw new Error('참여한 방의 채팅만 열 수 있어요.');

  return { room, messages: (state.messages[roomId] ?? []).filter(({ id }) => id > start) };
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
