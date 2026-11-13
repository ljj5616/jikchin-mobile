import { Image } from 'expo-image';
import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppIcon, Badge } from '@/components/jikchin-ui';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useMockSession } from '@/features/auth/mock-session';
import { useTheme } from '@/hooks/use-theme';

import { formatGameDate, type RoomResponse } from './room-list';

export function MatchCard({ room, featured = false }: { room: RoomResponse; featured?: boolean }) {
  const theme = useTheme();
  const { session } = useMockSession();
  const teams = session ? [...session.teams.KBO, ...session.teams.KLEAGUE] : [];
  const sides = [
    { id: room.homeTeamId, name: room.homeTeam, side: '홈' },
    { id: room.awayTeamId, name: room.awayTeam, side: '원정' },
  ];
  const foreground = featured ? Brand.white : theme.text;
  const muted = featured ? Brand.ice : theme.textSecondary;

  return (
    <View style={[
      styles.card,
      { backgroundColor: featured ? Brand.deepBlue : theme.backgroundElement },
      featured && styles.featured,
    ]}>
      {featured && (
        <View style={styles.featuredHeading}>
          <ThemedText type="smallBold" style={{ color: Brand.ice }}>경기 정보</ThemedText>
          <ThemedText type="smallBold" style={{ color: Brand.white }}>{formatGameDate(room.gameDate)}</ThemedText>
        </View>
      )}
      <View style={styles.match}>
        {sides.map(({ id, name, side }, index) => {
          const team = teams.find((item) => item.id === id);
          return (
            <Fragment key={side}>
              {index === 1 && <ThemedText style={[styles.versus, { color: featured ? Brand.mint : theme.accentText }]}>VS</ThemedText>}
              <View style={styles.team}>
                <View style={[styles.mark, { backgroundColor: featured ? '#FFFFFF26' : theme.surface }]}>
                  {team?.logoUrl ? <Image source={team.logoUrl} contentFit="contain" style={styles.teamLogo} /> : (
                    <ThemedText type="smallBold" style={{ color: featured ? Brand.white : theme.accentText }}
                      numberOfLines={1} adjustsFontSizeToFit>{team?.shortName || name.slice(0, 2)}</ThemedText>
                  )}
                </View>
                <ThemedText style={[styles.teamName, { color: foreground }]}>{name}</ThemedText>
                <ThemedText type="small" style={{ color: muted }}>{side}</ThemedText>
              </View>
            </Fragment>
          );
        })}
      </View>
      <View style={[styles.location, { borderColor: featured ? '#FFFFFF36' : theme.border }]}>
        <AppIcon name="location" size={17} color={featured ? Brand.mint : theme.accentText} />
        <ThemedText type="smallBold" style={[styles.locationName, { color: foreground }]}>{room.stadium}</ThemedText>
        {!featured && <Badge label={formatGameDate(room.gameDate)} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, gap: 12, borderRadius: 14 },
  featured: { padding: 18, gap: 18, borderRadius: 19 },
  featuredHeading: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6 },
  match: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  team: { flex: 1, minWidth: 0, alignItems: 'center', gap: 4 },
  mark: { width: 44, height: 44, padding: 4, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  teamLogo: { width: '100%', height: '100%' },
  teamName: { fontSize: 15, lineHeight: 21, fontWeight: '800', textAlign: 'center' },
  versus: { marginTop: 10, fontSize: 17, lineHeight: 24, fontWeight: '900' },
  location: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  locationName: { flexGrow: 1, flexShrink: 1 },
});
