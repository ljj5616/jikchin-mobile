import { uuid } from 'expo';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon, Badge } from '@/components/jikchin-ui';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useMockSession } from '@/features/auth/mock-session';
import { MatchCard } from '@/features/rooms/match-card';
import {
  chatBodyMaxLength,
  getRoomChat,
  getRoomMessages,
  sendRoomMessage,
  type ChatMessageResponse,
} from '@/features/rooms/room-chat-api';
import { getRoomDetail, leaveRoom as leaveRoomRequest, type RoomParticipant } from '@/features/rooms/room-api';
import { formatGameDate } from '@/features/rooms/room-list';
import { useTheme } from '@/hooks/use-theme';

function MessageBubble({ message, own, onPressSender }: { message: ChatMessageResponse; own: boolean; onPressSender: () => void }) {
  const theme = useTheme();

  return (
    <View style={[styles.message, own && styles.ownMessage]}>
      {!own && message.senderId > 0 && (
        <Pressable accessibilityRole="button" accessibilityLabel={`${message.senderNickname ?? '사용자'} 프로필 보기`} onPress={onPressSender} style={styles.sender}>
          <View style={[styles.senderAvatar, { backgroundColor: theme.backgroundSelected }]}>
            {message.senderAvatarUrl
              ? <Image source={message.senderAvatarUrl} style={styles.avatarImage} contentFit="cover" />
              : <ThemedText type="smallBold" themeColor="accentText">{(message.senderNickname ?? '?').slice(0, 1)}</ThemedText>}
          </View>
          <ThemedText type="smallBold" style={styles.senderName}>{message.senderNickname ?? '알 수 없는 사용자'}</ThemedText>
        </Pressable>
      )}
      {!own && message.senderId <= 0 && <ThemedText type="smallBold">탈퇴한 회원</ThemedText>}
      <View style={[styles.bubble, own && styles.ownBubble, { backgroundColor: own ? Brand.deepBlue : theme.surface, borderColor: own ? Brand.deepBlue : theme.border }]}>
        <ThemedText style={own && styles.lightText}>{message.body}</ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">{message.createdAt.slice(11, 16)}</ThemedText>
    </View>
  );
}

