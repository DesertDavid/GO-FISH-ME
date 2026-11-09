import * as THREE from 'three';
import { OceanSim, defaultOceanParams } from './water/OceanSim.js';
import { OceanSurface } from './water/OceanSurface.js';
import { bakeShoreMap } from './water/shoreMap.js';
import { bakeWaterTextures } from './water/bakeTextures.js';
import { SkySystem } from './scene/sky.js';
import { createTerrain, heroRock } from './scene/terrain.js';
import { islandHeight, ISLAND_SIZE } from './scene/islandHeight.js';
import { PlanarReflection } from './engine/PlanarReflection.js';
import { PostFX } from './engine/PostFX.js';
import { GpuTimer } from './engine/gpuTimer.js';
import { FullscreenQuad, rawPass } from './engine/fullscreen.js';
import { WaterQuery } from './water/WaterQuery.js';
import { UnderwaterPass } from './water/UnderwaterPass.js';
import { Spray } from './water/Spray.js';
import { MarineSnow } from './water/MarineSnow.js';
import { Floaters } from './scene/floaters.js';
import { FloaterShadow } from './scene/floaterShadow.js';
import { WaveCaustics } from './water/Caustics.js';
import { LOC } from './game/current.js';
import { createGame } from './game/game.js';

// Reel World: the Ultra-Water renderer (FFT ocean, shore waves, caustics, buoyancy) driving a
// fishing game. Each page load renders one location; travelling reloads.
const REFLECT_LAYER = 1;
const ldBar = document.getElementById('ldBar'), ldText = document.getElementById('ldText');
const progress = (p, t) => { ldBar.style.width = `${Math.round(p * 100)}%`; if (t) ldText.textContent = t; };
const frame = () => new Promise((r) => setTimeout(r, 16));

const renderer = new THREE.WebGLRenderer({
  antialias: false, depth: false, stencil: false, alpha: false, powerPreference: 'high-performance',
});
renderer.autoClear = false;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.capabilities.maxTextures = renderer.getContext().getParameter(WebGL2RenderingContext.MAX_COMBINED_TEXTURE_IMAGE_UNITS);
document.body.prepend(renderer.domElement);

const args = new URLSearchParams(location.search);
const mobile = args.has('mobile') || (!args.has('desktop') && matchMedia('(pointer: coarse)').matches);
const quality = mobile
  ? { resolution: 0.6, msaa: 2, reflections: true, reflectionScale: 0.35 }
  : { resolution: 1, msaa: 4, reflections: true, reflectionScale: 0.5 };
const camera = new THREE.PerspectiveCamera(60, 1, 0.5, 80000);
const overlayCam = new THREE.PerspectiveCamera(60, 1, 0.02, 60);

