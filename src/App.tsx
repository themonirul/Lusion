import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { VideoScrubWebGL } from './components/Section/RendererEngine';
import { InterfacePanel } from './components/Section/InterfacePanel';
import { ThemeContext } from './styles/theme';
import { Bus } from './lib/ReactiveSystem';

const SCROLL_MILESTONES = [
  { p: 0.1, label: "THE JOURNEY BEGINS", sub: "SCROLL TO EXPLORE THE LAKE" },
  { p: 0.45, label: "KINETIC REFRACTION", sub: "FLUID DYNAMICS MERGING WITH REALITY" },
  { p: 0.85, label: "BEYOND THE HORIZON", sub: "A SEAMLESS BLEND OF LIGHT AND MOTION" }
];

export default function App() {
  const [mode, setMode] = React.useState<'light' | 'dark'>('dark');
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    const handleUpdate = (data: any) => {
      if (data.currentProgress !== undefined) setProgress(data.currentProgress);
    };
    Bus.on('store/scrubber', handleUpdate);
  }, []);

  const toggleMode = () => {
    setMode(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const styles: any = {
    app: {
      position: 'relative',
      width: '100vw',
      height: '500vh', 
      background: mode === 'dark' ? '#08080a' : '#f0f0f2',
      color: mode === 'dark' ? '#FFFFFF' : '#0A0A0A',
      transition: 'background 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
      fontFamily: 'Inter, sans-serif',
      overflowX: 'hidden'
    },
    canvasContainer: {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: 1
    },
    overlay: {
      position: 'fixed',
      inset: 0,
      pointerEvents: 'none',
      zIndex: 2,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '40px'
    }
  };

  return (
    <ThemeContext.Provider value={{ mode, toggle: toggleMode }}>
      <div style={styles.app}>
        <div style={styles.canvasContainer}>
          <VideoScrubWebGL />
        </div>

        <div style={styles.overlay}>
          <AnimatePresence mode="wait">
            {SCROLL_MILESTONES.map((m, i) => {
              const active = Math.abs(progress - m.p) < 0.12;
              if (!active) return null;

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -30, filter: 'blur(10px)' }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  style={{ position: 'absolute', textAlign: 'center' }}
                >
                  <h2 style={{ 
                    fontFamily: 'Bebas Neue', 
                    fontSize: 'clamp(40px, 8vw, 120px)', 
                    margin: 0, 
                    letterSpacing: '0.15em',
                    color: mode === 'dark' ? '#fff' : '#000',
                    lineHeight: 1
                  }}>
                    {m.label}
                  </h2>
                  <div style={{ 
                    fontFamily: 'Victor Mono', 
                    fontSize: 'clamp(10px, 1vw, 14px)', 
                    letterSpacing: '0.5em', 
                    opacity: 0.5,
                    marginTop: '20px',
                    textTransform: 'uppercase'
                  }}>
                    {m.sub}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        <InterfacePanel />
        
        {/* Helper guide at start */}
        <motion.div
          animate={{ opacity: progress > 0.05 ? 0 : 1 }}
          style={{
            position: 'fixed',
            bottom: '120px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 3,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            pointerEvents: 'none'
          }}
        >
          <div style={{ fontFamily: 'Victor Mono', fontSize: '10px', letterSpacing: '0.2em', opacity: 0.4 }}>SCROLL TO BEGIN</div>
          <motion.div 
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ width: '1px', height: '40px', background: 'rgba(255,255,255,0.2)' }} 
          />
        </motion.div>
      </div>
    </ThemeContext.Provider>
  );
}
