// services/admin-auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { apiBaseUrl } from '../../services/api-config';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  email: string;
  role: string;
  nom: string;
  prenom: string;
  userId: number;
  isActive?: boolean;
  avatarUrl?: string;
}

export interface AdminUser {
  id: number;
  userId: number;
  email: string;
  name: string;
  nom: string;
  prenom: string;
  role: string;
  isActive: boolean;
  permissions: string[];
  token?: string;
  telephone?: string;
  avatarUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminAuthService {
  private apiUrl = `${apiBaseUrl}/api/auth`;
  private currentUserSubject: BehaviorSubject<AdminUser | null>;
  public currentUser: Observable<AdminUser | null>;

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    const savedUser = localStorage.getItem('adminUser');
    const savedToken = localStorage.getItem('adminToken');
    
    let initialUser: AdminUser | null = null;
    
    if (savedUser && savedToken && savedUser !== 'undefined' && savedToken !== 'undefined') {
      try {
        const parsedUser = JSON.parse(savedUser);
        if (parsedUser && typeof parsedUser === 'object') {
          parsedUser.token = savedToken;
          initialUser = parsedUser;
        }
      } catch (e) {
        this.clearStorage();
      }
    }
    
    this.currentUserSubject = new BehaviorSubject<AdminUser | null>(initialUser);
    this.currentUser = this.currentUserSubject.asObservable();
  }

  private clearStorage(): void {
    localStorage.removeItem('adminUser');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminRemember');
  }

  login(email: string, password: string): Observable<AuthResponse> {
    const loginRequest: LoginRequest = { email, password };

    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, loginRequest)
      .pipe(
        tap(response => {
          if (!response || !response.token) {
            throw new Error('Réponse d\'authentification invalide');
          }

          const adminUser: AdminUser = {
            id: response.userId,
            userId: response.userId,
            email: response.email,
            name: `${response.prenom} ${response.nom}`,
            nom: response.nom,
            prenom: response.prenom,
            role: response.role,
            isActive: response.isActive ?? true,
            permissions: this.getPermissionsFromRole(response.role),
            token: response.token,
            avatarUrl: response.avatarUrl,
          };

          localStorage.setItem('adminUser', JSON.stringify(adminUser));
          localStorage.setItem('adminToken', response.token);
          this.currentUserSubject.next(adminUser);
        }),
        catchError(error => {
          console.error('Login API error:', error);
          return throwError(() => error);
        })
      );
  }

  private getPermissionsFromRole(role: string): string[] {
    const roleLower = role.toLowerCase();
    switch (roleLower) {
      case 'super_admin':
      case 'superadmin':
        return ['all'];
      case 'admin':
        return ['properties:create', 'properties:edit', 'properties:delete', 'users:view', 'dashboard:view'];
      case 'responsable_commercial':
        return ['properties:create', 'properties:edit', 'clients:view', 'commercials:manage', 'dashboard:view'];
      case 'commercial':
        return ['properties:create', 'properties:edit', 'clients:view', 'dashboard:view'];
      default:
        return [];
    }
  }

  logout(): void {
    this.clearStorage();
    this.currentUserSubject.next(null);
    this.router.navigate(['/admin/login']);
  }

  isLoggedIn(): boolean {
    const token = this.getToken();
    const user = this.currentUserSubject.value;
    return !!token && !!user && !this.isTokenExpired();
  }

  isAdmin(): boolean {
    const user = this.currentUserSubject.value;
    if (!user) return false;

    const userRole = user.role?.toUpperCase();
    const adminRoles = ['SUPER_ADMIN', 'SUPERADMIN', 'ADMIN', 'RESPONSABLE_COMMERCIAL', 'COMMERCIAL', 'AFFILIATE'];
    return adminRoles.includes(userRole);
  }

  getToken(): string | null {
    const token = localStorage.getItem('adminToken');
    return token && token !== 'undefined' ? token : null;
  }

  getCurrentUser(): AdminUser | null {
    return this.currentUserSubject.value;
  }

  /**
   * Patches the in-memory user and persists to localStorage.
   * Called by SettingsComponent after a successful profile / avatar update.
   */
  updateCurrentUser(patch: Partial<AdminUser>): void {
    const current = this.currentUserSubject.value;
    if (!current) return;
    const updated: AdminUser = {
      ...current,
      ...patch,
      name: patch.prenom && patch.nom
        ? `${patch.prenom} ${patch.nom}`
        : (patch.prenom ? `${patch.prenom} ${current.nom}` :
           patch.nom   ? `${current.prenom} ${patch.nom}` : current.name),
    };
    localStorage.setItem('adminUser', JSON.stringify(updated));
    this.currentUserSubject.next(updated);
  }

  isTokenExpired(): boolean {
    const token = this.getToken();
    if (!token) return true;

    try {
      const parts = token.split('.');
      if (parts.length !== 3) return true;
      
      const payload = JSON.parse(atob(parts[1]));
      const expiration = payload.exp * 1000;
      return Date.now() >= expiration;
    } catch (e) {
      return true;
    }
  }

  canAccessDashboard(): boolean {
    const user = this.currentUserSubject.value;
    if (!user) return false;

    const userRole = user.role?.toUpperCase();
    const dashboardRoles = ['SUPER_ADMIN', 'SUPERADMIN', 'ADMIN', 'COMMERCIAL', 'RESPONSABLE_COMMERCIAL', 'AFFILIATE'];
    return dashboardRoles.includes(userRole);
  }

  getDefaultRoute(): string {
    const role = this.currentUserSubject.value?.role?.toUpperCase();
    if (role === 'AFFILIATE') return '/admin/affiliate-dashboard';
    return '/admin/dashboard';
  }

  // Méthode pour rafraîchir le token
  refreshToken(): Observable<AuthResponse> {
    const currentToken = this.getToken();
    if (!currentToken) {
      return throwError(() => new Error('No token to refresh'));
    }
    
    return this.http.post<AuthResponse>(`${this.apiUrl}/refresh`, { token: currentToken })
      .pipe(
        tap(response => {
          if (response && response.token) {
            localStorage.setItem('adminToken', response.token);
            const currentUser = this.getCurrentUser();
            if (currentUser) {
              currentUser.token = response.token;
              localStorage.setItem('adminUser', JSON.stringify(currentUser));
              this.currentUserSubject.next(currentUser);
            }
          }
        }),
        catchError(error => {
          this.logout();
          return throwError(() => error);
        })
      );
  }
}