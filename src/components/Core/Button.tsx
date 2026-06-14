import React from 'react';
import { motion } from 'motion/react';
import { useStyles } from '../../styles/theme';

interface ButtonProps {
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary';
  onClick?: () => void;
}

export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', onClick }) => {
  const { colors } = useStyles();

  const styles: any = {
    container: {
      position: 'relative',
      padding: '12px 24px',
      border: 'none',
      borderRadius: '24px',
      cursor: 'pointer',
      overflow: 'hidden',
      fontFamily: 'Inter',
      fontSize: '14px',
      fontWeight: '600',
      transition: 'transform 0.1s ease, background 0.3s ease, color 0.3s ease',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: variant === 'primary' ? colors.accentSurface : colors.surface(2),
      color: variant === 'primary' ? colors.accentContent : colors.content(1),
    }
  };

  return (
    <motion.button
      style={styles.container}
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {children}
    </motion.button>
  );
};
