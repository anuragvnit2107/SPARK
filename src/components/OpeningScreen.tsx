import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ArrowRight, Loader2, Play } from 'lucide-react';

interface OpeningScreenProps {
  onContinue: () => void;
}

const RIBBON_VERTEX_SHADER = `
  uniform float uTime;
  uniform vec2 uPointer;
  uniform float uPhase;
  uniform float uSide;
  uniform float uLoadSurge;
  varying vec2 vUv;
  varying float vWave;
  varying vec3 vNormalView;
  varying vec3 vViewPos;

  void main() {
    vUv = uv;
    vec3 pos = position;

    float speed = 0.52 + uLoadSurge * 2.1;
    float travel = pos.x * 0.28 * uSide + uTime * speed + uPhase;
    float amp = 1.0 + uLoadSurge * 1.45;
    float wavePrimary = (sin(travel) * 0.55 + sin(travel * 1.7 + pos.y * 1.4) * 0.24) * amp;
    float waveCross = cos(pos.y * 1.8 - uTime * (0.42 + uLoadSurge * 1.4) + uPhase) * 0.28 * amp;
    float pointerLift = (uPointer.x * 0.22 + uPointer.y * 0.18) * sin(uv.x * 3.14159);

    // During loading surge, corner ribbons sweep inward & spiral toward camera depth
    float swirlAngle = uLoadSurge * 0.48 * uSide * (0.3 + uv.x * 0.7);
    float c = cos(swirlAngle);
    float s = sin(swirlAngle);
    vec2 rotatedXY = vec2(pos.x * c - pos.y * s, pos.x * s + pos.y * c);
    pos.xy = mix(pos.xy, rotatedXY * (1.0 - uLoadSurge * 0.16), uLoadSurge);

    pos.z += (wavePrimary + waveCross + pointerLift) * 0.65 + uLoadSurge * (1.4 * sin(uv.x * 3.14159));
    pos.y += sin(travel * 0.85 + uv.y * 2.1) * (0.34 + uLoadSurge * 0.42);

    float dzdx = cos(travel) * 0.28 * 0.55 * 0.65 * uSide * amp;
    float dzdy = -sin(pos.y * 1.8 - uTime * 0.42 + uPhase) * 1.8 * 0.28 * 0.65 * amp;
    vec3 displacedNormal = normalize(vec3(-dzdx, -dzdy, 1.0));

    vWave = wavePrimary;
    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    vViewPos = -mvPos.xyz;
    vNormalView = normalize(normalMatrix * displacedNormal);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const RIBBON_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform vec3 uColorDeep;
  uniform vec3 uColorMid;
  uniform vec3 uColorLight;
  uniform float uOpacity;
  uniform float uLoadSurge;
  varying vec2 vUv;
  varying float vWave;
  varying vec3 vNormalView;
  varying vec3 vViewPos;

  void main() {
    vec3 N = normalize(vNormalView);
    vec3 V = normalize(vViewPos);
    float ndotv = abs(dot(N, V));
    float fresnel = pow(1.0 - clamp(ndotv, 0.0, 1.0), 2.2);

    float flowBand = 0.5 + 0.5 * sin(vUv.x * 7.0 - uTime * (0.75 + uLoadSurge * 3.2) + vUv.y * 2.2);
    float energyPulse = 0.5 + 0.5 * sin(vUv.x * 12.0 - uTime * 5.2);
    vec3 baseCol = mix(uColorDeep, uColorMid, clamp(vUv.y * 0.85 + flowBand * 0.28, 0.0, 1.0));
    baseCol = mix(baseCol, uColorLight, fresnel * (0.72 + uLoadSurge * 0.22));
    baseCol += vec3(0.08, 0.42, 0.28) * uLoadSurge * energyPulse * 0.65;

    float edgeDist = min(vUv.y, 1.0 - vUv.y);
    float edgeRim = smoothstep(0.12, 0.0, edgeDist);
    vec3 col = mix(baseCol, vec3(0.95, 1.0, 0.98), edgeRim * (0.78 + uLoadSurge * 0.2) + pow(fresnel, 3.0) * 0.48);

    float tipFade = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.84, vUv.x);
    float bodyAlpha = mix(uOpacity * 0.48, uOpacity + uLoadSurge * 0.2, fresnel * 0.6 + edgeRim * 0.55);
    float alpha = clamp(bodyAlpha * tipFade * (0.85 + 0.15 * vWave), 0.0, 0.95);

    gl_FragColor = vec4(col, alpha);
  }
`;

