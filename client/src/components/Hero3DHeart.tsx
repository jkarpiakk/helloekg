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

// Tempo WIZUALNE cyklu (fala aktywacji + puls). Fizjologiczne 72 BPM (0,83 s) jest
// wizualnie za szybkie, by prześledzić SA → AV → QRS → T, więc cykl jest zwolniony
// ~3× dla czytelności dydaktycznej. Pasek EKG używa tej samej stałej → pełna synchronizacja.
const CYCLE_SECONDS = 2.6;
// Obrót serca — spokojny, żeby fala była czytelna (rad/s)
const ROTATION_SPEED = 0.14;

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
      // Gęstość: 4900 pkt ze specyfikacji dawało zbyt rzadką, „dziurawą" bryłę przy
      // próbkowaniu realnej anatomii — chmura musi się zlepiać w kształt serca.
      const COUNT = isMobile ? 9000 : 20000;

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

      // ————— Wyprostowanie modelu: długa oś anatomiczna (podstawa→koniuszek) ma iść wzdłuż Y,
      // koniuszkiem w dół. Model z Sketchfaba leży na boku (jego długa oś to Z), a inne
      // modele mogą być zorientowane jeszcze inaczej — dlatego oś wykrywamy z geometrii,
      // zamiast zakładać. Koniuszek rozpoznajemy po zwężeniu przekroju.
      const ext = [
        { min: Infinity, max: -Infinity },
        { min: Infinity, max: -Infinity },
        { min: Infinity, max: -Infinity },
      ];
      for (let i = 0; i < COUNT; i++) {
        for (let a = 0; a < 3; a++) {
          const val = raw[i * 3 + a];
          if (val < ext[a].min) ext[a].min = val;
          if (val > ext[a].max) ext[a].max = val;
        }
      }
      const spans = ext.map((e) => e.max - e.min);
      const longAxis = spans.indexOf(Math.max(...spans));
      const o1 = (longAxis + 1) % 3;
      const o2 = (longAxis + 2) % 3;

      // Kierunek osi: koniuszek ma być na dole (y = -1), podstawa z naczyniami na górze.
      //
      // Automatyczne wykrywanie koniuszka po zwężeniu przekroju NIE DZIAŁA na tym modelu:
      // pęk wielkich naczyń przy podstawie też się zwęża, więc heurystyka wskazywała
      // zły koniec i serce stawało na głowie. Kierunek jest więc ustawiony wprost.
      // Przy podmianie modelu na inny może wymagać odwrócenia znaku.
      const APEX_TOWARD_AXIS_MIN = true;

      const lo = ext[longAxis].min, hi = ext[longAxis].max, len = hi - lo;
      const cLong = (lo + hi) / 2;
      const c1 = (ext[o1].min + ext[o1].max) / 2;
      const c2 = (ext[o2].min + ext[o2].max) / 2;
      const k = 2 / Math.max(len, 1e-6);
      const dir = APEX_TOWARD_AXIS_MIN ? 1 : -1;

      const positions = new Float32Array(COUNT * 3);
      for (let i = 0; i < COUNT; i++) {
        positions[i * 3] = (raw[i * 3 + o1] - c1) * k;
        positions[i * 3 + 1] = (raw[i * 3 + longAxis] - cLong) * k * dir;
        positions[i * 3 + 2] = (raw[i * 3 + o2] - c2) * k;
      }

      // ————— Kotwice układu bodźcoprzewodzącego wyprowadzone Z GEOMETRII, nie zgadnięte.
      // Dzięki temu leżą na realnej anatomii modelu, a nie obok niej.
      const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
      const ATRIA_FLOOR = 0.35;               // powyżej tej wysokości punkty traktujemy jako przedsionki

      // centroid punktów spełniających warunek
      const centroid = (test: (x: number, y: number, z: number) => boolean, fallback: any) => {
        let n = 0, sx = 0, sy = 0, sz = 0;
        for (let i = 0; i < COUNT; i++) {
          const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
          if (!test(x, y, z)) continue;
          sx += x; sy += y; sz += z; n++;
        }
        return n ? V(sx / n, sy / n, sz / n) : fallback;
      };

      // Koniuszek — środek najniższego 2% masy
      const APEX = centroid((_x, y) => y < -0.90, V(0, -0.92, 0));
      // Strona przedsionków o większej masie: tam sadzamy węzeł SA (szczyt prawego przedsionka)
      let leftMass = 0, rightMass = 0;
      for (let i = 0; i < COUNT; i++) {
        if (positions[i * 3 + 1] < 0.55) continue;
        if (positions[i * 3] < 0) leftMass++; else rightMass++;
      }
      const saSide = rightMass >= leftMass ? 1 : -1;
      const SA = centroid((x, y) => y > 0.62 && x * saSide > 0.05, V(saSide * 0.3, 0.75, 0));

      // Węzeł AV i pęczek Hisa leżą w przegrodzie, czyli WEWNĄTRZ serca — a model jest pustą
      // skorupą powierzchniową, więc w środku nie ma ani jednej cząsteczki. Punkt na osi
      // byłby równo oddalony od całego pierścienia ściany i rozświetlałby pas dookoła serca
      // zamiast zlokalizowanego węzła. Dlatego kotwicę sadzimy na najbardziej przyśrodkowej
      // cząsteczce po stronie węzła SA — daje to lokalną plamkę we właściwym miejscu.
      const mostMedial = (yc: number, band: number, fallback: any) => {
        let best = fallback, bestR = Infinity;
        for (let i = 0; i < COUNT; i++) {
          const y = positions[i * 3 + 1];
          if (Math.abs(y - yc) > band) continue;
          const x = positions[i * 3], z = positions[i * 3 + 2];
          if (x * saSide < 0) continue;
          const r = Math.hypot(x, z);
          if (r < bestR) { bestR = r; best = V(x, y, z); }
        }
        return best;
      };
      const AV = mostMedial(0.26, 0.10, V(0, 0.26, 0));
      const HIS = mostMedial(0.02, 0.10, V(0, 0.02, 0));
      // Odnogi — schodzą przegrodą ku koniuszkowi, po obu jej stronach
      const RBB = V(HIS.x + 0.18, -0.35, HIS.z);
      const LBB = V(HIS.x - 0.18, -0.40, HIS.z);

      // Ile najbliższych cząsteczek tworzy widoczny węzeł. Progi promieniowe zawodzą,
      // bo zależą od skali i grubości ściany — licznik gwarantuje, że węzeł AV
      // (rdzeń dydaktyczny) ma zawsze co rozświetlić.
      const nodeCount = Math.max(40, Math.round(COUNT * 0.012));
      const nearestSet = (target: any, k: number) => {
        const d: { i: number; d: number }[] = [];
        for (let i = 0; i < COUNT; i++) {
          const dx = positions[i * 3] - target.x;
          const dy = positions[i * 3 + 1] - target.y;
          const dz = positions[i * 3 + 2] - target.z;
          d.push({ i, d: dx * dx + dy * dy + dz * dz });
        }
        d.sort((a, b) => a.d - b.d);
        const set = new Set<number>();
        for (let n = 0; n < Math.min(k, d.length); n++) set.add(d[n].i);
        return set;
      };
      const avNodeSet = nearestSet(AV, nodeCount);
      const hisSet = nearestSet(HIS, Math.round(nodeCount * 0.7));

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

        if (avNodeSet.has(i)) {
          sArr[i] = 0.30 + Math.random() * 0.10;       // węzeł AV — przytrzymanie w fazie PQ
        } else if (hisSet.has(i)) {
          sArr[i] = 0.40 + Math.random() * 0.04;       // pęczek Hisa
        } else if (y >= ATRIA_FLOOR) {
          // Przedsionki: rozejście promieniste od węzła SA (fala, nie punkt)
          const d = pv.distanceTo(SA) / maxAtrialDist;
          sArr[i] = 0.02 + Math.min(d, 1) * 0.26;      // 0.02 … 0.28
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

      // Zróżnicowany rozmiar punktów — jednolita kropka czytała się jak szum,
      // mieszanka drobnych i większych daje wrażenie materii o grubości
      const sizes = new Float32Array(COUNT);
      for (let i = 0; i < COUNT; i++) {
        const r = Math.random();
        sizes[i] = 0.55 + r * r * 1.35;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
      geo.setAttribute("aS", new THREE.BufferAttribute(sArr, 1));
      geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

      // ————— Fala aktywacji liczona w shaderze (jeden uniform czasu, atrybut `s` per cząsteczka)
      // uWave = 0 → fala pobudzenia WYŁĄCZONA: zostaje sam obrót i puls mechaniczny.
      // Ustaw na 1, żeby wrócić do rozświetlania sekwencją P → pauza AV → QRS → T
      // (cała logika mapy aktywacji jest policzona i gotowa, tylko wygaszona).
      const SHOW_CONDUCTION_WAVE = false;

      const uniforms = {
        uPhase: { value: 0 },
        uSize: { value: 0.021 },
        // bez fali chmura musi być jasna sama z siebie; z falą jest przygaszona,
        // żeby pobudzenie było wyraźnie widoczne
        uRest: { value: SHOW_CONDUCTION_WAVE ? 0.55 : 0.92 },
        uWave: { value: SHOW_CONDUCTION_WAVE ? 1 : 0 },
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
          // Asymetria: szybkie narastanie, wolniejszy zanik — front fali zostawia
          // czytelny ogon zamiast stroboskopowego mignięcia
          float signed = phase - tA;
          if (signed < -0.5) signed += 1.0;
          if (signed > 0.5) signed -= 1.0;
          float sigma = signed < 0.0 ? 0.022 : 0.075;
          float wave = exp(-(signed * signed) / (2.0 * sigma * sigma));

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
          attribute float aSize;
          uniform float uPhase;
          uniform float uSize;
          uniform float uRest;
          uniform float uWave;
          uniform float uViewport;
          varying vec3 vColor;
          varying float vAlpha;
          ${PHASE_GLSL}
          void main() {
            float e = excitation(aS, uPhase) * uWave;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);

            // Cieniowanie w głąb: punkty dalsze od kamery ciemnieją i lekko zanikają,
            // dzięki czemu chmura czyta się jako bryła, a nie płaska plama.
            float depth = clamp((-mv.z - 3.2) / 2.4, 0.0, 1.0);
            float shade = mix(1.0, 0.34, depth);

            // Rozświetlenie ku jasnej zieleni marki, poza tym kolor bazowy
            vColor = mix(aColor * shade, vec3(0.243, 0.902, 0.659), e * 0.85);
            vAlpha = clamp((uRest + e * 0.45) * mix(1.0, 0.55, depth), 0.0, 0.95);

            // Rozmiar: bazowe zróżnicowanie per punkt + delikatny przyrost przy pobudzeniu
            gl_PointSize = uSize * aSize * uViewport / -mv.z * (1.0 + e * 0.22);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          varying vec3 vColor;
          varying float vAlpha;
          void main() {
            vec2 d = gl_PointCoord - vec2(0.5);
            float r2 = dot(d, d);
            if (r2 > 0.25) discard;   // okrągły punkt, bez poświaty i PBR
            // Miękka krawędź — twarde kółka przy tej gęstości robiły efekt szumu
            float edge = smoothstep(0.25, 0.06, r2);
            gl_FragColor = vec4(vColor, vAlpha * edge);
          }
        `,
      });

      const cloud = new THREE.Points(geo, mat);
      const grp = new THREE.Group();
      grp.add(cloud);
      grp.scale.set(1.18, 1.18, 1.18);
      scene.add(grp);

      // Uwaga: świadomie BEZ rysowanego okablowania Hisa-Purkinjego. Polilinie wewnątrz
      // chmury czytały się jako obce kreski przecinające bryłę serca. Trasa przewodzenia
      // jest widoczna wyłącznie przez sekwencję rozświetlania cząsteczek.

      setReady(true);

      // ————— Pętla: rotacja 0,32 rad/s + skurcz mechaniczny 72 BPM (dwufazowy +6% / +3,5%)
      // Zegar absolutny (performance.now), a nie liczony od montażu — dzięki temu
      // HeroEKGStrip trafia w tę samą fazę cyklu bez przekazywania stanu.
      const mechanical = (phase: number) => {
        // Elektryka (QRS od 24%) lekko wyprzedza mechanikę — skurcz startuje ~26%.
        // Okna szersze niż w pierwszej wersji: skurcz ma płynąć, nie szarpać.
        const a = Math.exp(-Math.pow((phase - 0.27) / 0.075, 2)) * 0.06;
        const b = Math.exp(-Math.pow((phase - 0.44) / 0.10, 2)) * 0.035;
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
          grp.rotation.y = t * ROTATION_SPEED;
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
