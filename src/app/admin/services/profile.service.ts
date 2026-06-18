import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { Observable, map } from 'rxjs';
import { apiBaseUrl } from '../../services/api-config';

export interface UserProfileDTO {
  id: number;
  prenom: string;
  nom: string;
  email: string;
  telephone?: string;
  role: string;
  avatarUrl?: string;
}

export interface UpdateProfileRequest {
  prenom: string;
  nom: string;
  email: string;
  telephone?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly base = `${apiBaseUrl}/api/profile`;

  constructor(private http: HttpClient, private sanitizer: DomSanitizer) {}

  /** Fetch a JWT-protected image URL as a blob and return a safe object URL. */
  fetchAvatarBlob(avatarUrl: string): Observable<SafeUrl> {
    return this.http.get(avatarUrl, { responseType: 'blob' }).pipe(
      map(blob => this.sanitizer.bypassSecurityTrustUrl(URL.createObjectURL(blob)))
    );
  }

  getProfile(): Observable<UserProfileDTO> {
    return this.http.get<UserProfileDTO>(this.base);
  }

  updateProfile(req: UpdateProfileRequest): Observable<UserProfileDTO> {
    return this.http.put<UserProfileDTO>(this.base, req);
  }

  changePassword(req: ChangePasswordRequest): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.base}/password`, req);
  }

  uploadAvatar(file: File): Observable<UserProfileDTO> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<UserProfileDTO>(`${this.base}/avatar`, form);
  }

  deleteAvatar(): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/avatar`);
  }
}
