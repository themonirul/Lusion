import React from 'react';
import { Store, Bus } from '../../lib/ReactiveSystem';
import { ThemeSwitcher } from '../Core/ThemeSwitcher';
import { Slider } from '../Core/Slider';
import { useStyles } from '../../styles/theme';

export const InterfacePanel: React.FC = () => {
  const { colors, tokens } = useStyles();
  const [params, setParams] = React.useState({
    pinch: 0.4,
    distort: 1.6,
    progress: 0.0,
    pushPower: 25.0,
    flow: 0.985,
    chaos: 5.0
  });

  React.useEffect(() => {
    const handleUpdate = (data: any) => {
      setParams(prev => ({ 
        ...prev, 
        pinch: data.pinchPower !== undefined ? data.pinchPower : prev.pinch,
        distort: data.distortionPower !== undefined ? data.distortionPower : prev.distort,
        progress: data.currentProgress !== undefined ? data.currentProgress : prev.progress,
        pushPower: data.pushPower !== undefined ? data.pushPower : prev.pushPower,
        flow: data.flow !== undefined ? data.flow : prev.flow,
        chaos: data.chaos !== undefined ? data.chaos : prev.chaos
      }));
    };
    Bus.on('store/scrubber', handleUpdate);
  }, []);

  const update = (key: string, val: number, storeKey: string) => {
    setParams(prev => ({ ...prev, [key]: val }));
    Store.update('scrubber', { [storeKey]: val });
  };

  const styles = {
    panel: {
      position: 'fixed' as const,
      bottom: '40px',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      alignItems: 'center',
      gap: '24px',
      padding: '12px 24px',
      background: `${colors.surface(1)}EE`,
      backdropFilter: 'blur(32px) saturate(180%)',
      borderRadius: '40px',
      border: `1px solid ${colors.content(3)}11`,
      boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      zIndex: 100,
    },
    section: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '4px',
      minWidth: '140px'
    },
    label: {
      fontFamily: tokens.Type.Expressive.Label.S.font,
      fontSize: '9px',
      color: colors.content(3),
      textTransform: 'uppercase' as const,
      letterSpacing: '0.1em'
    },
    value: {
      fontFamily: tokens.Type.Expressive.Label.S.font,
      fontSize: '13px',
      fontWeight: 500,
      color: colors.content(1)
    }
  };

  return (
    <div style={styles.panel}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <ThemeSwitcher />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={styles.label}>Mode</span>
          <span style={{ fontSize: '11px', fontWeight: 600 }}>KINETIC</span>
        </div>
      </div>

      <div style={{ width: '1px', height: '32px', background: `${colors.content(3)}11` }} />

      <div style={styles.section}>
        <Slider 
          label="Pinch Distortion" 
          min={0} max={1.5} step={0.01} 
          value={params.pinch} 
          onChange={(v) => update('pinch', v, 'pinchPower')} 
        />
      </div>

      <div style={styles.section}>
        <Slider 
          label="Fluid Refraction" 
          min={0.1} max={5.0} step={0.1} 
          value={params.distort} 
          onChange={(v) => update('distort', v, 'distortionPower')} 
        />
      </div>

      <div style={styles.section}>
        <Slider 
          label="Push Power" 
          min={5} max={100} step={1} 
          value={params.pushPower} 
          onChange={(v) => update('pushPower', v, 'pushPower')} 
        />
      </div>

      <div style={styles.section}>
        <Slider 
          label="Fluid Flow" 
          min={0.9} max={0.999} step={0.001} 
          value={params.flow} 
          onChange={(v) => update('flow', v, 'flow')} 
        />
      </div>

      <div style={styles.section}>
        <Slider 
          label="Chaos" 
          min={0} max={20} step={0.5} 
          value={params.chaos} 
          onChange={(v) => update('chaos', v, 'chaos')} 
        />
      </div>

      <div style={{ width: '1px', height: '32px', background: `${colors.content(3)}11` }} />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '60px' }}>
        <span style={styles.label}>Progress</span>
        <span style={styles.value}>
          {(params.progress * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
};
