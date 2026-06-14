# GPGPU Particle Engine

A highly optimized, production-ready Three.js simulation engine that translates complex GPGPU physics algorithms into Vanilla Three.js implementations.

## Architecture
- **Reactive Decoupled System**: Orchestrates React (Intent), FSM (State), Event Bus (Routing), and Data Store (Snapshotting).
- **Three.js Core**: Pure 0.180.0 implementation, decoupled from React's component render cycle for maximum FPS.
- **GSAP Orchestration**: Manages custom user-triggered timelines and animation physics outside React.
- **Design System**: Atomic modular architecture with semantic design tokens and JS-in-JS styling.

## Directory Map
- `/src/lib`: Core simulation logic and Reactive System.
- `/src/components/Core`: Basic UI atoms.
- `/src/components/Section`: Major application sections (Renderer, Interface).
- `/src/styles`: Theme and token definitions.
