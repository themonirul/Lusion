import React, { useRef, useEffect, useState, useMemo, useImperativeHandle, forwardRef, memo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { videoPersistence } from "../../services/videoPersistence";
import { Bus, Store } from "../../lib/ReactiveSystem";
import { SIM_VERTEX, BLUR_9_FRAG, SCREEN_PAINT_FRAG, DISTORTION_COMPOSITOR_FRAG } from "../../shaders/fluidShaders";

/**
 * High-Performance Scroll-Driven Video Scrubber with GPGPU Fluid & Center Pinch Distortion
 * Refined for Modular React 18.2 + Three.js 0.180.0
 */

function getLinearIndices(total: number): number[] {
  return Array.from({ length: total }, (_, i) => i);
}

export interface VideoScrubWebGLHandle {
  exportRegistry: () => Promise<void>;
}

interface VideoScrubWebGLProps {
  videoUrl?: string;
  staticFrames?: string[];
  pinchPower?: number;
  fluidDistortionPower?: number;
  onScrub?: (progress: number) => void;
  numFrames?: number;
}

export const VideoScrubWebGL = forwardRef<VideoScrubWebGLHandle, VideoScrubWebGLProps>((props, ref) => {
  const {
    videoUrl = "https://res.cloudinary.com/dkemjl9se/video/upload/v1780345662/First-person_discovery_lake_vall__202606012155_bhyhue.mp4",
    staticFrames,
    pinchPower = 0.4,
    fluidDistortionPower = 1.6,
    onScrub,
    numFrames = 150,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const targetProgress = useRef(0.0);
  const currentProgress = useRef(0.0);
  const currentVelocity = useRef(0);

  const isPointerDownRef = useRef(false);
  const isTouchingRef = useRef(false);
  const isWheelingRef = useRef(false);

  const frameCacheRef = useRef<{ [key: number]: THREE.Texture }>({});
  
  const pointerXRef = useRef(0.5);
  const pointerYRef = useRef(0.5);
  const pointerDxRef = useRef(0);
  const pointerDyRef = useRef(0);
  const pointerMovedRef = useRef(false);
  const pointerHoveredRef = useRef(false);

  const lastClientX = useRef<number | null>(null);
  const lastClientY = useRef<number | null>(null);
  const lastTouchX = useRef<number | null>(null);
  const lastTouchY = useRef<number | null>(null);

  const isScrollingRef = useRef(false);

  useEffect(() => {
    const handlePointerDown = () => { isPointerDownRef.current = true; };
    const handlePointerUp = () => { isPointerDownRef.current = false; };
    const handleTouchStart = () => { isTouchingRef.current = true; };
    const handleTouchEnd = () => { isTouchingRef.current = false; };
    
    let wheelTimeout: any = null;
    const handleWheel = () => {
      isWheelingRef.current = true;
      if (wheelTimeout) clearTimeout(wheelTimeout);
      wheelTimeout = setTimeout(() => { isWheelingRef.current = false; }, 150);
    };

    window.addEventListener("pointerdown", handlePointerDown, { passive: true });
    window.addEventListener("pointerup", handlePointerUp, { passive: true });
    window.addEventListener("pointercancel", handlePointerUp, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("wheel", handleWheel, { passive: true });

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("wheel", handleWheel);
    };
  }, []);

  useEffect(() => {
    let scrollEl: HTMLElement | Window = window;
    let scrollTimeout: any = null;

    const handleScroll = () => {
      isScrollingRef.current = true;
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => { isScrollingRef.current = false; }, 150);

      let progress = 0;
      const scrollY = window.scrollY;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (maxScroll > 0) {
        progress = scrollY / maxScroll;
      }
      targetProgress.current = Math.max(0.0001, Math.min(0.9999, progress));
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (lastClientX.current === e.clientX && lastClientY.current === e.clientY) return;
      lastClientX.current = e.clientX;
      lastClientY.current = e.clientY;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      pointerDxRef.current = 8 * (x - pointerXRef.current) * rect.width;
      pointerDyRef.current = 8 * (y - pointerYRef.current) * rect.height;
      pointerXRef.current = x;
      pointerYRef.current = y;
      pointerMovedRef.current = true;
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        if (lastTouchX.current === touch.clientX && lastTouchY.current === touch.clientY) return;
        lastTouchX.current = touch.clientX;
        lastTouchY.current = touch.clientY;

        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = (touch.clientX - rect.left) / rect.width;
        const y = (touch.clientY - rect.top) / rect.height;

        pointerDxRef.current = 8 * (x - pointerXRef.current) * rect.width;
        pointerDyRef.current = 8 * (y - pointerYRef.current) * rect.height;
        pointerXRef.current = x;
        pointerYRef.current = y;
        pointerMovedRef.current = true;
      }
    };

    window.addEventListener("pointermove", handleGlobalPointerMove, { passive: true });
    window.addEventListener("touchmove", handleGlobalTouchMove, { passive: true });

    return () => {
      window.removeEventListener("pointermove", handleGlobalPointerMove);
      window.removeEventListener("touchmove", handleGlobalTouchMove);
    };
  }, []);

  const handleExportRegistry = async () => {
    // Basic export implementation
    console.log("Exporting Frame Registry...");
  };

  useImperativeHandle(ref, () => ({
    exportRegistry: handleExportRegistry
  }));

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "#08080a",
        overflow: "hidden",
      }}
    >
      <Canvas
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
      >
        <ScrubberScreen
          videoUrl={videoUrl}
          staticFrames={staticFrames}
          frameCacheRef={frameCacheRef}
          numFrames={numFrames}
          targetProgress={targetProgress}
          currentProgress={currentProgress}
          currentVelocity={currentVelocity}
          pinchPower={pinchPower}
          fluidDistortionPower={fluidDistortionPower}
          onScrub={onScrub}
          pointerXRef={pointerXRef}
          pointerYRef={pointerYRef}
          pointerDxRef={pointerDxRef}
          pointerDyRef={pointerDyRef}
          pointerMovedRef={pointerMovedRef}
        />
      </Canvas>
    </div>
  );
});

