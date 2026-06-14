import React from 'react';
import { motion } from 'motion/react';
import { Sun, Moon } from '@phosphor-icons/react';
import { ThemeContext, useStyles } from '../../styles/theme';

export const ThemeSwitcher: React.FC = () => {
  const { mode, toggle } = React.useContext(ThemeContext);
  const { colors } = useStyles();

  const styles: any = {
    button: {
      position: 'relative',
      width: '40px',
      height: '40px',
      borderRadius: '20px',
      border: 'none',
      background: `${colors.content(3)}11`,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: colors.content(1),
      transition: 'background 0.3s ease',
    }
  };

  return (
    <motion.button
      style={styles.button}
      onClick={toggle}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
    >
      {mode === 'dark' ? <Moon size={20} weight="fill" /> : <Sun size={20} weight="fill" />}
    </motion.button>
  );
};

