import { queryClient, apiRequest } from "./queryClient";
import type { AuthUser, LoginForm, RegisterForm } from "@/types";

class AuthService {
  private currentUser: AuthUser | null = null;

  async login(credentials: LoginForm): Promise<AuthUser> {
    const response = await apiRequest("POST", "/api/auth/login", credentials);
    const data = await response.json();
    
    this.currentUser = data.user;
    
    // Invalidate all queries to refresh data with new auth state
    queryClient.invalidateQueries();
    
    return data.user;
  }

  async register(userData: RegisterForm): Promise<{ message: string; user: AuthUser }> {
    const response = await apiRequest("POST", "/api/auth/register", userData);
    const data = await response.json();
    return data;
  }

  async logout(): Promise<void> {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      this.currentUser = null;
      queryClient.clear();
      // Redirect to home page
      window.location.href = "/";
    }
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    if (this.currentUser) {
      return this.currentUser;
    }

    try {
      const response = await apiRequest("GET", "/api/auth/me");
      const data = await response.json();
      this.currentUser = data.user;
      return data.user;
    } catch (error) {
      // Not authenticated
      this.currentUser = null;
      return null;
    }
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const response = await apiRequest("POST", "/api/auth/forgot-password", { email });
    return response.json();
  }

  async resetPassword(token: string, password: string, confirmPassword: string): Promise<{ message: string }> {
    const response = await apiRequest("POST", "/api/auth/reset-password", {
      token,
      password,
      confirmPassword
    });
    return response.json();
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  hasRole(role: string): boolean {
    return this.currentUser?.role === role;
  }

  hasAnyRole(roles: string[]): boolean {
    return this.currentUser ? roles.includes(this.currentUser.role) : false;
  }

  isAdmin(): boolean {
    return this.hasAnyRole(["owner", "admin"]);
  }

  canReviewContent(): boolean {
    return this.hasAnyRole(["owner", "reviewer"]);
  }

  canManageUsers(): boolean {
    return this.hasAnyRole(["owner", "support"]);
  }

  // Get user info
  getUser(): AuthUser | null {
    return this.currentUser;
  }

  // Update current user data
  updateUser(userData: Partial<AuthUser>): void {
    if (this.currentUser) {
      this.currentUser = { ...this.currentUser, ...userData };
    }
  }
}

export const authService = new AuthService();

// React hook for authentication
export function useAuth() {
  const user = authService.getUser();
  
  return {
    user,
    isAuthenticated: authService.isAuthenticated(),
    isAdmin: authService.isAdmin(),
    canReviewContent: authService.canReviewContent(),
    canManageUsers: authService.canManageUsers(),
    hasRole: authService.hasRole.bind(authService),
    hasAnyRole: authService.hasAnyRole.bind(authService),
    login: authService.login.bind(authService),
    register: authService.register.bind(authService),
    logout: authService.logout.bind(authService),
    forgotPassword: authService.forgotPassword.bind(authService),
    resetPassword: authService.resetPassword.bind(authService),
  };
}