async function boot() {
  progress(0.05, `Travelling to ${LOC.name}…`);
  await frame();
  // --- world ------------------------------------------------------------------------
  const sky = new SkySystem(renderer);
  Object.assign(sky.params, { cloudCoverage: LOC.sky.clouds, turbidity: LOC.sky.turbidity });
  progress(0.15, 'Mapping the shoreline…');
  await frame();
  const shore = bakeShoreMap(islandHeight, Math.min(ISLAND_SIZE * 0.8, 2400), 512, heroRock.none ? null : (x, z) => {
    const q = ((x - heroRock.x) ** 2 + (z - heroRock.z) ** 2) / (8.5 * 8.5);
    return q < 1 ? 4 * (1 - q) : -Infinity;
  });
  progress(0.35, 'Spinning up the waves…');
  await frame();
  const tex = bakeWaterTextures(renderer);
  const oceanParams = {
    ...defaultOceanParams(), windSpeed: LOC.wind, windDirection: LOC.windDir, fetchKm: LOC.fetch, waveScale: LOC.waveScale,
    swellScale: LOC.swell, swellDirection: LOC.swellDir, choppiness: LOC.chop,
  };
  const ocean = new OceanSim(renderer, oceanParams);
  const caustics = new WaveCaustics(renderer, ocean);
  const floatShadow = new FloaterShadow();
  const surface = new OceanSurface(ocean, shore, sky, floatShadow.uniforms);
  const su = surface.uniforms;
  su.uFoamTex.value = tex.foam;
  su.uShoreWave.value.x = LOC.shoreWave;

  const scene = new THREE.Scene();
  scene.environment = sky.cube;
  scene.add(sky.background);
  progress(0.5, 'Raising the land…');
  await frame();
  const terrain = createTerrain({
    sky, caustics: caustics.uniforms, floatShadow: floatShadow.uniforms, water: surface.uniforms,
    absorption: surface.uniforms.uAbsorption.value, reflectionLayer: REFLECT_LAYER,
  });
  scene.add(terrain.group);
  su.uRock.value.set(heroRock.x, heroRock.z, heroRock.none ? 0 : 8.5, 0);

  const sunLight = new THREE.DirectionalLight(0xffffff, Math.PI);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(4096, 4096);
  Object.assign(sunLight.shadow.camera, { left: -900, right: 900, top: 900, bottom: -900, near: 10, far: 5000 });
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.6;
  scene.add(sunLight, sunLight.target);
  su.uShadowMatrix.value = terrain.uniforms.uSunShadowMatrix.value = sunLight.shadow.matrix;
  su.uShadowBias.value = 0.05 / (sunLight.shadow.camera.far - sunLight.shadow.camera.near);

  // water colour for this location
  const look = LOC.waterLook;
  su.uAbsorption.value.fromArray(look.absorption);
  su.uScatterColor.value.fromArray(look.scatter);
  su.uFoamTint.value.fromArray(look.foam);

  const query = new WaterQuery(renderer, surface, 512);
  const floaters = new Floaters({ scene, heightAt: islandHeight, patchMaterial: terrain.patchProp });
  const underwater = new UnderwaterPass(surface, camera, caustics.uniforms);
  underwater.params.scattering = look.turbidity;
  let camWater = 0, wasSubmerged = false, uwComp = 1;

  const reflection = new PlanarReflection(REFLECT_LAYER);
  su.uReflMatrix.value = reflection.textureMatrix;
  const emptyReflection = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  emptyReflection.needsUpdate = true;

  const waterScene = new THREE.Scene();
  const restore = new FullscreenQuad(rawPass(/* glsl */`
precision highp float;
uniform sampler2D uTex;
in vec2 vUv;
out vec4 outColor;
void main() { outColor = texture(uTex, vUv); }`, { uTex: { value: null } }));
  restore.mesh.renderOrder = -1;
  if (/OculusBrowser/.test(navigator.userAgent)) waterScene.add(restore.mesh);
  const spray = new Spray(surface, shore, [...terrain.shoreRocks, ...(heroRock.none ? [] : [{ x: heroRock.x, z: heroRock.z, r: 8.5 }])]);
  const snow = new MarineSnow(surface);
  waterScene.add(surface.mesh, spray.mesh, spray.splash, spray.rockSplash, snow.mesh);

  const post = new PostFX(renderer);
  post.params.bloomStrength = mobile ? 0 : 0.05;
  post.params.bloomThreshold = 1.5;

  // first-person overlay: rod, reel and the fish you're holding up, drawn over the world
  const overlay = new THREE.Scene();
  overlay.environment = sky.cube;
  const ovSun = new THREE.DirectionalLight(0xffffff, 2);
  const ovHemi = new THREE.HemisphereLight(0xbfd8ff, 0x3a3020, 0.6);
  // over-the-shoulder fill so the held fish isn't backlit. A point light: the patched
  // materials (terrain.js) only support a single directional light.
  const ovFill = new THREE.PointLight(0xffffff, 3.5, 0, 2);
  overlay.add(ovSun, ovHemi, ovFill);

  let hdrRT = null;
  function makeTargets() {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    hdrRT?.dispose();
    hdrRT = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType, samples: quality.msaa, generateMipmaps: false,
      depthTexture: new THREE.DepthTexture(size.x, size.y, THREE.FloatType),
    });
    restore.material.uniforms.uTex.value = hdrRT.texture;
    su.uSceneColor.value = hdrRT.texture;
    su.uSceneDepth.value = hdrRT.depthTexture;
    su.uResolution.value.copy(size);
    reflection.scale = quality.reflectionScale;
    reflection.setSize(size.x, size.y);
    post.setSize(size.x, size.y);
    underwater.setSize(size.x, size.y);
  }
  function resize() {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * quality.resolution);
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = overlayCam.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    overlayCam.updateProjectionMatrix();
    makeTargets();
  }
  window.addEventListener('resize', resize);

  let sunDirty = true;
  function applySun() {
    sky.update();
    sunLight.position.copy(sky.sunDir).multiplyScalar(2000);
    sunLight.color.setRGB(sky.sunColor.x, sky.sunColor.y, sky.sunColor.z).multiplyScalar(1 / Math.max(sky.sunColor.x, 1e-4));
    sunLight.intensity = Math.PI * Math.max(sky.sunColor.x, 1e-4);
    ovSun.position.copy(sky.sunDir);
    ovSun.color.copy(sunLight.color);
    ovSun.intensity = sunLight.intensity;
    ovHemi.intensity = 0.4 + sunLight.intensity * 0.15;
    renderer.shadowMap.needsUpdate = true;
    sunDirty = false;
  }

  const engine = {
    renderer, scene, camera, overlay, floaters, sky, surface, ocean, terrain, query,
    patchProp: terrain.patchProp, heightAt: islandHeight,
    setSun: (elevation, azimuth) => { Object.assign(sky.params, { elevation, azimuth }); sunDirty = true; },
    // weather: cloud cover + sun strength (sky re-bake), wind (wave spectrum), haze
    setWeatherLook: ({ clouds, sun, windMul, fogMul }) => {
      Object.assign(sky.params, { cloudCoverage: clouds, sunIntensity: sun });
      sunDirty = true;
      const wind = Math.min(17, LOC.wind * windMul);   // past ~17 m/s the seas outgrow the boats
      if (Math.abs(ocean.params.windSpeed - wind) > 0.05) { ocean.params.windSpeed = wind; ocean.dirty = true; }
      terrain.uniforms.uFogDensity.value = LOC.fog * fogMul;
    },
    // graphics settings: render resolution scale and water reflections
    setQuality: ({ resolution, reflections }) => {
      const base = mobile ? 0.6 : 1;
      const res = THREE.MathUtils.clamp(base * resolution, 0.3, 1);
      const changed = Math.abs(res - quality.resolution) > 1e-3;
      quality.resolution = res;
      quality.reflections = reflections;
      if (changed) resize();
    },
  };
  const game = createGame(engine);
  window.game = game;
  await game.init((p, t) => progress(0.6 + p * 0.4, t));

  // --- frame ---------------------------------------------------------------------
  const timer = new GpuTimer(renderer.getContext());
  let elapsed = 0;
  function renderFrame(dt) {
    elapsed += dt;
    game.update(dt);
    if (sunDirty) applySun();
    timer.beginFrame();
    if (query.resultCount > 0) { camWater = query.result[0]; game.ingestWater(query.result, query.resultCount); }
    floaters.ingest(query, 3);
    floaters.step(dt);
    floatShadow.update(renderer, floaters.scene, floaters.bodies, sky.sunDir);
    for (let i = 0; i < 8; i++) {
      const e = floaters.impacts[i], age = e ? floaters.time - e.t : 1e9;
      su.uImpact.value[i].set(e?.x ?? 0, e?.z ?? 0, age, age < 30 ? e.amp : 0);
      su.uImpactSize.value[i] = e?.size ?? 1;
    }
    ocean.update(dt, timer);
    caustics.update(sky.sunDir);
    surface.update(camera, elapsed % 3600);
    spray.update();
    const pts = floaters.collectPoints([camera.position, ...game.queryPoints()]);
    query.submit(pts, floaters.count, floaters.layout, elapsed);

    const camY = camera.position.y;
    // the first-person eye is kept >= 0.7 m above the water, so near-surface effects only
    // kick in for the underwater camera
    const submerged = camY < camWater - 0.3, nearSurface = camY < camWater + 0.6;
    su.uCamSide.value = camY > camWater + 0.5 ? -1 : camY < camWater - 0.5 ? 1 : 0;
    snow.update(camera, hdrRT.height, nearSurface);
    uwComp += ((submerged ? 0.55 : 1) - uwComp) * Math.min(1, dt * 3);
    post.params.exposure = uwComp;
    post.params.droplets = wasSubmerged && !submerged ? 1 : submerged ? 0 : Math.max(0, post.params.droplets - dt / 5);
    wasSubmerged = submerged;

    if (quality.reflections && !submerged) {
      reflection.render(renderer, scene, camera);
      su.uReflection.value = reflection.target.texture;
    } else su.uReflection.value = emptyReflection;

    renderer.setRenderTarget(hdrRT);
    renderer.setClearColor(0x000000, 1);
    renderer.clear(true, true, false);
    renderer.render(scene, camera);
    su.uShadowMap.value = sunLight.shadow.map.depthTexture;
    hdrRT.resolveDepthBuffer = nearSurface;
    renderer.render(waterScene, camera);
    hdrRT.resolveDepthBuffer = true;
    // rod + held fish on top, with their own near plane
    overlayCam.position.copy(camera.position);
    overlayCam.quaternion.copy(camera.quaternion);
    overlayCam.updateMatrixWorld();
    ovFill.position.set(0.4, 0.5, 0.2).applyMatrix4(camera.matrixWorld);
    // the underwater pass needs the scene depth, so the overlay (which clears depth) is
    // only drawn above the surface
    if (!nearSurface) {
      renderer.clear(false, true, false);
      renderer.render(overlay, overlayCam);
    }

    let out = hdrRT.texture;
    if (nearSurface) out = underwater.render(renderer, hdrRT, camY < camWater - 0.8);
    post.render(out, dt);
    timer.endFrame();
  }

  resize();
  applySun();
  // dev hook: advance the simulation by hand (rendering stalls while the tab is hidden)
  window.__step = (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) renderFrame(dt); };
  let last = performance.now();
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    try {
      renderFrame(dt);
    } catch (err) {
      console.error(err);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

boot().catch((err) => {
  console.error(err);
  ldText.textContent = 'Something went wrong loading the world: ' + err.message;
});
