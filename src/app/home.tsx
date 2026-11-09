import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useMockSession } from '@/features/auth/mock-session';
import { getMockRooms } from '@/features/rooms/mock-rooms';
import { formatGameDate, listRecruitingRooms, type RoomResponse } from '@/features/rooms/room-list';
import { useTheme } from '@/hooks/use-theme';

function RoomCard({ room }: { room: RoomResponse }) {
  const theme = useTheme();

  return (
    <View
      style={[styles.card, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
      <View style={styles.cardRow}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {formatGameDate(room.gameDate)}
        </ThemedText>
        <View style={styles.vacancyBadge}>
          <ThemedText type="smallBold" style={styles.vacancyText}>
            {room.capacity - room.participantCount}자리 남음
          </ThemedText>
        </View>
      </View>

      <View style={styles.match}>
        <ThemedText accessibilityRole="header" style={styles.roomTitle}>{room.title}</ThemedText>
        <ThemedText type="small">{room.homeTeam} vs {room.awayTeam}</ThemedText>
      </View>

      <View style={[styles.cardRow, styles.cardFooter, { borderColor: theme.backgroundSelected }]}>
        <ThemedText type="small" themeColor="textSecondary">{room.stadium}</ThemedText>
        <ThemedText type="smallBold">{room.participantCount}/{room.capacity}명 참여</ThemedText>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const theme = useTheme();
  const { session, signOut } = useMockSession();
  if (!session || session.needProfile) return null;

  const today = new Date();
  const rooms = listRecruitingRooms(getMockRooms(today), today);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.backgroundElement }]}>
      <StatusBar style="auto" />
      <FlatList
        data={rooms}
        keyExtractor={(room) => String(room.id)}
        renderItem={({ item }) => <RoomCard room={item} />}
        style={styles.list}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.toolbar}>
              <ThemedText type="smallBold">직관친구</ThemedText>
              <View style={styles.account}>
                {session.avatarUri && (
                  <Image
                    source={session.avatarUri}
                    accessibilityLabel={`${session.profile.nickname}님의 프로필 사진`}
                    style={styles.photo}
                    contentFit="cover"
                  />
                )}
                <Pressable
                  accessibilityRole="button"
                  onPress={signOut}
                  style={[styles.button, { backgroundColor: theme.background }]}>
                  <ThemedText type="smallBold">로그아웃</ThemedText>
                </Pressable>
              </View>
            </View>

            <View style={styles.intro}>
              <ThemedText accessibilityRole="header" type="subtitle" style={styles.title}>
                직관방
              </ThemedText>
              <ThemedText themeColor="textSecondary">같이 볼 경기를 찾아보세요.</ThemedText>
            </View>

            <View style={styles.cardRow}>
              <ThemedText accessibilityRole="header" type="smallBold">
                모집 중인 방 {rooms.length}개
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">예시 데이터</ThemedText>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View
            style={[styles.card, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
            <ThemedText themeColor="textSecondary">지금 모집 중인 방이 없어요.</ThemedText>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: 520 },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.five,
  },
  header: { gap: Spacing.four, marginBottom: Spacing.two },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  account: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  photo: { width: 32, height: 32, borderRadius: 16 },
  button: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 12,
  },
  intro: { gap: Spacing.one },
  title: { fontWeight: '700' },
  separator: { height: Spacing.two + Spacing.one },
  card: {
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
  },
  cardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  vacancyBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 8,
    backgroundColor: '#E7F5ED',
  },
  vacancyText: { color: '#17623E' },
  match: { gap: Spacing.one },
  roomTitle: { fontSize: 18, lineHeight: 25, fontWeight: '700' },
  cardFooter: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.two },
});
