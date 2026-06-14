# LLM Instructions & Context

## Project Files
- `src/App.tsx`: Application entry point and lifecycle manager for the Three.js Engine.
- `src/lib/ReactiveSystem.tsx`: The "Brain" - holds the Event Bus, Data Store, and FSM.
- `src/components/Section/RendererEngine.tsx`: The "Heart" - pure Three.js renderer loop.
- `src/styles/theme.tsx`: Design tokens and semantic roles.

## Developer Guidelines (ELI10)
1. **Never use Tailwind**: All styles are in a JS `styles` object.
2. **Three.js is separate**: Don't put Three.js objects into React state. Use `Engine.ts`.
3. **Communicate via Bus**: If a button needs to change the particle count, update the `Store`, which emits an event that the `Engine` observes.
4. **Framer Motion for UI**: Use it for buttons and menus. Use **GSAP** for Three.js rotations and complex transitions.
