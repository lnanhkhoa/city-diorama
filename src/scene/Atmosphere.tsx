import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { setCityLights, setWaterSky } from '../kit/materials';
import { setSurface, updateSurface } from '../kit/surface';
import type { Daytime } from '../weather/api';
import type { WeatherKind } from '../weather/codes';
import type { Surface } from '../weather/surface';
import { KEY_DIR, RIM_DIR, SHADOW_RADIUS, TARGET, lightingFor } from './lighting';
import { WeatherFx } from './weatherFx';

const KEY_POS = KEY_DIR.clone().multiplyScalar(32);
const RIM_POS = RIM_DIR.clone().multiplyScalar(30);

/** Tile corners sit about this far either side of the orbit target along the view. */
const TILE_REACH = 14;
/** Fog `far` beyond the target at full strength, and with none. */
const FOG_FAR_FULL = 22;
const FOG_FAR_NONE = 400;
/** Fog strength change per second, matching the surface blend. */
const FOG_RATE = 0.5;

interface Props {
  kind: WeatherKind;
  daytime: Daytime;
  surface: Surface;
  reducedMotion: boolean;
}

/** Environment map, key/rim/sky lights, shadow catcher, depth fog, rain and snow, and the weather on surfaces. */
export function Atmosphere({ kind, daytime, surface, reducedMotion }: Props) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const [fx] = useState(() => new WeatherFx(reducedMotion));
  // Always present (at no strength it reaches nothing): adding or removing scene fog would recompile every program.
  const [fog] = useState(() => new THREE.Fog(0xffffff, FOG_FAR_NONE, FOG_FAR_NONE));
  const fogLevel = useRef(surface.fog);
  const fogColor = useRef('');
  const firstSurface = useRef(true);
  const l = useMemo(() => lightingFor(kind, daytime), [kind, daytime]);
  const { snow, wet, ice, fog: fogTarget } = surface;

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04).texture;
    pmrem.dispose();
    room.dispose();
    scene.environment = env;
    return () => {
      scene.environment = null;
      env.dispose();
    };
  }, [gl, scene]);

  useLayoutEffect(() => {
    scene.environmentIntensity = l.env;
    gl.toneMappingExposure = l.exposure;
    fx.set(kind);
    setCityLights(l.lights);
    setWaterSky(l.sky, l.hemi);
  }, [gl, scene, fx, kind, l]);

  // The first scene starts with its weather in place; later changes blend in.
  useLayoutEffect(() => {
    setSurface({ snow, wet, ice, fog: fogTarget }, firstSurface.current);
    firstSurface.current = false;
  }, [snow, wet, ice, fogTarget]);

  // Fog distances follow the live camera (zoom, poster fits), so the front corner stays crisp and the back row fades.
  useLayoutEffect(() => {
    scene.fog = fog;
    scene.onBeforeRender = (_r, _s, camera) => {
      const d = camera.position.distanceTo(TARGET);
      fog.near = d - TILE_REACH * 0.7;
      fog.far = d + THREE.MathUtils.lerp(FOG_FAR_NONE, FOG_FAR_FULL, fogLevel.current);
    };
    return () => {
      scene.fog = null;
      scene.onBeforeRender = () => {};
    };
  }, [scene, fog]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    fx.update(state.clock.elapsedTime, dt);
    updateSurface(dt);
    const step = FOG_RATE * dt;
    fogLevel.current = fogLevel.current < fogTarget ? Math.min(fogTarget, fogLevel.current + step) : Math.max(fogTarget, fogLevel.current - step);
    // Fog melts into the page background's lower colour (set by `applyTheme`).
    const bg = document.documentElement.style.getPropertyValue('--bg-bottom');
    if (bg && bg !== fogColor.current) {
      fogColor.current = bg;
      fog.color.set(bg);
    }
  });

  return (
    <>
      <directionalLight
        position={KEY_POS}
        color={l.sunColor}
        intensity={l.sun}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={SHADOW_RADIUS[kind]}
        shadow-camera-left={-16}
        shadow-camera-bottom={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-near={1}
        shadow-camera-far={70}
      />
      <directionalLight position={RIM_POS} color={0xcfe0ff} intensity={l.rim} />
      <hemisphereLight color={l.sky} groundColor={l.ground} intensity={l.hemi} />
      <mesh rotation-x={-Math.PI / 2} position-y={-1.25} receiveShadow>
        <planeGeometry args={[90, 90]} />
        <shadowMaterial opacity={0.16} />
      </mesh>
      <primitive object={fx.group} />
    </>
  );
}
