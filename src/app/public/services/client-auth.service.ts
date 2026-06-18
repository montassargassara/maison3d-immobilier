import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, tap } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { apiBaseUrl } from '../../services/api-config';

export interface ClientPublicProfile {
  id: number;
  email: string;
  nom: string;
  prenom: string;
  telephone: string;
  role: string;
}

export interface ClientAuthResponse {
  token: string;
  email: string;
  role: string;
  nom: string;
  prenom: string;
  userId: number;
}

const TOKEN_KEY = 'client_public_token';
const PROFILE_KEY = 'client_public_profile';

@Injectable({ providedIn: 'root' })
export class ClientAuthService {
  private http = inject(HttpClient);
  private base = `${apiBaseUrl}/api/client/auth`;

  private currentUser$ = new BehaviorSubject<ClientPublicProfile | null>(this.readProfile());
  readonly user$ = this.currentUser$.asObservable();

  register(payload: {
    nom: string;
    prenom: string;
    email: string;
    telephone: string;
    password: string;
    budgetEstime?: number;
    pays?: string;
    ville?: string;
  }): Observable<ClientAuthResponse> {
    return this.http.post<ClientAuthResponse>(`${this.base}/register`, payload).pipe(
      tap((res) => this.persist(res))
    );
  }

  login(email: string, password: string): Observable<ClientAuthResponse> {
    return this.http.post<ClientAuthResponse>(`${this.base}/login`, { email, password }).pipe(
      tap((res) => this.persist(res))
    );
  }

  me(): Observable<ClientPublicProfile | null> {
    if (!this.getToken()) return of(null);
    return this.http.get<ClientPublicProfile>(`${this.base}/me`).pipe(
      tap((profile) => {
        this.currentUser$.next(profile);
        this.writeStorage(PROFILE_KEY, JSON.stringify(profile));
      }),
      catchError(() => {
        this.logout();
        return of(null);
      })
    );
  }

  logout(): void {
    this.clearStorage();
    this.currentUser$.next(null);
  }

  /**
   * Considered logged-in as soon as a JWT is in storage. The cached profile
   * may rehydrate slightly later — basing the gate on the token alone avoids
   * a race where button handlers see "logged out" for a few ms and bounce
   * the user to /compte/login by mistake.
   */
  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  getToken(): string | null {
    return this.readStorage(TOKEN_KEY);
  }

  getCurrentUser(): ClientPublicProfile | null {
    return this.currentUser$.value;
  }

  private persist(res: ClientAuthResponse): void {
    this.writeStorage(TOKEN_KEY, res.token);
    const profile: ClientPublicProfile = {
      id: res.userId,
      email: res.email,
      nom: res.nom,
      prenom: res.prenom,
      telephone: '',
      role: res.role,
    };
    this.writeStorage(PROFILE_KEY, JSON.stringify(profile));
    this.currentUser$.next(profile);
  }

  private readProfile(): ClientPublicProfile | null {
    const raw = this.readStorage(PROFILE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ClientPublicProfile;
    } catch {
      return null;
    }
  }

  // Storage helpers — SSR safe (localStorage is undefined on the server)
  private readStorage(key: string): string | null {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(key);
  }
  private writeStorage(key: string, value: string): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(key, value);
  }
  private clearStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(PROFILE_KEY);
  }
}
