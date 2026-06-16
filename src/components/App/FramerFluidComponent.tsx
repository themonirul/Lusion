import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { addPropertyControls, ControlType } from "framer";

// --- SHADERS ---

const SIM_VERTEX = `
  varying vec2 v_uv;
  void main() {
    v_uv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const BLUR_9_FRAG = `
  precision highp float;
  uniform sampler2D u_texture;
  uniform vec2 u_delta;
  varying vec2 v_uv;
  void main() {
    vec4 color = texture2D(u_texture, v_uv) * 0.1633;
    vec2 delta = u_delta;
    color += texture2D(u_texture, v_uv - delta) * 0.1531;
    color += texture2D(u_texture, v_uv + delta) * 0.1531;
    delta += u_delta;
    color += texture2D(u_texture, v_uv - delta) * 0.12245;
    color += texture2D(u_texture, v_uv + delta) * 0.12245;
    delta += u_delta;
    color += texture2D(u_texture, v_uv - delta) * 0.0918;
    color += texture2D(u_texture, v_uv + delta) * 0.0918;
    delta += u_delta;
    color += texture2D(u_texture, v_uv - delta) * 0.051;
    color += texture2D(u_texture, v_uv + delta) * 0.051;
    gl_FragColor = color;
  }
`;

const FLUID_SIM_FRAG = `
  precision highp float;
  uniform sampler2D u_lowPaintTexture;
  uniform sampler2D u_prevPaintTexture;
  uniform vec2 u_paintTexelSize;
  uniform vec4 u_drawFrom; // x, y, radius, 1
  uniform vec4 u_drawTo;   // x, y, radius, 1
  uniform float u_pushStrength;
  uniform vec3 u_dissipations;
  uniform vec2 u_vel;
  varying vec2 v_uv;

  float sdSegment(in vec2 p, in vec2 a, in vec2 b) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
  }

  #ifdef USE_NOISE
  uniform float u_curlScale;
  uniform float u_curlStrength;
  vec2 hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy) * 2.0 - 1.0;
  }
  vec3 noised(in vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f*f*f*(f*(f*6.0-15.0)+10.0);
    vec2 ga = hash(i + vec2(0.0, 0.0)); vec2 gb = hash(i + vec2(1.0, 0.0));
    vec2 gc = hash(i + vec2(0.0, 1.0)); vec2 gd = hash(i + vec2(1.0, 1.0));
    float va = dot(ga, f - vec2(0.0, 0.0)); float vb = dot(gb, f - vec2(1.0, 0.0));
    float vc = dot(gc, f - vec2(0.0, 1.0)); float vd = dot(gd, f - vec2(1.0, 1.0));
    return vec3(va + u.x*(vb-va) + u.y*(vc-va) + u.x*u.y*(va-vb-vc+vd), ga + u.x*(gb-ga) + u.y*(gc-ga) + u.x*u.y*(ga-gb-gc+gd));
  }
  #endif

  void main() {
    float dist = sdSegment(gl_FragCoord.xy, u_drawFrom.xy, u_drawTo.xy);
    float progressOnSegment = clamp(dot(gl_FragCoord.xy - u_drawFrom.xy, u_drawTo.xy - u_drawFrom.xy) / max(0.0001, dot(u_drawTo.xy - u_drawFrom.xy, u_drawTo.xy - u_drawFrom.xy)), 0.0, 1.0);
    vec2 radiusWeight = mix(u_drawFrom.zw, u_drawTo.zw, progressOnSegment);
    
    float drawingMask = 1.0 - smoothstep(-0.01, radiusWeight.x, dist);
    
    vec4 lowData = texture2D(u_lowPaintTexture, v_uv);
    vec2 velInv = (0.5 - lowData.xy) * u_pushStrength;
    
    #ifdef USE_NOISE
    vec3 noiseVal = noised(gl_FragCoord.xy * u_curlScale * (1.0 - lowData.xy));
    velInv += noiseVal.yz * (lowData.z + lowData.w) * u_curlStrength;
    #endif
    
    vec4 data = texture2D(u_prevPaintTexture, v_uv + velInv * u_paintTexelSize);
    data.xy -= 0.5;
    
    vec4 delta = (u_dissipations.xxyz - 1.0) * data;
    vec2 newVel = u_vel * drawingMask;
    delta += vec4(newVel, radiusWeight.yy * drawingMask, radiusWeight.yy * drawingMask);
    
    delta.zw = sign(delta.zw) * max(vec2(0.004), abs(delta.zw));
    data += delta;
    data.xy += 0.5;
    
    gl_FragColor = clamp(data, vec4(0.0), vec4(1.0));
  }