// --- SHADERS & SIMULATION (lusion.co inspired) ---

class ThreeFluidSolver {
  gl: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.OrthographicCamera; quad: THREE.Mesh;
  paintRT: any; lowRT: any; lowBlurRT: any;
  paintMat: THREE.ShaderMaterial; blurMat: THREE.ShaderMaterial;
  
  params = {
    pushStrength: 25.0,
    dissipation: new THREE.Vector3(0.985, 0.985, 0.5), // vel, weight1, weight2
    curlScale: 0.05,
    curlStrength: 5.0,
    blurRadius: 8.0
  };

  constructor(gl: THREE.WebGLRenderer, res: { w: number; h: number }) {
    this.gl = gl;
    this.scene = new THREE.Scene(); this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); this.scene.add(this.quad);

    const createRT = (w: number, h: number) => {
      return new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    };

    const pX = res.w >> 1, pY = res.h >> 1;
    const lX = res.w >> 3, lY = res.h >> 3;

    const rtA = createRT(pX, pY); const rtB = rtA.clone();
    this.paintRT = { read: rtA, write: rtB, swap: () => { const t = this.paintRT.read; this.paintRT.read = this.paintRT.write; this.paintRT.write = t; } };
    this.lowRT = createRT(lX, lY);
    this.lowBlurRT = createRT(lX, lY);

    this.paintMat = new THREE.ShaderMaterial({
      vertexShader: SIM_VERTEX,
      fragmentShader: SCREEN_PAINT_FRAG,
      defines: { USE_NOISE: "" },
      uniforms: {
        u_lowPaintTexture: { value: null },
        u_prevPaintTexture: { value: null },
        u_paintTexelSize: { value: new THREE.Vector2(1 / pX, 1 / pY) },
        u_scrollOffset: { value: new THREE.Vector2(0, 0) },
        u_drawFrom: { value: new THREE.Vector4() },
        u_drawTo: { value: new THREE.Vector4() },
        u_pushStrength: { value: this.params.pushStrength },
        u_dissipations: { value: this.params.dissipation },
        u_vel: { value: new THREE.Vector2() },
        u_curlScale: { value: this.params.curlScale },
        u_curlStrength: { value: this.params.curlStrength }
      }
    });

