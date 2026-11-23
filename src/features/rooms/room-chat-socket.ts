import { Client, type IFrame } from '@stomp/stompjs';

import { AuthApiError, getApiBaseUrl, type AuthenticatedSession } from '@/features/auth/auth-api';

import type { ChatMessageResponse } from './room-chat-api';

function getErrorStatus(frame: IFrame): number | undefined {
  try {
    return (JSON.parse(frame.body) as { status?: number }).status;
  } catch {
    return undefined;
  }
}

export function subscribeToRoomChat(
  session: AuthenticatedSession,
  roomId: number,
  callbacks: {
    onConnected: () => void;
    onDisconnected: () => void;
    onMessage: (message: ChatMessageResponse) => void;
    onAccessDenied: () => void;
  },
) {
  let stopped = false;
  let client: Client | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let renewalTimer: ReturnType<typeof setTimeout> | undefined;
  let reconnectDelay = 1000;
  let previousAccessToken: string | undefined;

  function stop() {
    stopped = true;
    clearTimeout(reconnectTimer);
    clearTimeout(renewalTimer);
    void client?.deactivate({ force: true });
  }

  function reconnect() {
    if (stopped) return;
    callbacks.onDisconnected();
    reconnectTimer = setTimeout(() => { void connect(); }, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 15000);
  }

  async function connect() {
    try {
      const brokerURL = `${getApiBaseUrl().replace(/^http/i, 'ws')}/ws/chat`;
      const { accessToken, expiresAt } = await session.getSocketCredentials(previousAccessToken);
      if (stopped) return;
      previousAccessToken = undefined;

      const socket = new Client({
        brokerURL,
        connectHeaders: { Authorization: `Bearer ${accessToken}` },
        connectionTimeout: 10000,
        reconnectDelay: 0,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
        discardWebsocketOnCommFailure: true,
        forceBinaryWSFrames: true,
        onConnect: () => {
          if (stopped) return;
          socket.subscribe(`/topic/rooms/${roomId}/messages`, (frame) => {
            if (stopped) return;
            let message: ChatMessageResponse;
            try {
              message = JSON.parse(frame.body) as ChatMessageResponse;
            } catch {
              return;
            }
            if (message?.roomId === roomId && Number.isSafeInteger(message.id)) callbacks.onMessage(message);
          });
          reconnectDelay = 1000;
          callbacks.onConnected();
        },
        onStompError: (frame) => {
          const status = getErrorStatus(frame);
          if (status === 403 || status === 404) {
            stop();
            callbacks.onAccessDenied();
            return;
          }
          if (status === 401) previousAccessToken = accessToken;
          socket.forceDisconnect();
        },
        onWebSocketClose: () => {
          clearTimeout(renewalTimer);
          reconnect();
        },
      });

      client = socket;
      const remaining = expiresAt - Date.now();
      renewalTimer = setTimeout(() => {
        previousAccessToken = accessToken;
        socket.forceDisconnect();
      }, Math.max(0, remaining - Math.min(5000, remaining / 2)));
      socket.activate();
    } catch (error) {
      if (stopped) return;
      if (error instanceof AuthApiError && error.status === 401) {
        stop();
        callbacks.onAccessDenied();
      } else {
        reconnect();
      }
    }
  }

  void connect();
  return stop;
}
