import type { AuthenticatedSession } from '@/features/auth/auth-api';

import { getRoom } from './room-api';

export const chatBodyMaxLength = 2000;

export type ChatMessageResponse = {
  id: number;
  roomId: number;
  chatThreadId: number;
  senderId: number;
  senderNickname: string | null;
  senderAvatarUrl: string;
  type: 'TEXT' | 'IMAGE';
  body: string;
  clientMessageId: string | null;
  createdAt: string;
};

type ChatHistoryResponse = {
  messages: ChatMessageResponse[];
  hasMore: boolean;
  nextBeforeId: number | null;
};

const chatErrors = { 403: '방 참여자만 채팅을 이용할 수 있어요.', 404: '방을 찾을 수 없어요.' };

export function getRoomMessages(session: AuthenticatedSession, roomId: number, beforeId?: number) {
  const query = beforeId === undefined ? '' : `?beforeId=${beforeId}`;
  return session.request<ChatHistoryResponse>(`/api/rooms/${roomId}/messages${query}`, {
    errorMessages: chatErrors,
  });
}

export async function getRoomChat(session: AuthenticatedSession, roomId: number) {
  const [room, history] = await Promise.all([getRoom(session, roomId), getRoomMessages(session, roomId)]);
  return { room, ...history };
}

export function sendRoomMessage(session: AuthenticatedSession, roomId: number, body: string, clientMessageId: string) {
  return session.request<ChatMessageResponse>(`/api/rooms/${roomId}/messages`, {
    json: { body, clientMessageId },
    errorMessages: chatErrors,
  });
}
