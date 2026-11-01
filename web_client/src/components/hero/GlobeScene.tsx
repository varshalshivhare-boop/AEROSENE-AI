'use client';

import React, { useRef, useMemo, Suspense, useEffect } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { OrbitControls, Line } from '@react-three/drei';
import * as THREE from 'three';

// Coordinate conversion for equirectangular earth texture (lon, lat -> 3D point)
function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

// ---- Camera Zoom Controller with Dynamic FOV Warp ----

function CameraZoomController({ isZooming }: { isZooming?: boolean }) {
  const { camera } = useThree();
  const progressRef = useRef(0);

  useFrame((_, delta) => {
    if (isZooming) {
      progressRef.current += delta;
      // Smooth cubic acceleration curve
      const t = Math.min(progressRef.current / 1.15, 1);
      const easeT = t * t * (3 - 2 * t);

      // Camera dives straight into India (22.5° N, 78.9° E)
      camera.position.z = THREE.MathUtils.lerp(4.3, 1.45, easeT);
      camera.position.y = THREE.MathUtils.lerp(0, 0.48, easeT);
      camera.position.x = THREE.MathUtils.lerp(0, 0.12, easeT);

      // Hyper-speed FOV warp expansion
      if ('fov' in camera) {
        const persCamera = camera as THREE.PerspectiveCamera;
        persCamera.fov = THREE.MathUtils.lerp(42, 65, easeT);
        persCamera.updateProjectionMatrix();
      }
    }
  });

  return null;
}

// ---- Hypersonic Atmospheric Warp Streak Particles ----

function WarpStreaks({ isZooming }: { isZooming?: boolean }) {
  const count = 160;
  const meshRef = useRef<THREE.Points>(null);

  const [positions, speeds] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 5.5;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 5.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 4 + 1.5;
      spd[i] = 1.2 + Math.random() * 2.8;
    }
    return [pos, spd];
  }, []);

  useFrame((_, delta) => {
    if (!meshRef.current || !isZooming) return;
    const pos = meshRef.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 2] += delta * speeds[i] * 14;
      if (pos[i * 3 + 2] > 5) {
        pos[i * 3 + 2] = -1.5;
      }
    }
    meshRef.current.geometry.attributes.position.needsUpdate = true;
  });

  if (!isZooming) return null;

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.055}
        color="#38c1d6"
        transparent
        opacity={0.85}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ---- Realistic Earth Sphere ----

