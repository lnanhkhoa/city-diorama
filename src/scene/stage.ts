import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FullScreenQuad, Pass } from 'three/addons/postprocessing/Pass.js';
import { CopyShader } from 'three/addons/shaders/CopyShader.js';
import type { CityScene } from '../cities/types';
import { disposeTree, mergeStatic } from '../kit/merge';
import { setCityLights, waterTime } from '../kit/materials';
import { isLit, type Daytime } from '../weather/api';
import type { WeatherKind } from '../weather/codes';
import { ResolutionGovernor } from './resolution';
import { WeatherFx } from './weatherFx';

const TARGET = new THREE.Vector3(0, 3.2, 0);
/**
 * Half-extents (world units at the target) the camera keeps on screen: the
 * tile's diamond is wide, while tall landmarks set the vertical extent.
 */
const FIT_HALF_WIDTH = 15.5;
const FIT_HALF_HEIGHT = 18.5;
const INTRO_MS = 900;
const OUTRO_MS = 280;
/** Frames right after a poster render (target reallocations, readback) are not steady-state load. */
const SNAPSHOT_SETTLE_MS = 1000;
const IDLE_RESUME_MS = 6000;

interface Lighting {
  sun: number;
  sunColor: number;
  rim: number;
  hemi: number;
  sky: number;
  ground: number;
  env: number;
  exposure: number;
  /** Window and lamp glow, see `setCityLights`. */
  lights: number;
}

/** Clear-sky lighting outside full day; cloud cover scales the lit phases in `lightingFor`. */
const PHASE_LIGHTING: Record<Exclude<Daytime, 'day'>, Lighting> = {
  dawn: { sun: 1.7, sunColor: 0xffc2a0, rim: 0.9, hemi: 0.75, sky: 0xf2c6cf, ground: 0x6e6272, env: 0.35, exposure: 1.0, lights: 0.2 },
  dusk: { sun: 1.9, sunColor: 0xff9d5c, rim: 0.7, hemi: 0.65, sky: 0xe9a98f, ground: 0x5c4a5c, env: 0.3, exposure: 1.0, lights: 0.45 },
  night: { sun: 0.45, sunColor: 0x9fb4ff, rim: 0.5, hemi: 0.45, sky: 0x3a4a78, ground: 0x1b1f2b, env: 0.15, exposure: 1.0, lights: 0.9 },
  dark: { sun: 0.2, sunColor: 0x8095d6, rim: 0.3, hemi: 0.28, sky: 0x232c52, ground: 0x0c0e15, env: 0.08, exposure: 1.0, lights: 1 },
};

function lightingFor(kind: WeatherKind, daytime: Daytime): Lighting {
  if (daytime === 'day') {
    switch (kind) {
      case 'clear':
        return { sun: 3.0, sunColor: 0xfff0d8, rim: 0.9, hemi: 0.8, sky: 0xdbe9ff, ground: 0x9a8f80, env: 0.45, exposure: 1.0, lights: 0 };
      case 'partly':
        return { sun: 2.3, sunColor: 0xfff4e6, rim: 0.8, hemi: 1.0, sky: 0xdde6f2, ground: 0x8f8a82, env: 0.45, exposure: 1.0, lights: 0 };
      default:
        return { sun: 1.0, sunColor: 0xe6ecf5, rim: 0.5, hemi: 1.5, sky: 0xe4e9f0, ground: 0x7d8086, env: 0.55, exposure: 0.95, lights: 0 };
    }
  }
  const l = PHASE_LIGHTING[daytime];
  // Moonlight is already soft; at dawn and dusk cloud trades direct sun for sky light, as by day.
  if (!isLit(daytime) || kind === 'clear') return l;
  return kind === 'partly' ? { ...l, sun: l.sun * 0.8, hemi: l.hemi * 1.2 } : { ...l, sun: l.sun * 0.35, hemi: l.hemi * 1.8, env: l.env * 1.2 };
}

/** Unit vector toward `azimuth` (from +z toward +x) and `elevation`, degrees. */
function direction(azimuth: number, elevation: number): THREE.Vector3 {
  const a = THREE.MathUtils.degToRad(azimuth);
  const e = THREE.MathUtils.degToRad(elevation);
  return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
}

