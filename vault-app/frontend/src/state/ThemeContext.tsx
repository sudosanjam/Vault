import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'obsidian' | 'coffee' | 'ruby' | 'sapphire' | 'emerald' | 'amethyst';

export interface ThemeDefinition {
  id: Theme;
  name: string;
  baseCanvas: string;
  accentPrimary: string;
  accentSecondary: string;
  atmosphere: string;
  tagline: string;
  canvasName: string;
  accentPrimaryName: string;
  accentSecondaryName: string;
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'obsidian',
    name: 'Obsidian',
    baseCanvas: '#0e0f15',
    accentPrimary: '#89b4fa',
    accentSecondary: '#cba6f7',
    atmosphere: 'Clean Apple Pro modern dark',
    tagline: 'Slate Obsidian • Celestial Blue • Mocha Lavender',
    canvasName: 'Slate Obsidian',
    accentPrimaryName: 'Celestial Blue',
    accentSecondaryName: 'Mocha Lavender',
  },
  {
    id: 'coffee',
    name: 'Coffee',
    baseCanvas: '#120e0c',
    accentPrimary: '#d4a373',
    accentSecondary: '#e0a96d',
    atmosphere: 'Warm roasted dark brown',
    tagline: 'Espresso Dark • Caramel Mocha • Warm Hazelnut',
    canvasName: 'Espresso Dark',
    accentPrimaryName: 'Caramel Mocha',
    accentSecondaryName: 'Warm Hazelnut',
  },
  {
    id: 'ruby',
    name: 'Ruby',
    baseCanvas: '#13080b',
    accentPrimary: '#f38ba8',
    accentSecondary: '#f2cdcd',
    atmosphere: 'Rich burgundy velvet',
    tagline: 'Midnight Bordeaux • Velvet Crimson • Pastel Rose',
    canvasName: 'Midnight Bordeaux',
    accentPrimaryName: 'Velvet Crimson',
    accentSecondaryName: 'Pastel Rose',
  },
  {
    id: 'sapphire',
    name: 'Sapphire',
    baseCanvas: '#080d16',
    accentPrimary: '#38bdf8',
    accentSecondary: '#818cf8',
    atmosphere: 'Deep midnight oceanic navy',
    tagline: 'Ocean Abyss • Electric Cyan • Royal Azure',
    canvasName: 'Ocean Abyss',
    accentPrimaryName: 'Electric Cyan',
    accentSecondaryName: 'Royal Azure',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    baseCanvas: '#07120d',
    accentPrimary: '#5eead4',
    accentSecondary: '#a6e3a1',
    atmosphere: 'Botanical alpine pine',
    tagline: 'Pine Forest • Pastel Mint • Sage Green',
    canvasName: 'Pine Forest',
    accentPrimaryName: 'Pastel Mint',
    accentSecondaryName: 'Sage Green',
  },
  {
    id: 'amethyst',
    name: 'Amethyst',
    baseCanvas: '#0e0817',
    accentPrimary: '#c084fc',
    accentSecondary: '#f5c2e7',
    atmosphere: 'Cosmic cyber lavender',
    tagline: 'Deep Cosmic • Radiant Violet • Lilac Stardust',
    canvasName: 'Deep Cosmic',
    accentPrimaryName: 'Radiant Violet',
    accentSecondaryName: 'Lilac Stardust',
  },
];

interface ThemeContextType {
  theme: Theme;
  currentThemeDef: ThemeDefinition;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  availableThemes: ThemeDefinition[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const normalizeTheme = (saved: string | null): Theme => {
  if (!saved) return 'obsidian';
  if (['obsidian', 'coffee', 'ruby', 'sapphire', 'emerald', 'amethyst'].includes(saved)) {
    return saved as Theme;
  }
  // Backwards compatibility with previous theme names
  if (saved === 'dark') return 'obsidian';
  if (saved === 'oled') return 'sapphire';
  if (saved === 'cyberpunk') return 'amethyst';
  if (saved === 'light') return 'obsidian';
  return 'obsidian';
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('vault_theme');
    return normalizeTheme(saved);
  });

  const currentThemeDef = THEMES.find(t => t.id === theme) || THEMES[0];

  useEffect(() => {
    const root = document.documentElement;
    // Remove previous theme classes
    THEMES.forEach(t => {
      root.classList.remove(`theme-${t.id}`, t.id);
    });
    root.classList.remove('oled', 'cyberpunk', 'light');

    // Add dark class and specific theme class & data attribute
    root.classList.add('dark', `theme-${theme}`, theme);
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = 'dark';

    localStorage.setItem('vault_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setThemeState(prev => {
      const idx = THEMES.findIndex(t => t.id === prev);
      const nextIdx = (idx + 1) % THEMES.length;
      return THEMES[nextIdx].id;
    });
  };

  const setTheme = (t: Theme) => {
    setThemeState(t);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        currentThemeDef,
        toggleTheme,
        setTheme,
        availableThemes: THEMES,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
