import { AuthApiError, type AuthenticatedSession } from '@/features/auth/auth-api';

import type { CreateRoomRequest } from './create-room';
import type { RoomResponse } from './room-list';

export type RoomParticipant = {
  userId: number;
  nickname: string | null;
  avatarUrl: string;
  host: boolean;
  joinedAt: string;
};

const roomsPath = '/api/rooms';
const roomNotFound = '방을 찾을 수 없어요.';
const roomErrors = { 404: roomNotFound };

export function listRooms(session: AuthenticatedSession) {
  return session.request<RoomResponse[]>(roomsPath);
}

export function listJoinedRooms(session: AuthenticatedSession) {
  return session.request<RoomResponse[]>(`${roomsPath}/mine`);
}

export function createRoom(session: AuthenticatedSession, room: CreateRoomRequest) {
  return session.request<RoomResponse>(roomsPath, {
    json: room,
    errorMessages: { 400: '경기 날짜, 팀과 모집 정원을 다시 확인해 주세요.' },
  });
}

export function getRoom(session: AuthenticatedSession, roomId: number) {
  return session.request<RoomResponse>(`${roomsPath}/${roomId}`, { errorMessages: roomErrors });
}

export function listRoomParticipants(session: AuthenticatedSession, roomId: number) {
  return session.request<RoomParticipant[]>(`${roomsPath}/${roomId}/participants`, { errorMessages: roomErrors });
}

export async function getRoomDetail(session: AuthenticatedSession, roomId: number) {
  const [room, participants] = await Promise.all([getRoom(session, roomId), listRoomParticipants(session, roomId)]);
  return { room, participants };
}

export function joinRoom(session: AuthenticatedSession, roomId: number) {
  return session.request<RoomResponse>(`${roomsPath}/${roomId}/participants`, {
    method: 'POST',
    errorMessages: {
      ...roomErrors,
      403: '차단 관계 또는 계정 상태로 인해 이 방에 참여할 수 없어요.',
      409: '방 정원이 가득 찼거나 경기 날짜가 지났어요.',
    },
  });
}

export async function leaveRoom(session: AuthenticatedSession, roomId: number) {
  try {
    await session.request<void>(`${roomsPath}/${roomId}/participants/me`, { method: 'DELETE' });
  } catch (error) {
    // A retry after the last participant leaves can find that the room has already been deleted.
    if (!(error instanceof AuthApiError) || error.status !== 404) throw error;
  }
}