function RealisticEarth({ radius = 1.55, isZooming }: { radius?: number; isZooming?: boolean }) {
  const earthRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const pulseRingRef = useRef<THREE.Mesh>(null);

  // Load real NASA / Satellite textures
  const [colorMap, bumpMap, waterMap, cloudsMap] = useLoader(THREE.TextureLoader, [
    '/textures/earth-blue-marble.jpg',
    '/textures/earth-topology.png',
    '/textures/earth-water.png',
    '/textures/earth-clouds.png',
  ]);

  // Initial orientation: rotate to face India (78°E, 22°N) directly to the user
  const initialRotationDone = useRef(false);

  useFrame((_, delta) => {
    if (earthRef.current) {
      if (!initialRotationDone.current) {
        // -Math.PI * 0.18 or Math.PI * 1.82 accurately faces India (78°E) right to the camera
        earthRef.current.rotation.y = -Math.PI * 0.18;
        earthRef.current.rotation.z = THREE.MathUtils.degToRad(-12);
        if (cloudsRef.current) {
          cloudsRef.current.rotation.y = -Math.PI * 0.18;
          cloudsRef.current.rotation.z = THREE.MathUtils.degToRad(-12);
        }
        initialRotationDone.current = true;
      }

      // Gentle natural rotation when not zooming
      if (!isZooming) {
        earthRef.current.rotation.y += delta * 0.035;
      }
    }

    // Clouds move slightly faster
    if (cloudsRef.current && !isZooming) {
      cloudsRef.current.rotation.y += delta * 0.048;
    }

    // Concentric pulse on India
    if (pulseRingRef.current) {
      const s = 1 + Math.sin(Date.now() * 0.003) * 0.25;
      pulseRingRef.current.scale.set(s, s, s);
    }
  });

  // Target points in India
  const indiaCities = useMemo(
    () => [
      { name: 'Delhi NCR', lat: 28.61, lon: 77.23, aqi: 187, color: '#ef4444' },
      { name: 'Mumbai', lat: 19.07, lon: 72.87, aqi: 132, color: '#f59e0b' },
      { name: 'Bengaluru', lat: 12.97, lon: 77.59, aqi: 48, color: '#10b981' },
      { name: 'Kolkata', lat: 22.57, lon: 88.36, aqi: 156, color: '#ef4444' },
      { name: 'Varanasi', lat: 25.31, lon: 82.97, aqi: 168, color: '#ef4444' },
    ],
    []
  );

  // India center vector for radar beacon
  const indiaCenter = useMemo(() => latLonToVector3(22.5, 78.9, radius), [radius]);
  const normalIndia = useMemo(() => indiaCenter.clone().normalize(), [indiaCenter]);

  return (
    <group>
      {/* 1. Earth Body with real landmasses, oceans, and topography */}
      <mesh ref={earthRef}>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshPhongMaterial
          map={colorMap}
          bumpMap={bumpMap}
          bumpScale={0.04}
          specularMap={waterMap}
          specular={new THREE.Color('#38bdf8')}
          shininess={16}
        />

        {/* Monitoring beacons on Indian cities attached to rotating earth */}
        {indiaCities.map((city) => {
          const pos = latLonToVector3(city.lat, city.lon, radius * 1.002);
          const posBeacon = latLonToVector3(city.lat, city.lon, radius * 1.04);
          return (
            <group key={city.name}>
              {/* Ground dot */}
              <mesh position={pos}>
                <sphereGeometry args={[0.018, 12, 12]} />
                <meshBasicMaterial color={city.color} />
              </mesh>
              {/* Projected vertical sensor line */}
              <line>
                <bufferGeometry
                  attach="geometry"
                  {...(() => {
                    const geom = new THREE.BufferGeometry().setFromPoints([pos, posBeacon]);
                    return geom;
                  })()}
                />
                <lineBasicMaterial attach="material" color={city.color} transparent opacity={0.7} />
              </line>
              {/* Floating beacon light */}
              <mesh position={posBeacon}>
                <sphereGeometry args={[0.01, 8, 8]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            </group>
          );
        })}

        {/* Concentric radar ring over India region */}
        <group position={indiaCenter} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normalIndia)}>
          <mesh ref={pulseRingRef}>
            <ringGeometry args={[0.15, 0.17, 32]} />
            <meshBasicMaterial color="#38c1d6" transparent opacity={0.6} side={THREE.DoubleSide} />
          </mesh>
        </group>
      </mesh>

      {/* 2. Realistic Cloud Layer */}
      <mesh ref={cloudsRef}>
        <sphereGeometry args={[radius * 1.012, 64, 64]} />
        <meshStandardMaterial
          map={cloudsMap}
          transparent
          opacity={0.38}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* 3. Glowing Atmospheric Halo (Outer rim) */}
      <mesh>
        <sphereGeometry args={[radius * 1.15, 64, 64]} />
        <meshPhongMaterial
          color="#38c1d6"
          emissive="#0284c7"
          emissiveIntensity={0.8}
          transparent
          opacity={0.08}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// ---- Fallback Sphere while textures load ----

function EarthLoadingFallback({ radius = 1.55 }: { radius?: number }) {
  return (
    <mesh>
      <sphereGeometry args={[radius, 32, 32]} />
      <meshPhongMaterial
        color="#0c2a4d"
        emissive="#071b30"
        emissiveIntensity={0.4}
        wireframe
      />
    </mesh>
  );
}

// ---- Orbiting Environmental Satellite (Sentinel-5P) ----

function SatelliteOrbit({ isZooming }: { isZooming?: boolean }) {
  const satRef = useRef<THREE.Group>(null);
  const angle = useRef(0.8);

  useFrame((_, delta) => {
    if (!isZooming) {
      angle.current += delta * 0.35;
    }
    if (satRef.current) {
      const r = 2.15;
      const inclination = Math.PI / 3.2; // Sun-synchronous polar orbit tilt
      satRef.current.position.x = r * Math.cos(angle.current);
      satRef.current.position.y = r * Math.sin(angle.current) * Math.sin(inclination);
      satRef.current.position.z = r * Math.sin(angle.current) * Math.cos(inclination);
      satRef.current.lookAt(0, 0, 0);
    }
  });

  return (
    <group ref={satRef}>
      {/* Satellite Main Body */}
      <mesh>
        <boxGeometry args={[0.08, 0.04, 0.05]} />
        <meshStandardMaterial color="#f8fafc" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Gold foil sensor housing */}
      <mesh position={[0, -0.02, 0.02]}>
        <cylinderGeometry args={[0.015, 0.02, 0.03, 12]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Blue Solar Panels */}
      <mesh position={[0.13, 0, 0]}>
        <boxGeometry args={[0.14, 0.005, 0.08]} />
        <meshStandardMaterial color="#1e3a8a" emissive="#2563eb" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[-0.13, 0, 0]}>
        <boxGeometry args={[0.14, 0.005, 0.08]} />
        <meshStandardMaterial color="#1e3a8a" emissive="#2563eb" emissiveIntensity={0.4} />
      </mesh>
      {/* Sensor Beam Cone pointing to Earth */}
      <mesh position={[0, 0, 0.4]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.18, 0.8, 16, 1, true]} />
        <meshBasicMaterial color="#38c1d6" transparent opacity={0.08} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ---- Orbital Path Ring ----