    this.blurMat = new THREE.ShaderMaterial({
      vertexShader: SIM_VERTEX,
      fragmentShader: BLUR_9_FRAG,
      uniforms: {
        u_texture: { value: null },
        u_delta: { value: new THREE.Vector2() }
      }
    });
  }

  renderPass(mat: any, target: any) { 
    this.quad.material = mat; 
    this.gl.setRenderTarget(target); 
    this.gl.render(this.scene, this.camera); 
  }

  update(delta: number, drawFrom: THREE.Vector4, drawTo: THREE.Vector4, velocity: THREE.Vector2, scrollOffset: THREE.Vector2) {
    this.paintRT.swap();
    
    // Physics Pass
    this.paintMat.uniforms.u_lowPaintTexture.value = this.lowBlurRT.texture;
    this.paintMat.uniforms.u_prevPaintTexture.value = this.paintRT.read.texture;
    this.paintMat.uniforms.u_drawFrom.value.copy(drawFrom);
    this.paintMat.uniforms.u_drawTo.value.copy(drawTo);
    this.paintMat.uniforms.u_vel.value.copy(velocity).multiplyScalar(delta * 0.8);
    this.paintMat.uniforms.u_scrollOffset.value.copy(scrollOffset);
    
    this.renderPass(this.paintMat, this.paintRT.write);

    // Copy to low-res & Blur
    this.gl.setRenderTarget(this.lowRT);
    this.gl.render(this.scene, this.camera); // Default material on quad is still paintMat? No, need to switch.
    // Actually simpler to just use a copy material or blit
    // Let's use the blur material for the first pass which also scales
    
    // Blur Pass 1 (Horizontal)
    this.blurMat.uniforms.u_texture.value = this.paintRT.write.texture;
    this.blurMat.uniforms.u_delta.value.set(this.params.blurRadius / this.lowRT.width * 0.25, 0);
    this.renderPass(this.blurMat, this.lowRT);

    // Blur Pass 2 (Vertical)
    this.blurMat.uniforms.u_texture.value = this.lowRT.texture;
    this.blurMat.uniforms.u_delta.value.set(0, this.params.blurRadius / this.lowRT.height * 0.25);
    this.renderPass(this.blurMat, this.lowBlurRT);

    this.gl.setRenderTarget(null);
  }

  dispose() {
    this.paintRT.read.dispose(); this.paintRT.write.dispose();
    this.lowRT.dispose(); this.lowBlurRT.dispose();
    this.paintMat.dispose(); this.blurMat.dispose();
  }
}

interface ScrubberScreenProps {
  videoUrl: string; staticFrames?: string[]; frameCacheRef: any; numFrames: number;
  targetProgress: any; currentProgress: any; currentVelocity: any; pinchPower: number; fluidDistortionPower: number;
  onScrub?: (p: number) => void; pointerXRef: any; pointerYRef: any; pointerDxRef: any; pointerDyRef: any; pointerMovedRef: any;
}

