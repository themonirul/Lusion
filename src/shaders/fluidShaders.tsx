export const SIM_VERTEX = `
  varying vec2 v_uv;
  void main() {
    v_uv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

export const BLUR_9_FRAG = `
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

export const SCREEN_PAINT_FRAG = `
  precision highp float;
  uniform sampler2D u_lowPaintTexture;
  uniform sampler2D u_prevPaintTexture;
  uniform vec2 u_paintTexelSize;
  uniform vec2 u_scrollOffset;
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
    
    vec4 lowData = texture2D(u_lowPaintTexture, v_uv - u_scrollOffset);
    vec2 velInv = (0.5 - lowData.xy) * u_pushStrength;
    
    #ifdef USE_NOISE
    vec3 noiseVal = noised(gl_FragCoord.xy * u_curlScale * (1.0 - lowData.xy));
    velInv += noiseVal.yz * (lowData.z + lowData.w) * u_curlStrength;
    #endif
    
    vec4 data = texture2D(u_prevPaintTexture, v_uv - u_scrollOffset + velInv * u_paintTexelSize);
    data.xy -= 0.5;
    
    vec4 delta = (u_dissipations.xxyz - 1.0) * data;
    vec2 newVel = u_vel * drawingMask;
    delta += vec4(newVel, radiusWeight.yy * drawingMask);
    
    delta.zw = sign(delta.zw) * max(vec2(0.004), abs(delta.zw));
    data += delta;
    data.xy += 0.5;
    
    gl_FragColor = clamp(data, vec4(0.0), vec4(1.0));
  }
`;

export const DISTORTION_COMPOSITOR_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D u_texture;
  uniform sampler2D u_screenPaintTexture;
  uniform vec2 u_screenPaintTexelSize;
  uniform float u_amount;
  uniform float u_rgbShift;
  uniform float u_multiplier;
  uniform float u_colorMultiplier;
  uniform float u_shade;
  uniform float u_time;
  uniform vec2 u_res;

  float rand(vec2 n) { 
    return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
  }

  void main() {
    float bnoise = rand(gl_FragCoord.xy + fract(u_time));
    vec4 data = texture2D(u_screenPaintTexture, vUv);
    
    float weight = (data.z + data.w) * 0.5;
    vec2 vel = (0.5 - data.xy - 0.001) * 2.0 * weight;
    
    vec2 velocity = vel * u_amount / 4.0 * u_screenPaintTexelSize * u_multiplier;
    vec2 uv = vUv + bnoise * velocity;
    
    vec4 color = vec4(0.0);
    // 9-tap motion blur along fluid path
    for(int i = 0; i < 9; i++) {
      color += texture2D(u_texture, uv);
      uv += velocity;
    }
    color /= 9.0;
    
    // Chromatic shimmer
    vec3 shimmer = sin(vec3(vel.x + vel.y) * 40.0 + vec3(0.0, 2.0, 4.0) * u_rgbShift);
    color.rgb += shimmer * smoothstep(0.4, -0.9, weight) * u_shade * max(abs(vel.x), abs(vel.y)) * u_colorMultiplier;
    
    gl_FragColor = color;
  }
`;