`;

const FLUID_COMPOSITOR_FRAG = `
  precision highp float;
  varying vec2 v_uv;
  uniform sampler2D u_fluidTexture;
  uniform vec3 u_bgColor;
  uniform vec3 u_fluidColors[5];
  uniform int u_colorCount;
  uniform float u_opacity;
  uniform float u_glowIntensity;
  uniform float u_bloomStrength;
  uniform float u_time;

  void main() {
    vec4 fluidData = texture2D(u_fluidTexture, v_uv);
    float weight = (fluidData.z + fluidData.w) * 0.5;
    
    vec3 color = u_bgColor;
    
    if (weight > 0.01) {
      // Pick color based on weight or custom logic
      vec3 fluidColor = u_fluidColors[0];
      if (u_colorCount > 1) {
        float t = clamp(weight * 1.5, 0.0, float(u_colorCount - 1));
        int idx = int(t);
        fluidColor = mix(u_fluidColors[idx], u_fluidColors[min(idx + 1, u_colorCount - 1)], fract(t));
      }
      
      // Add some glow
      color = mix(u_bgColor, fluidColor * (1.0 + u_glowIntensity), smoothstep(0.0, 1.0, weight));
      
      // Simple bloom-like effect
      color += fluidColor * pow(weight, 3.0) * u_bloomStrength;
    }
    
    gl_FragColor = vec4(color, u_opacity);
  }