function ScrubberScreen(props: ScrubberScreenProps) {
  const { videoUrl, staticFrames, frameCacheRef, numFrames, targetProgress, currentProgress, currentVelocity, pinchPower, fluidDistortionPower, onScrub, pointerXRef, pointerYRef, pointerDxRef, pointerDyRef, pointerMovedRef } = props;
  const { gl, size } = useThree();
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

  // Local state for uniform drives
  const powers = useRef({ 
    pinch: props.pinchPower, 
    distort: props.fluidDistortionPower,
    pushPower: 25.0,
    flow: 0.985,
    chaos: 5.0,
    dispersion: 1.0
  });

  useEffect(() => {
    const handleUpdate = (data: any) => {
      if (data.pinchPower !== undefined) powers.current.pinch = data.pinchPower;
      if (data.distortionPower !== undefined) powers.current.distort = data.distortionPower;
      if (data.pushPower !== undefined) powers.current.pushPower = data.pushPower;
      if (data.flow !== undefined) powers.current.flow = data.flow;
      if (data.chaos !== undefined) powers.current.chaos = data.chaos;
      if (data.dispersion !== undefined) powers.current.dispersion = data.dispersion;
    };
    Bus.on('store/scrubber', handleUpdate);
  }, []);

  useEffect(() => {
    if (staticFrames?.length) return;
    let active = true;
    videoPersistence.resolve(videoUrl).then(url => active && setResolvedUrl(url));
    return () => { active = false; };
  }, [videoUrl]);

  useEffect(() => {
    if (!resolvedUrl || staticFrames?.length) return;
    let destroyed = false;
    const POOL_SIZE = 20;
    const pool = Array.from({ length: POOL_SIZE }, () => {
      const v = document.createElement("video"); v.src = resolvedUrl; v.crossOrigin = "anonymous"; v.muted = v.playsInline = true; v.preload = "auto"; return v;
    });

    const process = async (v: HTMLVideoElement) => {
      if (destroyed) return;
      const progressIdx = Math.floor(targetProgress.current * (numFrames - 1));
      let bestIdx = -1, minDist = Infinity;
      for (let i = 0; i < numFrames; i++) {
        if (frameCacheRef.current[i]) continue;
        const d = Math.abs(i - progressIdx);
        if (d < minDist) { minDist = d; bestIdx = i; }
        if (d <= 1) break;
      }
      if (bestIdx === -1) return;
      v.currentTime = (bestIdx / (numFrames - 1)) * v.duration;
      v.onseeked = async () => {
        const bmp = await createImageBitmap(v);
        if (destroyed) return bmp.close();
        const tex = new THREE.Texture(bmp); tex.flipY = true; tex.generateMipmaps = false; tex.needsUpdate = true;
        gl.initTexture(tex); frameCacheRef.current[bestIdx] = tex;
        process(v);
      };
    };

    pool.forEach(v => v.onloadedmetadata = () => process(v));
    return () => { destroyed = true; pool.forEach(v => { v.pause(); v.src = ""; }); };
  }, [resolvedUrl, numFrames]);

  const solver = useMemo(() => new ThreeFluidSolver(gl, { w: 1024, h: 1024 }), [gl]);
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`,
    fragmentShader: DISTORTION_COMPOSITOR_FRAG,
    uniforms: {
      u_texture: { value: null },
      u_screenPaintTexture: { value: solver.paintRT.read.texture },
      u_screenPaintTexelSize: { value: solver.paintMat.uniforms.u_paintTexelSize.value },
      u_amount: { value: 20.0 },
      u_rgbShift: { value: 1.0 },
      u_multiplier: { value: 1.25 },
      u_colorMultiplier: { value: 1.0 },
      u_shade: { value: 1.25 },
      u_time: { value: 0 },
      u_res: { value: new THREE.Vector2() }
    }
  }), [gl, solver]);

  const prevMouseXY = useRef(new THREE.Vector2(0, 0));
  const drawFrom = useRef(new THREE.Vector4(0, 0, 0, 0));
  const drawTo = useRef(new THREE.Vector4(0, 0, 0, 0));

  useFrame((s, d) => {
    const tX = 1024 >> 1, tY = 1024 >> 1;
    
    // Calculate Drawing parameters
    const rect = gl.domElement.getBoundingClientRect();
    const currentMouseXY = new THREE.Vector2(pointerXRef.current, 1 - pointerYRef.current);
    const mouseDist = currentMouseXY.distanceTo(prevMouseXY.current);
    
    // Fit radius base on mouse speed
    const minR = 0, maxR = 60, distRange = 0.05;
    let radius = THREE.MathUtils.clamp(THREE.MathUtils.mapLinear(mouseDist, 0, distRange, minR, maxR), minR, maxR);
    if (!pointerMovedRef.current) radius = 0;

    drawFrom.current.copy(drawTo.current);
    drawTo.current.set((currentMouseXY.x * 2 - 1 + 1) * tX / 2, (currentMouseXY.y * 2 - 1 + 1) * tY / 2, radius, 1);
    
    const mouseVel = new THREE.Vector2(drawTo.current.x - drawFrom.current.x, drawTo.current.y - drawFrom.current.y);
    
    // Update solver params from reactive store
    solver.params.pushStrength = powers.current.pushPower;
    solver.params.dissipation.x = powers.current.flow;
    solver.params.dissipation.y = powers.current.flow;
    solver.params.curlStrength = powers.current.chaos;
    
    const useNoise = powers.current.chaos > 0 ? "1" : "";
    if (solver.paintMat.defines.USE_NOISE !== useNoise) {
      solver.paintMat.defines.USE_NOISE = useNoise;
      solver.paintMat.needsUpdate = true;
    }

    solver.update(Math.min(d, 0.032), drawFrom.current, drawTo.current, mouseVel, new THREE.Vector2(0, 0));
    
    prevMouseXY.current.copy(currentMouseXY);
    pointerMovedRef.current = false;

    // Composition
    currentProgress.current = targetProgress.current;
    const fIdx = currentProgress.current * (numFrames - 1), tIdx = Math.floor(fIdx);
    let l = -1, h = -1;
    for (let i = tIdx; i >= 0; i--) if (frameCacheRef.current[i]) { l = i; break; }
    for (let i = tIdx; i < numFrames; i++) if (frameCacheRef.current[i]) { h = i; break; }

    const lowTex = l !== -1 ? frameCacheRef.current[l] : null;
    const highTex = h !== -1 ? frameCacheRef.current[h] : null;
    const weight = (l === h || l === -1 || h === -1) ? 0 : (fIdx - l) / (h - l);
    
    // Simple blend for u_texture source
    material.uniforms.u_texture.value = highTex; 
    material.uniforms.u_res.value.set(size.width, size.height);
    material.uniforms.u_time.value = s.clock.elapsedTime;
    material.uniforms.u_screenPaintTexture.value = solver.paintRT.read.texture;
    
    // Update composition uniforms
    material.uniforms.u_amount.value = THREE.MathUtils.lerp(material.uniforms.u_amount.value, powers.current.distort * 15.0, 0.1);
    material.uniforms.u_rgbShift.value = THREE.MathUtils.lerp(material.uniforms.u_rgbShift.value, powers.current.dispersion, 0.1);
    
    onScrub?.(currentProgress.current);
    Store.update('scrubber', { currentProgress: currentProgress.current });
  });

  return <mesh scale={[1.1, 1.1, 1]}><planeGeometry args={[2, 2]} /><primitive object={material} attach="material" /></mesh>;
}
