import React from 'react';
import { motion } from 'motion/react';
import { useStyles } from '../../styles/theme';

interface SliderProps {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
}

export const Slider = React.memo(({ label, min, max, step = 1, value, onChange }: SliderProps) => {
  const { colors } = useStyles();

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseFloat(e.target.value));
  };

  const styles = React.useMemo(() => ({
    container: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '8px',
      width: '100%'
    },
    labelRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    label: {
      fontFamily: 'Victor Mono',
      fontSize: '9px',
      textTransform: 'uppercase' as const,
      color: colors.content(3),
      letterSpacing: '0.1em',
    },
    valueText: {
      fontFamily: 'Victor Mono',
      fontSize: '10px',
      color: colors.content(2),
    },
    sliderWrapper: {
      position: 'relative' as const,
      height: '3px',
      background: `${colors.content(3)}11`,
      borderRadius: '2px',
      display: 'flex',
      alignItems: 'center'
    },
    track: {
      position: 'absolute' as const,
      height: '100%',
      background: '#00FF88',
      borderRadius: '2px',
    },
    input: {
      position: 'absolute' as const,
      width: '100%',
      opacity: 0,
      cursor: 'pointer',
      margin: 0,
      zIndex: 2
    },
    thumb: {
      position: 'absolute' as const,
      width: '10px',
      height: '10px',
      background: '#FFFFFF',
      borderRadius: '50%',
      border: `2px solid #00FF88`,
      transform: 'translateX(-50%)',
      pointerEvents: 'none' as const,
      zIndex: 1,
      boxShadow: '0 0 10px rgba(0, 255, 136, 0.4)'
    }
  }), [colors]);

  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div style={styles.container}>
      <div style={styles.labelRow}>
        <span style={styles.label}>{label}</span>
        <span style={styles.valueText}>{value.toFixed(step < 1 ? 2 : 1)}</span>
      </div>
      <div style={styles.sliderWrapper}>
        <div style={{ ...styles.track, width: `${percentage}%` }} />
        <div 
          style={{ ...styles.thumb, left: `${percentage}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleInput}
          style={styles.input}
        />
      </div>
    </div>
  );
});