`;

// --- SOLVER CLASS ---

class ThreeFluidSolver {
  gl: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.OrthographicCamera; quad: THREE.Mesh;
  paintRT: any; lowRT: any; lowBlurRT: any;
  paintMat: THREE.ShaderMaterial; blurMat: THREE.ShaderMaterial;
  
  params = {
    pushStrength: 25.0,
    dissipation: new THREE.Vector3(0.985, 0.985, 0.985), // vel, weight1, weight2
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

    const pX = res.w, pY = res.h;
    const lX = res.w >> 3, lY = res.h >> 3;

    const rtA = createRT(pX, pY); const rtB = rtA.clone();
    this.paintRT = { read: rtA, write: rtB, swap: () => { const t = this.paintRT.read; this.paintRT.read = this.paintRT.write; this.paintRT.write = t; } };
    this.lowRT = createRT(lX, lY);
    this.lowBlurRT = createRT(lX, lY);

    this.paintMat = new THREE.ShaderMaterial({
      vertexShader: SIM_VERTEX,
      fragmentShader: FLUID_SIM_FRAG,
      defines: { USE_NOISE: "" },
      uniforms: {
        u_lowPaintTexture: { value: null },
        u_prevPaintTexture: { value: null },
        u_paintTexelSize: { value: new THREE.Vector2(1 / pX, 1 / pY) },
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

  renderPass(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) { 
    this.quad.material = mat; 
    this.gl.setRenderTarget(target); 
    this.gl.render(this.scene, this.camera); 
  }

  update(delta: number, drawFrom: THREE.Vector4, drawTo: THREE.Vector4, velocity: THREE.Vector2) {
    this.paintRT.swap();
    
    // Physics Pass
    this.paintMat.uniforms.u_lowPaintTexture.value = this.lowBlurRT.texture;
    this.paintMat.uniforms.u_prevPaintTexture.value = this.paintRT.read.texture;
    this.paintMat.uniforms.u_drawFrom.value.copy(drawFrom);
    this.paintMat.uniforms.u_drawTo.value.copy(drawTo);
    this.paintMat.uniforms.u_vel.value.copy(velocity).multiplyScalar(delta * 0.8);
    
    this.renderPass(this.paintMat, this.paintRT.write);

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
    this.quad.geometry.dispose();
  }
}

// --- FRAMER COMPONENT ---

export function FluidSimulation(props: any) {
  const {
    height,
    viewportHeight,
    overflowVisible,
    simResolution,
    dyeRes,
    fluidSpeed,
    velocityDissipation,
    densityDissipation,
    pressureIterations,
    curlStrength,
    splatRadius,
    backgroundColor,
    fluidColors,
    colorMode,
    opacity,
    glowIntensity,
    bloomStrength,
    mouseInteraction,
    touchInteraction,
    autoMovement,
    autoMovementSpeed,
    distortionStrength,
    quality,
    fpsLimit,
    pauseOffscreen
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!pauseOffscreen || !containerRef.current) return;
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), { threshold: 0 });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [pauseOffscreen]);

  const style: React.CSSProperties = {
    width: "100%",
    height: viewportHeight ? "100vh" : height || 600,
    overflow: overflowVisible ? "visible" : "hidden",
    position: "relative",
    backgroundColor: backgroundColor || "#000",
  };

  return (
    <div ref={containerRef} style={style}>
      {isVisible && (
        <Canvas
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          style={{ position: "absolute", inset: 0 }}
        >
          <SceneController {...props} />
        </Canvas>
      )}
    </div>
  );
}

function SceneController(props: any) {
  const { gl, size } = useThree();
  const {
    simResolution = 128,
    fluidSpeed = 1.0,
    velocityDissipation = 0.985,
    densityDissipation = 0.985,
    curlStrength = 5.0,
    splatRadius = 30,
    backgroundColor = "#000000",
    fluidColors = ["#ffffff"],
    opacity = 1.0,
    glowIntensity = 0.5,
    bloomStrength = 0.5,
    mouseInteraction = true,
    autoMovement = false,
    autoMovementSpeed = 1.0
  } = props;

  const res = useMemo(() => {
    const q = props.quality === "High" ? 1 : props.quality === "Medium" ? 2 : 4;
    return { w: Math.floor(size.width / q), h: Math.floor(size.height / q) };
  }, [size, props.quality]);

  const solver = useMemo(() => new ThreeFluidSolver(gl, { w: simResolution, h: simResolution }), [gl, simResolution]);

  const fColors = useMemo(() => {
    return fluidColors.map((c: string) => new THREE.Color(c));
  }, [fluidColors]);

  const compositorMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: `varying vec2 v_uv; void main() { v_uv = uv; gl_Position = vec4(position, 1.0); }`,
    fragmentShader: FLUID_COMPOSITOR_FRAG,
    uniforms: {
      u_fluidTexture: { value: solver.paintRT.read.texture },
      u_bgColor: { value: new THREE.Color(backgroundColor) },
      u_fluidColors: { value: fColors },
      u_colorCount: { value: fColors.length },
      u_opacity: { value: opacity },
      u_glowIntensity: { value: glowIntensity },
      u_bloomStrength: { value: bloomStrength },
      u_time: { value: 0 }
    }
  }), [solver, backgroundColor, fColors, opacity, glowIntensity, bloomStrength]);

  const mouse = useRef(new THREE.Vector2(0.5, 0.5));
  const prevMouse = useRef(new THREE.Vector2(0.5, 0.5));
  const pointerPos = useRef(new THREE.Vector2(0.5, 0.5));
  const isMoving = useRef(false);

  useEffect(() => {
    const onMove = (e: any) => {
      if (!mouseInteraction) return;
      const x = (e.clientX || e.touches?.[0]?.clientX || 0) / size.width;
      const y = 1.0 - (e.clientY || e.touches?.[0]?.clientY || 0) / size.height;
      pointerPos.current.set(x, y);
      isMoving.current = true;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
    };
  }, [size, mouseInteraction]);

  const drawFrom = useRef(new THREE.Vector4());
  const drawTo = useRef(new THREE.Vector4());

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.032);
    
    // Auto movement logic
    if (autoMovement) {
      const t = state.clock.elapsedTime * autoMovementSpeed;
      pointerPos.current.set(
        0.5 + Math.cos(t) * 0.3,
        0.5 + Math.sin(t * 0.8) * 0.3
      );
      isMoving.current = true;
    }

    const mouseDist = pointerPos.current.distanceTo(prevMouse.current);
    let radius = THREE.MathUtils.clamp(mouseDist * 1000, 0, splatRadius);
    if (!isMoving.current) radius = 0;

    drawFrom.current.copy(drawTo.current);
    drawTo.current.set(pointerPos.current.x * simResolution, pointerPos.current.y * simResolution, radius, 1);
    
    const vel = new THREE.Vector2(drawTo.current.x - drawFrom.current.x, drawTo.current.y - drawFrom.current.y);
    
    solver.params.pushStrength = 20.0 * fluidSpeed;
    solver.params.dissipation.set(velocityDissipation, densityDissipation, densityDissipation);
    solver.params.curlStrength = curlStrength;
    
    const shouldNoise = curlStrength > 0 ? "" : undefined;
    if (solver.paintMat.defines.USE_NOISE !== shouldNoise) {
        if (shouldNoise === "") solver.paintMat.defines.USE_NOISE = "";
        else delete solver.paintMat.defines.USE_NOISE;
        solver.paintMat.needsUpdate = true;
    }

    solver.update(dt, drawFrom.current, drawTo.current, vel);
    
    compositorMat.uniforms.u_fluidTexture.value = solver.paintRT.write.texture;
    compositorMat.uniforms.u_time.value = state.clock.elapsedTime;
    
    prevMouse.current.copy(pointerPos.current);
    isMoving.current = false;
  });

  useEffect(() => () => solver.dispose(), [solver]);

  return (
    <mesh scale={[1, 1, 1]}>
      <planeGeometry args={[2, 2]} />
      <primitive object={compositorMat} attach="material" />
    </mesh>
  );
}

// --- PROPERTY CONTROLS ---

addPropertyControls(FluidSimulation, {
  height: { type: ControlType.Number, defaultValue: 600, min: 100, max: 2000, title: "Height" },
  viewportHeight: { type: ControlType.Boolean, defaultValue: false, title: "Full Viewport" },
  overflowVisible: { type: ControlType.Boolean, defaultValue: false, title: "Overflow" },

  simResolution: { 
    type: ControlType.Enum, 
    defaultValue: 128, 
    options: [64, 128, 256, 512],
    optionTitles: ["64px", "128px", "256px", "512px"],
    title: "Sim Resolution" 
  },
  fluidSpeed: { type: ControlType.Number, defaultValue: 1.0, min: 0.1, max: 5.0, step: 0.1, title: "Speed" },
  velocityDissipation: { type: ControlType.Number, defaultValue: 0.985, min: 0.9, max: 0.999, step: 0.001, title: "Vel Dissipation" },
  densityDissipation: { type: ControlType.Number, defaultValue: 0.985, min: 0.9, max: 0.999, step: 0.001, title: "Density Dissipation" },
  curlStrength: { type: ControlType.Number, defaultValue: 5.0, min: 0, max: 20, step: 0.5, title: "Curl" },
  splatRadius: { type: ControlType.Number, defaultValue: 30, min: 5, max: 200, title: "Splat Radius" },

  backgroundColor: { type: ControlType.Color, defaultValue: "#000000", title: "BG Color" },
  fluidColors: { 
    type: ControlType.Array, 
    control: { type: ControlType.Color, defaultValue: "#ffffff" },
    defaultValue: ["#ffffff", "#3b82f6", "#8b5cf6"],
    title: "Fluid Colors" 
  },
  opacity: { type: ControlType.Number, defaultValue: 1.0, min: 0, max: 1.0, step: 0.1, title: "Opacity" },
  glowIntensity: { type: ControlType.Number, defaultValue: 0.5, min: 0, max: 2.0, step: 0.1, title: "Glow" },
  bloomStrength: { type: ControlType.Number, defaultValue: 0.5, min: 0, max: 2.0, step: 0.1, title: "Bloom" },

  mouseInteraction: { type: ControlType.Boolean, defaultValue: true, title: "Mouse Tracking" },
  autoMovement: { type: ControlType.Boolean, defaultValue: false, title: "Auto Move" },
  autoMovementSpeed: { type: ControlType.Number, defaultValue: 1.0, min: 0.1, max: 5.0, title: "Auto Speed" },

  quality: { 
    type: ControlType.Enum, 
    defaultValue: "Medium", 
    options: ["Low", "Medium", "High"],
    title: "Quality" 
  },
  pauseOffscreen: { type: ControlType.Boolean, defaultValue: true, title: "Pause Offscreen" }
});
