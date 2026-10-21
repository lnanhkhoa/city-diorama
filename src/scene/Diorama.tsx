import { Canvas, useFrame, useThree, type CameraProps, type GLProps } from '@react-three/fiber';
import { useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type Ref } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { CityBuild } from '../cities/types';
import type { Daytime } from '../weather/api';
import type { WeatherKind } from '../weather/codes';
import { Atmosphere } from './Atmosphere';
import { CityStage, type ShowMode } from './city-stage';
import { TARGET, VIEW_DIR } from './lighting';
import { createComposer, type PostChain } from './passes';
import { ResolutionGovernor } from './resolution';

/**
 * Half-extents (world units at the target) the camera keeps on screen: the
 * tile's diamond is wide, while tall landmarks set the vertical extent.
 */
const FIT_HALF_WIDTH = 15.5;
const FIT_HALF_HEIGHT = 18.5;
/** Frames right after a poster render (target reallocations, readback) are not steady-state load. */
const SNAPSHOT_SETTLE_MS = 1000;
const IDLE_RESUME_MS = 6000;

// The scene pass's MSAA target does the antialiasing; canvas MSAA would be wasted.
const GL: GLProps = { antialias: false, alpha: true };
// `manual`: `fit` owns aspect and projection (it also offsets the view).
const CAMERA: CameraProps = { fov: 26, near: 0.5, far: 400, manual: true, position: TARGET.clone().addScaledVector(VIEW_DIR, 60) };

export interface DioramaHandle {
  /**
   * Render one frame at `w`×`h` with the same fitting rules as the live view
   * and return a copy, so posters frame the whole tile at any aspect ratio.
   */
  snapshot(w: number, h: number): HTMLCanvasElement;
}

interface Props {
  /** City on stage; a different function swaps it (`mode` says how), null leaves the stage as it is. */
  build: CityBuild | null;
  mode: ShowMode;
  kind: WeatherKind;
  daytime: Daytime;
  handle: Ref<DioramaHandle>;
}

