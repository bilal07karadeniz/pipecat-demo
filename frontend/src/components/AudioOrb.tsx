import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';
import * as THREE from 'three';

export type AgentState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface AudioOrbProps {
  agentState: AgentState;
  getOutputVolume: () => number;
  getInputVolume: () => number;
}

// Custom shader material for the orb
const vertexShader = `
  uniform float uTime;
  uniform float uVolume;
  uniform float uAgentActivity;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying float vDisplacement;

  // Simplex noise function
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  void main() {
    vUv = uv;
    vNormal = normal;

    // Create smooth organic displacement - lower frequency = larger, smoother waves
    float noiseFreq = 1.0 + uVolume * 0.5;
    float noiseAmp = 0.08 + uVolume * 0.2 + uAgentActivity * 0.05;

    // Slower animation for more elegant movement
    vec3 noisePos = position + uTime * 0.15;
    float noise = snoise(noisePos * noiseFreq) * noiseAmp;

    // Single noise layer for smooth surface (removed secondary layer)
    vDisplacement = noise;

    vec3 newPosition = position + normal * vDisplacement;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform float uVolume;
  uniform float uAgentActivity;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying float vDisplacement;

  void main() {
    // Create gradient based on displacement and normals
    float fresnel = pow(1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);

    // Mix colors based on displacement and activity
    vec3 color = mix(uColor1, uColor2, vDisplacement * 2.0 + 0.5);
    color = mix(color, uColor3, fresnel * (0.5 + uVolume * 0.5));

    // Add glow effect
    float glow = fresnel * (0.3 + uAgentActivity * 0.4 + uVolume * 0.3);
    color += glow * uColor3;

    // Add subtle pulse
    float pulse = sin(uTime * 3.0) * 0.05 * uAgentActivity;
    color += pulse;

    gl_FragColor = vec4(color, 1.0);
  }
`;

// State-based colors
const stateColors = {
  idle: {
    color1: new THREE.Color(0.2, 0.1, 0.3),
    color2: new THREE.Color(0.3, 0.2, 0.5),
    color3: new THREE.Color(0.5, 0.3, 0.7),
  },
  listening: {
    color1: new THREE.Color(0.1, 0.2, 0.4),
    color2: new THREE.Color(0.2, 0.4, 0.6),
    color3: new THREE.Color(0.3, 0.6, 0.9),
  },
  thinking: {
    color1: new THREE.Color(0.3, 0.2, 0.1),
    color2: new THREE.Color(0.5, 0.4, 0.2),
    color3: new THREE.Color(0.8, 0.6, 0.3),
  },
  speaking: {
    color1: new THREE.Color(0.2, 0.3, 0.2),
    color2: new THREE.Color(0.3, 0.5, 0.3),
    color3: new THREE.Color(0.4, 0.8, 0.5),
  },
};

interface OrbMeshProps {
  agentState: AgentState;
  getOutputVolume: () => number;
  getInputVolume: () => number;
}

function OrbMesh({ agentState, getOutputVolume, getInputVolume }: OrbMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // Smoothed values for transitions
  const smoothedVolume = useRef(0);
  const smoothedActivity = useRef(0);
  const currentColors = useRef({
    color1: stateColors.idle.color1.clone(),
    color2: stateColors.idle.color2.clone(),
    color3: stateColors.idle.color3.clone(),
  });

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uVolume: { value: 0 },
      uAgentActivity: { value: 0 },
      uColor1: { value: stateColors.idle.color1 },
      uColor2: { value: stateColors.idle.color2 },
      uColor3: { value: stateColors.idle.color3 },
    }),
    []
  );

  useFrame((state) => {
    if (!materialRef.current) return;

    const time = state.clock.getElapsedTime();

    // Get current volume based on state
    let targetVolume = 0;
    let targetActivity = 0;

    if (agentState === 'speaking') {
      targetVolume = getOutputVolume();
      targetActivity = 1;
    } else if (agentState === 'listening') {
      targetVolume = getInputVolume();
      targetActivity = 0.7;
    } else if (agentState === 'thinking') {
      targetVolume = 0.3 + Math.sin(time * 4) * 0.2;
      targetActivity = 0.8;
    } else {
      targetVolume = 0.1 + Math.sin(time * 2) * 0.05;
      targetActivity = 0.2;
    }

    // Smooth transitions
    smoothedVolume.current += (targetVolume - smoothedVolume.current) * 0.15;
    smoothedActivity.current += (targetActivity - smoothedActivity.current) * 0.1;

    // Smooth color transitions
    const targetColors = stateColors[agentState];
    currentColors.current.color1.lerp(targetColors.color1, 0.05);
    currentColors.current.color2.lerp(targetColors.color2, 0.05);
    currentColors.current.color3.lerp(targetColors.color3, 0.05);

    // Update uniforms
    materialRef.current.uniforms.uTime.value = time;
    materialRef.current.uniforms.uVolume.value = smoothedVolume.current;
    materialRef.current.uniforms.uAgentActivity.value = smoothedActivity.current;
    materialRef.current.uniforms.uColor1.value = currentColors.current.color1;
    materialRef.current.uniforms.uColor2.value = currentColors.current.color2;
    materialRef.current.uniforms.uColor3.value = currentColors.current.color3;

    // Rotate slowly
    if (meshRef.current) {
      meshRef.current.rotation.y = time * 0.1;
      meshRef.current.rotation.x = Math.sin(time * 0.2) * 0.1;
    }
  });

  return (
    <Sphere ref={meshRef} args={[1.5, 128, 128]}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </Sphere>
  );
}

export function AudioOrb({ agentState, getOutputVolume, getInputVolume }: AudioOrbProps) {
  return (
    <div className="w-full h-full bg-black">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.2} />
        <pointLight position={[10, 10, 10]} intensity={0.5} />
        <OrbMesh
          agentState={agentState}
          getOutputVolume={getOutputVolume}
          getInputVolume={getInputVolume}
        />
      </Canvas>
    </div>
  );
}

// WebGL detection utility
export function hasWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}
