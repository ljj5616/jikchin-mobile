/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#102039',
    background: '#F4F6FD',
    backgroundElement: '#EAF0FE',
    backgroundSelected: '#DCE6FA',
    textSecondary: '#505B71',
    surface: '#FFFFFF',
    border: '#E1E7F4',
    accent: '#1948D1',
    accentText: '#1843BD',
    success: '#00644D',
    successSurface: '#D9F7EB',
    danger: '#A82119',
    dangerSurface: '#FCE7E6',
  },
  dark: {
    text: '#EDF2FF',
    background: '#0F1728',
    backgroundElement: '#1E2C49',
    backgroundSelected: '#2B3D61',
    textSecondary: '#B0BDD7',
    surface: '#172239',
    border: '#2B3A55',
    accent: '#2554DB',
    accentText: '#A5BDFF',
    success: '#86E9C8',
    successSurface: '#173A36',
    danger: '#FFB4AF',
    dangerSurface: '#41262C',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

export const Brand = {
  blue: '#1948D1',
  deepBlue: '#0737A8',
  white: '#FFFFFF',
  ice: '#D9E6FF',
  mint: '#72F4C1',
  red: '#A82119',
} as const;
