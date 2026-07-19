import { useEffect, useRef, useState } from "react";

/**
 * Hero3DHeart — anatomiczne serce jako chmura cząsteczek z falą pobudzenia
 * biegnącą drogą układu bodźcoprzewodzącego (SA → przedsionki → pauza AV →
 * Hisa → odnogi → Purkinje), zsynchronizowaną z 72 BPM w sekwencji P → PQ → QRS → T.
 *
 * three.js, GLTFLoader i MeshSurfaceSampler ładowane wyłącznie dynamicznie —
 * nigdy nie trafiają do głównego bundle.
 *
 * ⚠️ TODO (brand book §6, B1): model źródłowy „Anatomically Correct Human Heart"
 * (Pigcraft, CC BY 4.0, Sketchfab) wymaga zalogowanego konta Sketchfab do pobrania,
 * więc NIE MA GO jeszcze w repo. Do czasu wgrania pliku pod MODEL_URL komponent
 * próbkuje geometrię proceduralną (anatomiczne przybliżenie: komory, przedsionki,
 * łuk aorty). Po wrzuceniu skompresowanego .glb (<1,5 MB) do client/public/models/
 * ścieżka GLB uruchomi się automatycznie — kod poniżej jej nie potrzebuje zmieniać.
 * Kotwice układu przewodzącego są zdefiniowane we frakcjach znormalizowanego
 * bounding boxa, więc zadziałają dla obu źródeł, ale po podpięciu realnego .glb
 * warto je dostroić wzrokowo do konkretnej anatomii modelu.
 */

const MODEL_URL = "/models/heart.glb";

// Cykl 72 BPM = 60/72 ≈ 0,8333 s
const CYCLE_SECONDS = 60 / 72;

type Props = { size?: number; className?: string };