const HELIX_VERTEX_SHADER = `
  uniform float uTime;
  uniform float uLoadSurge;
  uniform float uPhase;
  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewPos;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // 3D helical flow ripple advancing along the spiral arc
    float ripple = sin(uv.x * 14.0 - uTime * 5.6 + uPhase) * (0.14 + uLoadSurge * 0.24);
    pos.z += ripple + uLoadSurge * (uv.x * 1.6 - 0.5);
    pos.xy *= (1.18 - uLoadSurge * 0.28 + 0.08 * sin(uTime * 3.0 + uv.x * 6.0));

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    vViewPos = -mvPos.xyz;
    vNormalView = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const HELIX_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uLoadSurge;
  uniform vec3 uColorDeep;
  uniform vec3 uColorBright;
  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewPos;

  void main() {
    vec3 N = normalize(vNormalView);
    vec3 V = normalize(vViewPos);
    float fresnel = pow(1.0 - clamp(abs(dot(N, V)), 0.0, 1.0), 1.9);

    float stream = smoothstep(0.1, 0.95, 0.5 + 0.5 * sin(vUv.x * 16.0 - uTime * 6.5));
    float edgeMask = smoothstep(0.0, 0.22, vUv.y) * smoothstep(1.0, 0.78, vUv.y);
    float tipFade = smoothstep(0.0, 0.16, vUv.x) * smoothstep(1.0, 0.82, vUv.x);

    vec3 col = mix(uColorDeep, uColorBright, clamp(stream * 0.65 + fresnel * 0.55, 0.0, 1.0));
    col = mix(col, vec3(0.94, 1.0, 0.97), fresnel * 0.55);

    float alpha = clamp(uLoadSurge * 0.88 * tipFade * (0.45 + 0.55 * edgeMask) * (0.65 + 0.35 * stream), 0.0, 0.92);
    gl_FragColor = vec4(col, alpha);
  }
`;

function detectSoftwareWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export const OpeningScreen: React.FC<OpeningScreenProps> = ({ onContinue }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const pointerTargetRef = useRef({ x: 0, y: 0 });
  const pointerCurrRef = useRef({ x: 0, y: 0 });
  const loadTargetRef = useRef(0);
  const loadCurrRef = useRef(0);
  const launchRafRef = useRef(0);
  const launchTimeoutRef = useRef(0);

  const [phase, setPhase] = useState<'idle' | 'loading' | 'exiting'>('idle');
  const [loadPct, setLoadPct] = useState(0);
  const [webglReady, setWebglReady] = useState(true);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(launchRafRef.current);
      clearTimeout(launchTimeoutRef.current);
    };
  }, []);

  const handleLaunch = useCallback(() => {
    if (phase !== 'idle') return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    setPhase('loading');
    loadTargetRef.current = 1;

    if (prefersReducedMotion) {
      setLoadPct(100);
      setPhase('exiting');
      launchTimeoutRef.current = window.setTimeout(() => onContinue(), 120);
      return;
    }

    const durationMs = 920;
    const startAt = performance.now();

    const stepProgress = (now: number) => {
      const t = Math.min(1, (now - startAt) / durationMs);
      // Smooth cubic ease-in-out curve
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      setLoadPct(Math.min(100, Math.round(eased * 100)));

      if (t < 1) {
        launchRafRef.current = requestAnimationFrame(stepProgress);
      } else {
        setPhase('exiting');
        launchTimeoutRef.current = window.setTimeout(() => {
          onContinue();
        }, 280);
      }
    };

    launchRafRef.current = requestAnimationFrame(stepProgress);
  }, [onContinue, phase]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        handleLaunch();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleLaunch]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const isSoftwareGl = detectSoftwareWebGL();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglReady(false);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(
      container.clientWidth || window.innerWidth,
      container.clientHeight || window.innerHeight
    );
    renderer.setClearColor(0x000000, 0);

    const domCanvas = renderer.domElement;
    domCanvas.style.width = '100%';
    domCanvas.style.height = '100%';
    domCanvas.style.display = 'block';
    container.appendChild(domCanvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      42,
      (container.clientWidth || window.innerWidth) /
        Math.max(1, container.clientHeight || window.innerHeight),
      0.1,
      100
    );
    camera.position.set(0, 0, 11.5);

    const disposables: { dispose: () => void }[] = [];
    const ribbonMaterials: THREE.ShaderMaterial[] = [];
    const helixMaterials: THREE.ShaderMaterial[] = [];

    const buildRibbonGeometry = (curvePts: THREE.Vector3[], width: number, segsU = 96, segsV = 20) => {
      const curve = new THREE.CatmullRomCurve3(curvePts);
      const geo = new THREE.BufferGeometry();
      const positions: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];

      const up = new THREE.Vector3(0, 0, 1);
      for (let i = 0; i <= segsU; i++) {
        const u = i / segsU;
        const pt = curve.getPoint(u);
        const tangent = curve.getTangent(u).normalize();
        const binormal = new THREE.Vector3().crossVectors(tangent, up).normalize();
        const wFactor = Math.sin(u * Math.PI) * 0.55 + 0.45;
        const halfW = width * 0.5 * wFactor;

        for (let j = 0; j <= segsV; j++) {
          const v = j / segsV;
          const offset = (v - 0.5) * 2 * halfW;
          const vx = pt.x + binormal.x * offset;
          const vy = pt.y + binormal.y * offset;
          const vz = pt.z + Math.sin(v * Math.PI) * 0.22;
          positions.push(vx, vy, vz);
          uvs.push(u, v);
        }
      }

      for (let i = 0; i < segsU; i++) {
        for (let j = 0; j < segsV; j++) {
          const a = i * (segsV + 1) + j;
          const b = (i + 1) * (segsV + 1) + j;
          const c = (i + 1) * (segsV + 1) + (j + 1);
          const d = i * (segsV + 1) + (j + 1);
          indices.push(a, b, d, b, c, d);
        }
      }

      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      return geo;
    };

    const createCornerRibbon = (opts: {
      curvePts: THREE.Vector3[];
      width: number;
      deep: number;
      mid: number;
      light: number;
      opacity: number;
      phase: number;
      side: number;
      tiltZ: number;
    }) => {
      const geo = buildRibbonGeometry(opts.curvePts, opts.width);
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uPointer: { value: new THREE.Vector2(0, 0) },
          uPhase: { value: opts.phase },
          uSide: { value: opts.side },
          uLoadSurge: { value: 0 },
          uColorDeep: { value: new THREE.Color(opts.deep) },
          uColorMid: { value: new THREE.Color(opts.mid) },
          uColorLight: { value: new THREE.Color(opts.light) },
          uOpacity: { value: opts.opacity },
        },
        vertexShader: RIBBON_VERTEX_SHADER,
        fragmentShader: RIBBON_FRAGMENT_SHADER,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.z = opts.tiltZ;
      scene.add(mesh);
      disposables.push(geo, mat);
      ribbonMaterials.push(mat);
      return mesh;
    };

    // Top-left sweeping emerald glass ribbon cluster
    createCornerRibbon({
      curvePts: [
        new THREE.Vector3(-10.5, 5.2, -0.4),
        new THREE.Vector3(-7.4, 3.8, 0.3),
        new THREE.Vector3(-4.6, 2.2, 0.1),
        new THREE.Vector3(-2.1, 4.9, -0.6),
      ],
      width: 2.35,
      deep: 0x047857,
      mid: 0x10b981,
      light: 0xa7f3d0,
      opacity: 0.72,
      phase: 0.2,
      side: 1.0,
      tiltZ: 0.04,
    });
    createCornerRibbon({
      curvePts: [
        new THREE.Vector3(-10.8, 2.6, -0.8),
        new THREE.Vector3(-7.6, 1.5, 0.4),
        new THREE.Vector3(-4.8, 3.1, 0.2),
        new THREE.Vector3(-1.4, 5.4, -0.9),
      ],
      width: 1.55,
      deep: 0x059669,
      mid: 0x34d399,
      light: 0xd1fae5,
      opacity: 0.62,
      phase: 1.7,
      side: 1.0,
      tiltZ: -0.03,
    });
    createCornerRibbon({
      curvePts: [
        new THREE.Vector3(-9.8, 0.4, -1.2),
        new THREE.Vector3(-6.9, 1.9, -0.2),
        new THREE.Vector3(-4.4, 3.8, 0.5),
        new THREE.Vector3(-2.6, 5.8, -0.4),
      ],
      width: 0.95,
      deep: 0x065f46,
      mid: 0x00d992,
      light: 0xffffff,
      opacity: 0.55,
      phase: 3.1,
      side: 1.0,
      tiltZ: 0.02,
    });

    // Bottom-right flowing emerald glass ribbon cluster
    createCornerRibbon({
      curvePts: [
        new THREE.Vector3(1.6, -5.2, -0.5),
        new THREE.Vector3(4.9, -3.5, 0.3),
        new THREE.Vector3(7.6, -1.7, 0.2),
        new THREE.Vector3(10.6, 0.9, -0.7),
      ],
      width: 2.4,
      deep: 0x047857,
      mid: 0x10b981,
      light: 0xa7f3d0,
      opacity: 0.74,
      phase: 0.9,
      side: -1.0,
      tiltZ: -0.04,
    });
    createCornerRibbon({
      curvePts: [
        new THREE.Vector3(2.8, -5.6, -0.9),
        new THREE.Vector3(5.8, -2.5, 0.5),
        new THREE.Vector3(8.2, -3.0, 0.1),
        new THREE.Vector3(10.9, -0.8, -0.6),
      ],
      width: 1.65,
      deep: 0x059669,
      mid: 0x34d399,
      light: 0xecfdf5,
      opacity: 0.64,
      phase: 2.3,
      side: -1.0,
      tiltZ: 0.03,
    });
    createCornerRibbon({
      curvePts: [
        new THREE.Vector3(-0.2, -5.4, -1.1),
        new THREE.Vector3(4.2, -4.1, -0.1),
        new THREE.Vector3(7.3, -2.1, 0.4),
        new THREE.Vector3(10.3, -3.6, -0.4),
      ],
      width: 1.05,
      deep: 0x064e3b,
      mid: 0x14b8a6,
      light: 0xffffff,
      opacity: 0.56,
      phase: 4.1,
      side: -1.0,
      tiltZ: -0.02,
    });

    // 3D Flowing Green Loading Vortex Ribbons (triggered on Continue -> loading phase)
    const loadingGroup = new THREE.Group();
    scene.add(loadingGroup);

    const helixCount = 3;
    for (let h = 0; h < helixCount; h++) {
      const pts: THREE.Vector3[] = [];
      const turns = 1.45;
      const steps = 32;
      const baseAngle = (h * Math.PI * 2) / helixCount;
      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        const theta = baseAngle + u * Math.PI * 2 * turns;
        const radius = 5.4 - u * 3.1;
        const x = Math.cos(theta) * radius;
        const y = Math.sin(theta) * radius * 0.72;
        const z = -2.2 + u * 4.4;
        pts.push(new THREE.Vector3(x, y, z));
      }
      const geo = buildRibbonGeometry(pts, 0.68 - h * 0.08, 100, 14);
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uLoadSurge: { value: 0 },
          uPhase: { value: h * 1.4 },
          uColorDeep: { value: new THREE.Color(h === 0 ? 0x047857 : 0x059669) },
          uColorBright: { value: new THREE.Color(h === 2 ? 0x6ee7b7 : 0x10b981) },
        },
        vertexShader: HELIX_VERTEX_SHADER,
        fragmentShader: HELIX_FRAGMENT_SHADER,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = 0.25 * (h - 1);
      loadingGroup.add(mesh);
      disposables.push(geo, mat);
      helixMaterials.push(mat);
    }

    // Subtle luminous floating emerald particles (surge into a flowing stream on Continue)
    const particleCount = 68;
    const pPos = new Float32Array(particleCount * 3);
    const pBase = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const topLeftCluster = i % 2 === 0;
      const px = topLeftCluster
        ? -8.5 + Math.random() * 5.6
        : 2.6 + Math.random() * 6.4;
      const py = topLeftCluster
        ? 0.6 + Math.random() * 4.4
        : -5.0 + Math.random() * 4.4;
      const pz = -1.4 + Math.random() * 2.2;
      pPos[i * 3] = px;
      pPos[i * 3 + 1] = py;
      pPos[i * 3 + 2] = pz;
      pBase[i * 3] = px;
      pBase[i * 3 + 1] = py;
      pBase[i * 3 + 2] = pz;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0x10b981,
      size: 0.09,
      transparent: true,
      opacity: 0.44,
      depthWrite: false,
    });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);
    disposables.push(pGeo, pMat);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = Math.max(1, container.clientHeight || window.innerHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    const handleContextLost = (ev: Event) => {
      ev.preventDefault();
      setWebglReady(false);
    };
    const handleContextRestored = () => {
      setWebglReady(true);
    };
    domCanvas.addEventListener('webglcontextlost', handleContextLost);
    domCanvas.addEventListener('webglcontextrestored', handleContextRestored);

    let disposed = false;
    let frameId = 0;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;

      pointerCurrRef.current.x = THREE.MathUtils.damp(
        pointerCurrRef.current.x,
        pointerTargetRef.current.x,
        4.5,
        dt
      );
      pointerCurrRef.current.y = THREE.MathUtils.damp(
        pointerCurrRef.current.y,
        pointerTargetRef.current.y,
        4.5,
        dt
      );
      loadCurrRef.current = THREE.MathUtils.damp(
        loadCurrRef.current,
        loadTargetRef.current,
        5.5,
        dt
      );
      const surge = loadCurrRef.current;

      // Smooth 3D camera push & FOV widening during Continue -> load surge
      const targetCamZ = 11.5 - surge * 3.1;
      const targetFov = 42 + surge * 8.5;
      camera.position.z = THREE.MathUtils.damp(camera.position.z, targetCamZ, 5.0, dt);
      if (Math.abs(camera.fov - targetFov) > 0.02) {
        camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 5.0, dt);
        camera.updateProjectionMatrix();
      }

      for (const mat of ribbonMaterials) {
        mat.uniforms.uTime.value = elapsed;
        mat.uniforms.uLoadSurge.value = surge;
        mat.uniforms.uPointer.value.set(pointerCurrRef.current.x, pointerCurrRef.current.y);
      }

      loadingGroup.rotation.z += dt * (0.2 + surge * 2.4);
      loadingGroup.rotation.y = Math.sin(elapsed * 0.9) * 0.28 * surge;
      for (const hMat of helixMaterials) {
        hMat.uniforms.uTime.value = elapsed;
        hMat.uniforms.uLoadSurge.value = surge;
      }

      pMat.opacity = 0.44 + surge * 0.46;
      pMat.size = 0.09 + surge * 0.06;
      const attr = pGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < particleCount; i++) {
        const bx = pBase[i * 3];
        const by = pBase[i * 3 + 1];
        const bz = pBase[i * 3 + 2];
        const angle = surge * (1.2 + (i % 5) * 0.25);
        const ca = Math.cos(angle);
        const sa = Math.sin(angle);
        const sx = (bx * ca - by * sa) * (1 - surge * 0.24);
        const sy = (bx * sa + by * ca) * (1 - surge * 0.24);
        attr.setXYZ(
          i,
          sx + Math.sin(elapsed * (0.45 + surge * 2.5) + i) * (0.16 + surge * 0.25),
          sy + Math.cos(elapsed * (0.55 + surge * 2.5) + i * 0.7) * (0.18 + surge * 0.25),
          bz + surge * (2.6 + (i % 7) * 0.4)
        );
      }
      attr.needsUpdate = true;

      renderer.render(scene, camera);

      if (!prefersReducedMotion) {
        if (isSoftwareGl) afterDraw(tick);
        else frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      domCanvas.removeEventListener('webglcontextlost', handleContextLost);
      domCanvas.removeEventListener('webglcontextrestored', handleContextRestored);
      for (const d of disposables) d.dispose();
      renderer.dispose();
      if (domCanvas.parentNode === container) {
        container.removeChild(domCanvas);
      }
    };
  }, []);

  const isLoading = phase === 'loading';
  const isExiting = phase === 'exiting';

  return (
    <div
      data-testid="opening-screen"
      onPointerMove={(e) => {
        const nx = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
        const ny = -((e.clientY / Math.max(1, window.innerHeight)) * 2 - 1);
        pointerTargetRef.current = { x: nx, y: ny };
      }}
      style={{
        background:
          'radial-gradient(circle at 50% 44%, #f7fffb 0%, #e7fdf3 48%, #c7f9e5 100%)',
      }}
      className={`fixed inset-0 z-50 flex items-center justify-center overflow-hidden select-none transition-all duration-300 ease-out ${
        isExiting ? 'opacity-0 scale-[1.03] pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Subtle diagonal specular studio light rays behind centerpiece */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-500"
        style={{
          background:
            'linear-gradient(125deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0) 36%, rgba(16,185,129,0.12) 55%, rgba(255,255,255,0) 78%)',
          opacity: isLoading ? 1 : 0.78,
        }}
      />

      {/* CSS 3D Flowing Emerald Energy Halo & Fallback Waves during loading */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-all duration-700 ${
          isLoading ? 'opacity-100 scale-110' : 'opacity-0 scale-75'
        }`}
      >
        <div
          className="w-[540px] h-[540px] rounded-full border-2 border-emerald-400/35"
          style={{
            transform: isLoading
              ? 'perspective(800px) rotateX(62deg) rotateZ(45deg) scale(1.15)'
              : 'perspective(800px) rotateX(62deg) rotateZ(0deg) scale(0.75)',
            boxShadow: '0 0 80px 14px rgba(16, 185, 129, 0.24), inset 0 0 60px rgba(52, 211, 153, 0.2)',
            transition: 'transform 900ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </div>

      {/* Styled SVG fallback corner ribbons if WebGL context is unavailable */}
      {!webglReady && (
        <svg
          aria-hidden="true"
          viewBox="0 0 1440 900"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 w-full h-full opacity-75 transition-transform duration-700"
          style={{
            transform: isLoading ? 'scale(1.12)' : 'scale(1)',
          }}
        >
          <defs>
            <linearGradient id="sparkFallbackRibbon" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#059669" stopOpacity="0.65" />
              <stop offset="50%" stopColor="#34d399" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#a7f3d0" stopOpacity="0.15" />
            </linearGradient>
          </defs>
          <path
            d="M-40,340 C160,260 280,140 440,-20 L-40,-20 Z"
            fill="url(#sparkFallbackRibbon)"
          />
          <path
            d="M1480,520 C1220,620 1120,760 980,920 L1480,920 Z"
            fill="url(#sparkFallbackRibbon)"
          />
        </svg>
      )}

      {/* Three.js 3D Animated Flowing Green Ribbons & Vortex */}
      <div
        ref={mountRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 w-full h-full"
      />

      {/* Center Hero Lockup */}
      <main className="relative z-10 flex flex-col items-center justify-center px-6 py-10 text-center max-w-2xl w-full">
        {/* Glassy 3D-Shaded Spark "S" + Lightning Bolt + Orbital Spheres Emblem */}
        <div
          className="relative mb-5 transition-transform duration-700 ease-out"
          style={{
            filter: isLoading
              ? 'drop-shadow(0 24px 44px rgba(5, 150, 105, 0.42))'
              : 'drop-shadow(0 18px 34px rgba(5, 150, 105, 0.28))',
            transform: isLoading
              ? 'perspective(760px) rotateY(16deg) scale(1.06) translateY(-6px)'
              : 'perspective(760px) rotateY(0deg) scale(1) translateY(0)',
          }}
        >
          <svg
            viewBox="0 0 260 210"
            className="w-48 h-40 sm:w-56 sm:h-44"
            role="img"
            aria-label="Spark glass emblem"
          >
            <defs>
              <linearGradient id="glassEmeraldTop" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#a7f3d0" />
                <stop offset="35%" stopColor="#10b981" />
                <stop offset="72%" stopColor="#047857" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
              <linearGradient id="glassEmeraldBottom" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#6ee7b7" />
                <stop offset="45%" stopColor="#059669" />
                <stop offset="100%" stopColor="#064e3b" />
              </linearGradient>
              <linearGradient id="orbitalGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="50%" stopColor="#a7f3d0" />
                <stop offset="100%" stopColor="#047857" />
              </linearGradient>
              <radialGradient id="orbSphere" cx="35%" cy="32%" r="65%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="32%" stopColor="#6ee7b7" />
                <stop offset="75%" stopColor="#059669" />
                <stop offset="100%" stopColor="#064e3b" />
              </radialGradient>
              <linearGradient id="boltGlow" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#065f46" />
                <stop offset="50%" stopColor="#047857" />
                <stop offset="100%" stopColor="#064e3b" />
              </linearGradient>
            </defs>

            {/* Back half of tilted orbital ring */}
            <path
              d="M52,148 C34,116 66,58 130,30 C178,10 212,20 206,46"
              fill="none"
              stroke="url(#orbitalGrad)"
              strokeWidth="4.2"
              strokeLinecap="round"
              opacity="0.88"
            />

            {/* Sculpted "S" Upper Glass Ribbon */}
            <path
              d="M174,34 L112,34 C82,34 68,54 74,77 C80,99 102,107 132,110 C152,112 162,118 164,128 C166,105 152,92 126,88 C104,85 96,77 98,66 C100,56 112,51 132,51 L160,51 Z"
              fill="url(#glassEmeraldTop)"
              stroke="#ecfdf5"
              strokeWidth="1.6"
              opacity="0.95"
            />
            <path
              d="M174,34 L112,34 C84,34 70,52 75,74 C88,61 108,52 136,52 L160,52 L174,34 Z"
              fill="#ffffff"
              opacity="0.28"
            />

            {/* Sculpted "S" Lower Glass Ribbon */}
            <path
              d="M84,174 L148,174 C178,174 192,152 184,126 C177,104 152,96 124,93 C103,90 94,84 92,74 C90,99 106,112 132,116 C155,119 163,128 160,141 C157,151 144,157 124,157 L96,157 Z"
              fill="url(#glassEmeraldBottom)"
              stroke="#d1fae5"
              strokeWidth="1.6"
              opacity="0.95"
            />
            <path
              d="M84,174 L148,174 C172,174 185,158 184,139 C169,153 150,158 122,158 L96,158 Z"
              fill="#ffffff"
              opacity="0.22"
            />

            {/* Central Lightning Bolt */}
            <path
              d="M139,66 L112,107 L130,107 L120,145 L149,100 L131,100 Z"
              fill="url(#boltGlow)"
              stroke="#ecfdf5"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />

            {/* Front arc of tilted orbital ring */}
            <path
              d="M206,46 C214,76 178,136 112,164 C74,180 56,168 52,148"
              fill="none"
              stroke="url(#orbitalGrad)"
              strokeWidth="3.6"
              strokeLinecap="round"
              opacity="0.92"
            />

            {/* Orbital Glass Spheres */}
            <circle cx="204" cy="46" r="10.5" fill="url(#orbSphere)" stroke="#ecfdf5" strokeWidth="1.2" />
            <circle cx="54" cy="148" r="8.5" fill="url(#orbSphere)" stroke="#ecfdf5" strokeWidth="1.2" />
          </svg>
        </div>

        {/* SPARK Wordmark matching mockup */}
        <h1
          className="text-4xl sm:text-5xl md:text-[54px] font-semibold tracking-[0.34em] text-[#053b2b] pl-[0.34em] leading-none flex items-center justify-center"
          style={{ fontFamily: '"Outfit", "Plus Jakarta Sans", sans-serif' }}
        >
          <span>SP</span>
          <span className="relative inline-flex items-center justify-center mx-[0.02em]">
            <span>A</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 18"
              className="w-3.5 h-3 absolute bottom-[0.14em] left-1/2 -translate-x-1/2 pointer-events-none"
            >
              <polygon points="12,3 22,17 2,17" fill="#00e599" />
            </svg>
          </span>
          <span>RK</span>
        </h1>

        {/* Tagline with Hairline Flanks */}
        <div className="mt-4 flex items-center justify-center gap-4 w-full max-w-md">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#0f684b]/45" />
          <p className="text-base sm:text-lg italic font-medium text-[#0c5940] tracking-wide whitespace-nowrap">
            Build with Creativity
          </p>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#0f684b]/45" />
        </div>

        {/* Capabilities Strip (Unboxed clean typography with middot separators) */}
        <p className="mt-4 text-[11px] sm:text-xs font-semibold tracking-[0.26em] text-[#0e5a42]/85 uppercase whitespace-nowrap">
          DESIGN <span className="mx-1.5 text-emerald-600/70">·</span> SIMULATE{' '}
          <span className="mx-1.5 text-emerald-600/70">·</span> CODE{' '}
          <span className="mx-1.5 text-emerald-600/70">·</span> EXPLORE
        </p>

        {/* Primary Continue Button -> Morphs into 3D Loading Indicator when clicked */}
        {phase === 'idle' ? (
          <button
            type="button"
            data-testid="opening-continue-btn"
            onClick={handleLaunch}
            className="mt-9 group relative inline-flex items-center justify-center gap-3 px-10 py-3.5 rounded-full text-base font-semibold text-white whitespace-nowrap shrink-0 transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400/55 cursor-pointer"
            style={{
              background: 'linear-gradient(180deg, #10d494 0%, #059669 55%, #047857 100%)',
              boxShadow:
                '0 14px 30px -6px rgba(5, 150, 105, 0.52), inset 0 1.5px 1px rgba(255, 255, 255, 0.65), inset 0 -2px 4px rgba(4, 78, 59, 0.45)',
              border: '1px solid rgba(167, 243, 208, 0.8)',
            }}
          >
            <Play className="w-4 h-4 fill-white text-white transition-transform duration-200 group-hover:translate-x-0.5" />
            <span>Continue</span>
            <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
          </button>
        ) : (
          <div
            role="progressbar"
            aria-label="Loading Spark workspace"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={loadPct}
            data-testid="opening-loading-bar"
            className="mt-9 w-64 sm:w-72 flex flex-col items-center gap-2.5"
          >
            <div className="flex items-center justify-between w-full px-1 text-xs font-semibold text-[#064e3b]">
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />
                <span>Loading workspace</span>
              </span>
              <span className="font-mono tabular-nums text-emerald-800">{loadPct}%</span>
            </div>
            <div className="relative w-full h-2.5 rounded-full overflow-hidden bg-emerald-950/15 border border-emerald-500/35 shadow-inner">
              <div
                className="h-full rounded-full transition-[width] duration-75 ease-out"
                style={{
                  width: `${loadPct}%`,
                  background: 'linear-gradient(90deg, #059669 0%, #10b981 55%, #6ee7b7 100%)',
                  boxShadow: '0 0 12px rgba(16, 185, 129, 0.65)',
                }}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
