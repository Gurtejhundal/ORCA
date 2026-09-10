'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Geometry,
  Mesh,
  Program,
  Renderer,
  RenderTarget,
  Texture,
  Triangle,
} from 'ogl';

const VIDEO_SRC = '/assets/ocean/orca-ocean.mp4';
const POSTER_SRC = '/assets/ocean/orca-ocean-poster.jpg';
const MAX_WAVES = 40;
const START_SCALE = 1.35;

const waveVertex = `
precision highp float;

attribute vec2 position;
attribute vec2 uv;
attribute vec2 iOffset;
attribute vec2 iScale;
attribute vec2 iDirection;
attribute float iOpacity;

varying vec2 vUv;
varying float vOpacity;

void main() {
  vUv = uv;
  vOpacity = iOpacity;
  vec2 direction = normalize(iDirection + vec2(0.0001));
  mat2 rotation = mat2(direction.x, -direction.y, direction.y, direction.x);
  vec2 transformed = rotation * (position * iScale);
  gl_Position = vec4(iOffset + transformed, 0.0, 1.0);
}
`;

const waveFragment = `
precision highp float;

varying vec2 vUv;
varying float vOpacity;

const float PI = 3.141592653589793;
const float EDGE = 0.006737947;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float radiusSquared = dot(p, p);
  if (radiusSquared > 1.0) discard;

  float brush = (exp(-radiusSquared * 4.2) - EDGE) / (1.0 - EDGE);
  float concentricCrests = 0.55 + 0.45 * cos(sqrt(radiusSquared) * PI * 8.0);
  float value = brush * concentricCrests * vOpacity * vOpacity;
  gl_FragColor = vec4(vec3(value), 1.0);
}
`;

const screenVertex = `
precision highp float;
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const compositeFragment = `
precision highp float;

varying vec2 vUv;

uniform sampler2D uVideo;
uniform sampler2D uDisplacement;
uniform vec2 uResolution;
uniform vec2 uVideoSize;
uniform vec2 uTexel;
uniform float uStrength;

vec2 coverUV(vec2 uv) {
  vec2 safeVideoSize = max(uVideoSize, vec2(1.0));
  vec2 scale = uResolution / safeVideoSize;
  vec2 scaledSize = safeVideoSize * max(scale.x, scale.y);
  vec2 offset = (uResolution - scaledSize) * 0.5;
  return (uv * uResolution - offset) / scaledSize;
}

