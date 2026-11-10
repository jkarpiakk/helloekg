import { z } from "zod";

/**
 * Przełączniki aplikacji.
 *
 * Z konfiguracji serwera (/etc/helloekg-kurs.env), bo zmieniają zachowanie płatności i indeksowania:
 * - PLATNOSCI_WLACZONE: domyślnie wyłączone; bez tego nie ma cennika, zakupu ani tras checkout (404).
 * - INDEKSOWANIE: domyślnie zakaz (X-Robots-Tag noindex i robots.txt Disallow) do dnia startu.
 *
 * Z panelu admina (tabela app_settings, zmienia właściciel): ustawienia niżej, z wartościami domyślnymi.
 */
export const platnosciWlaczone = (): boolean => /^(1|true|tak)$/i.test(process.env.PLATNOSCI_WLACZONE ?? "");
export const indeksowanieWlaczone = (): boolean => /^(1|true|tak)$/i.test(process.env.INDEKSOWANIE ?? "");

const IP_RE = /^(?:\d{1,3}(?:\.\d{1,3}){3}|[0-9a-f:]{2,39})$/i;

export const USTAWIENIA = {
  /** Formularz rejestracji przyjmuje nowe konta (istniejące konta działają zawsze) */
  rejestracja_otwarta: { domyslnie: true as boolean, schemat: z.boolean() },
  /** Regulamin bety i polityka prywatności opublikowane (po akceptacji JK); bez nich rejestracja jest zamknięta */
  dokumenty_opublikowane: { domyslnie: false as boolean, schemat: z.boolean() },
  /** Wyjątki od limitów prób dla adresów IP firmy testującej (pentest); domyślnie wyłączone */
  limit_wyjatki_wlaczone: { domyslnie: false as boolean, schemat: z.boolean() },
  limit_wyjatki_ip: { domyslnie: [] as string[], schemat: z.array(z.string().trim().regex(IP_RE, "Nieprawidłowy adres IP")).max(20) },
} as const;

export type KluczUstawienia = keyof typeof USTAWIENIA;
type Wartosc<K extends KluczUstawienia> = (typeof USTAWIENIA)[K]["domyslnie"];

const PAMIEC_MS = 10_000;
let pamiec: { kiedy: number; wartosci: Map<string, unknown> } | null = null;

async function wczytaj(): Promise<Map<string, unknown>> {
  if (pamiec && Date.now() - pamiec.kiedy < PAMIEC_MS) return pamiec.wartosci;
  const { pool } = await import("./db");
  const r = await pool.query<{ key: string; value: unknown }>("SELECT key, value FROM app_settings");
  const wartosci = new Map(r.rows.map((w) => [w.key, w.value]));
  pamiec = { kiedy: Date.now(), wartosci };
  return wartosci;
}

export async function ustawienie<K extends KluczUstawienia>(klucz: K): Promise<Wartosc<K>> {
  const def = USTAWIENIA[klucz];
  try {
    const w = (await wczytaj()).get(klucz);
    const p = def.schemat.safeParse(w);
    return (p.success ? p.data : def.domyslnie) as Wartosc<K>;
  } catch (e: any) {
    console.error(`[ustawienia] odczyt ${klucz} nie wyszedł, wartość domyślna:`, e?.message);
    return def.domyslnie as Wartosc<K>;
  }
}

export async function wszystkieUstawienia(): Promise<{ [K in KluczUstawienia]: Wartosc<K> }> {
  const wynik: Record<string, unknown> = {};
  for (const k of Object.keys(USTAWIENIA) as KluczUstawienia[]) wynik[k] = await ustawienie(k);
  return wynik as { [K in KluczUstawienia]: Wartosc<K> };
}

export async function zapiszUstawienie(klucz: KluczUstawienia, wartosc: unknown, kto: string | null): Promise<void> {
  const p = USTAWIENIA[klucz].schemat.safeParse(wartosc);
  if (!p.success) throw new Error(p.error.issues[0]?.message ?? "Nieprawidłowa wartość");
  const { pool } = await import("./db");
  await pool.query(
    `INSERT INTO app_settings (key, value, updated_at, updated_by) VALUES ($1, $2::jsonb, now(), $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [klucz, JSON.stringify(p.data), kto],
  );
  pamiec = null;
}

/** Rejestracja przyjmuje konta: przełącznik w panelu i opublikowane dokumenty, do których jest zgoda */
export async function rejestracjaPrzyjmuje(): Promise<boolean> {
  return (await ustawienie("rejestracja_otwarta")) && (await ustawienie("dokumenty_opublikowane"));
}

/** Adres z listy wyjątków (pentest), gdy przełącznik jest włączony: limity prób go nie dotyczą */
export async function ipWyjeteZLimitow(ip: string | undefined): Promise<boolean> {
  if (!ip || !(await ustawienie("limit_wyjatki_wlaczone"))) return false;
  const czyste = ip.replace(/^::ffff:/i, "").toLowerCase();
  return (await ustawienie("limit_wyjatki_ip")).some((a) => a.toLowerCase() === czyste);
}
