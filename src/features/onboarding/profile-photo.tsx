import { Image } from 'expo-image';
import { launchImageLibraryAsync, type ImagePickerAsset } from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/jikchin-ui';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { ProfilePhotoSelection } from './profile';

const maxPhotoBytes = 5 * 1024 * 1024;
const maxPhotoDimension = 4096;

type ProfilePhotoProps = {
  uri: string | null;
  onChange: (photo: ProfilePhotoSelection | null) => void;
  disabled?: boolean;
};

function validatePhoto(asset: ImagePickerAsset) {
  const mimeType = asset.mimeType || asset.file?.type;
  const fileName = asset.fileName ?? asset.file?.name ?? asset.uri;
  const isJpeg = mimeType ? mimeType === 'image/jpeg' : /\.jpe?g$/i.test(fileName);
  if (!isJpeg) return 'JPG 또는 JPEG 사진을 선택해 주세요.';

  const bytes = asset.fileSize ?? asset.file?.size;
  if (bytes !== undefined && (bytes === 0 || bytes > maxPhotoBytes)) {
    return '5MB 이하의 사진을 선택해 주세요.';
  }
  if (asset.width > maxPhotoDimension || asset.height > maxPhotoDimension) {
    return '가로와 세로가 모두 4096px 이하인 사진을 선택해 주세요.';
  }
  return null;
}

export function ProfilePhoto({ uri, onChange, disabled }: ProfilePhotoProps) {
  const theme = useTheme();
  const [error, setError] = useState<string | null>(null);

  async function pickPhoto() {
    try {
      const result = await launchImageLibraryAsync({ mediaTypes: ['images'] });
      if (result.canceled) return;

      const asset = result.assets[0];
      const validationError = validatePhoto(asset);
      setError(validationError);
      if (!validationError) onChange({ uri: asset.uri, file: asset.file });
    } catch {
      setError('사진을 열 수 없어요. 다시 시도해 주세요.');
    }
  }

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">프로필 사진 (선택)</ThemedText>
      <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
        <View style={[styles.preview, { backgroundColor: theme.backgroundSelected }]}>
          {uri ? (
            <Image source={uri} style={styles.photo} contentFit="cover" />
          ) : (
            <AppIcon name="person" color={theme.accentText} size={32} />
          )}
        </View>
        <View style={styles.details}>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={disabled}
              onPress={pickPhoto}
              style={[styles.action, { backgroundColor: theme.surface }]}>
              <AppIcon name="camera" size={16} color={theme.accentText} />
              <ThemedText type="smallBold" themeColor="accentText">{uri ? '사진 변경' : '사진 선택'}</ThemedText>
            </Pressable>
            {uri && (
              <Pressable
                accessibilityRole="button"
                disabled={disabled}
                onPress={() => {
                  onChange(null);
                  setError(null);
                }}
                style={styles.action}>
                <ThemedText type="smallBold" themeColor="textSecondary">사진 제거</ThemedText>
              </Pressable>
            )}
          </View>
          <ThemedText type="small" themeColor="textSecondary">JPEG · 최대 5MB · 4096×4096</ThemedText>
        </View>
      </View>
      {error && <ThemedText type="small" accessibilityRole="alert" themeColor="danger">{error}</ThemedText>}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 12 },
  preview: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  details: { flex: 1, gap: Spacing.half },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  action: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: Spacing.two,
    borderRadius: 10,
  },
});
