import bcrypt from "bcrypt";
import { randomBytes, createHash } from "crypto";
import { storage } from "./storage";
import type { User } from "@shared/schema";

export interface AuthSession {
  userId: string;
  user: User;
}

function hashToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

// Hash-atrapa (ten sam koszt co prawdziwe hasła): przy nieznanym e-mailu i tak liczymy
// bcrypt.compare, żeby czas odpowiedzi nie zdradzał, czy konto istnieje.
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) dummyHashPromise = bcrypt.hash(randomBytes(16).toString("hex"), 12);
  return dummyHashPromise;
}
void getDummyHash(); // policz od razu przy starcie, nie przy pierwszym logowaniu

export class AuthService {
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  generateToken(): string {
    return randomBytes(32).toString("hex");
  }

  async authenticateUser(email: string, password: string): Promise<User | null> {
    const user = await storage.getUserByEmail(email);
    const hash = user?.password ?? (await getDummyHash());
    const isValid = await this.verifyPassword(password, hash);
    if (!user || !isValid) return null;

    return user;
  }

  async registerUser(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    profession?: string;
    marketingConsent: boolean;
    termsAccepted: boolean;
    privacyAccepted: boolean;
  }): Promise<{ user: User; verificationToken: string }> {
    const existingUser = await storage.getUserByEmail(userData.email);
    if (existingUser) {
      throw new Error("Użytkownik z tym adresem e-mail już istnieje");
    }

    const hashedPassword = await this.hashPassword(userData.password);
    const verificationToken = this.generateToken();

    const user = await storage.createUser({
      ...userData,
      password: hashedPassword,
      emailVerificationToken: verificationToken,
    });

    return { user, verificationToken };
  }

  async verifyEmail(token: string): Promise<User | null> {
    const user = await storage.getUserByVerificationToken(token);
    if (!user) return null;

    const updatedUser = await storage.updateUser(user.id, {
      emailVerified: true,
      emailVerificationToken: null,
    });

    return updatedUser;
  }

  async initiatePasswordReset(email: string): Promise<string | null> {
    const user = await storage.getUserByEmail(email);
    if (!user) return null;

    // Generate plaintext token (goes in the email link), store only its hash
    const plainToken = this.generateToken();
    const tokenHash = hashToken(plainToken);
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 60 minutes

    await storage.updateUser(user.id, {
      passwordResetToken: tokenHash,
      passwordResetExpiry: expiry,
    });

    return plainToken; // Only the plaintext leaves this function
  }

  async resetPassword(
    token: string,
    newPassword: string
  ): Promise<{ success: boolean; userId?: string; error?: string }> {
    // Look up by the hash of the incoming token
    const tokenHash = hashToken(token);
    const user = await storage.getUserByPasswordResetToken(tokenHash);
    if (!user) {
      return { success: false, error: "Nieprawidłowy token resetowania hasła" };
    }

    if (!user.passwordResetExpiry || new Date(user.passwordResetExpiry) < new Date()) {
      return { success: false, error: "Token resetowania hasła wygasł" };
    }

    const hashedPassword = await this.hashPassword(newPassword);

    // Clear the token and set the new password. Link z maila dowodzi, że adres należy do tej osoby,
    // więc ustawienie hasła z niego potwierdza też e-mail (np. konto założone przy zakupie gościa).
    await storage.updateUser(user.id, {
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpiry: null,
      emailVerified: true,
      emailVerificationToken: null,
    });

    // Invalidate all existing sessions so old sessions can no longer be used
    await storage.invalidateUserSessions(user.id);

    return { success: true, userId: user.id };
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
