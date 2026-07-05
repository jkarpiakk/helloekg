import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

/**
 * Hero 3D heart — a particle cloud, brand hero only.
 *
 * three.js is imported dynamically so it never lands in the main bundle
 * (loads on mount, when this component actually renders).
 *
 * ⚠️ TODO (brand book §6): the geometry below is a PROCEDURAL APPROXIMATION —
 * a mathematical heart cloud, deliberately non-final. Replace with points
 * SAMPLED from a real anatomical `.glb` (pulmonary trunk, veins, coronaries)
 * via MeshSurfaceSampler, keeping this look (gradient, 72 BPM pulse, rotation,
 * density). Treat this file as the motion/appearance reference, not final geometry.
 */

interface Hero3DHeartProps {
  className?: string;
  /** Accessible description of the decorative hero. */
  ariaLabel?: string;
}

// 2D heart outline (classic parametric curve); lofted into 3D below.
function heartOutline(t: number): [number, number] {
  const x = 16 * Math.sin(t) ** 3;
  const y =
    13 * Math.cos(t) -
    5 * Math.cos(2 * t) -
    2 * Math.cos(3 * t) -
    Math.cos(4 * t);
  return [x / 16, y / 16]; // normalize to ~unit scale
}

// Linear interpolate between three hex colors by height ratio [0..1].
function heightColor(r: number): [number, number, number] {
  // #175A42 -> #2BB380 -> #3EE6A8
  const stops = [
    [0x17 / 255, 0x5a / 255, 0x42 / 255],
    [0x2b / 255, 0xb3 / 255, 0x80 / 255],
    [0x3e / 255, 0xe6 / 255, 0xa8 / 255],
  ];
  const seg = r < 0.5 ? 0 : 1;
  const local = r < 0.5 ? r / 0.5 : (r - 0.5) / 0.5;
  const a = stops[seg];
  const b = stops[seg + 1];
  return [
    a[0] + (b[0] - a[0]) * local,
    a[1] + (b[1] - a[1]) * local,
    a[2] + (b[2] - a[2]) * local,
  ];
}

