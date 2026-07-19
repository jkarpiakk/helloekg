import { useEffect, useRef } from "react";
import type { Color } from "three"; // import wyłącznie typu — znika w buildzie, three ładowany dynamicznie

// TODO (przyszła iteracja): poniższa geometria to proceduralne przybliżenie anatomii.
// Docelowo próbkować cząsteczki z prawdziwego anatomicznego modelu .glb (NIH 3D / Sketchfab CC)
// — pień płucny, żyły, wieńcówki — zachowując tę samą estetykę: kolory, puls 72 BPM,
// rotację i gęstość.

type Props = { size?: number; className?: string };

export default function Hero3DHeart({ size = 360, className = "" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let disposed = false;
    let frameId = 0;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      const canvas = canvasRef.current;
      if (!canvas || disposed) return;

      const isMobile = window.matchMedia("(max-width: 768px)").matches;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(size, size, false);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
      camera.position.set(0, 0.15, 4.6);

      const cDark = new THREE.Color("#175A42");
      const cMid = new THREE.Color("#2BB380");
      const cLight = new THREE.Color("#3EE6A8");
      const cAorta = new THREE.Color("#66F2C4");
      const tmp = new THREE.Color();

      const P: number[] = [];
      const C: number[] = [];
      const jit = () => (Math.random() - 0.5) * 0.045;
      const push = (x: number, y: number, z: number, c: Color) => {
        P.push(x + jit(), y + jit(), z + jit());
        C.push(c.r, c.g, c.b);
      };
      const bodyColor = (y: number) => {
        tmp.copy(cDark)
          .lerp(cLight, Math.max(0, Math.min(1, (y + 1.0) / 1.7)))
          .lerp(cMid, Math.random() * 0.3);
        return tmp;
      };

      const D = isMobile ? 0.55 : 1; // redukcja gęstości na mobile

      // lewa komora
      for (let i = 0; i < Math.round(2100 * D); i++) {
        const u = Math.random();
        const a = Math.random() * Math.PI * 2;
        const y = 0.5 - 1.4 * u;
        const r = 0.72 * Math.pow(1 - u, 0.55) * (1 + 0.08 * Math.sin(a * 2));
        push(Math.cos(a) * r - 0.3 * u + 0.12, y, Math.sin(a) * r * 0.8, bodyColor(y));
      }
      // prawa komora
      for (let i = 0; i < Math.round(900 * D); i++) {
        const u = Math.random() * 0.72;
        const a = Math.random() * Math.PI * 2;
        const y = 0.42 - 1.1 * u;
        const r = 0.44 * Math.pow(1 - u / 0.72, 0.5);
        push(0.52 + Math.cos(a) * r - 0.18 * u, y, 0.12 + Math.sin(a) * r * 0.75, bodyColor(y));
      }
      // przedsionki
      const blob = (cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, n: number) => {
        for (let k = 0; k < Math.round(n * D); k++) {
          const th = Math.acos(2 * Math.random() - 1);
          const ph = Math.random() * Math.PI * 2;
          push(cx + Math.sin(th) * Math.cos(ph) * rx, cy + Math.cos(th) * ry, cz + Math.sin(th) * Math.sin(ph) * rz, bodyColor(cy));
        }
      };
      blob(-0.18, 0.55, -0.18, 0.34, 0.28, 0.3, 420);
      blob(0.42, 0.5, -0.05, 0.3, 0.24, 0.26, 350);
      blob(-0.05, 0.62, 0.22, 0.22, 0.18, 0.18, 200);

      // łuk aorty
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.02, 0.55, 0),
        new THREE.Vector3(0.06, 0.95, 0.02),
        new THREE.Vector3(-0.08, 1.22, -0.02),
        new THREE.Vector3(-0.42, 1.28, -0.08),
        new THREE.Vector3(-0.66, 1.05, -0.12),
        new THREE.Vector3(-0.72, 0.7, -0.14),
      ]);
      for (let i = 0; i < Math.round(950 * D); i++) {
        const t = Math.random();
        const p = curve.getPoint(t);
        const tan = curve.getTangent(t);
        const up = Math.abs(tan.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
        const n1 = new THREE.Vector3().crossVectors(tan, up).normalize();
        const n2 = new THREE.Vector3().crossVectors(tan, n1).normalize();
        const a = Math.random() * Math.PI * 2;
        const rr = 0.13 * (1 - 0.25 * t);
        tmp.copy(cAorta).lerp(cMid, Math.random() * 0.4);
        push(
          p.x + (n1.x * Math.cos(a) + n2.x * Math.sin(a)) * rr,
          p.y + (n1.y * Math.cos(a) + n2.y * Math.sin(a)) * rr,
          p.z + (n1.z * Math.cos(a) + n2.z * Math.sin(a)) * rr,
          tmp
        );
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(P), 3));
      geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(C), 3));
      const mat = new THREE.PointsMaterial({ size: 0.021, vertexColors: true, transparent: true, opacity: 0.92 });
      const cloud = new THREE.Points(geo, mat);
      cloud.rotation.z = -0.18;
      cloud.position.y = -0.12;
      const grp = new THREE.Group();
      grp.add(cloud);
      grp.scale.set(1.18, 1.18, 1.18);
      scene.add(grp);

      const t0 = performance.now();
      // puls 72 BPM = cykl 0,833 s; skurcz dwufazowy +6% i +3,5%
      const beat = (t: number) => {
        const p = (t % 0.833) / 0.833;
        return Math.exp(-Math.pow((p - 0.12) / 0.05, 2)) * 0.06 + Math.exp(-Math.pow((p - 0.34) / 0.07, 2)) * 0.035;
      };

      const loop = (now: number) => {
        const t = (now - t0) / 1000;
        grp.rotation.y = reduced ? 0.4 : t * 0.32;
        const s = 1.18 * (1 + (reduced ? 0 : beat(t)));
        grp.scale.set(s, s, s);
        renderer.render(scene, camera);
        if (!reduced) frameId = requestAnimationFrame(loop);
      };
      frameId = requestAnimationFrame(loop);

      cleanup = () => {
        cancelAnimationFrame(frameId);
        geo.dispose();
        mat.dispose();
        renderer.dispose();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      width={size * 2}
      height={size * 2}
      style={{ width: size, height: size, display: "block" }}
      className={className}
      aria-hidden="true"
    />
  );
}