function OrbitalTrack() {
  const ringPoints = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const r = 2.15;
    const inclination = Math.PI / 3.2;
    for (let i = 0; i <= 100; i++) {
      const a = (i / 100) * Math.PI * 2;
      pts.push(
        new THREE.Vector3(
          r * Math.cos(a),
          r * Math.sin(a) * Math.sin(inclination),
          r * Math.sin(a) * Math.cos(inclination)
        )
      );
    }
    return pts;
  }, []);

  return (
    <Line
      points={ringPoints}
      color="#38c1d6"
      lineWidth={0.8}
      transparent
      opacity={0.25}
      dashed
      dashSize={0.12}
      gapSize={0.06}
    />
  );
}

// ---- Scene Lighting ----

function RealisticLighting() {
  return (
    <>
      <ambientLight intensity={0.52} color="#e0f2fe" />
      {/* Front-centered sun so Earth is evenly illuminated in the center */}
      <directionalLight position={[0, 3, 5]} intensity={2.2} color="#fffbeb" />
      <directionalLight position={[-4, 1, 2]} intensity={0.5} color="#38c1d6" />
      <directionalLight position={[4, 1, 2]} intensity={0.5} color="#38c1d6" />
      <pointLight position={[0, -3, -4]} intensity={0.6} color="#0284c7" />
    </>
  );
}

// ---- Main Component Export ----

export interface GlobeSceneProps {
  className?: string;
  isZooming?: boolean;
  onZoomTrigger?: () => void;
}

export default function GlobeScene({ className, isZooming, onZoomTrigger }: GlobeSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Capture wheel/scroll events directly before Three.js/OrbitControls can intercept them
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !onZoomTrigger) return;

    let accumulatedScroll = 0;
    const onScroll = (e: WheelEvent) => {
      if (isZooming) return;
      accumulatedScroll += Math.abs(e.deltaY);
      if (accumulatedScroll > 12) {
        onZoomTrigger();
        accumulatedScroll = 0;
      }
    };

    el.addEventListener('wheel', onScroll, { capture: true, passive: true });
    return () => {
      el.removeEventListener('wheel', onScroll, { capture: true });
    };
  }, [onZoomTrigger, isZooming]);

  return (
    <div
      ref={containerRef}
      className={className ?? 'w-full h-full relative cursor-grab active:cursor-grabbing'}
    >
      <Canvas
        camera={{ position: [0, 0, 4.3], fov: 42 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
        style={{ background: 'transparent' }}
      >
        <RealisticLighting />
        <CameraZoomController isZooming={isZooming} />

        <Suspense fallback={<EarthLoadingFallback />}>
          <RealisticEarth radius={1.52} isZooming={isZooming} />
        </Suspense>

        <SatelliteOrbit isZooming={isZooming} />
        <OrbitalTrack />
        <WarpStreaks isZooming={isZooming} />

        {/* OrbitControls: allows user to freely click & rotate Earth */}
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate={!isZooming}
          autoRotateSpeed={0.5}
          enableDamping={true}
          dampingFactor={0.08}
          minPolarAngle={Math.PI * 0.15}
          maxPolarAngle={Math.PI * 0.85}
          rotateSpeed={0.5}
        />
      </Canvas>

      {/* Hint overlay to indicate interactivity */}
      {!isZooming && (
        <div className="absolute bottom-2 right-4 pointer-events-none flex items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
          <span className="w-1.5 h-1.5 rounded-full bg-[#38c1d6] animate-ping" />
          <span className="text-[10px] font-mono text-[#8ba8cc] tracking-wider uppercase">
            Scroll or Drag to Explore
          </span>
        </div>
      )}
    </div>
  );
}
