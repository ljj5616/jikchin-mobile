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

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useMockSession } from '@/features/auth/mock-session';
import {
  chatBodyMaxLength,
  leaveMockRoom,
  loadMockRoomChat,
  loadMockRoomDetail,
  mockRoomUserIds,
  sendMockRoomMessage,
  type ChatMessageResponse,
  type RoomParticipant,
} from '@/features/rooms/mock-room-store';
import { formatGameDate } from '@/features/rooms/room-list';
import { useTheme } from '@/hooks/use-theme';

function MessageBubble({ message, own, onPressSender }: { message: ChatMessageResponse; own: boolean; onPressSender: () => void }) {
  const theme = useTheme();

  return (
    <View style={[styles.message, own && styles.ownMessage]}>
      {!own && message.senderId > 0 && (
        <Pressable accessibilityRole="button" accessibilityLabel={`${message.senderNickname ?? '사용자'} 프로필 보기`} onPress={onPressSender}>
          <ThemedText type="smallBold">{message.senderNickname ?? '알 수 없는 사용자'}</ThemedText>
        </Pressable>
      )}
      {!own && message.senderId <= 0 && <ThemedText type="smallBold">탈퇴한 회원</ThemedText>}
      <View style={[styles.bubble, { backgroundColor: own ? '#2554DB' : theme.backgroundElement }]}>
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
  const userId = session && !session.needProfile ? mockRoomUserIds[session.provider] : null;
  const [chat, setChat] = useState<Awaited<ReturnType<typeof loadMockRoomChat>> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [participants, setParticipants] = useState<RoomParticipant[] | null>(null);
  const [creatorId, setCreatorId] = useState<number | null>(null);
  const [participantsError, setParticipantsError] = useState<string | null>(null);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const sending = useRef(false);
  const leaving = useRef(false);
  const participantsRequest = useRef(0);
  const [menuPosition] = useState(() => new Animated.Value(400));
  const messageList = useRef<FlatList<ChatMessageResponse>>(null);

  useFocusEffect(useCallback(() => {
    if (userId === null) return;
    let active = true;

    loadMockRoomChat(roomId, userId).then((result) => {
      if (!active) return;
      setChat(result);
      setLoadError(null);
    }).catch((error) => {
      if (!active) return;
      setChat(null);
      setLoadError(error instanceof Error ? error.message : '채팅방을 불러오지 못했어요.');
    });

    return () => { active = false; participantsRequest.current += 1; };
  }, [roomId, userId]));

  async function loadParticipants() {
    if (userId === null) return;
    const request = ++participantsRequest.current;
    setParticipants(null);
    setParticipantsError(null);
    try {
      const result = await loadMockRoomDetail(roomId, userId);
      if (request === participantsRequest.current) { setParticipants(result.participants); setCreatorId(result.creatorId); }
    } catch {
      if (request === participantsRequest.current) setParticipantsError('참여자를 불러오지 못했어요.');
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
    if (!session || session.needProfile || userId === null || !chat || !body.trim() || sending.current || leaving.current) return;
    sending.current = true;
    setIsSending(true);
    setSendError(null);

    try {
      const message = await sendMockRoomMessage(roomId, { id: userId, nickname: session.profile.nickname }, body);
      setChat((current) => current ? { ...current, messages: [...current.messages, message] } : current);
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
    if (userId === null || leaving.current || sending.current) return;
    leaving.current = true;
    setIsLeaving(true);
    setLeaveError(null);

    try {
      await leaveMockRoom(roomId, userId);
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

  const canSend = !isSending && body.trim().length > 0;
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
        <View style={[styles.header, { borderColor: theme.backgroundSelected }]}>
          <View style={styles.toolbar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="뒤로 가기"
              onPress={() => router.canGoBack() ? router.back() : router.replace('/home')}
              style={styles.headerAction}>
              <ThemedText style={styles.backIcon}>‹</ThemedText>
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
                <View style={styles.menuIcon}>
                  <View style={[styles.menuLine, { backgroundColor: theme.text }]} />
                  <View style={[styles.menuLine, { backgroundColor: theme.text }]} />
                  <View style={[styles.menuLine, { backgroundColor: theme.text }]} />
                </View>
              </Pressable>
            )}
            {!chat && <View style={styles.headerAction} />}
          </View>
          {chat && (
            <>
              <ThemedText type="small">{chat.room.homeTeam} vs {chat.room.awayTeam}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatGameDate(chat.room.gameDate)} · {chat.room.stadium} · {chat.room.participantCount}/{chat.room.capacity}명
              </ThemedText>
            </>
          )}
        </View>

        {chat ? (
          <>
            <FlatList
              ref={messageList}
              data={chat.messages}
              keyExtractor={(message) => String(message.id)}
              renderItem={({ item }) => <MessageBubble message={item} own={item.senderId === userId}
                onPressSender={() => router.push({ pathname: '/user-profile/[userId]', params: { userId: item.senderId } })} />}
              contentContainerStyle={styles.messages}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => messageList.current?.scrollToEnd({ animated: false })}
              ListEmptyComponent={
                <ThemedText themeColor="textSecondary" style={styles.empty}>
                  첫 인사를 남겨보세요.
                </ThemedText>
              }
            />
            <View style={[styles.composer, { borderColor: theme.backgroundSelected }]}>
              {sendError && <ThemedText type="small" accessibilityRole="alert">{sendError}</ThemedText>}
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
                  onPress={sendMessage}
                  disabled={!canSend}
                  style={[styles.send, !canSend && styles.disabled]}>
                  <ThemedText type="smallBold" style={styles.lightText}>보내기</ThemedText>
                </Pressable>
              </View>
            </View>
          </>
        ) : (
          <ThemedText accessibilityLiveRegion="polite" themeColor="textSecondary" style={styles.empty}>
            {loadError ?? '채팅방을 불러오는 중이에요.'}
          </ThemedText>
        )}
      </KeyboardAvoidingView>

      <Modal visible={showMenu} transparent animationType="none" onRequestClose={showLeaveDialog ? cancelLeave : closeMenu}>
        <View style={styles.menuOverlay} accessibilityViewIsModal>
          <Pressable accessibilityRole="button" accessibilityLabel="메뉴 닫기" onPress={closeMenu} style={StyleSheet.absoluteFill} />
          <Animated.View style={[styles.drawer, { backgroundColor: theme.background, transform: [{ translateX: menuPosition }] }]}>
            <SafeAreaView style={styles.drawerSafe}>
              <View style={styles.drawerHeader}>
                <View style={styles.drawerTitle}>
                  <ThemedText type="small" themeColor="textSecondary">채팅방</ThemedText>
                  <ThemedText accessibilityRole="header" style={styles.drawerRoomTitle} numberOfLines={2}>{chat?.room.title}</ThemedText>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="메뉴 닫기" onPress={closeMenu} style={styles.closeButton}>
                  <ThemedText style={styles.closeIcon}>×</ThemedText>
                </Pressable>
              </View>
              <View style={styles.participantsHeading}>
                <ThemedText accessibilityRole="header" type="smallBold">참여자</ThemedText>
                <ThemedText type="smallBold" themeColor="textSecondary">{participants?.length ?? chat?.room.participantCount ?? 0}명</ThemedText>
              </View>
              <FlatList
                data={participants ?? []}
                keyExtractor={(participant) => String(participant.userId)}
                style={styles.participantList}
                renderItem={({ item }) => (
                  <Pressable accessibilityRole="button" accessibilityLabel={`${item.nickname ?? '사용자'} 프로필 보기`}
                    onPress={() => { closeMenu(); router.push({ pathname: '/user-profile/[userId]', params: { userId: item.userId } }); }}
                    style={styles.participantRow}>
                    <View style={styles.avatar}>
                      {item.avatarUrl ? <Image source={item.avatarUrl} style={styles.avatarImage} contentFit="cover" /> : (
                        <ThemedText style={styles.avatarText}>{(item.nickname ?? '?').slice(0, 1)}</ThemedText>
                      )}
                    </View>
                    <ThemedText style={styles.participantName} numberOfLines={1}>{item.nickname ?? '알 수 없는 사용자'}</ThemedText>
                    {item.userId === userId && <ThemedText type="small" themeColor="textSecondary">나</ThemedText>}
                    {item.host && <View style={styles.hostBadge}><ThemedText type="smallBold" style={styles.hostText}>방장</ThemedText></View>}
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
              <View style={[styles.drawerActions, { borderColor: theme.backgroundSelected }]}>
                <Pressable accessibilityRole="button" onPress={openLeaveDialog} disabled={isSending || isLeaving}
                  style={[styles.drawerAction, (isSending || isLeaving) && styles.disabled]}>
                  <ThemedText type="smallBold" style={styles.leaveText}>방 나가기</ThemedText>
                </Pressable>
                {creatorId !== null && creatorId !== userId && <Pressable accessibilityRole="button" onPress={() => {
                  closeMenu();
                  router.push({ pathname: '/report', params: { targetType: 'ROOM', targetId: roomId } });
                }} style={styles.drawerAction}>
                  <ThemedText type="smallBold">방 신고</ThemedText>
                </Pressable>}
              </View>
            </SafeAreaView>
          </Animated.View>
          {showLeaveDialog && (
            <View style={styles.overlay}>
              <View style={[styles.dialog, { backgroundColor: theme.background }]}>
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
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    gap: Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  headerAction: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  toolbarTitle: { flex: 1, minWidth: 0, fontSize: 20, lineHeight: 28, fontWeight: '700' },
  backIcon: { fontSize: 38, lineHeight: 44, fontWeight: '400' },
  menuIcon: { width: 23, gap: 5 },
  menuLine: { height: 2, borderRadius: 1 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  messages: { flexGrow: 1, padding: Spacing.four, gap: Spacing.three },
  message: { alignSelf: 'flex-start', alignItems: 'flex-start', maxWidth: '88%', gap: Spacing.one },
  ownMessage: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubble: { borderRadius: 16, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
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
    borderRadius: 12,
    fontSize: 16,
  },
  send: {
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#2554DB',
  },
  disabled: { opacity: 0.5 },
  menuOverlay: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  drawer: { width: '85%', maxWidth: 360, height: '100%' },
  drawerSafe: { flex: 1, paddingHorizontal: Spacing.four },
  drawerHeader: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: Spacing.three, paddingBottom: Spacing.four, gap: Spacing.two },
  drawerTitle: { flex: 1, gap: Spacing.one },
  drawerRoomTitle: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  closeIcon: { fontSize: 30, lineHeight: 36 },
  participantsHeading: { flexDirection: 'row', gap: Spacing.two, paddingTop: Spacing.four, paddingBottom: Spacing.two },
  participantList: { flex: 1 },
  participantRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  participantName: { flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E6EDFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: '#2554DB', fontWeight: '700' },
  hostBadge: { borderRadius: 8, backgroundColor: '#E6EDFF', paddingHorizontal: Spacing.two, paddingVertical: Spacing.half },
  hostText: { color: '#2554DB' },
  participantsMessage: { paddingVertical: Spacing.three },
  retryButton: { minHeight: 44, justifyContent: 'center' },
  drawerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.four, borderTopWidth: StyleSheet.hairlineWidth },
  drawerAction: { minHeight: 56, justifyContent: 'center' },
  leaveText: { color: '#A82119' },
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
  confirmLeave: { backgroundColor: '#A82119' },
});