/**
 * `OutputPass` that tone-maps and encodes straight colour. The canvas is
 * transparent over the CSS sky, so silhouette pixels are premultiplied by
 * their coverage; ACES and the sRGB encode lift such a scaled-down colour by
 * more than its alpha, and the page then composites it brighter than both the
 * object and the sky, a rim that crawls along every edge as the camera turns.
 */
function straightAlphaOutputPass(): OutputPass {
  const pass = new OutputPass();
  const read = 'gl_FragColor = texture2D( tDiffuse, vUv );';
  const src = pass.material.fragmentShader;
  if (!src.includes(read)) throw new Error('OutputShader changed: straight-alpha patch no longer applies');
  pass.material.fragmentShader = src
    .replace(read, `${read}\n\tgl_FragColor.rgb /= max( gl_FragColor.a, 1e-4 );`)
    .replace(/\}\s*$/, '\tgl_FragColor.rgb *= gl_FragColor.a;\n}');
  return pass;
}

const MSAA_SAMPLES = 4;

/**
 * Renders the scene into its own multisampled target and copies the resolved
 * image into the composer's read buffer. Only this pass pays for MSAA:
 * multisampled composer buffers would make every later full-screen pass (the
 * AO copy and blend, the output) write all samples for nothing.
 */
class MsaaRenderPass extends Pass {
  private readonly target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: MSAA_SAMPLES });
  private readonly quad = new FullScreenQuad(
    new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: this.target.texture }, opacity: { value: 1 } },
      vertexShader: CopyShader.vertexShader,
      fragmentShader: CopyShader.fragmentShader,
      depthTest: false,
      depthWrite: false,
    }),
  );

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
  ) {
    super();
    this.needsSwap = false;
  }

  override setSize(width: number, height: number): void {
    this.target.setSize(width, height);
  }

  override render(renderer: THREE.WebGLRenderer, _writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget): void {
    renderer.setRenderTarget(this.target);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(readBuffer);
    this.quad.render(renderer);
  }
}

/**
 * GTAO at half the canvas resolution on each axis: a quarter of the occlusion
 * and denoise work. The upsampled result is also steadier: at full resolution
 * the per-pixel sampling noise sparkles along edges while the camera turns.
 */
class HalfResGtaoPass extends GTAOPass {
  override setSize(width: number, height: number): void {
    super.setSize(Math.max(1, Math.round(width / 2)), Math.max(1, Math.round(height / 2)));
  }
}

/** Every city is laid out for this corner view; each city opens from it. */
const VIEW_DIR = direction(45, 33);
// A key from camera-left (−15°) lights the +z facades and shades the +x ones,
// so every block shows two values and casts its shadow to screen-right, as in
// the reference prints. The rim comes from behind and picks out tower edges.
const KEY_DIR = direction(-15, 52);
const RIM_DIR = direction(200, 28);

interface Transition {
  obj: THREE.Object3D;
  start: number;
  dur: number;
  from: number;
  to: number;
  done?: () => void;
}

