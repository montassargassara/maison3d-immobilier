import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBaseUrl } from '../../services/api-config';

export type ShareRequestStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';

export interface PropertyShareRequestDTO {
  id: number;
  status: ShareRequestStatus;

  propertyId: number;
  propertyTitle: string;
  propertyType: string;
  propertyStatut: string;
  propertyPrixVente?: number;
  propertyPrixLocation?: number;
  propertyAdresse?: string;
  propertyCity?: string;
  propertyCountry?: string;
  propertySurface?: number;
  propertyNbChambres?: number;
  propertyMainImageUrl?: string;

  commissionPercentage: number;
  commissionType: 'PERCENTAGE' | 'FIXED';
  expectedCommissionAmount?: number;

  sharedById: number;
  sharedByName: string;
  agencyAdminId: number;
  agencyAdminName: string;

  message?: string;
  rejectionReason?: string;

  createdAt: string;
  respondedAt?: string;
}

export interface CreateShareRequestDTO {
  agencyAdminIds: number[];
  commissionType: 'PERCENTAGE' | 'FIXED';
  commissionPercentage: number;
  message?: string;
}

export interface ShareRequestResponseDTO {
  response: 'ACCEPTED' | 'REJECTED';
  rejectionReason?: string;
}

export interface AgencyAdminItem {
  id: number;
  fullName: string;
  email: string;
  alreadyShared: boolean;
  shareRequestStatus?: ShareRequestStatus | null;
}

@Injectable({ providedIn: 'root' })
export class ShareRequestService {

  private readonly base = `${apiBaseUrl}/api/share-requests`;

  constructor(private http: HttpClient) {}

  // ─── Super Admin ──────────────────────────────────────────────────────────

  createRequests(propertyId: number, dto: CreateShareRequestDTO): Observable<PropertyShareRequestDTO[]> {
    return this.http.post<PropertyShareRequestDTO[]>(`${this.base}/property/${propertyId}`, dto);
  }

  getSentRequests(): Observable<PropertyShareRequestDTO[]> {
    return this.http.get<PropertyShareRequestDTO[]>(`${this.base}/sent`);
  }

  getRequestsForProperty(propertyId: number): Observable<PropertyShareRequestDTO[]> {
    return this.http.get<PropertyShareRequestDTO[]>(`${this.base}/property/${propertyId}`);
  }

  getAgenciesWithStatus(propertyId: number): Observable<AgencyAdminItem[]> {
    return this.http.get<AgencyAdminItem[]>(`${this.base}/property/${propertyId}/agencies`);
  }

  cancelRequest(requestId: number): Observable<PropertyShareRequestDTO> {
    return this.http.delete<PropertyShareRequestDTO>(`${this.base}/${requestId}`);
  }

  // ─── Agency Admin ─────────────────────────────────────────────────────────

  getIncomingRequests(): Observable<PropertyShareRequestDTO[]> {
    return this.http.get<PropertyShareRequestDTO[]>(`${this.base}/incoming`);
  }

  getPendingIncomingRequests(): Observable<PropertyShareRequestDTO[]> {
    return this.http.get<PropertyShareRequestDTO[]>(`${this.base}/incoming/pending`);
  }

  getRequest(requestId: number): Observable<PropertyShareRequestDTO> {
    return this.http.get<PropertyShareRequestDTO>(`${this.base}/${requestId}`);
  }

  respond(requestId: number, dto: ShareRequestResponseDTO): Observable<PropertyShareRequestDTO> {
    return this.http.put<PropertyShareRequestDTO>(`${this.base}/${requestId}/respond`, dto);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  formatCommission(amount: number, type: 'PERCENTAGE' | 'FIXED'): string {
    if (!amount) return 'Aucune commission';
    return type === 'PERCENTAGE' ? `${amount}%` : `${amount.toLocaleString('fr-FR')} TND`;
  }

  formatExpectedRevenue(request: PropertyShareRequestDTO): string {
    const amount = request.expectedCommissionAmount ?? 0;
    return `${amount.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} TND`;
  }
}
