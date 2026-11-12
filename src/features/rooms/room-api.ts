import { AuthApiError, request } from '@/features/auth/auth-api';

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

export function listRooms(token: string) {
  return request<RoomResponse[]>(roomsPath, { token });
}

export function listJoinedRooms(token: string) {
  return request<RoomResponse[]>(`${roomsPath}/mine`, { token });
}

export function createRoom(token: string, room: CreateRoomRequest) {
  return request<RoomResponse>(roomsPath, {
    token,
    json: room,
    errorMessages: { 400: '경기 날짜, 팀과 모집 정원을 다시 확인해 주세요.' },
  });
}

export function getRoom(token: string, roomId: number) {
  return request<RoomResponse>(`${roomsPath}/${roomId}`, { token, errorMessages: roomErrors });
}

export function listRoomParticipants(token: string, roomId: number) {
  return request<RoomParticipant[]>(`${roomsPath}/${roomId}/participants`, { token, errorMessages: roomErrors });
}

export async function getRoomDetail(token: string, roomId: number) {
  const [room, participants] = await Promise.all([getRoom(token, roomId), listRoomParticipants(token, roomId)]);
  return { room, participants };
}

export function joinRoom(token: string, roomId: number) {
  return request<RoomResponse>(`${roomsPath}/${roomId}/participants`, {
    token,
    method: 'POST',
    errorMessages: {
      ...roomErrors,
      403: '차단 관계 또는 계정 상태로 인해 이 방에 참여할 수 없어요.',
      409: '방 정원이 가득 찼거나 경기 날짜가 지났어요.',
    },
  });
}

export async function leaveRoom(token: string, roomId: number) {
  try {
    await request<void>(`${roomsPath}/${roomId}/participants/me`, { token, method: 'DELETE' });
  } catch (error) {
    // A retry after the last participant leaves can find that the room has already been deleted.
    if (!(error instanceof AuthApiError) || error.status !== 404) throw error;
  }
}