export function Hero3DHeart({ className, ariaLabel = "Serce jako chmura punktów — bohater helloEKG" }: Hero3DHeartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = usePrefersReducedMotion();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let raf = 0;
    let cleanup = () => {};

    (async () => {
      let THREE: any;
      try {
        THREE = await import("three");
      } catch {
        return; // keep the static placeholder if three fails to load
      }
      if (disposed) return;

      const parent = canvas.parentElement;
      let width = parent?.clientWidth || 480;
      let height = parent?.clientHeight || 480;
      const isMobile = width < 768;
      const COUNT = isMobile ? 2700 : 4900;
      const AORTA = Math.round(COUNT * 0.06);

      let renderer: any;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      } catch {
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
      camera.position.set(0, 0, 3.4);

      const positions = new Float32Array(COUNT * 3);
      const colors = new Float32Array(COUNT * 3);

      // Body: loft the 2D heart outline through depth s in [-1, 1] (puffy heart).
      const bodyCount = COUNT - AORTA;
      let yMin = Infinity;
      let yMax = -Infinity;
      const tmp: number[] = [];
      for (let i = 0; i < bodyCount; i++) {
        const t = Math.random() * Math.PI * 2;
        const s = Math.random() * 2 - 1;
        const k = Math.sqrt(Math.max(0, 1 - s * s));
        const [ox, oy] = heartOutline(t);
        const jitter = 0.015;
        const x = ox * k + (Math.random() - 0.5) * jitter;
        const y = oy + (Math.random() - 0.5) * jitter;
        const z = s * 0.62 + (Math.random() - 0.5) * jitter;
        tmp.push(x, y, z);
        if (y < yMin) yMin = y;
        if (y > yMax) yMax = y;
      }
      for (let i = 0; i < bodyCount; i++) {
        const x = tmp[i * 3];
        const y = tmp[i * 3 + 1];
        const z = tmp[i * 3 + 2];
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
        const r = (y - yMin) / (yMax - yMin || 1);
        const [cr, cg, cb] = heightColor(r);
        colors[i * 3] = cr;
        colors[i * 3 + 1] = cg;
        colors[i * 3 + 2] = cb;
      }

      // Aorta: an arc rising from the top of the heart (colour #66F2C4).
      const aortaColor = [0x66 / 255, 0xf2 / 255, 0xc4 / 255];
      const start = new THREE.Vector3(0.05, yMax * 0.7, 0.1);
      const ctrl = new THREE.Vector3(0.35, yMax + 0.5, 0.05);
      const end = new THREE.Vector3(0.15, yMax + 1.05, -0.1);
      for (let i = 0; i < AORTA; i++) {
        const idx = bodyCount + i;
        const u = i / AORTA;
        // quadratic bezier
        const mx = (1 - u) * (1 - u) * start.x + 2 * (1 - u) * u * ctrl.x + u * u * end.x;
        const my = (1 - u) * (1 - u) * start.y + 2 * (1 - u) * u * ctrl.y + u * u * end.y;
        const mz = (1 - u) * (1 - u) * start.z + 2 * (1 - u) * u * ctrl.z + u * u * end.z;
        const j = 0.04;
        positions[idx * 3] = mx + (Math.random() - 0.5) * j;
        positions[idx * 3 + 1] = my + (Math.random() - 0.5) * j;
        positions[idx * 3 + 2] = mz + (Math.random() - 0.5) * j;
        colors[idx * 3] = aortaColor[0];
        colors[idx * 3 + 1] = aortaColor[1];
        colors[idx * 3 + 2] = aortaColor[2];
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: isMobile ? 0.03 : 0.024,
        vertexColors: true,
        transparent: true,
        opacity: 0.92,
        sizeAttenuation: true,
        depthWrite: false,
      });

      const points = new THREE.Points(geometry, material);
      points.rotation.x = -0.15;
      scene.add(points);

      setReady(true);

      const onResize = () => {
        if (!parent) return;
        width = parent.clientWidth;
        height = parent.clientHeight;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      window.addEventListener("resize", onResize);

      if (reduced) {
        // Static: a gentle fixed pose, single render, no loop.
        points.rotation.y = 0.5;
        renderer.render(scene, camera);
      } else {
        const ROT = 0.32; // rad/s
        const BEAT = 60 / 72; // seconds per beat @ 72 BPM
        let last = 0;
        const loop = (now: number) => {
          if (disposed) return;
          const time = now / 1000;
          const dt = last ? time - last : 0;
          last = time;
          points.rotation.y += ROT * dt;
          // Two-phase pulse: +6% then +3.5%.
          const phase = (time % BEAT) / BEAT;
          const b1 = Math.exp(-((phase - 0.12) ** 2) / (2 * 0.02 ** 2)) * 0.06;
          const b2 = Math.exp(-((phase - 0.32) ** 2) / (2 * 0.03 ** 2)) * 0.035;
          points.scale.setScalar(1 + b1 + b2);
          renderer.render(scene, camera);
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      }

      cleanup = () => {
        window.removeEventListener("resize", onResize);
        cancelAnimationFrame(raf);
        geometry.dispose();
        material.dispose();
        renderer.dispose();
      };
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cleanup();
    };
  }, [reduced]);

  return (
    <div
      className={className}
      role="img"
      aria-label={ariaLabel}
      style={{ position: "relative", width: "100%", height: "100%", minHeight: 320 }}
    >
      {/* Static placeholder — visible until the cloud is ready (keeps LCP cheap). */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          opacity: ready ? 0 : 1,
          transition: "opacity 0.6s ease",
          background:
            "radial-gradient(closest-side, rgba(62,230,168,0.10), rgba(11,15,20,0) 70%)",
        }}
      />
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
    </div>
  );
}

export default Hero3DHeart;
