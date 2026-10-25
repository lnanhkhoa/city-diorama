import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { setCityLights, setWaterSky } from '../kit/materials';
import type { Daytime } from '../weather/api';
import type { WeatherKind } from '../weather/codes';
import { KEY_DIR, RIM_DIR, lightingFor } from './lighting';
import { WeatherFx } from './weatherFx';

const KEY_POS = KEY_DIR.clone().multiplyScalar(32);
const RIM_POS = RIM_DIR.clone().multiplyScalar(30);

interface Props {
  kind: WeatherKind;
  daytime: Daytime;
  reducedMotion: boolean;
}

/** Environment map, key/rim/sky lights, shadow catcher, rain, snow and lightning. */
export function Atmosphere({ kind, daytime, reducedMotion }: Props) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const sun = useRef<THREE.DirectionalLight>(null!);
  const [fx] = useState(() => new WeatherFx(reducedMotion));
  const l = useMemo(() => lightingFor(kind, daytime), [kind, daytime]);

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

  useFrame((state, delta) => {
    fx.update(state.clock.elapsedTime, Math.min(delta, 0.1));
    sun.current.intensity = l.sun + fx.flashLevel * 4;
  });

  const clearSky = kind === 'clear' || kind === 'partly';
  return (
    <>
      <directionalLight
        ref={sun}
        position={KEY_POS}
        color={l.sunColor}
        intensity={l.sun}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={clearSky ? 3 : 9}
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
