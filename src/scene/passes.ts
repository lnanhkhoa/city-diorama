import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FullScreenQuad, Pass } from 'three/addons/postprocessing/Pass.js';
import { CopyShader } from 'three/addons/shaders/CopyShader.js';

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

function copyMaterial(texture: THREE.Texture | null): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: texture }, opacity: { value: 1 } },
    vertexShader: CopyShader.vertexShader,
    fragmentShader: CopyShader.fragmentShader,
    depthTest: false,
    depthWrite: false,
  });
}

/**
 * Renders the scene into its own multisampled target and copies the resolved
 * image into the composer's read buffer. Only this pass pays for MSAA:
 * multisampled composer buffers would make every later full-screen pass (the
 * AO copy and blend, the output) write all samples for nothing.
 */
class MsaaRenderPass extends Pass {
  /** Scene depth, resolved out of the multisampled buffer for the TAA reprojection. */
  readonly depth = new THREE.DepthTexture(1, 1);
  private readonly target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    samples: MSAA_SAMPLES,
    depthTexture: this.depth,
    resolveDepthBuffer: true,
  });
  private readonly quad = new FullScreenQuad(copyMaterial(this.target.texture));

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

  override dispose(): void {
    this.target.dispose();
    this.quad.material.dispose();
    this.quad.dispose();
  }
}

/** Share of each new frame in the accumulated image. */
const TAA_BLEND = 0.1;

function halton(index: number, base: number): number {
  let f = 1;
  let r = 0;
  for (let i = index; i > 0; i = Math.floor(i / base)) {
    f /= base;
    r += f * (i % base);
  }
  return r;
}

/** Halton (2, 3) offsets in render pixels, within ±0.5: an even sub-pixel spread repeating every 8 frames. */
const JITTER = Array.from({ length: 8 }, (_, i) => [halton(i + 1, 2) - 0.5, halton(i + 1, 3) - 0.5] as const);

const TAA_SHADER = /* glsl */ `
  uniform sampler2D tCurrent;
  uniform sampler2D tHistory;
  uniform sampler2D tDepth;
  uniform mat4 inverseViewProjection;
  uniform mat4 previousViewProjection;
  uniform vec2 resolution;
  uniform bool reset;
  varying vec2 vUv;

  // Catmull-Rom from five bilinear taps (corners dropped): repeated resampling
  // of the history under a turning camera stays sharp.
  vec4 history(vec2 uv) {
    vec2 pos = uv * resolution;
    vec2 c1 = floor(pos - 0.5) + 0.5;
    vec2 f = pos - c1;
    vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
    vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
    vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
    vec2 w3 = f * f * (-0.5 + 0.5 * f);
    vec2 w12 = w1 + w2;
    vec2 t0 = (c1 - 1.0) / resolution;
    vec2 t3 = (c1 + 2.0) / resolution;
    vec2 t12 = (c1 + w2 / w12) / resolution;
    vec4 sum = texture2D(tHistory, vec2(t12.x, t0.y)) * (w12.x * w0.y)
      + texture2D(tHistory, vec2(t0.x, t12.y)) * (w0.x * w12.y)
      + texture2D(tHistory, t12) * (w12.x * w12.y)
      + texture2D(tHistory, vec2(t3.x, t12.y)) * (w3.x * w12.y)
      + texture2D(tHistory, vec2(t12.x, t3.y)) * (w12.x * w3.y);
    return sum / (w12.x * w0.y + w0.x * w12.y + w12.x * w12.y + w3.x * w12.y + w12.x * w3.y);
  }

  void main() {
    vec4 current = texture2D(tCurrent, vUv);
    vec4 world = inverseViewProjection * vec4(vUv * 2.0 - 1.0, texture2D(tDepth, vUv).x * 2.0 - 1.0, 1.0);
    vec4 prev = previousViewProjection * (world / world.w);
    vec2 prevUv = prev.xy / prev.w * 0.5 + 0.5;
    if (reset || any(lessThan(prevUv, vec2(0.0))) || any(greaterThan(prevUv, vec2(1.0)))) {
      gl_FragColor = current;
      return;
    }
    // Clamp the history into the new frame's 3x3 neighbourhood: whatever moved
    // or was uncovered takes the new frame's colours instead of trailing.
    vec2 texel = 1.0 / resolution;
    vec4 lo = current;
    vec4 hi = current;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec4 c = texture2D(tCurrent, vUv + vec2(float(x), float(y)) * texel);
        lo = min(lo, c);
        hi = max(hi, c);
      }
    }
    vec4 h = clamp(history(prevUv), lo, hi);
    // Premultiplied colour never exceeds its alpha; a per-channel clamp alone can break that.
    h.rgb = min(h.rgb, vec3(h.a));
    gl_FragColor = mix(h, current, ${TAA_BLEND.toFixed(2)});
  }
`;

