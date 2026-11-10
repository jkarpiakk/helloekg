import { randomBytes, createHash } from "crypto";
import { storage } from "./storage";
import { skrotHasla, sprawdzHaslo, wymagaPrzeliczenia } from "./hasla";
import { db } from "./db";
import { userConsents, DOKUMENTY, type User } from "@shared/schema";

export interface AuthSession {
  userId: string;
  user: User;
}

/** Tokeny z maili trzymamy w bazie tylko jako skrót SHA-256: wyciek bazy nie daje działających linków */
export function hashToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

/** Link potwierdzający adres e-mail jest ważny 24 godziny, link do ustawienia hasła 1 godzinę */
export const WAZNOSC_POTWIERDZENIA_MS = 24 * 60 * 60 * 1000;
export const WAZNOSC_RESETU_MS = 60 * 60 * 1000;

/** Rejestracja na adres, który ma już konto: trasa odpowiada tak samo jak przy nowym koncie */
export class KontoIstnieje extends Error {
  constructor(public user: User) {
    super("Konto z tym adresem już istnieje");
  }
}

// Skrót-atrapa (ten sam koszt co prawdziwe hasła): przy nieznanym e-mailu i tak liczymy skrót,
// żeby czas odpowiedzi nie zdradzał, czy konto istnieje.
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) dummyHashPromise = skrotHasla(randomBytes(16).toString("hex"));
  return dummyHashPromise;
}
void getDummyHash(); // policz od razu przy starcie, nie przy pierwszym logowaniu

export class AuthService {
  async hashPassword(password: string): Promise<string> {
    return skrotHasla(password);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return sprawdzHaslo(password, hash);
  }

  generateToken(): string {
    return randomBytes(32).toString("hex");
  }

  async authenticateUser(email: string, password: string): Promise<User | null> {
    const user = await storage.getUserByEmail(email);
    const hash = user?.password ?? (await getDummyHash());
    const isValid = await this.verifyPassword(password, hash);
    if (!user || !isValid) return null;

    // stary skrót (bcrypt) przeliczamy na argon2id, póki mamy hasło w ręku
    if (wymagaPrzeliczenia(user.password)) {
      try {
        await storage.updateUser(user.id, { password: await this.hashPassword(password) });
      } catch (e: any) {
        console.error("[auth] przeliczenie skrótu hasła nie wyszło:", e?.message);
      }
    }
    return user;
  }

  /**
   * Nowe konto testera bety: rola student (kursant), znacznik tester_bety, zgody z wersją dokumentów.
   * Zwraca token potwierdzenia adresu (jawny tylko w mailu). Istniejący adres: KontoIstnieje.
   */
  async registerUser(dane: { email: string; password: string; firstName: string }): Promise<{ user: User; verificationToken: string }> {
    // skrót najpierw, także dla istniejącego adresu: czas odpowiedzi nie zdradza, czy konto już jest
    const hashedPassword = await this.hashPassword(dane.password);
    const existingUser = await storage.getUserByEmail(dane.email);
    if (existingUser) throw new KontoIstnieje(existingUser);

    const verificationToken = this.generateToken();

    const user = await db.transaction(async (tx) => {
      const user = await storage.createUser({
        email: dane.email,
        password: hashedPassword,
        firstName: dane.firstName,
        lastName: "",
        role: "student",
        testerBety: true,
        termsAccepted: true,
        privacyAccepted: true,
        marketingConsent: false,
        emailVerificationToken: hashToken(verificationToken),
        emailVerificationExpiry: new Date(Date.now() + WAZNOSC_POTWIERDZENIA_MS),
      }, tx);
      await tx.insert(userConsents).values([
        { userId: user.id, document: "regulamin_bety", version: DOKUMENTY.regulamin_bety.wersja },
        { userId: user.id, document: "polityka_prywatnosci", version: DOKUMENTY.polityka_prywatnosci.wersja },
      ]);
      return user;
    });

    return { user, verificationToken };
  }

  /** Nowy link potwierdzający (ponowne wysłanie): poprzedni przestaje działać */
  async newVerificationToken(userId: string): Promise<string> {
    const token = this.generateToken();
    await storage.updateUser(userId, {
      emailVerificationToken: hashToken(token),
      emailVerificationExpiry: new Date(Date.now() + WAZNOSC_POTWIERDZENIA_MS),
    });
    return token;
  }

  async verifyEmail(token: string): Promise<User | null> {
    const user = await storage.getUserByVerificationToken(hashToken(token));
    if (!user) return null;
    if (!user.emailVerificationExpiry || new Date(user.emailVerificationExpiry) < new Date()) return null;

    return storage.updateUser(user.id, {
      emailVerified: true,
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
      emailVerificationToken: null,
      emailVerificationExpiry: null,
    });
  }

  async initiatePasswordReset(email: string): Promise<string | null> {
    const user = await storage.getUserByEmail(email);
    if (!user) return null;

    // Jawny token idzie tylko do maila, w bazie jego skrót
    const plainToken = this.generateToken();
    await storage.updateUser(user.id, {
      passwordResetToken: hashToken(plainToken),
      passwordResetExpiry: new Date(Date.now() + WAZNOSC_RESETU_MS),
    });

    return plainToken;
  }

  async resetPassword(
    token: string,
    newPassword: string
  ): Promise<{ success: boolean; user?: User; error?: string }> {
    const user = await storage.getUserByPasswordResetToken(hashToken(token));
    if (!user) {
      return { success: false, error: "Link do ustawienia hasła jest nieprawidłowy albo został już użyty" };
    }

    if (!user.passwordResetExpiry || new Date(user.passwordResetExpiry) < new Date()) {
      return { success: false, error: "Link do ustawienia hasła wygasł. Poproś o nowy" };
    }

    const hashedPassword = await this.hashPassword(newPassword);

    // Token jednorazowy: czyścimy go razem ze zmianą hasła. Link z maila dowodzi, że adres należy do tej osoby,
    // więc ustawienie hasła z niego potwierdza też e-mail (np. konto założone przy zakupie gościa).
    const updated = await storage.updateUser(user.id, {
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpiry: null,
      emailVerified: true,
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
      emailVerificationToken: null,
      emailVerificationExpiry: null,
    });

    // Wszystkie dotychczasowe sesje (także napastnika, jeśli znał stare hasło) przestają działać
    await storage.invalidateUserSessions(user.id);

    return { success: true, user: updated };
  }

  hasRole(user: User, role: string): boolean {
    return user.role === role;
  }

  hasAnyRole(user: User, roles: string[]): boolean {
    return roles.includes(user.role);
  }

  isAdmin(user: User): boolean {
    return this.hasAnyRole(user, ["owner", "admin"]);
  }

  canReviewContent(user: User): boolean {
    return this.hasAnyRole(user, ["owner", "reviewer"]);
  }

  canManageUsers(user: User): boolean {
    return this.hasAnyRole(user, ["owner", "support"]);
  }
}

export const authService = new AuthService();
