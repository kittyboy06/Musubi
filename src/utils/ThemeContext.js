import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from './theme';

const ACCENT_STORAGE_KEY = 'musubi_app_accent_theme_v1';

export const accentThemes = {
  Maroon: {
    name: 'Maroon',
    primary: '#881337',
    primaryContainer: '#9f1239',
    primaryDark: '#4c0519',
    primaryLight: '#be123c',
    maroonBar: '#881337',
    accentGlow: 'rgba(136, 19, 55, 0.15)',
  },
  Indigo: {
    name: 'Indigo',
    primary: '#4338ca',
    primaryContainer: '#4f46e5',
    primaryDark: '#312e81',
    primaryLight: '#6366f1',
    maroonBar: '#4338ca',
    accentGlow: 'rgba(67, 56, 202, 0.15)',
  },
  Emerald: {
    name: 'Emerald',
    primary: '#047857',
    primaryContainer: '#059669',
    primaryDark: '#064e3b',
    primaryLight: '#10b981',
    maroonBar: '#047857',
    accentGlow: 'rgba(4, 120, 87, 0.15)',
  },
  Amber: {
    name: 'Amber',
    primary: '#b45309',
    primaryContainer: '#d97706',
    primaryDark: '#78350f',
    primaryLight: '#f59e0b',
    maroonBar: '#b45309',
    accentGlow: 'rgba(180, 83, 9, 0.15)',
  },
};

const ThemeContext = createContext({
  activeThemeName: 'Maroon',
  activeTheme: accentThemes.Maroon,
  setAccentTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [activeThemeName, setActiveThemeName] = useState('Maroon');

  useEffect(() => {
    async function loadSavedTheme() {
      try {
        const saved = await AsyncStorage.getItem(ACCENT_STORAGE_KEY);
        if (saved && accentThemes[saved]) {
          setActiveThemeName(saved);
          applyThemeToGlobalObject(saved);
        }
      } catch (e) {}
    }
    loadSavedTheme();
  }, []);

  const applyThemeToGlobalObject = (themeName) => {
    const palette = accentThemes[themeName] || accentThemes.Maroon;
    theme.colors.primary = palette.primary;
    theme.colors.primaryContainer = palette.primaryContainer;
    theme.colors.primaryDark = palette.primaryDark;
    theme.colors.primaryLight = palette.primaryLight;
    theme.colors.maroonBar = palette.maroonBar;
    theme.colors.accentGlow = palette.accentGlow;
  };

  const setAccentTheme = async (themeName) => {
    if (accentThemes[themeName]) {
      setActiveThemeName(themeName);
      applyThemeToGlobalObject(themeName);
      try {
        await AsyncStorage.setItem(ACCENT_STORAGE_KEY, themeName);
      } catch (e) {}
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        activeThemeName,
        activeTheme: accentThemes[activeThemeName] || accentThemes.Maroon,
        setAccentTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
