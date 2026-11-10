import crypto from "crypto";
import bcrypt from "bcrypt";

/**
 * Skróty haseł: argon2id (wbudowany w Node od 24.7) w formacie PHC
 * `$argon2id$v=19$m=…,t=…,p=…$<sól>$<skrót>`, parametry wg zaleceń OWASP (19 MiB, 2 przebiegi, 1 wątek).
 * Stare konta mają skróty bcrypt (`$2b$…`): sprawdzamy je dalej, a po udanym logowaniu przeliczamy na argon2id.
 */
const PARAMS = { memory: 19456, passes: 2, parallelism: 1, tagLength: 32 } as const;

type Argon2Params = {
  message: string | Buffer;
  nonce: Buffer;
  parallelism: number;
  tagLength: number;
  memory: number;
  passes: number;
};
const argon2 = (crypto as unknown as {
  argon2: (alg: "argon2id", p: Argon2Params, cb: (err: Error | null, key: Buffer) => void) => void;
}).argon2;

function liczArgon2(haslo: string, sol: Buffer, p: { memory: number; passes: number; parallelism: number; tagLength: number }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    argon2("argon2id", { message: haslo, nonce: sol, ...p }, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

const b64 = (b: Buffer) => b.toString("base64").replace(/=+$/, "");

export async function skrotHasla(haslo: string): Promise<string> {
  const sol = crypto.randomBytes(16);
  const skrot = await liczArgon2(haslo, sol, PARAMS);
  return `$argon2id$v=19$m=${PARAMS.memory},t=${PARAMS.passes},p=${PARAMS.parallelism}$${b64(sol)}$${b64(skrot)}`;
}

const PHC = /^\$argon2id\$v=19\$m=(\d{1,7}),t=(\d{1,3}),p=(\d{1,2})\$([A-Za-z0-9+/]{16,})\$([A-Za-z0-9+/]{16,})$/;

export async function sprawdzHaslo(haslo: string, zapisany: string): Promise<boolean> {
  if (zapisany.startsWith("$2")) return bcrypt.compare(haslo, zapisany);
  const m = PHC.exec(zapisany);
  if (!m) return false;
  const oczekiwany = Buffer.from(m[5], "base64");
  const policzony = await liczArgon2(haslo, Buffer.from(m[4], "base64"), {
    memory: Number(m[1]),
    passes: Number(m[2]),
    parallelism: Number(m[3]),
    tagLength: oczekiwany.length,
  });
  return policzony.length === oczekiwany.length && crypto.timingSafeEqual(policzony, oczekiwany);
}

/** Skrót starego typu (bcrypt) albo ze słabszymi parametrami: przeliczyć po udanym logowaniu */
export function wymagaPrzeliczenia(zapisany: string): boolean {
  const m = PHC.exec(zapisany);
  return !m || Number(m[1]) < PARAMS.memory || Number(m[2]) < PARAMS.passes;
}
