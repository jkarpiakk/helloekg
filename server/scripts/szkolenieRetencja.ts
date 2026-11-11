/**
 * Przechowywanie rejestru szkolenia z punktami: 5 lat od końca roku kalendarzowego wydania zaświadczenia
 * (zaświadczenie z 2.01.2026 → dane do 31.12.2031). Usuwa zapis, dziennik, podejścia i zaświadczenia osób,
 * których konto już nie istnieje, gdy okres minął (albo gdy nie mają żadnego zaświadczenia).
 * Konta istniejące nie są ruszane. Domyślnie tylko PRÓBA (liczy, nic nie usuwa).
 *
 *   DATABASE_URL=... npx tsx server/scripts/szkolenieRetencja.ts          # próba
 *   DATABASE_URL=... npx tsx server/scripts/szkolenieRetencja.ts --usun   # usunięcie
 *
 * To samo w panelu: Szkolenie → Ustawienia szkolenia → Przechowywanie (tylko właściciel).
 * Uruchamiać raz w roku, w styczniu (np. timer systemd), po kopii bazy.
 */
import { pool } from "../db";
import { czyscPrzeterminowane } from "../szkolenie/serwis";

const usun = process.argv.includes("--usun");
czyscPrzeterminowane({ proba: !usun })
  .then((w) => {
    console.log(usun ? "Usunięto:" : "PRÓBA (nic nie usunięto):", JSON.stringify(w));
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
