import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBaseUrl } from '../../services/api-config';

export type SaleValidationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface SaleValidationRequestDTO {
  id: number;
  status: SaleValidationStatus;
  source: 'DIRECT_SALE' | 'CRM_LEAD';
  targetStatus: string; // VENDU or LOUE

  // Property
  propertyId: number;
  propertyTitle: string;
  propertyType?: string;
  propertyStatut?: string;
  propertyCity?: string;
  propertyCountry?: string;
  propertyPrixVente?: number;
  propertyPrixLocation?: number;
  propertyMainImageUrl?: string;

  // Requester (the agent who wants to close the deal)
  requesterId: number;
  requesterName: string;
  requesterEmail: string;

  // Buyer
  buyerId?: number;
  buyerName?: string;
  clientNom?: string;
  clientPrenom?: string;
  clientEmail?: string;
  clientTelephone?: string;

  // Rental contract (if targetStatus = LOUE)
  rentalStartDate?: string;
  rentalDurationMonths?: number;
  rentalAmount?: number;
  rentalNotes?: string;

  // Admin-entered terms at approval (null while PENDING)
  finalPrice?: number;
  commissionPercentage?: number;

  // Review
  reviewedById?: number;
  reviewedByName?: string;
  rejectionReason?: string;
  reviewedAt?: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class SaleValidationService {
  private readonly base = `${apiBaseUrl}/api/sale-validations`;

  constructor(private http: HttpClient) {}

  getPendingForMe(): Observable<SaleValidationRequestDTO[]> {
    return this.http.get<SaleValidationRequestDTO[]>(`${this.base}/pending-for-me`);
  }

  getMyRequests(): Observable<SaleValidationRequestDTO[]> {
    return this.http.get<SaleValidationRequestDTO[]>(`${this.base}/my-requests`);
  }

  getPendingCount(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.base}/pending-count`);
  }

  approve(id: number, finalPrice: number, commissionPercentage: number)
      : Observable<SaleValidationRequestDTO> {
    return this.http.put<SaleValidationRequestDTO>(
      `${this.base}/${id}/approve`, { finalPrice, commissionPercentage });
  }

  reject(id: number, reason: string): Observable<SaleValidationRequestDTO> {
    return this.http.put<SaleValidationRequestDTO>(`${this.base}/${id}/reject`, { reason });
  }
}
