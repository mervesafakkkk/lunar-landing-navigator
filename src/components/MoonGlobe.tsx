import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html, OrbitControls, Stars, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useStore } from '../state/store.tsx';
import { moonGeometry } from '../lib/astro/ephemeris.ts';
import { SITES, makeCustomSite, type Site } from '../lib/sites.ts';
import type { Vec3 } from '../lib/astro/vec.ts';

/** Moon body-fixed (x→0°E, z→north) to three.js world (y up). */
const toThree = (v: Vec3) => new THREE.Vector3(v[0], v[2], -v[1]);
const latLonToThree = (lat: number, lon: number, r = 1) => {
  const la = (lat * Math.PI) / 180, lo = (lon * Math.PI) / 180;
  return new THREE.Vector3(r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo));
};

export type GlobeView = 'south' | 'site' | 'near';
import { COMPARE_COLORS } from '../lib/colors.ts';

export function MoonGlobe({ view, viewNonce }: { view: GlobeView; viewNonce: number }) {
  const { state } = useStore();
  const geom = useMemo(() => moonGeometry(state.cursorMs), [state.cursorMs]);
  const sunDir = useMemo(() => toThree(geom.sun).normalize(), [geom]);
  const earthDir = useMemo(() => toThree(geom.earth).normalize(), [geom]);

  return (
    <Canvas camera={{ position: [0.55, -2.75, 0.35], fov: 38, near: 0.01, far: 200 }} dpr={[1, 2]} gl={{ antialias: true }}>
      <color attach="background" args={['#02040a']} />
      <Stars radius={60} depth={30} count={3500} factor={2.5} saturation={0} fade speed={0.3} />
      <ambientLight intensity={0.04} />
      <directionalLight position={sunDir.clone().multiplyScalar(10)} intensity={3.1} color="#fff4e0" />
      {/* Earthshine: faint bluish light from the actual Earth direction */}
      <directionalLight position={earthDir.clone().multiplyScalar(10)} intensity={0.12} color="#8fd7ff" />
      <Suspense fallback={<Html center><span className="font-mono text-xs text-ink-faint">Loading LRO imagery…</span></Html>}>
        <Moon />
      </Suspense>
      <SunMarker dir={sunDir} />
      <EarthMarker dir={earthDir} />
      <SiteMarkers />
      <CameraRig view={view} nonce={viewNonce} />
    </Canvas>
  );
}

function Moon() {
  const { set } = useStore();
  const [map, disp] = useTexture([`${import.meta.env.BASE_URL}textures/lroc_color_poles_1k.jpg`, `${import.meta.env.BASE_URL}textures/ldem_3_8bit.jpg`]);
  useEffect(() => { map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8; map.needsUpdate = true; }, [map]);
  const onDouble = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const p = e.point.clone().normalize();
    const lat = (Math.asin(p.y) * 180) / Math.PI;
    const lon = (Math.atan2(-p.z, p.x) * 180) / Math.PI;
    set({ custom: makeCustomSite(+lat.toFixed(4), +lon.toFixed(4)), siteId: 'custom' });
  };
  return (
    <mesh onDoubleClick={onDouble}>
      <sphereGeometry args={[1, 256, 128]} />
      <meshStandardMaterial map={map} displacementMap={disp} displacementScale={0.012} displacementBias={-0.006} bumpMap={disp} bumpScale={1.2} roughness={0.95} metalness={0} />
    </mesh>
  );
}

function SunMarker({ dir }: { dir: THREE.Vector3 }) {
  const pos = dir.clone().multiplyScalar(14);
  return (
    <group position={pos}>
      <mesh><sphereGeometry args={[0.35, 24, 24]} /><meshBasicMaterial color="#ffe08a" /></mesh>
      <mesh><sphereGeometry args={[0.8, 24, 24]} /><meshBasicMaterial color="#f5b82e" transparent opacity={0.18} /></mesh>
    </group>
  );
}