export default function Hero3DHeart({ size = 360, className = "" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);

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
      const COUNT = isMobile ? 2700 : 4900;

      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(size, size, false);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
      camera.position.set(0, 0.15, 4.6);

      // ————— Źródło punktów: realny .glb, a w razie jego braku geometria proceduralna
      let raw: Float32Array | null = null;
      try {
        const head = await fetch(MODEL_URL, { method: "HEAD" });
        if (head.ok) {
          const [{ GLTFLoader }, { MeshSurfaceSampler }] = await Promise.all([
            import("three/examples/jsm/loaders/GLTFLoader.js"),
            import("three/examples/jsm/math/MeshSurfaceSampler.js"),
          ]);
          const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
          const meshes: any[] = [];
          gltf.scene.traverse((o: any) => {
            if (o.isMesh && o.geometry) meshes.push(o);
          });
          if (meshes.length) {
            // Próbkowanie z powierzchni mesha, proporcjonalnie do jego powierzchni
            const samplers = meshes.map((m) => new MeshSurfaceSampler(m).build());
            const out = new Float32Array(COUNT * 3);
            const p = new THREE.Vector3();
            for (let i = 0; i < COUNT; i++) {
              const mi = i % samplers.length;
              samplers[mi].sample(p);
              meshes[mi].localToWorld(p);
              out[i * 3] = p.x;
              out[i * 3 + 1] = p.y;
              out[i * 3 + 2] = p.z;
            }
            raw = out;
          }
        }
      } catch {
        // brak modelu lub błąd ładowania — zejdź do geometrii proceduralnej
      }
      if (disposed) return;
      const sampledFromModel = raw !== null;
      if (!raw) raw = buildProceduralHeart(COUNT);

      // ————— Normalizacja do wspólnej przestrzeni: środek w (0,0,0), wysokość = 2
      const bb = { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity };
      for (let i = 0; i < COUNT; i++) {
        const x = raw[i * 3], y = raw[i * 3 + 1], z = raw[i * 3 + 2];
        if (x < bb.minX) bb.minX = x; if (x > bb.maxX) bb.maxX = x;
        if (y < bb.minY) bb.minY = y; if (y > bb.maxY) bb.maxY = y;
        if (z < bb.minZ) bb.minZ = z; if (z > bb.maxZ) bb.maxZ = z;
      }
      const cx = (bb.minX + bb.maxX) / 2;
      const cy = (bb.minY + bb.maxY) / 2;
      const cz = (bb.minZ + bb.maxZ) / 2;
      const k = 2 / Math.max(bb.maxY - bb.minY, 1e-6);
      const positions = new Float32Array(COUNT * 3);
      for (let i = 0; i < COUNT; i++) {
        positions[i * 3] = (raw[i * 3] - cx) * k;
        positions[i * 3 + 1] = (raw[i * 3 + 1] - cy) * k;
        positions[i * 3 + 2] = (raw[i * 3 + 2] - cz) * k;
      }

      // ————— Kotwice układu bodźcoprzewodzącego (znormalizowana anatomia, y: -1 koniuszek … +1 podstawa)
      const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
      const SA = V(0.42, 0.78, -0.06);        // węzeł zatokowy — szczyt prawego przedsionka
      const AV = V(0.14, 0.34, 0.0);          // węzeł AV — podstawa przegrody międzyprzedsionkowej
      const HIS = V(0.12, 0.16, 0.0);         // pęczek Hisa — górna część przegrody międzykomorowej
      const RBB = V(0.30, -0.28, 0.04);       // odnoga prawa
      const LBB = V(-0.04, -0.32, 0.02);      // odnoga lewa
      const APEX = V(0.06, -0.88, 0.0);       // koniuszek — początek sieci Purkinjego
      const ATRIA_FLOOR = 0.30;               // powyżej tej wysokości traktujemy punkty jako przedsionki

      // ————— Parametr `s`: położenie punktu wzdłuż ścieżki aktywacji (liczone raz, przy inicjalizacji)
      //   0.00–0.30 przedsionki | 0.30–0.40 węzeł AV | 0.40–0.50 Hisa/odnogi | 0.50–1.00 miokardium komór
      const sArr = new Float32Array(COUNT);
      const colors = new Float32Array(COUNT * 3);
      const pv = new THREE.Vector3();

      // maksymalny dystans od SA w obrębie przedsionków — do normalizacji fali przedsionkowej
      let maxAtrialDist = 1e-6;
      for (let i = 0; i < COUNT; i++) {
        const y = positions[i * 3 + 1];
        if (y < ATRIA_FLOOR) continue;
        pv.set(positions[i * 3], y, positions[i * 3 + 2]);
        const d = pv.distanceTo(SA);
        if (d > maxAtrialDist) maxAtrialDist = d;
      }
      // maksymalny dystans komorowy od trasy Hisa-Purkinjego
      let maxVentDist = 1e-6;
      for (let i = 0; i < COUNT; i++) {
        const y = positions[i * 3 + 1];
        if (y >= ATRIA_FLOOR) continue;
        pv.set(positions[i * 3], y, positions[i * 3 + 2]);
        const d = Math.min(pv.distanceTo(APEX), pv.distanceTo(RBB), pv.distanceTo(LBB));
        if (d > maxVentDist) maxVentDist = d;
      }

      const cDark = new THREE.Color("#175A42");
      const cMid = new THREE.Color("#2BB380");
      const cLight = new THREE.Color("#3EE6A8");
      const cAorta = new THREE.Color("#66F2C4");
      const col = new THREE.Color();

      for (let i = 0; i < COUNT; i++) {
        const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
        pv.set(x, y, z);

        if (y >= ATRIA_FLOOR) {
          // Przedsionki: rozejście promieniste od węzła SA (fala, nie punkt)
          const d = pv.distanceTo(SA) / maxAtrialDist;
          if (pv.distanceTo(AV) < 0.16) {
            sArr[i] = 0.30 + Math.random() * 0.10;    // strefa węzła AV — przytrzymanie
          } else {
            sArr[i] = 0.02 + Math.min(d, 1) * 0.26;   // 0.02 … 0.28
          }
        } else if (pv.distanceTo(HIS) < 0.18) {
          sArr[i] = 0.40 + Math.random() * 0.04;       // pęczek Hisa
        } else {
          // Komory: najpierw wzdłuż przegrody ku koniuszkowi, potem sweep w górę po ścianach
          const dTree = Math.min(pv.distanceTo(APEX), pv.distanceTo(RBB), pv.distanceTo(LBB));
          const along = Math.min(dTree / maxVentDist, 1);
          sArr[i] = 0.50 + along * 0.50;
        }

        // Kolor: gradient po wysokości koniuszek → podstawa; aorta osobno
        const isAorta = y > 0.92;
        if (isAorta) {
          col.copy(cAorta);
        } else {
          const r = Math.max(0, Math.min(1, (y + 1) / 2));
          col.copy(cDark).lerp(cMid, Math.min(r * 2, 1));
          if (r > 0.5) col.lerp(cLight, (r - 0.5) * 2);
        }
        colors[i * 3] = col.r;
        colors[i * 3 + 1] = col.g;
        colors[i * 3 + 2] = col.b;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
      geo.setAttribute("aS", new THREE.BufferAttribute(sArr, 1));

      // ————— Fala aktywacji liczona w shaderze (jeden uniform czasu, atrybut `s` per cząsteczka)
      const uniforms = {
        uPhase: { value: 0 },
        uSize: { value: 0.021 },
        uRest: { value: 0.55 },        // spoczynkowe przygaszenie chmury
        uViewport: { value: size * Math.min(window.devicePixelRatio, 2) },
      };

      // Wspólny kod fazy dla chmury i okablowania:
      //   P   0–15%   przedsionki od SA na zewnątrz
      //   PQ  15–24%  przytrzymanie w węźle AV (reszta ciemnieje)
      //   QRS 24–34%  Hisa → odnogi → Purkinje, komory niemal jednocześnie
      //   T   45–60%  łagodna repolaryzacja gasnąca od komór
      const PHASE_GLSL = `
        float activationTime(float s) {
          if (s < 0.30) return (s / 0.30) * 0.15;                      // P
          if (s < 0.40) return 0.15 + ((s - 0.30) / 0.10) * 0.09;      // pauza AV / PQ
          if (s < 0.50) return 0.24 + ((s - 0.40) / 0.10) * 0.03;      // Hisa / odnogi
          return 0.27 + ((s - 0.50) / 0.50) * 0.07;                    // QRS w komorach
        }

        float cyclicGap(float a, float b) {
          float d = abs(a - b);
          return min(d, 1.0 - d);
        }

        float excitation(float s, float phase) {
          float tA = activationTime(s);
          float g = cyclicGap(phase, tA);
          float wave = exp(-(g * g) / (2.0 * 0.016 * 0.016));

          // Węzeł AV: jasny punkt TRWA przez całe opóźnienie PQ — sedno dydaktyczne
          if (s >= 0.30 && s < 0.40) {
            float hold = smoothstep(0.145, 0.16, phase) * (1.0 - smoothstep(0.225, 0.245, phase));
            wave = max(wave, hold);
          }

          // Załamek T: repolaryzacja komór, gasnąca w odwrotnej kolejności
          if (s >= 0.50) {
            float vfrac = (s - 0.50) / 0.50;
            float tT = 0.45 + (1.0 - vfrac) * 0.15;
            float gt = cyclicGap(phase, tT);
            wave = max(wave, exp(-(gt * gt) / (2.0 * 0.045 * 0.045)) * 0.55);
          }
          return wave;
        }
      `;

      const mat = new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        vertexShader: `
          attribute vec3 aColor;
          attribute float aS;
          uniform float uPhase;
          uniform float uSize;
          uniform float uRest;
          uniform float uViewport;
          varying vec3 vColor;
          varying float vAlpha;
          ${PHASE_GLSL}
          void main() {
            float e = excitation(aS, uPhase);
            // Rozświetlenie ku jasnej zieleni marki, poza tym kolor bazowy
            vColor = mix(aColor, vec3(0.243, 0.902, 0.659), e * 0.85);
            vAlpha = clamp(uRest + e * 0.45, 0.0, 0.92);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = uSize * uViewport / -mv.z * (1.0 + e * 0.6);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          varying vec3 vColor;
          varying float vAlpha;
          void main() {
            vec2 d = gl_PointCoord - vec2(0.5);
            if (dot(d, d) > 0.25) discard;   // okrągły punkt, bez poświaty i PBR
            gl_FragColor = vec4(vColor, vAlpha);
          }
        `,
      });

      const cloud = new THREE.Points(geo, mat);
      const grp = new THREE.Group();
      grp.add(cloud);
      grp.scale.set(1.18, 1.18, 1.18);
      scene.add(grp);

      // ————— B5: świecące okablowanie Hisa-Purkinjego (drzewko wewnątrz serca)
      const wirePts: number[] = [];
      const wireS: number[] = [];
      const addBranch = (from: any, to: any, sFrom: number, sTo: number, segs = 12) => {
        for (let i = 0; i < segs; i++) {
          const a = i / segs;
          const b = (i + 1) / segs;
          const pa = from.clone().lerp(to, a);
          const pb = from.clone().lerp(to, b);
          wirePts.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
          wireS.push(sFrom + (sTo - sFrom) * a, sFrom + (sTo - sFrom) * b);
        }
      };
      addBranch(SA, AV, 0.02, 0.30);        // szlaki międzywęzłowe
      addBranch(AV, HIS, 0.34, 0.42);       // węzeł AV → pęczek Hisa
      addBranch(HIS, RBB, 0.42, 0.47);      // odnoga prawa
      addBranch(HIS, LBB, 0.42, 0.47);      // odnoga lewa
      addBranch(RBB, APEX, 0.47, 0.55);     // ku koniuszkowi
      addBranch(LBB, APEX, 0.47, 0.55);
      // sieć Purkinjego — sweep w górę po ścianach obu komór
      addBranch(APEX, V(0.62, -0.10, 0.10), 0.55, 0.92);
      addBranch(APEX, V(-0.42, -0.06, 0.06), 0.55, 0.92);
      addBranch(APEX, V(0.14, -0.05, -0.34), 0.55, 0.88);

      const wireGeo = new THREE.BufferGeometry();
      wireGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(wirePts), 3));
      wireGeo.setAttribute("aS", new THREE.BufferAttribute(new Float32Array(wireS), 1));
      const wireMat = new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        vertexShader: `
          attribute float aS;
          uniform float uPhase;
          varying float vAlpha;
          ${PHASE_GLSL}
          void main() {
            vAlpha = 0.10 + excitation(aS, uPhase) * 0.9;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying float vAlpha;
          void main() { gl_FragColor = vec4(0.243, 0.902, 0.659, vAlpha); }
        `,
      });
      grp.add(new THREE.LineSegments(wireGeo, wireMat));

      setReady(true);

      // ————— Pętla: rotacja 0,32 rad/s + skurcz mechaniczny 72 BPM (dwufazowy +6% / +3,5%)
      // Zegar absolutny (performance.now), a nie liczony od montażu — dzięki temu
      // HeroEKGStrip trafia w tę samą fazę cyklu bez przekazywania stanu.
      const mechanical = (phase: number) => {
        // Elektryka (QRS od 24%) lekko wyprzedza mechanikę — skurcz startuje ~26%
        const a = Math.exp(-Math.pow((phase - 0.26) / 0.045, 2)) * 0.06;
        const b = Math.exp(-Math.pow((phase - 0.40) / 0.06, 2)) * 0.035;
        return a + b;
      };

      if (reduced) {
        // prefers-reduced-motion: statyczne serce z podświetloną trasą przewodzenia,
        // bez pętli animacji — zatrzymane w fazie QRS, gdy widać całe drzewko
        uniforms.uPhase.value = 0.30;
        grp.rotation.y = 0.4;
        renderer.render(scene, camera);
      } else {
        const loop = (now: number) => {
          const t = now / 1000;
          const phase = (t % CYCLE_SECONDS) / CYCLE_SECONDS;
          uniforms.uPhase.value = phase;
          grp.rotation.y = t * 0.32;
          const s = 1.18 * (1 + mechanical(phase));
          grp.scale.set(s, s, s);
          renderer.render(scene, camera);
          frameId = requestAnimationFrame(loop);
        };
        frameId = requestAnimationFrame(loop);
      }

      if (!sampledFromModel && typeof console !== "undefined") {
        console.info(
          "[Hero3DHeart] Brak %s — użyto geometrii proceduralnej. Wgraj model Pigcraft (CC BY 4.0), aby próbkować realną anatomię.",
          MODEL_URL
        );
      }

      cleanup = () => {
        cancelAnimationFrame(frameId);
        geo.dispose();
        mat.dispose();
        wireGeo.dispose();
        wireMat.dispose();
        renderer.dispose();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [size]);

  return (
    <div
      className={className}
      style={{ position: "relative", width: size, height: size }}
      role="img"
      aria-label="Serce jako chmura punktów z falą pobudzenia biegnącą układem bodźcoprzewodzącym"
    >
      {/* Statyczny placeholder do czasu załadowania modelu — hero nie blokuje LCP */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          opacity: ready ? 0 : 1,
          transition: "opacity 0.6s ease",
          background: "radial-gradient(closest-side, rgba(62,230,168,0.10), rgba(11,15,20,0) 70%)",
        }}
      />
      <canvas
        ref={canvasRef}
        width={size * 2}
        height={size * 2}
        style={{ width: size, height: size, display: "block" }}
        aria-hidden="true"
      />
    </div>
  );
}