void main() {
  float left = texture2D(uDisplacement, vUv - vec2(uTexel.x, 0.0)).r;
  float right = texture2D(uDisplacement, vUv + vec2(uTexel.x, 0.0)).r;
  float down = texture2D(uDisplacement, vUv - vec2(0.0, uTexel.y)).r;
  float up = texture2D(uDisplacement, vUv + vec2(0.0, uTexel.y)).r;
  vec2 gradient = vec2(right - left, up - down);

  // The boat remains crisp inside this feathered center exclusion zone.
  vec2 boatDistance = (vUv - vec2(0.5, 0.515)) / vec2(0.105, 0.205);
  float boatExclusion = smoothstep(0.58, 1.18, length(boatDistance));
  vec2 displacement = gradient * uStrength * boatExclusion;

  vec3 color = texture2D(uVideo, coverUV(vUv + displacement)).rgb;
  gl_FragColor = vec4(color, 1.0);
}
`;

type Wave = {
  x: number;
  y: number;
  directionX: number;
  directionY: number;
  longAxis: number;
  shortAxis: number;
  scale: number;
  target: number;
  opacity: number;
};

export function OceanRippleVideo({ ariaLabel = 'Fishing boat moving through the ocean' }: { ariaLabel?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [rippleEnabled, setRippleEnabled] = useState(false);

  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 720px)');
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setRippleEnabled(!mobileQuery.matches && !motionQuery.matches);

    sync();
    mobileQuery.addEventListener('change', sync);
    motionQuery.addEventListener('change', sync);
    return () => {
      mobileQuery.removeEventListener('change', sync);
      motionQuery.removeEventListener('change', sync);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const syncPlayback = () => {
      if (document.hidden) {
        video.pause();
      } else {
        void video.play().catch(() => {
          // The poster remains visible if the browser blocks autoplay.
        });
      }
    };

    syncPlayback();
    document.addEventListener('visibilitychange', syncPlayback);
    return () => document.removeEventListener('visibilitychange', syncPlayback);
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    const video = videoRef.current;
    if (!mount || !video || !rippleEnabled) return;

    let renderer: Renderer;
    try {
      renderer = new Renderer({
        alpha: false,
        antialias: false,
        dpr: 1,
      });
    } catch {
      return;
    }

    const gl = renderer.gl;
    gl.clearColor(0.02, 0.08, 0.11, 1);
    const canvas = gl.canvas;
    canvas.setAttribute('aria-hidden', 'true');
    mount.appendChild(canvas);

    const videoTexture = new Texture(gl, {
      generateMipmaps: false,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
    });

    const offsets = new Float32Array(MAX_WAVES * 2);
    const scales = new Float32Array(MAX_WAVES * 2);
    const directions = new Float32Array(MAX_WAVES * 2);
    const opacities = new Float32Array(MAX_WAVES);
    const waves: Wave[] = Array.from({ length: MAX_WAVES }, () => ({
      x: 0,
      y: 0,
      directionX: 1,
      directionY: 0,
      longAxis: 120,
      shortAxis: 72,
      scale: START_SCALE,
      target: START_SCALE,
      opacity: 0,
    }));

    const geometry = new Geometry(gl, {
      position: {
        size: 2,
        data: new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      },
      uv: {
        size: 2,
        data: new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]),
      },
      iOffset: { instanced: 1, size: 2, data: offsets },
      iScale: { instanced: 1, size: 2, data: scales },
      iDirection: { instanced: 1, size: 2, data: directions },
      iOpacity: { instanced: 1, size: 1, data: opacities },
    });

    const waveProgram = new Program(gl, {
      vertex: waveVertex,
      fragment: waveFragment,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      cullFace: false,
    });
    waveProgram.setBlendFunc(gl.ONE, gl.ONE);
    const waveMesh = new Mesh(gl, {
      geometry,
      program: waveProgram,
      frustumCulled: false,
    });

    const displacementTarget = new RenderTarget(gl, {
      width: 2,
      height: 2,
      depth: false,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
    });

    const compositeUniforms = {
      uVideo: { value: videoTexture },
      uDisplacement: { value: displacementTarget.texture },
      uResolution: { value: [1, 1] },
      uVideoSize: { value: [1920, 1080] },
      uTexel: { value: [1, 1] },
      uStrength: { value: 0.19 },
    };

    const compositeMesh = new Mesh(gl, {
      geometry: new Triangle(gl),
      program: new Program(gl, {
        vertex: screenVertex,
        fragment: compositeFragment,
        uniforms: compositeUniforms,
        depthTest: false,
        depthWrite: false,
      }),
    });

    let width = 1;
    let height = 1;
    let currentWave = 0;
    let previousX = Number.NaN;
    let previousY = Number.NaN;
    let previousPointerTime = 0;

    const resize = () => {
      width = Math.max(1, mount.clientWidth);
      height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height);
      compositeUniforms.uResolution.value = [width, height];

      const quality = width < 1024 ? 0.32 : 0.4;
      const fieldWidth = Math.max(2, Math.round(width * quality));
      const fieldHeight = Math.max(2, Math.round(height * quality));
      displacementTarget.setSize(fieldWidth, fieldHeight);
      compositeUniforms.uTexel.value = [1 / fieldWidth, 1 / fieldHeight];
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    const addWave = (
      x: number,
      y: number,
      directionX: number,
      directionY: number,
      velocity: number,
    ) => {
      const wave = waves[currentWave];
      currentWave = (currentWave + 1) % MAX_WAVES;
      wave.x = x;
      wave.y = y;
      wave.directionX = directionX;
      wave.directionY = directionY;
      wave.longAxis = 176 + velocity * 64;
      wave.shortAxis = 122 + velocity * 38;
      wave.scale = START_SCALE;
      wave.target = 5.1 + velocity * 0.9;
      wave.opacity = 0.95;
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = mount.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = rect.height - (event.clientY - rect.top);
      if (!Number.isFinite(previousX) || !Number.isFinite(previousY)) {
        previousX = x;
        previousY = y;
        previousPointerTime = event.timeStamp;
        return;
      }

      const dx = x - previousX;
      const dy = y - previousY;
      const distance = Math.hypot(dx, dy);
      if (distance < 12) return;

      const elapsed = Math.max(8, event.timeStamp - previousPointerTime);
      const velocity = Math.min(1, distance / elapsed / 1.25);
      const inverseDistance = 1 / Math.max(distance, 0.001);
      addWave(x, y, dx * inverseDistance, dy * inverseDistance, velocity);
      previousX = x;
      previousY = y;
      previousPointerTime = event.timeStamp;
    };

    const resetPointer = () => {
      previousX = Number.NaN;
      previousY = Number.NaN;
      previousPointerTime = 0;
    };

    mount.addEventListener('pointermove', onPointerMove, { passive: true });
    mount.addEventListener('pointerleave', resetPointer, { passive: true });

    let animationFrame = 0;
    let previousFrameTime = 0;
    let firstFrameDrawn = false;

    const renderFrame = (now: number) => {
      animationFrame = 0;
      if (document.hidden) return;

      const delta = previousFrameTime
        ? Math.min(0.05, (now - previousFrameTime) / 1000)
        : 0;
      previousFrameTime = now;
      const growth = 1 - Math.exp(-delta * 1.1);
      const decay = Math.exp(-delta * 2.05);

      for (let index = 0; index < MAX_WAVES; index += 1) {
        const wave = waves[index];
        if (wave.opacity <= 0.003) {
          wave.opacity = 0;
          opacities[index] = 0;
          continue;
        }

        wave.opacity *= decay;
        wave.scale += (wave.target - wave.scale) * growth;
        const halfLong = (wave.longAxis * wave.scale) / 2;
        const halfShort = (wave.shortAxis * wave.scale) / 2;

        offsets[index * 2] = (wave.x / width) * 2 - 1;
        offsets[index * 2 + 1] = (wave.y / height) * 2 - 1;
        scales[index * 2] = (halfLong / width) * 2;
        scales[index * 2 + 1] = (halfShort / height) * 2;
        directions[index * 2] = wave.directionX;
        directions[index * 2 + 1] = wave.directionY;
        opacities[index] = wave.opacity;
      }

      geometry.attributes.iOffset.needsUpdate = true;
      geometry.attributes.iScale.needsUpdate = true;
      geometry.attributes.iDirection.needsUpdate = true;
      geometry.attributes.iOpacity.needsUpdate = true;

      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        videoTexture.image = video;
        videoTexture.needsUpdate = true;
        renderer.render({ scene: waveMesh, target: displacementTarget, clear: true });
        renderer.render({ scene: compositeMesh });

        if (!firstFrameDrawn) {
          firstFrameDrawn = true;
          mount.dataset.ready = 'true';
        }
      }

      animationFrame = requestAnimationFrame(renderFrame);
    };

    const syncAnimation = () => {
      if (document.hidden) {
        if (animationFrame) cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        previousFrameTime = 0;
      } else if (!animationFrame) {
        animationFrame = requestAnimationFrame(renderFrame);
      }
    };

    document.addEventListener('visibilitychange', syncAnimation);
    animationFrame = requestAnimationFrame(renderFrame);

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', syncAnimation);
      mount.removeEventListener('pointermove', onPointerMove);
      mount.removeEventListener('pointerleave', resetPointer);
      delete mount.dataset.ready;
      if (canvas.parentNode === mount) mount.removeChild(canvas);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [rippleEnabled]);

  return (
    <div className="ocean-ripple">
      <div className="ocean-ripple__poster" aria-hidden="true" />
      <video
        ref={videoRef}
        className="ocean-ripple__video"
        data-ready={videoReady}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster={POSTER_SRC}
        onCanPlay={() => setVideoReady(true)}
        aria-label={ariaLabel}
      >
        <source src={VIDEO_SRC} type="video/mp4" />
      </video>
      <div ref={mountRef} className="ocean-ripple__surface" aria-hidden="true" />
    </div>
  );
}
