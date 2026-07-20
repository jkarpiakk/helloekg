import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/hooks/use-theme";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { CYCLE_SECONDS, cyclePhase } from "@/lib/heart-rhythm";

/**
 * Hero3DHeart — anatomiczne serce jako chmura cząsteczek, obracające się
 * i pulsujące skurczem dwufazowym w rytmie wspólnym z paskiem EKG pod hero.
 *
 * Punkty próbkowane są z powierzchni realnego modelu anatomicznego
 * (client/public/models/heart.glb — „Anatomically Correct Human Heart",
 * Pigcraft, CC BY 4.0; atrybucja w stopce). Gdy pliku brakuje, komponent
 * schodzi do geometrii proceduralnej i sygnalizuje to w konsoli.
 *
 * three.js, GLTFLoader i MeshSurfaceSampler ładowane wyłącznie dynamicznie —
 * nigdy nie trafiają do głównego bundle.
 *
 * Fala pobudzenia (SA → przedsionki → pauza AV → Hisa → odnogi → Purkinje)
 * jest zaimplementowana, ale WYŁĄCZONA stałą SHOW_CONDUCTION_WAVE — patrz
 * komentarz przy niej. Przy wyłączonej fali cała mapa aktywacji jest pomijana,
 * żeby nie płacić za obliczenia, których shader i tak nie użyje.
 */

const MODEL_URL = "/models/heart.glb";

// Obrót serca — spokojny, żeby bryła była czytelna (rad/s)
const ROTATION_SPEED = 0.14;

// Fala pobudzenia: 1 = sekwencja P → pauza AV → QRS → T, 0 = sam obrót i puls.
// Wyłączona na życzenie — cała logika mapy aktywacji zostaje w kodzie i wraca
// po zmianie tej stałej na true.
const SHOW_CONDUCTION_WAVE = false;

type Props = {
  size?: number;
  className?: string;
  /**
   * Czy koniuszek serca leży po stronie MINIMUM najdłuższej osi modelu.
   *
   * Automatyczne rozpoznanie po zwężeniu przekroju zawodzi: pęk wielkich naczyń
   * przy podstawie zwęża się podobnie jak koniuszek, więc heurystyka odwracała
   * serce do góry nogami. Domyślna wartość jest dobrana do modelu w repo oraz do
   * geometrii proceduralnej (obie mają koniuszek przy minimum). Przy podmianie
   * modelu na inny wystarczy przekazać `apexTowardAxisMin={false}` zamiast
   * edytować komponent.
   */
  apexTowardAxisMin?: boolean;
};

