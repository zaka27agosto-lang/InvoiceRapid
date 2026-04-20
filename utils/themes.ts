export type PrimaryColor = 'purple' | 'blue' | 'green' | 'orange' | 'pink' | 'teal';
export type ThemeMode = 'light' | 'dark';

export interface PrimaryColorOption {
  name: PrimaryColor;
  displayName: string;
  color: string;
  lightBackground: string;
  lightCard: string;
  darkBackground: string;
  darkCard: string;
}

export const primaryColors: Record<PrimaryColor, PrimaryColorOption> = {
  purple: {
    name: 'purple',
    displayName: 'Púrpura',
    color: '#6C47FF',
    lightBackground: '#F8F7FF',
    lightCard: '#FFFFFF',
    darkBackground: '#1E1B4B',
    darkCard: '#2D2A5C',
  },
  blue: {
    name: 'blue',
    displayName: 'Azul',
    color: '#007AFF',
    lightBackground: '#F0F8FF',
    lightCard: '#FFFFFF',
    darkBackground: '#0A1628',
    darkCard: '#1A2D4A',
  },
  green: {
    name: 'green',
    displayName: 'Verde',
    color: '#00C853',
    lightBackground: '#F1F8E9',
    lightCard: '#FFFFFF',
    darkBackground: '#1B2F1B',
    darkCard: '#2D4A2D',
  },
  orange: {
    name: 'orange',
    displayName: 'Naranja',
    color: '#FF6B00',
    lightBackground: '#FFF8E7',
    lightCard: '#FFFFFF',
    darkBackground: '#2D1F0A',
    darkCard: '#4A3215',
  },
  pink: {
    name: 'pink',
    displayName: 'Rosa',
    color: '#FF2D55',
    lightBackground: '#FFF0F5',
    lightCard: '#FFFFFF',
    darkBackground: '#2D0A15',
    darkCard: '#4A1522',
  },
  teal: {
    name: 'teal',
    displayName: 'Turquesa',
    color: '#00B5AD',
    lightBackground: '#F0F9FA',
    lightCard: '#FFFFFF',
    darkBackground: '#0A2D2A',
    darkCard: '#154A45',
  },
};

export interface Theme {
  primaryColor: PrimaryColor;
  mode: ThemeMode;
  colors: {
    primary: string;
    primaryLight: string;
    background: string;
    card: string;
    text: string;
    textSecondary: string;
    border: string;
    success: string;
    warning: string;
    error: string;
  };
}

export function getTheme(primaryColor: PrimaryColor, mode: ThemeMode): Theme {
  const colorOption = primaryColors[primaryColor];
  const isDark = mode === 'dark';
  
  return {
    primaryColor,
    mode,
    colors: {
      primary: colorOption.color,
      primaryLight: isDark ? `${colorOption.color}20` : `${colorOption.color}15`,
      background: isDark ? colorOption.darkBackground : colorOption.lightBackground,
      card: isDark ? colorOption.darkCard : colorOption.lightCard,
      text: isDark ? '#FFFFFF' : '#1a1a1a',
      textSecondary: isDark ? '#A0A0A0' : '#888888',
      border: isDark ? '#333333' : '#e8e8e8',
      success: '#26de81',
      warning: '#FF9F43',
      error: '#FF4757',
    },
  };
}
