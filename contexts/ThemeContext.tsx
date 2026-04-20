import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { getTheme, PrimaryColor, Theme, ThemeMode } from '../utils/themes';

export interface ThemeContextType {
  currentTheme: Theme;
  primaryColor: PrimaryColor;
  mode: ThemeMode;
  setPrimaryColor: (color: PrimaryColor) => Promise<void>;
  setMode: (mode: ThemeMode) => Promise<void>;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [primaryColor, setPrimaryColorState] = useState<PrimaryColor>('purple');
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [currentTheme, setCurrentTheme] = useState<Theme>(getTheme('purple', 'light'));

  useEffect(() => {
    loadThemeSettings();
  }, []);

  async function loadThemeSettings() {
    try {
      const savedColor = await AsyncStorage.getItem('primaryColor');
      const savedMode = await AsyncStorage.getItem('themeMode');
      
      const newColor = savedColor as PrimaryColor || 'purple';
      const newMode = savedMode as ThemeMode || 'light';
      
      setPrimaryColorState(newColor);
      setModeState(newMode);
      setCurrentTheme(getTheme(newColor, newMode));
    } catch (e) {
      console.error('Error loading theme settings:', e);
    }
  }

  async function setPrimaryColor(color: PrimaryColor) {
    try {
      await AsyncStorage.setItem('primaryColor', color);
      setPrimaryColorState(color);
      setCurrentTheme(getTheme(color, mode));
    } catch (e) {
      console.error('Error saving primary color:', e);
    }
  }

  async function setMode(newMode: ThemeMode) {
    try {
      await AsyncStorage.setItem('themeMode', newMode);
      setModeState(newMode);
      setCurrentTheme(getTheme(primaryColor, newMode));
    } catch (e) {
      console.error('Error saving theme mode:', e);
    }
  }

  return (
    <ThemeContext.Provider value={{ currentTheme, primaryColor, mode, setPrimaryColor, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