export default function Hero3DHeart({
  size = 360,
  className = "",
  apexTowardAxisMin = true,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);
  const { theme } = useTheme();
  const reducedMotion = useReducedMotion();
  // Uchwyt do uniformów palety — pozwala przemalować chmurę przy zmianie motywu
  // BEZ przebudowywania geometrii (ponowne parsowanie .glb i próbkowanie 20 000 punktów).
  const paletteRef = useRef<((isLight: boolean) => void) | null>(null);

  useEffect(() => {
    let disposed = false;
    let frameId = 0;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      const canvas = canvasRef.current;
      if (!canvas || disposed) return;

      const isMobile = window.matchMedia("(max-width: 768px)").matches;
      // Gęstość: 4900 pkt ze specyfikacji dawało zbyt rzadką, „dziurawą" bryłę przy
      // próbkowaniu realnej anatomii — chmura musi się zlepiać w kształt serca.
      const COUNT = isMobile ? 9000 : 20000;

      // ————— Źródło punktów: realny .glb, a w razie jego braku geometria proceduralna.
      // Ładowanie idzie PRZED utworzeniem renderera: kontekst WebGL powstawał wcześniej
      // niż te awaity i wyciekał, gdy komponent odmontowano w trakcie pobierania modelu.
      let raw: Float32Array | null = null;
      let rawNormals: Float32Array | null = null;
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
            // Model trzymamy bez normalnych (inaczej weld nie scala wierzchołków i plik
            // puchnie z 0,8 MB do 7 MB). Liczymy je tutaj — sampler potrzebuje ich,
            // żeby zwracać normalną powierzchni, na której opiera się cieniowanie.
            for (const m of meshes) {
              if (!m.geometry.getAttribute("normal")) m.geometry.computeVertexNormals();
            }
            // Próbkowanie z powierzchni mesha, proporcjonalnie do jego powierzchni
            const samplers = meshes.map((m) => new MeshSurfaceSampler(m).build());
            const out = new Float32Array(COUNT * 3);
            const outN = new Float32Array(COUNT * 3);
            const p = new THREE.Vector3();
            const nrm = new THREE.Vector3();
            for (let i = 0; i < COUNT; i++) {
              const mi = i % samplers.length;
              samplers[mi].sample(p, nrm);
              meshes[mi].localToWorld(p);
              out[i * 3] = p.x;
              out[i * 3 + 1] = p.y;
              out[i * 3 + 2] = p.z;
              outN[i * 3] = nrm.x;
              outN[i * 3 + 1] = nrm.y;
              outN[i * 3 + 2] = nrm.z;
            }
            raw = out;
            rawNormals = outN;
          }
        }
      } catch {
        // brak modelu lub błąd ładowania — zejdź do geometrii proceduralnej
      }
      if (disposed) return;
      const sampledFromModel = raw !== null;
      if (!raw) raw = buildProceduralHeart(COUNT);

      // Renderer dopiero TERAZ — po wszystkich awaitach. Dzięki temu nie istnieje
      // okno, w którym kontekst WebGL żyje, a `cleanup` jest jeszcze pustą funkcją.
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(size, size, false);
      // Zwolnienie kontekstu rejestrujemy natychmiast po jego utworzeniu.
      cleanup = () => renderer.dispose();

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
      camera.position.set(0, 0.15, 4.6);

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
      // Sterowane propem `apexTowardAxisMin` — uzasadnienie przy definicji propa.
      const lo = ext[longAxis].min, hi = ext[longAxis].max, len = hi - lo;
      const cLong = (lo + hi) / 2;
      const c1 = (ext[o1].min + ext[o1].max) / 2;
      const c2 = (ext[o2].min + ext[o2].max) / 2;
      const k = 2 / Math.max(len, 1e-6);
      const dir = apexTowardAxisMin ? 1 : -1;

      const positions = new Float32Array(COUNT * 3);
      for (let i = 0; i < COUNT; i++) {
        positions[i * 3] = (raw[i * 3 + o1] - c1) * k;
        positions[i * 3 + 1] = (raw[i * 3 + longAxis] - cLong) * k * dir;
        positions[i * 3 + 2] = (raw[i * 3 + o2] - c2) * k;
      }

      // Normalne przechodzą przez tę samą zamianę osi co pozycje (bez przesunięcia i skali)
      const normals = new Float32Array(COUNT * 3);
      for (let i = 0; i < COUNT; i++) {
        if (rawNormals) {
          normals[i * 3] = rawNormals[i * 3 + o1];
          normals[i * 3 + 1] = rawNormals[i * 3 + longAxis] * dir;
          normals[i * 3 + 2] = rawNormals[i * 3 + o2];
        } else {
          // Geometria proceduralna nie ma normalnych — przybliżamy je kierunkiem
          // od osi serca na zewnątrz, co dla bryły obrotowej jest wystarczające
          const nx = positions[i * 3], ny = positions[i * 3 + 1] * 0.35, nz = positions[i * 3 + 2];
          const len2 = Math.hypot(nx, ny, nz) || 1;
          normals[i * 3] = nx / len2;
          normals[i * 3 + 1] = ny / len2;
          normals[i * 3 + 2] = nz / len2;
        }
      }

      // ————— Mapa aktywacji (atrybut `aS`). Liczona TYLKO gdy fala jest włączona:
      // przy uWave = 0 shader mnoży jej wynik przez zero, a koszt to dwa pełne
      // sortowania 20 000 elementów i kilka przebiegów po całej chmurze.
      const sArr = new Float32Array(COUNT);
      if (SHOW_CONDUCTION_WAVE) {
      // Kotwice układu bodźcoprzewodzącego wyprowadzone Z GEOMETRII, nie zgadnięte.
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

      // Parametr `s`: położenie punktu wzdłuż ścieżki aktywacji
      //   0.00–0.30 przedsionki | 0.30–0.40 węzeł AV | 0.40–0.50 Hisa/odnogi | 0.50–1.00 miokardium komór
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

      for (let i = 0; i < COUNT; i++) {
        const y = positions[i * 3 + 1];
        pv.set(positions[i * 3], y, positions[i * 3 + 2]);

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
      }
      } // koniec bloku SHOW_CONDUCTION_WAVE

      // ————— Kolor jako PARAMETR, nie gotowa barwa. Atrybut niesie tylko położenie
      // punktu na gradiencie (0 = koniuszek, 1 = podstawa; wartość ujemna = aorta),
      // a konkretne barwy siedzą w uniformach. Dzięki temu zmiana motywu to podmiana
      // czterech uniformów zamiast ponownego parsowania modelu i próbkowania 20 000 punktów.
      const grad = new Float32Array(COUNT);
      for (let i = 0; i < COUNT; i++) {
        const y = positions[i * 3 + 1];
        grad[i] = y > 0.92 ? -1 : Math.max(0, Math.min(1, (y + 1) / 2));
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
      geo.setAttribute("aGrad", new THREE.BufferAttribute(grad, 1));
      geo.setAttribute("aS", new THREE.BufferAttribute(sArr, 1));
      geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
      geo.setAttribute("aNormal", new THREE.BufferAttribute(normals, 3));

      // ————— Fala aktywacji liczona w shaderze (jeden uniform czasu, atrybut `s` per cząsteczka)
      const uniforms = {
        uPhase: { value: 0 },
        uSize: { value: 0.030 },
        // bez fali chmura musi być jasna sama z siebie; z falą jest przygaszona,
        // żeby pobudzenie było wyraźnie widoczne
        uRest: { value: SHOW_CONDUCTION_WAVE ? 0.62 : 1.0 },
        uWave: { value: SHOW_CONDUCTION_WAVE ? 1 : 0 },
        uViewport: { value: size * Math.min(window.devicePixelRatio, 2) },
        // 1 = motyw jasny: głębia idzie rozmiarem punktu, nie jasnością
        uIsLight: { value: 0 },
        // Paleta gradientu — podmieniana przy zmianie motywu bez przebudowy geometrii
        uCDark: { value: new THREE.Color() },
        uCMid: { value: new THREE.Color() },
        uCLight: { value: new THREE.Color() },
        uCAorta: { value: new THREE.Color() },
      };

      /**
       * Ustawia paletę pod motyw. Na jasnym tle jasna zieleń #3EE6A8 ma kontrast
       * 1,5:1 i znika — brand book §2 zabrania jej na jasnych tłach, więc gradient
       * schodzi w ciemniejsze zielenie z akcentem #0B7E54.
       */
      const applyPalette = (light: boolean) => {
        uniforms.uIsLight.value = light ? 1 : 0;
        uniforms.uCDark.value.set(light ? "#06251A" : "#175A42");
        uniforms.uCMid.value.set(light ? "#0B7E54" : "#3AC98E");
        uniforms.uCLight.value.set(light ? "#12A971" : "#5CF2BC");
        uniforms.uCAorta.value.set(light ? "#14B87C" : "#8CFFD6");
      };
      applyPalette(theme === "light");
      // Udostępniamy na zewnątrz, żeby efekt motywu mógł przemalować bez rebuildu
      paletteRef.current = (light: boolean) => {
        applyPalette(light);
        if (reducedMotion) renderer.render(scene, camera);
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
          attribute float aGrad;
          attribute float aS;
          attribute float aSize;
          attribute vec3 aNormal;
          uniform float uPhase;
          uniform float uSize;
          uniform float uRest;
          uniform float uWave;
          uniform float uViewport;
          uniform float uIsLight;
          uniform vec3 uCDark;
          uniform vec3 uCMid;
          uniform vec3 uCLight;
          uniform vec3 uCAorta;
          varying vec3 vColor;
          varying float vAlpha;
          ${PHASE_GLSL}
          void main() {
            // Barwa z gradientu: aGrad < 0 oznacza aortę, w przeciwnym razie
            // 0 = koniuszek, 1 = podstawa. Paleta przychodzi uniformami, więc
            // zmiana motywu nie wymaga odbudowy bufora kolorów.
            vec3 aColor;
            if (aGrad < 0.0) {
              aColor = uCAorta;
            } else {
              aColor = mix(uCDark, uCMid, min(aGrad * 2.0, 1.0));
              aColor = mix(aColor, uCLight, max(aGrad - 0.5, 0.0) * 2.0);
            }

            float e = excitation(aS, uPhase) * uWave;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vec3 n = normalize(normalMatrix * aNormal);
            vec3 viewDir = normalize(-mv.xyz);

            // Światło kluczowe z góry-lewej-przodu. To ono rzeźbi anatomię: komory,
            // przedsionki i naczynia dostają różne jasności zależnie od nachylenia.
            float key = max(dot(n, normalize(vec3(-0.45, 0.65, 0.85))), 0.0);
            // Wypełnienie z przeciwnej strony, żeby cienie nie były głuche
            float fill = max(dot(n, normalize(vec3(0.7, -0.25, 0.35))), 0.0) * 0.35;
            // Rim — podkreśla krawędź bryły i oddziela ją od tła
            float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 2.2);

            // Punkty odwrócone tyłem wygaszamy, inaczej przednia i tylna ściana
            // nakładają się w jednolitą kaszę i struktury znikają
            float facing = smoothstep(-0.35, 0.25, dot(n, viewDir));

            // Wysokie wypełnienie ambient: przy chmurze punktów głębokie cienie
            // czytają się jako dziury, a nie jako bryła
            float lambert = 0.62 + key * 0.75 + fill;
            float depth = clamp((-mv.z - 3.2) / 2.4, 0.0, 1.0);

            vec3 base;
            float a;
            if (uIsLight > 0.5) {
              // Jasny motyw: głębi NIE wolno kodować jasnością. Tło jest już maksymalnie
              // jasne, więc rozjaśnianie ku niemu kasuje punkt (zmierzone 1,11:1 — znika),
              // przez co bryła traci tylną ścianę. Punkty zostają ciemne w całym zakresie
              // głębi, a dystans niesie rozmiar (niżej) i lekki spadek krycia.
              base = aColor * (0.80 + key * 0.35);
              base = mix(base, vec3(0.55, 0.68, 0.62), depth * 0.20);
              base = mix(base, vec3(0.04, 0.36, 0.24), rim * 0.45);
              a = uRest * mix(1.0, 0.78, depth) * mix(0.45, 1.0, facing);
            } else {
              base = aColor * lambert;
              base += vec3(0.243, 0.902, 0.659) * rim * 0.45;
              base = mix(base, base * 0.55, depth);
              a = uRest * mix(1.0, 0.62, depth) * mix(0.30, 1.0, facing);
            }

            // Rozświetlenie falą pobudzenia (gdy włączona)
            vColor = mix(base, vec3(0.36, 1.0, 0.76), e * 0.9);
            vAlpha = clamp(a + e * 0.45, 0.0, 1.0);

            // Rozmiar: bazowe zróżnicowanie per punkt + delikatny przyrost przy pobudzeniu.
            // Na jasnym motywie rozmiar przejmuje rolę nośnika głębi — punkty w głębi
            // są mniejsze zamiast bledsze, bo bledsze po prostu znikają na bieli.
            float depthSize = mix(1.0, mix(1.0, 0.55, depth), uIsLight);
            gl_PointSize = uSize * aSize * depthSize * uViewport / -mv.z * (1.0 + e * 0.22);
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

      // ————— Pętla: obrót ROTATION_SPEED rad/s + skurcz dwufazowy (+6% / +3,5%)
      // w cyklu CYCLE_SECONDS. Zegar absolutny (performance.now), a nie liczony
      // od montażu — dzięki temu HeroEKGStrip trafia w tę samą fazę bez przekazywania stanu.
      const mechanical = (phase: number) => {
        // Elektryka (QRS od 24%) lekko wyprzedza mechanikę — skurcz startuje ~26%.
        // Okna szersze niż w pierwszej wersji: skurcz ma płynąć, nie szarpać.
        const a = Math.exp(-Math.pow((phase - 0.27) / 0.075, 2)) * 0.06;
        const b = Math.exp(-Math.pow((phase - 0.44) / 0.10, 2)) * 0.035;
        return a + b;
      };

      if (reducedMotion) {
        // prefers-reduced-motion: pojedyncza klatka, bez pętli. Wygląd jest ten sam
        // co animowany (fala jest wyłączona globalnie), tylko zatrzymany w spoczynku
        // i obrócony tak, by bryła czytała się z widoku trzy czwarte.
        uniforms.uPhase.value = 0;
        grp.rotation.y = 0.4;
        renderer.render(scene, camera);
      } else {
        const loop = (now: number) => {
          const t = now / 1000;
          const phase = cyclePhase(t);
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
        paletteRef.current = null;
        geo.dispose();
        mat.dispose();
        renderer.dispose();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
    // `theme` celowo POZA zależnościami — zmiana motywu przemalowuje chmurę
    // uniformami w efekcie niżej, zamiast odbudowywać całą geometrię.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, apexTowardAxisMin, reducedMotion]);

  // Przemalowanie przy zmianie motywu — bez dotykania geometrii
  useEffect(() => {
    paletteRef.current?.(theme === "light");
  }, [theme]);

  return (
    <div
      className={className}
      style={{ position: "relative", width: size, height: size }}
      role="img"
      aria-label={
        SHOW_CONDUCTION_WAVE
          ? "Anatomiczne serce jako chmura punktów z falą pobudzenia biegnącą układem bodźcoprzewodzącym"
          : "Anatomiczne serce jako obracająca się chmura punktów, pulsująca w rytmie skurczu"
      }
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
