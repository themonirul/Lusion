import React from 'react';

/** 
 * Category.Purpose.Context.Level Design Tokens
 */
export const Tokens = {
  Color: {
    Base: {
      Surface: {
        dark: { 1: '#0A0A0A', 2: '#141414', 3: '#1E1E1E' },
        light: { 1: '#FFFFFF', 2: '#F5F5F5', 3: '#EBEBEB' }
      },
      Content: {
        dark: { 1: '#FFFFFF', 2: '#A0A0A0', 3: '#606060' },
        light: { 1: '#0A0A0A', 2: '#404040', 3: '#808080' }
      }
    },
    Accent: {
      Surface: { dark: { 1: '#FFFFFF' }, light: { 1: '#0A0A0A' } },
      Content: { dark: { 1: '#000000' }, light: { 1: '#FFFFFF' } }
    },
    Feedback: {
      Success: { Surface: { 1: '#00FF88' }, Content: { 1: '#000000' } },
      Error: { Surface: { 1: '#FF4444' }, Content: { 1: '#FFFFFF' } },
      Focus: { Surface: { 1: '#00AAFF' }, Content: { 1: '#FFFFFF' } }
    }
  },
  Type: {
    Expressive: {
      Display: { L: { size: '64px', height: '1.1', weight: '700', font: 'Bebas Neue' } },
      Label: { S: { size: '10px', height: '1.2', weight: '500', font: 'Victor Mono' } }
    },
    Readable: {
      Body: { M: { size: '16px', height: '1.5', weight: '400', font: 'Inter' } }
    }
  },
  Space: {
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    10: '40px'
  }
};

/**
 * Minimalist Theme Context
 */
export const ThemeContext = React.createContext({ 
  mode: 'dark', 
  toggle: () => {} 
});

export const useStyles = () => {
  const context = React.useContext(ThemeContext);
  const mode = context.mode as 'light' | 'dark';
  
  return {
    tokens: Tokens,
    isDark: mode === 'dark',
    colors: {
      surface: (level: 1 | 2 | 3) => Tokens.Color.Base.Surface[mode][level],
      content: (level: 1 | 2 | 3) => Tokens.Color.Base.Content[mode][level],
      accentSurface: Tokens.Color.Accent.Surface[mode][1],
      accentContent: Tokens.Color.Accent.Content[mode][1],
    }
  };
};
