import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBaseUrl } from '../../services/api-config';

export interface CreateAgencyRequest {
  email: string;
  password: string;
  nom: string;
  prenom: string;
  agencyName: string;
  telephone?: string;
  description?: string;
}

export interface AgencyApplicationDTO {
  id: number;
  userId: number;
  email: string;
  nom: string;
  prenom: string;
  agencyName: string;
  telephone?: string;
  description?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  createdAt: string;
  reviewedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class AgencyRegistrationService {

  constructor(private http: HttpClient) {}

  // ── Public ───────────────────────────────────────────────────────────────

  registerAgency(request: CreateAgencyRequest): Observable<AgencyApplicationDTO> {
    return this.http.post<AgencyApplicationDTO>(`${apiBaseUrl}/api/register/agency`, request);
  }

  // ── Super Admin ───────────────────────────────────────────────────────────

  getPendingApplications(): Observable<AgencyApplicationDTO[]> {
    return this.http.get<AgencyApplicationDTO[]>(`${apiBaseUrl}/api/admin/agencies/pending`);
  }

  getAllApplications(): Observable<AgencyApplicationDTO[]> {
    return this.http.get<AgencyApplicationDTO[]>(`${apiBaseUrl}/api/admin/agencies`);
  }

  approve(id: number): Observable<AgencyApplicationDTO> {
    return this.http.put<AgencyApplicationDTO>(`${apiBaseUrl}/api/admin/agencies/${id}/approve`, {});
  }

  reject(id: number, reason: string): Observable<AgencyApplicationDTO> {
    return this.http.put<AgencyApplicationDTO>(`${apiBaseUrl}/api/admin/agencies/${id}/reject`, { reason });
  }
}
