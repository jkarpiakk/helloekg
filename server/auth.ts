import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { storage } from "./storage";
import type { User } from "@shared/schema";

export interface AuthSession {
  userId: string;
  user: User;
}

export class AuthService {
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  async authenticateUser(email: string, password: string): Promise<User | null> {
    const user = await storage.getUserByEmail(email);
    if (!user) return null;

    const isValid = await this.verifyPassword(password, user.password);
    if (!isValid) return null;

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
    // Check if user already exists
    const existingUser = await storage.getUserByEmail(userData.email);
    if (existingUser) {
      throw new Error("Użytkownik z tym adresem e-mail już istnieje");
    }

    // Hash password
    const hashedPassword = await this.hashPassword(userData.password);
    
    // Generate verification token
    const verificationToken = this.generateToken();

    // Create user
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

    // Mark email as verified and clear token
    const updatedUser = await storage.updateUser(user.id, {
      emailVerified: true,
      emailVerificationToken: null
    });

    return updatedUser;
  }

  async initiatePasswordReset(email: string): Promise<string | null> {
    const user = await storage.getUserByEmail(email);
    if (!user) return null;

    const resetToken = this.generateToken();
    const expiry = new Date(Date.now() + 60 * 60 * 1000);

    await storage.updateUser(user.id, {
      passwordResetToken: resetToken,
      passwordResetExpiry: expiry,
    });

    return resetToken;
  }

  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; userId?: string; error?: string }> {
    const user = await storage.getUserByPasswordResetToken(token);
    if (!user) {
      return { success: false, error: "Nieprawidłowy token resetowania hasła" };
    }

    if (!user.passwordResetExpiry || new Date(user.passwordResetExpiry) < new Date()) {
      return { success: false, error: "Token resetowania hasła wygasł" };
    }

    const hashedPassword = await this.hashPassword(newPassword);

    await storage.updateUser(user.id, {
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpiry: null,
    });

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