function EarthMarker({ dir }: { dir: THREE.Vector3 }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * 0.2; });
  const pos = dir.clone().multiplyScalar(4.2);
  return (
    <group position={pos}>
      <mesh ref={ref}>
        <sphereGeometry args={[0.16, 32, 32]} />
        <meshStandardMaterial color="#1e6fd9" emissive="#0b3a73" emissiveIntensity={0.6} roughness={0.6} />
      </mesh>
      <mesh><sphereGeometry args={[0.2, 32, 32]} /><meshBasicMaterial color="#22d3ee" transparent opacity={0.15} /></mesh>
      <Html center position={[0, 0.32, 0]}>
        <span className="pointer-events-none whitespace-nowrap font-mono text-[10px] font-bold text-earth-soft">EARTH · not to scale</span>
      </Html>
    </group>
  );
}

function SiteMarkers() {
  const { state, site, set, siteById } = useStore();
  const compare = state.compareIds.map(siteById);
  const sites: Site[] = state.custom ? [...SITES, state.custom] : SITES;
  return (
    <>
      {sites.map((s) => {
        const ci = compare.findIndex((c) => c.id === s.id);
        const selected = s.id === site.id;
        const color = selected ? '#ffffff' : ci >= 0 ? COMPARE_COLORS[ci] : '#7f8ba0';
        const p = latLonToThree(s.lat, s.lon, 1.008);
        return (
          <group key={s.id} position={p}>
            <mesh onClick={(e) => { e.stopPropagation(); set({ siteId: s.id }); }}>
              <sphereGeometry args={[selected ? 0.012 : 0.008, 16, 16]} />
              <meshBasicMaterial color={color} />
            </mesh>
            {selected && <PulseRing normal={p.clone().normalize()} />}
            {(selected || ci >= 0) && (
              <Html position={p.clone().normalize().multiplyScalar(0.02)} zIndexRange={[10, 0]}>
                <div className={`pointer-events-none -translate-y-full whitespace-nowrap rounded border px-1 py-px font-mono text-[9.5px] leading-tight backdrop-blur ${selected ? 'border-white/60 bg-void/70 text-white' : 'border-edge bg-void/60 text-ink-mute'}`}
                  style={!selected ? { color } : undefined}>
                  {s.name}
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </>
  );
}

function PulseRing({ normal }: { normal: THREE.Vector3 }) {
  const ref = useRef<THREE.Mesh>(null);
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal), [normal]);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const k = (clock.elapsedTime % 1.8) / 1.8;
    ref.current.scale.setScalar(1 + k * 2.5);
    (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
  });
  return (
    <mesh ref={ref} quaternion={q}>
      <ringGeometry args={[0.015, 0.019, 48]} />
      <meshBasicMaterial color="#22d3ee" transparent side={THREE.DoubleSide} />
    </mesh>
  );
}

function CameraRig({ view, nonce }: { view: GlobeView; nonce: number }) {
  const { site } = useStore();
  const camera = useThree((s) => s.camera);
  const controls = useRef<OrbitControlsImpl>(null);
  const target = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    if (view === 'south') target.current = new THREE.Vector3(0.55, -2.75, 0.35);
    else if (view === 'near') target.current = new THREE.Vector3(3.0, -0.2, 0.0);
    else target.current = latLonToThree(site.lat, site.lon, 1).normalize().multiplyScalar(1.9).add(new THREE.Vector3(0.25, 0, 0));
  }, [view, nonce, site.lat, site.lon]);

  useFrame(() => {
    if (!target.current) return;
    camera.position.lerp(target.current, 0.08);
    controls.current?.update();
    if (camera.position.distanceTo(target.current) < 0.005) target.current = null;
  });

  return (
    <OrbitControls
      ref={controls}
      enablePan={false}
      minDistance={1.25}
      maxDistance={7}
      rotateSpeed={0.5}
      zoomSpeed={0.6}
      onStart={() => { target.current = null; }}
    />
  );
}
