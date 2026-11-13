import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/jikchin-ui';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { onboardingTeams, type League, type Team } from './profile';

type TeamFieldProps = {
  league: League;
  teams?: Team[];
  label: string;
  value: number | null;
  required?: boolean;
  disabled?: boolean;
  expanded: boolean;
  onToggle: () => void;
  onSelect: (teamId: number | null) => void;
};

export function TeamField({ league, teams = onboardingTeams[league], label, value, required = false, disabled, expanded, onToggle, onSelect }: TeamFieldProps) {
  const theme = useTheme();
  const selected = teams.find((team) => team.id === value);
  const selectedName = selected?.name ?? (required ? '팀을 선택해 주세요' : '선택 안 함');
  const iconColor = league === 'KBO' ? theme.accentText : theme.success;
  const options = required ? teams : [{ id: null, name: '선택 안 함' }, ...teams];

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label} ({required ? '필수' : '선택'})</ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} 선택`}
        accessibilityValue={{ text: selectedName }}
        accessibilityState={{ expanded }}
        disabled={disabled}
        onPress={onToggle}
        style={[styles.selector, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
        <View style={[styles.teamIcon, { backgroundColor: theme.surface }]}>
          <AppIcon name={league === 'KBO' ? 'baseball' : 'football'} size={19} color={iconColor} />
        </View>
        <ThemedText style={styles.selection}>{selectedName}</ThemedText>
        <AppIcon name={expanded ? 'close' : 'chevron'} size={17} color={iconColor} />
      </Pressable>
      {expanded && (
        <View style={styles.options}>
          {options.map(({ id, name }) => (
            <Pressable
              key={id ?? 'none'}
              accessibilityRole="radio"
              accessibilityState={{ checked: id === value }}
              disabled={disabled}
              onPress={() => onSelect(id)}
              style={[
                styles.option,
                { backgroundColor: id === value ? theme.backgroundSelected : theme.backgroundElement },
              ]}>
              <ThemedText type={id === value ? 'smallBold' : 'small'}>{name}</ThemedText>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.two },
  selector: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderRadius: 12,
  },
  selection: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  teamIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  option: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 12,
  },
});
