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

export function getRoomMessages(session: AuthenticatedSession, roomId: number, beforeId?: number, signal?: AbortSignal) {
  const query = beforeId === undefined ? '' : `?beforeId=${beforeId}`;
  return session.request<ChatHistoryResponse>(`/api/rooms/${roomId}/messages${query}`, {
    errorMessages: chatErrors,
    signal,
  });
}

async function getRoomChat(session: AuthenticatedSession, roomId: number, signal: AbortSignal) {
  const [room, history] = await Promise.all([getRoom(session, roomId, signal), getRoomMessages(session, roomId, undefined, signal)]);
  return { room, ...history };
}

export async function syncRoomChat(session: AuthenticatedSession, roomId: number, lastSyncedId: number | null, signal: AbortSignal) {
  const latest = await getRoomChat(session, roomId, signal);
  const latestId = latest.messages.at(-1)?.id ?? 0;
  const messages = [...latest.messages];
  let page: ChatHistoryResponse = latest;
  // Follow the existing history cursor until the new pages overlap the last REST snapshot.
  while (lastSyncedId !== null && page.hasMore && page.nextBeforeId !== null && page.nextBeforeId > lastSyncedId) {
    page = await getRoomMessages(session, roomId, page.nextBeforeId, signal);
    for (const message of page.messages) messages.push(message);
  }
  return { room: latest.room, latestId, messages, hasMore: page.hasMore, nextBeforeId: page.nextBeforeId };
}

export function mergeChatMessages(current: ChatMessageResponse[], incoming: ChatMessageResponse[]) {
  const messages = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) messages.set(message.id, message);
  return [...messages.values()].sort((first, second) => second.id - first.id);
}

export function mergeChatHistory(current: ChatHistoryResponse, incoming: ChatHistoryResponse): ChatHistoryResponse {
  const older = !incoming.hasMore || (current.hasMore &&
    (incoming.nextBeforeId ?? 0) < (current.nextBeforeId ?? 0)) ? incoming : current;
  return {
    hasMore: older.hasMore,
    nextBeforeId: older.nextBeforeId,
    messages: mergeChatMessages(current.messages, incoming.messages),
  };
}

export function sendRoomMessage(session: AuthenticatedSession, roomId: number, body: string, clientMessageId: string) {
  return session.request<ChatMessageResponse>(`/api/rooms/${roomId}/messages`, {
    json: { body, clientMessageId },
    errorMessages: chatErrors,
  });
}