/**
 * Zapasowa geometria proceduralna — anatomiczne przybliżenie (komory, przedsionki,
 * łuk aorty) używane, dopóki w statykach nie ma modelu .glb. Zwraca surowe pozycje;
 * normalizacja i mapa aktywacji liczone są dalej tak samo jak dla punktów z mesha.
 */
function buildProceduralHeart(count: number): Float32Array {
  const out = new Float32Array(count * 3);
  const jit = () => (Math.random() - 0.5) * 0.045;
  let i = 0;
  const push = (x: number, y: number, z: number) => {
    if (i >= count) return;
    out[i * 3] = x + jit();
    out[i * 3 + 1] = y + jit();
    out[i * 3 + 2] = z + jit();
    i++;
  };

  const share = (f: number) => Math.round(count * f);

  // lewa komora
  for (let n = 0; n < share(0.42); n++) {
    const u = Math.random();
    const a = Math.random() * Math.PI * 2;
    const y = 0.5 - 1.4 * u;
    const r = 0.72 * Math.pow(1 - u, 0.55) * (1 + 0.08 * Math.sin(a * 2));
    push(Math.cos(a) * r - 0.3 * u + 0.12, y, Math.sin(a) * r * 0.8);
  }
  // prawa komora
  for (let n = 0; n < share(0.18); n++) {
    const u = Math.random() * 0.72;
    const a = Math.random() * Math.PI * 2;
    const y = 0.42 - 1.1 * u;
    const r = 0.44 * Math.pow(1 - u / 0.72, 0.5);
    push(0.52 + Math.cos(a) * r - 0.18 * u, y, 0.12 + Math.sin(a) * r * 0.75);
  }
  // przedsionki
  const blob = (cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, n: number) => {
    for (let m = 0; m < n; m++) {
      const th = Math.acos(2 * Math.random() - 1);
      const ph = Math.random() * Math.PI * 2;
      push(cx + Math.sin(th) * Math.cos(ph) * rx, cy + Math.cos(th) * ry, cz + Math.sin(th) * Math.sin(ph) * rz);
    }
  };
  blob(-0.18, 0.55, -0.18, 0.34, 0.28, 0.3, share(0.09));
  blob(0.42, 0.5, -0.05, 0.3, 0.24, 0.26, share(0.08));
  blob(-0.05, 0.62, 0.22, 0.22, 0.18, 0.18, share(0.04));

  // łuk aorty — parametryczny łuk nad podstawą serca
  const arc = (u: number) => {
    const pts = [
      [0.02, 0.55, 0], [0.06, 0.95, 0.02], [-0.08, 1.22, -0.02],
      [-0.42, 1.28, -0.08], [-0.66, 1.05, -0.12], [-0.72, 0.7, -0.14],
    ];
    const f = u * (pts.length - 1);
    const idx = Math.min(Math.floor(f), pts.length - 2);
    const l = f - idx;
    const a = pts[idx], b = pts[idx + 1];
    return [a[0] + (b[0] - a[0]) * l, a[1] + (b[1] - a[1]) * l, a[2] + (b[2] - a[2]) * l];
  };
  while (i < count) {
    const u = Math.random();
    const [px, py, pz] = arc(u);
    const a = Math.random() * Math.PI * 2;
    const rr = 0.13 * (1 - 0.25 * u);
    push(px + Math.cos(a) * rr, py, pz + Math.sin(a) * rr);
  }

  return out;
}