/** Owns the renderer, camera, lights and the currently displayed city. */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(26, 1, 0.5, 400);
  private readonly controls: OrbitControls;
  private readonly sun = new THREE.DirectionalLight(0xffffff, 2.5);
  private readonly rim = new THREE.DirectionalLight(0xcfe0ff, 0.8);
  private readonly hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
  private readonly fx: WeatherFx;
  private readonly composer: EffectComposer;
  private readonly ao: GTAOPass;
  private readonly timer = new THREE.Timer();
  private readonly reducedMotion: boolean;
  private city: { scene: CityScene; holder: THREE.Group } | null = null;
  private transitions: Transition[] = [];
  private idleTimer = 0;
  private baseSun = 2.5;
  /** Camera distance chosen by the last fit; user zoom is kept as a ratio of it. */
  private fitDistance = 0;
  /** Lowers the pixel ratio from 1.75 toward 1 while frames run slow; probes back up with headroom. */
  private readonly resolution = new ResolutionGovernor(Math.min(devicePixelRatio, 1.75), Math.min(devicePixelRatio, 1));
  private lastFrameAt = 0;

  constructor(private readonly host: HTMLElement) {
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // The scene pass's MSAA target does the antialiasing; canvas MSAA would be wasted.
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    this.renderer.setPixelRatio(this.resolution.level);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(this.renderer.domElement);
    this.timer.connect(document);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // Ambient occlusion supplies the contact darkening (under cornices, at
    // building feet, inside arches) that makes the miniature read as a render.
    // MSAA on the scene pass replaces the canvas antialiasing the composer
    // bypasses; the composer's own buffers stay single-sample, without depth.
    this.composer = new EffectComposer(this.renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false }));
    this.composer.addPass(new MsaaRenderPass(this.scene, this.camera));
    this.ao = new HalfResGtaoPass(this.scene, this.camera, 1, 1);
    this.ao.updateGtaoMaterial({ radius: 0.7, distanceExponent: 1.4, thickness: 1.2, scale: 1, samples: 16 });
    this.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    this.ao.blendIntensity = 0.85;
    this.composer.addPass(this.ao);
    this.composer.addPass(straightAlphaOutputPass());

    this.sun.position.copy(KEY_DIR).multiplyScalar(32);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.radius = 4;
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -16;
    sc.right = sc.top = 16;
    sc.near = 1;
    sc.far = 70;
    this.rim.position.copy(RIM_DIR).multiplyScalar(30);
    this.scene.add(this.sun, this.rim, this.hemi);

    const catcher = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.ShadowMaterial({ opacity: 0.16 }));
    catcher.rotation.x = -Math.PI / 2;
    catcher.position.y = -1.25;
    catcher.receiveShadow = true;
    this.scene.add(catcher);

    this.fx = new WeatherFx(this.reducedMotion);
    this.scene.add(this.fx.group);

    this.camera.position.copy(TARGET).addScaledVector(VIEW_DIR, 60);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(TARGET);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minPolarAngle = THREE.MathUtils.degToRad(20);
    this.controls.maxPolarAngle = THREE.MathUtils.degToRad(80);
    this.controls.autoRotate = !this.reducedMotion;
    this.controls.autoRotateSpeed = 0.35;
    this.controls.addEventListener('start', () => {
      this.controls.autoRotate = false;
      clearTimeout(this.idleTimer);
    });
    this.controls.addEventListener('end', () => {
      if (this.reducedMotion) return;
      this.idleTimer = window.setTimeout(() => (this.controls.autoRotate = true), IDLE_RESUME_MS);
    });

    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  /**
   * Show a city. `animate` swaps with the shrink/grow transition and returns
   * to the default view; `replace` rebuilds in place and keeps the camera
   * (dev hot-swap of an edited city module).
   */
  show(scene: CityScene, mode: 'animate' | 'replace' = 'animate'): void {
    const prev = this.city;
    const instant = this.reducedMotion || mode === 'replace';
    if (prev) {
      if (mode === 'animate') {
        // Layouts are authored for the default corner; open each city from it.
        // Updating once without damping drops any leftover drag momentum.
        this.controls.enableDamping = false;
        this.controls.update();
        this.camera.position.copy(this.controls.target).addScaledVector(VIEW_DIR, this.fitDistance);
        this.controls.update();
        this.controls.enableDamping = true;
      }
      const retire = () => {
        this.scene.remove(prev.holder);
        disposeTree(prev.holder);
      };
      this.transitions = this.transitions.filter((tr) => tr.obj !== prev.holder);
      if (instant) retire();
      else this.tween(prev.holder, prev.holder.scale.x, 0.001, OUTRO_MS, retire);
    }
    mergeStatic(scene.root);
    // Place every mover on its path now: with reduced motion this is the only update it gets.
    scene.update?.(0, 0);
    const holder = new THREE.Group();
    holder.add(scene.root);
    holder.scale.setScalar(instant ? 1 : 0.001);
    this.scene.add(holder);
    this.city = { scene, holder };
    if (!instant) this.tween(holder, 0.001, 1, INTRO_MS, undefined, prev ? OUTRO_MS * 0.6 : 0);
    // Shader compiles and two cities on screen at once are not steady-state load.
    this.resolution.holdUntil(performance.now() + (instant ? 0 : OUTRO_MS * 0.6) + INTRO_MS);
  }

  setWeather(kind: WeatherKind, daytime: Daytime): void {
    const l = lightingFor(kind, daytime);
    this.baseSun = l.sun;
    this.sun.intensity = l.sun;
    this.sun.color.setHex(l.sunColor);
    this.sun.shadow.radius = kind === 'clear' || kind === 'partly' ? 3 : 9;
    this.hemi.intensity = l.hemi;
    this.rim.intensity = l.rim;
    this.hemi.color.setHex(l.sky);
    this.hemi.groundColor.setHex(l.ground);
    this.scene.environmentIntensity = l.env;
    this.renderer.toneMappingExposure = l.exposure;
    // Diffuse (overcast, night) light leans on occlusion for form; direct sun on shadows.
    this.ao.blendIntensity = kind === 'clear' || kind === 'partly' ? 0.8 : 1;
    this.fx.set(kind);
    setCityLights(l.lights);
  }

  /**
   * Render one frame at `w`×`h` with the same fitting rules as the live view
   * and return a copy, so posters frame the whole tile at any aspect ratio.
   */
  snapshot(w: number, h: number): HTMLCanvasElement {
    // Settle any city swap first so the poster never catches a half-scaled tile.
    for (const tr of this.transitions) {
      tr.obj.scale.setScalar(Math.max(0.001, tr.to));
      tr.done?.();
    }
    this.transitions = [];
    // Posters always render at ratio 1, whatever level the live view is at.
    this.applyRatio(1);
    this.fit(w, h);
    this.composer.render();
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    out.getContext('2d')!.drawImage(this.renderer.domElement, 0, 0);
    this.applyRatio(this.resolution.level);
    this.resize();
    this.resolution.holdUntil(performance.now() + SNAPSHOT_SETTLE_MS);
    return out;
  }

  private applyRatio(ratio: number): void {
    this.renderer.setPixelRatio(ratio);
    this.composer.setPixelRatio(ratio);
  }

  private tween(obj: THREE.Object3D, from: number, to: number, dur: number, done?: () => void, delay = 0): void {
    this.transitions = this.transitions.filter((t) => t.obj !== obj);
    this.transitions.push({ obj, start: performance.now() + delay, dur, from, to, done });
  }

  private frame(): void {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.1);
    const t = this.timer.getElapsed();
    const now = performance.now();
    if (this.lastFrameAt) {
      const ratio = this.resolution.sample(now - this.lastFrameAt, now);
      if (ratio !== null) {
        this.applyRatio(ratio);
        this.resize();
      }
    }
    this.lastFrameAt = now;
    this.transitions = this.transitions.filter((tr) => {
      const k = THREE.MathUtils.clamp((now - tr.start) / tr.dur, 0, 1);
      const e = tr.to > tr.from ? easeOutBack(k) : k * k;
      tr.obj.scale.setScalar(Math.max(0.001, tr.from + (tr.to - tr.from) * e));
      if (k >= 1) tr.done?.();
      return k < 1;
    });
    if (!this.reducedMotion) {
      this.city?.scene.update?.(t, dt);
      waterTime.value = t;
    }
    this.fx.update(t, dt);
    this.sun.intensity = this.baseSun + this.fx.flashLevel * 4;
    this.controls.update(dt);
    this.composer.render(dt);
  }

  private resize(): void {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (w && h) this.fit(w, h);
  }

  private fit(w: number, h: number): void {
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    // Fit the tile's projected half-extents into each field of view.
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    const tanH = tanV * this.camera.aspect;
    const dist = Math.max(FIT_HALF_HEIGHT / tanV, FIT_HALF_WIDTH / tanH);
    const offset = this.camera.position.clone().sub(this.controls.target);
    const zoom = this.fitDistance ? offset.length() / this.fitDistance : 1;
    this.fitDistance = dist;
    this.controls.minDistance = dist * 0.45;
    this.controls.maxDistance = dist * 1.6;
    this.camera.position.copy(this.controls.target).addScaledVector(offset.normalize(), dist * zoom);
    // Push the model below the poster title on tall screens.
    const shift = this.camera.aspect < 1 ? 0.12 : 0.08;
    this.camera.setViewOffset(w, h, 0, -h * shift, w, h);
    this.camera.updateProjectionMatrix();
  }
}

function easeOutBack(k: number): number {
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
}