export default function RoomChatScreen() {
  const theme = useTheme();
  const { roomId: roomParam } = useLocalSearchParams<{ roomId: string }>();
  const roomId = Number(roomParam);
  const { session } = useMockSession();
  const apiSession = session && !session.needProfile ? session.apiSession : null;
  const userId = session && !session.needProfile ? session.userId : null;
  const [chat, setChat] = useState<Awaited<ReturnType<typeof getRoomChat>> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [participants, setParticipants] = useState<RoomParticipant[] | null>(null);
  const [participantsError, setParticipantsError] = useState<string | null>(null);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const sending = useRef(false);
  const pendingMessage = useRef<{ body: string; id: string } | null>(null);
  const leaving = useRef(false);
  const chatRequest = useRef(0);
  const loadingOlder = useRef(false);
  const participantsRequest = useRef(0);
  const [menuPosition] = useState(() => new Animated.Value(400));

  const loadChat = useCallback(async () => {
    const request = ++chatRequest.current;
    setChat(null);
    setLoadError(null);
    setHistoryError(null);
    if (!apiSession || !Number.isSafeInteger(roomId) || roomId <= 0) {
      setLoadError('방을 찾을 수 없어요.');
      return;
    }
    try {
      const result = await getRoomChat(apiSession, roomId);
      if (chatRequest.current === request) setChat({ ...result, messages: result.messages.reverse() });
    } catch (error) {
      if (chatRequest.current === request) {
        setChat(null);
        setLoadError(error instanceof Error ? error.message : '채팅방을 불러오지 못했어요.');
      }
    }
  }, [roomId, apiSession]);

  useFocusEffect(useCallback(() => {
    void loadChat();
    return () => { chatRequest.current += 1; participantsRequest.current += 1; };
  }, [loadChat]));

  async function loadOlderMessages() {
    if (!apiSession || !chat?.hasMore || chat.nextBeforeId === null || loadingOlder.current) return;
    const request = chatRequest.current;
    loadingOlder.current = true;
    setIsLoadingOlder(true);
    setHistoryError(null);
    try {
      const page = await getRoomMessages(apiSession, roomId, chat.nextBeforeId);
      if (chatRequest.current === request) {
        const older = page.messages.reverse();
        setChat((current) => current ? { ...current, ...page, messages: [...current.messages, ...older] } : current);
      }
    } catch (error) {
      if (chatRequest.current === request) setHistoryError(error instanceof Error ? error.message : '이전 메시지를 불러오지 못했어요.');
    } finally {
      loadingOlder.current = false;
      setIsLoadingOlder(false);
    }
  }

  async function loadParticipants() {
    if (!apiSession) return;
    const request = ++participantsRequest.current;
    setParticipants(null);
    setParticipantsError(null);
    try {
      const result = await getRoomDetail(apiSession, roomId);
      if (request === participantsRequest.current) {
        setParticipants(result.participants);
        setChat((current) => current ? { ...current, room: result.room } : current);
      }
    } catch (error) {
      if (request === participantsRequest.current) setParticipantsError(error instanceof Error ? error.message : '참여자를 불러오지 못했어요.');
    }
  }

  function openMenu() {
    Keyboard.dismiss();
    setShowMenu(true);
    menuPosition.setValue(400);
    Animated.timing(menuPosition, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    void loadParticipants();
  }

  function closeMenu() {
    if (leaving.current) return;
    participantsRequest.current += 1;
    setShowLeaveDialog(false);
    setShowMenu(false);
  }

  async function sendMessage() {
    const text = body.trim();
    if (!apiSession || !chat || !text || sending.current || leaving.current) return;
    sending.current = true;
    setIsSending(true);
    setSendError(null);

    try {
      const draft = pendingMessage.current?.body === text ? pendingMessage.current : { body: text, id: uuid.v4() };
      pendingMessage.current = draft;
      const message = await sendRoomMessage(apiSession, roomId, draft.body, draft.id);
      setChat((current) => {
        if (!current || current.messages.some((item) => item.id === message.id)) return current;
        return { ...current, messages: [message, ...current.messages].sort((a, b) => b.id - a.id) };
      });
      pendingMessage.current = null;
      setBody('');
    } catch (error) {
      setSendError(error instanceof Error ? error.message : '메시지를 보내지 못했어요.');
    } finally {
      sending.current = false;
      setIsSending(false);
    }
  }

  function openLeaveDialog() {
    Keyboard.dismiss();
    setLeaveError(null);
    setShowLeaveDialog(true);
  }

  function cancelLeave() {
    if (!leaving.current) setShowLeaveDialog(false);
  }

  async function leaveRoom() {
    if (!apiSession || leaving.current || sending.current) return;
    leaving.current = true;
    setIsLeaving(true);
    setLeaveError(null);

    try {
      await leaveRoomRequest(apiSession, roomId);
      chatRequest.current += 1;
      participantsRequest.current += 1;
      setShowLeaveDialog(false);
      setShowMenu(false);
      setChat(null);
      router.dismissTo('/home');
    } catch (error) {
      setLeaveError(error instanceof Error ? error.message : '방에서 나가지 못했어요.');
    } finally {
      leaving.current = false;
      setIsLeaving(false);
    }
  }

  const canSend = !isSending && !isLeaving && body.trim().length > 0;
  let leaveDescription = '다시 참여하면 그때부터 새 메시지를 볼 수 있어요.';
  if (chat?.room.participantCount === 1) {
    leaveDescription = '마지막 참여자가 나가면 이 방과 대화가 삭제돼요.';
  } else if (chat?.room.hostId === userId) {
    leaveDescription = '남아 있는 참여자에게 방장이 자동으로 넘어가요.';
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar style="auto" />
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { borderColor: theme.border }]}>
          <View style={styles.toolbar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="뒤로 가기"
              onPress={() => router.canGoBack() ? router.back() : router.replace('/home')}
              style={styles.headerAction}>
              <AppIcon name="back" size={24} />
            </Pressable>
            <ThemedText accessibilityRole="header" style={styles.toolbarTitle} numberOfLines={1}>
              {chat?.room.title ?? '방 채팅'}
            </ThemedText>
            {chat && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="채팅방 메뉴 열기"
                onPress={openMenu}
                style={styles.headerAction}>
                <AppIcon name="more" size={24} />
              </Pressable>
            )}
            {!chat && <View style={styles.headerAction} />}
          </View>
          {chat && (
            <Pressable accessibilityRole="button" accessibilityLabel="경기와 참여자 정보 보기" onPress={openMenu}
              style={[styles.matchPreview, { backgroundColor: theme.backgroundElement }]}>
              <AppIcon name="stadium" color={theme.accentText} size={22} />
              <View style={styles.matchText}>
                <ThemedText type="smallBold" numberOfLines={2}>{chat.room.homeTeam} vs {chat.room.awayTeam}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                  {formatGameDate(chat.room.gameDate)} · {chat.room.stadium}
                </ThemedText>
              </View>
              <AppIcon name="chevron" size={18} color={theme.accentText} />
            </Pressable>
          )}
        </View>

        {chat ? (
          <>
            <FlatList
              data={chat.messages}
              inverted
              keyExtractor={(message) => String(message.id)}
              renderItem={({ item }) => <MessageBubble message={item} own={item.senderId === userId}
                onPressSender={() => router.push({ pathname: '/user-profile/[userId]', params: { userId: item.senderId } })} />}
              contentContainerStyle={styles.messages}
              keyboardShouldPersistTaps="handled"
              ListFooterComponent={chat.hasMore ? (
                <View style={styles.participantsMessage}>
                  {historyError && <ThemedText accessibilityRole="alert" type="small">{historyError}</ThemedText>}
                  <Pressable accessibilityRole="button" disabled={isLoadingOlder} onPress={loadOlderMessages} style={styles.retryButton}>
                    <ThemedText type="smallBold">{isLoadingOlder ? '불러오는 중' : '이전 메시지 더 보기'}</ThemedText>
                  </Pressable>
                </View>
              ) : undefined}
              ListEmptyComponent={
                <ThemedText themeColor="textSecondary" style={styles.empty}>
                  첫 인사를 남겨보세요.
                </ThemedText>
              }
            />
            <View style={[styles.composer, { borderColor: theme.border, backgroundColor: theme.surface }]}>
              {sendError && <ThemedText type="small" accessibilityRole="alert" themeColor="danger">{sendError}</ThemedText>}
              <View style={styles.composerRow}>
                <TextInput
                  accessibilityLabel="채팅 메시지"
                  value={body}
                  onChangeText={setBody}
                  multiline
                  editable={!isSending}
                  maxLength={chatBodyMaxLength}
                  placeholder="메시지를 입력해 주세요"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="메시지 보내기"
                  onPress={sendMessage}
                  disabled={!canSend}
                  style={[styles.send, { backgroundColor: theme.accent }, !canSend && styles.disabled]}>
                  <AppIcon name="send" color={Brand.white} size={22} />
                </Pressable>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.empty}>
            <ThemedText accessibilityLiveRegion="polite" themeColor="textSecondary">
              {loadError ?? '채팅방을 불러오는 중이에요.'}
            </ThemedText>
            {loadError && (
              <Pressable accessibilityRole="button" onPress={loadChat} style={styles.retryButton}>
                <ThemedText type="smallBold">다시 시도</ThemedText>
              </Pressable>
            )}
          </View>
        )}
      </KeyboardAvoidingView>

      <Modal visible={showMenu} transparent animationType="none" onRequestClose={showLeaveDialog ? cancelLeave : closeMenu}>
        <View style={styles.menuOverlay} accessibilityViewIsModal>
          <Pressable accessibilityRole="button" accessibilityLabel="메뉴 닫기" onPress={closeMenu} style={StyleSheet.absoluteFill} />
          <Animated.View style={[styles.drawer, { backgroundColor: theme.surface, transform: [{ translateX: menuPosition }] }]}>
            <SafeAreaView style={styles.drawerSafe}>
              <View style={styles.drawerHeader}>
                <View style={styles.drawerTitle}>
                  <ThemedText type="small" themeColor="textSecondary">채팅방</ThemedText>
                  <ThemedText accessibilityRole="header" style={styles.drawerRoomTitle} numberOfLines={2}>{chat?.room.title}</ThemedText>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="메뉴 닫기" onPress={closeMenu} style={styles.closeButton}>
                  <AppIcon name="close" size={24} />
                </Pressable>
              </View>
              <FlatList
                data={participants ?? []}
                keyExtractor={(participant) => String(participant.userId)}
                style={styles.participantList}
                ListHeaderComponent={
                  <>
                    {chat && <MatchCard room={chat.room} />}
                    <View style={styles.participantsHeading}>
                      <ThemedText accessibilityRole="header" style={styles.drawerRoomTitle}>참여자</ThemedText>
                      {chat && <Badge label={`${participants?.length ?? chat.room.participantCount}/${chat.room.capacity}명`} />}
                    </View>
                  </>
                }
                renderItem={({ item }) => (
                  <Pressable accessibilityRole="button" accessibilityLabel={`${item.nickname ?? '사용자'} 프로필 보기`}
                    onPress={() => { closeMenu(); router.push({ pathname: '/user-profile/[userId]', params: { userId: item.userId } }); }}
                    style={[styles.participantRow, { backgroundColor: theme.backgroundElement }]}>
                    <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
                      {item.avatarUrl ? <Image source={item.avatarUrl} style={styles.avatarImage} contentFit="cover" /> : (
                        <ThemedText type="smallBold" themeColor="accentText">{(item.nickname ?? '?').slice(0, 1)}</ThemedText>
                      )}
                    </View>
                    <ThemedText style={styles.participantName} numberOfLines={1}>{item.nickname ?? '알 수 없는 사용자'}</ThemedText>
                    {item.userId === userId && <ThemedText type="small" themeColor="textSecondary">나</ThemedText>}
                    {item.host && <Badge label="방장" />}
                  </Pressable>
                )}
                ListEmptyComponent={participantsError ? (
                  <View style={styles.participantsMessage}>
                    <ThemedText accessibilityRole="alert" type="small" themeColor="textSecondary">{participantsError}</ThemedText>
                    <Pressable accessibilityRole="button" onPress={loadParticipants} style={styles.retryButton}><ThemedText type="smallBold">다시 시도</ThemedText></Pressable>
                  </View>
                ) : (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.participantsMessage}>
                    {participants === null ? '참여자를 불러오는 중이에요.' : '참여자가 없어요.'}
                  </ThemedText>
                )}
              />
              <View style={[styles.drawerActions, { borderColor: theme.border }]}>
                <Pressable accessibilityRole="button" disabled={isSending || isLeaving} onPress={() => {
                  closeMenu();
                  void loadChat();
                }} style={styles.drawerAction}>
                  <AppIcon name="refresh" color={theme.accentText} />
                  <ThemedText type="smallBold" style={styles.drawerActionLabel}>새로고침</ThemedText>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={openLeaveDialog} disabled={isSending || isLeaving}
                  style={[styles.drawerAction, (isSending || isLeaving) && styles.disabled]}>
                  <AppIcon name="back" color={theme.danger} />
                  <ThemedText type="smallBold" themeColor="danger" style={styles.drawerActionLabel}>방 나가기</ThemedText>
                </Pressable>
                <Pressable accessibilityRole="button" disabled={isSending || isLeaving} onPress={() => {
                  closeMenu();
                  router.push({ pathname: '/report', params: { targetType: 'ROOM', targetId: roomId } });
                }} style={styles.drawerAction}>
                  <AppIcon name="flag" color={theme.textSecondary} />
                  <ThemedText type="smallBold" style={styles.drawerActionLabel}>방 신고</ThemedText>
                </Pressable>
              </View>
            </SafeAreaView>
          </Animated.View>
          {showLeaveDialog && (
            <View style={styles.overlay}>
              <View style={[styles.dialog, { backgroundColor: theme.surface }]}>
                <ThemedText accessibilityRole="header" style={styles.title}>방에서 나갈까요?</ThemedText>
                <ThemedText themeColor="textSecondary">{leaveDescription}</ThemedText>
                {leaveError && <ThemedText type="small" accessibilityRole="alert">{leaveError}</ThemedText>}
                <View style={styles.dialogActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={cancelLeave}
                    disabled={isLeaving}
                    style={[styles.dialogButton, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText type="smallBold">취소</ThemedText>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={leaveRoom}
                    disabled={isLeaving}
                    style={[styles.dialogButton, styles.confirmLeave, isLeaving && styles.disabled]}>
                    <ThemedText type="smallBold" style={styles.lightText}>
                      {isLeaving ? '나가는 중' : '나가기'}
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center' },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  headerAction: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  toolbarTitle: { flex: 1, minWidth: 0, fontSize: 18, lineHeight: 26, fontWeight: '800' },
  matchPreview: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12 },
  matchText: { flex: 1, minWidth: 0 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  messages: { flexGrow: 1, padding: 18, gap: Spacing.three },
  message: { alignSelf: 'flex-start', alignItems: 'flex-start', maxWidth: '88%', gap: Spacing.one },
  ownMessage: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  sender: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7 },
  senderName: { flexShrink: 1 },
  senderAvatar: { width: 30, height: 30, borderRadius: 15, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  bubble: { borderWidth: 1, borderRadius: 16, borderTopLeftRadius: 5, paddingHorizontal: 14, paddingVertical: 9 },
  ownBubble: { borderTopLeftRadius: 16, borderTopRightRadius: 5 },
  lightText: { color: '#FFFFFF' },
  empty: { padding: Spacing.four, textAlign: 'center' },
  composer: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    maxHeight: 120,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 24,
    fontSize: 16,
  },
  send: {
    width: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  disabled: { opacity: 0.5 },
  menuOverlay: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  drawer: { width: '85%', maxWidth: 360, height: '100%' },
  drawerSafe: { flex: 1, paddingHorizontal: Spacing.four },
  drawerHeader: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: Spacing.three, paddingBottom: Spacing.four, gap: Spacing.two },
  drawerTitle: { flex: 1, gap: Spacing.one },
  drawerRoomTitle: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  participantsHeading: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two, paddingTop: Spacing.four, paddingBottom: Spacing.two },
  participantList: { flex: 1 },
  participantRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: 8, marginBottom: 6, borderRadius: 12 },
  participantName: { flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  participantsMessage: { paddingVertical: Spacing.three },
  retryButton: { minHeight: 44, justifyContent: 'center' },
  drawerActions: { flexDirection: 'row', gap: 4, borderTopWidth: StyleSheet.hairlineWidth },
  drawerAction: { flex: 1, minHeight: 60, alignItems: 'center', justifyContent: 'center', gap: 3 },
  drawerActionLabel: { textAlign: 'center', fontSize: 12, lineHeight: 17 },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  dialog: { width: '100%', maxWidth: 360, gap: Spacing.three, padding: Spacing.four, borderRadius: 16 },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two, flexWrap: 'wrap' },
  dialogButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 10,
  },
  confirmLeave: { backgroundColor: Brand.red },
});