/**
 * Temporal antialiasing. Every frame the projection shifts by a sub-pixel
 * offset, and each output pixel blends the new sample into the previous
 * result, reprojected through the scene depth. MSAA resolves each frame on
 * its own, so details thinner than a pixel (cables, lamp posts, ledges,
 * spires) pop in and out as the camera turns; accumulated over frames they
 * settle into a steady, supersampled image.
 */
export class TaaPass extends Pass {
  private readonly history = [0, 1].map(() => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false }));
  private readonly resolve: FullScreenQuad;
  private readonly uniforms: {
    tCurrent: THREE.IUniform<THREE.Texture | null>;
    tHistory: THREE.IUniform<THREE.Texture | null>;
    tDepth: THREE.IUniform<THREE.Texture>;
    inverseViewProjection: THREE.IUniform<THREE.Matrix4>;
    previousViewProjection: THREE.IUniform<THREE.Matrix4>;
    resolution: THREE.IUniform<THREE.Vector2>;
    reset: THREE.IUniform<boolean>;
  };
  private readonly presentMaterial = copyMaterial(null);
  private readonly present = new FullScreenQuad(this.presentMaterial);
  /** Projection without this frame's offset, set by `jitter`. */
  private readonly projection = new THREE.Matrix4();
  private readonly viewProjection = new THREE.Matrix4();
  private jittered = false;
  private frame = 0;
  private latest = 0;
  private valid = false;
  private width = 1;
  private height = 1;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    depth: THREE.DepthTexture,
  ) {
    super();
    this.uniforms = {
      tCurrent: { value: null },
      tHistory: { value: null },
      tDepth: { value: depth },
      inverseViewProjection: { value: new THREE.Matrix4() },
      previousViewProjection: { value: new THREE.Matrix4() },
      resolution: { value: new THREE.Vector2(1, 1) },
      reset: { value: true },
    };
    this.resolve = new FullScreenQuad(
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: CopyShader.vertexShader,
        fragmentShader: TAA_SHADER,
        depthTest: false,
        depthWrite: false,
      }),
    );
  }

  /** Offset the camera projection for the next frame. Call after the view is final, right before rendering. */
  jitter(): void {
    const { camera } = this;
    camera.updateProjectionMatrix();
    this.projection.copy(camera.projectionMatrix);
    const [x, y] = JITTER[this.frame++ % JITTER.length];
    const e = camera.projectionMatrix.elements;
    e[8] += (2 * x) / this.width;
    e[9] += (2 * y) / this.height;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    this.jittered = true;
  }

  /** Drop the accumulated image: the next frame shows as rendered. */
  reset(): void {
    this.valid = false;
  }

  override setSize(width: number, height: number): void {
    for (const t of this.history) t.setSize(width, height);
    this.width = width;
    this.height = height;
    this.valid = false;
  }

  override render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget): void {
    const u = this.uniforms;
    this.viewProjection.multiplyMatrices(this.jittered ? this.projection : this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.jittered = false;
    u.tCurrent.value = readBuffer.texture;
    u.tHistory.value = this.history[this.latest].texture;
    u.inverseViewProjection.value.copy(this.viewProjection).invert();
    u.resolution.value.set(this.width, this.height);
    u.reset.value = !this.valid;
    const next = this.history[1 - this.latest];
    renderer.setRenderTarget(next);
    this.resolve.render(renderer);
    this.presentMaterial.uniforms.tDiffuse.value = next.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.present.render(renderer);
    this.latest = 1 - this.latest;
    u.previousViewProjection.value.copy(this.viewProjection);
    this.valid = true;
  }

  override dispose(): void {
    for (const t of this.history) t.dispose();
    this.resolve.material.dispose();
    this.resolve.dispose();
    this.presentMaterial.dispose();
    this.present.dispose();
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

/** Composer plus the passes the view drives: AO blend follows the weather, TAA jitters each frame. */
export interface PostChain {
  composer: EffectComposer;
  ao: GTAOPass;
  taa: TaaPass;
}

/**
 * MSAA scene pass, ambient occlusion, straight-alpha output, temporal
 * antialiasing. Ambient occlusion supplies the contact darkening (under
 * cornices, at building feet, inside arches) that makes the miniature read as
 * a render. The composer's own buffers stay single-sample, without depth.
 */
export function createComposer(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera): PostChain {
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false }));
  const scenePass = new MsaaRenderPass(scene, camera);
  composer.addPass(scenePass);
  const ao = new HalfResGtaoPass(scene, camera, 1, 1);
  ao.updateGtaoMaterial({ radius: 0.7, distanceExponent: 1.4, thickness: 1.2, scale: 1, samples: 16 });
  ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
  ao.blendIntensity = 0.85;
  composer.addPass(ao);
  composer.addPass(straightAlphaOutputPass());
  // After the output encode: the history blends display values, so bright highlights cannot dominate it.
  const taa = new TaaPass(camera, scenePass.depth);
  composer.addPass(taa);
  return { composer, ao, taa };
}