/** The 3D view: renderer, camera, lights and the city on stage. */
export function Diorama(props: Props) {
  const [reducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  // Lowers the pixel ratio from 1.75 toward 1 while frames run slow; probes back up with headroom.
  const [governor] = useState(() => new ResolutionGovernor(Math.min(devicePixelRatio, 1.75), Math.min(devicePixelRatio, 1)));
  const [dpr, setDpr] = useState(governor.level);
  return (
    <div id="stage" className="stage">
      <Canvas
        gl={GL}
        camera={CAMERA}
        dpr={dpr}
        shadows="percentage"
        onCreated={({ gl }) => gl.domElement.setAttribute('aria-hidden', 'true')}
      >
        <DioramaScene {...props} reducedMotion={reducedMotion} governor={governor} onDpr={setDpr} />
      </Canvas>
    </div>
  );
}

interface SceneProps extends Props {
  reducedMotion: boolean;
  governor: ResolutionGovernor;
  onDpr: (ratio: number) => void;
}

function DioramaScene({ build, mode, kind, daytime, handle, reducedMotion, governor, onDpr }: SceneProps) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const getState = useThree((s) => s.get);

  const [stage] = useState(() => new CityStage(reducedMotion, (until) => governor.holdUntil(until)));
  const controls = useMemo(() => {
    const c = new OrbitControls(camera);
    c.target.copy(TARGET);
    c.enableDamping = true;
    c.enablePan = false;
    c.minPolarAngle = THREE.MathUtils.degToRad(20);
    c.maxPolarAngle = THREE.MathUtils.degToRad(80);
    c.autoRotate = !reducedMotion;
    c.autoRotateSpeed = 0.35;
    return c;
  }, [camera, reducedMotion]);
  const [post, setPost] = useState<PostChain | null>(null);
  /** Camera distance chosen by the last fit; user zoom is kept as a ratio of it. */
  const fitDistance = useRef(0);
  const lastFrameAt = useRef(0);
  const shownBuild = useRef<CityBuild | null>(null);

  // Drag pauses the turntable; it resumes after a while untouched.
  useEffect(() => {
    let idle = 0;
    const onStart = () => {
      controls.autoRotate = false;
      clearTimeout(idle);
    };
    const onEnd = () => {
      if (!reducedMotion) idle = window.setTimeout(() => (controls.autoRotate = true), IDLE_RESUME_MS);
    };
    controls.connect(gl.domElement);
    controls.addEventListener('start', onStart);
    controls.addEventListener('end', onEnd);
    return () => {
      clearTimeout(idle);
      controls.removeEventListener('start', onStart);
      controls.removeEventListener('end', onEnd);
      controls.disconnect();
    };
  }, [controls, gl, reducedMotion]);

  useEffect(() => {
    const p = createComposer(gl, scene, camera);
    setPost(p);
    return () => p.composer.dispose();
  }, [gl, scene, camera]);

  useEffect(() => {
    // Diffuse (overcast, night) light leans on occlusion for form; direct sun on shadows.
    if (post) post.ao.blendIntensity = kind === 'clear' || kind === 'partly' ? 0.8 : 1;
  }, [post, kind]);

  /** Size the composer and fit the tile's projected half-extents into each field of view. */
  const fit = (w: number, h: number, ratio: number) => {
    post?.composer.setPixelRatio(ratio);
    post?.composer.setSize(w, h);
    camera.aspect = w / h;
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const tanH = tanV * camera.aspect;
    const dist = Math.max(FIT_HALF_HEIGHT / tanV, FIT_HALF_WIDTH / tanH);
    const offset = camera.position.clone().sub(controls.target);
    const zoom = fitDistance.current ? offset.length() / fitDistance.current : 1;
    fitDistance.current = dist;
    controls.minDistance = dist * 0.45;
    controls.maxDistance = dist * 1.6;
    camera.position.copy(controls.target).addScaledVector(offset.normalize(), dist * zoom);
    // Push the model below the poster title on tall screens.
    const shift = camera.aspect < 1 ? 0.12 : 0.08;
    camera.setViewOffset(w, h, 0, -h * shift, w, h);
    camera.updateProjectionMatrix();
  };

  useLayoutEffect(() => {
    if (size.width && size.height) fit(size.width, size.height, dpr);
  });

  useEffect(() => {
    if (!build || build === shownBuild.current) return;
    shownBuild.current = build;
    stage.show(build, mode, () => {
      // Updating once without damping drops any leftover drag momentum.
      controls.enableDamping = false;
      controls.update();
      camera.position.copy(controls.target).addScaledVector(VIEW_DIR, fitDistance.current);
      controls.update();
      controls.enableDamping = true;
    });
  }, [build, mode, stage, controls, camera]);

  useImperativeHandle(handle, () => ({
    snapshot(w, h) {
      if (!post) throw new Error('Renderer not ready');
      stage.settle();
      // Posters always render at ratio 1, whatever level the live view is at.
      gl.setPixelRatio(1);
      gl.setSize(w, h, false);
      fit(w, h, 1);
      // One clean frame: no history from the live view, no jitter (fit just reset the projection).
      post.taa.reset();
      post.composer.render();
      const out = document.createElement('canvas');
      out.width = w;
      out.height = h;
      out.getContext('2d')!.drawImage(gl.domElement, 0, 0);
      const { size: live, viewport } = getState();
      gl.setPixelRatio(viewport.dpr);
      gl.setSize(live.width, live.height);
      fit(live.width, live.height, viewport.dpr);
      governor.holdUntil(performance.now() + SNAPSHOT_SETTLE_MS);
      return out;
    },
  }));

  useFrame((state, delta) => {
    const now = performance.now();
    if (lastFrameAt.current) {
      const ratio = governor.sample(now - lastFrameAt.current, now);
      if (ratio !== null) onDpr(ratio);
    }
    lastFrameAt.current = now;
    const dt = Math.min(delta, 0.1);
    stage.tick(now, state.clock.elapsedTime, dt);
    controls.update(dt);
  });

  // A positive priority hands rendering to the composer.
  useFrame((_, delta) => {
    if (!post) return;
    // Reprojection follows the camera, not a tile that is scaling: show swap frames as rendered.
    if (stage.settling) post.taa.reset();
    else post.taa.jitter();
    post.composer.render(Math.min(delta, 0.1));
  }, 1);

  return (
    <>
      <Atmosphere kind={kind} daytime={daytime} reducedMotion={reducedMotion} />
      <primitive object={stage.root} />
    </>
  );
}
