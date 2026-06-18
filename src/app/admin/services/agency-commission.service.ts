import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBaseUrl } from '../../services/api-config';

/** Mirrors backend CommissionDetailDTO exactly. */
export interface CommissionDetailDTO {
  id: number;
  source: 'AGENCY' | 'STAFF';
  beneficiaryId: number | null;
  beneficiaryName: string;
  beneficiaryEmail: string;
  beneficiaryRole: string | null;
  propertyId: number | null;
  propertyTitle: string;
  propertyMainImageUrl: string | null;
  propertyOwnerType: string | null;
  buyerName: string;
  transactionType: string; // SALE | RENT
  propertyPrice: number;
  commissionType: string; // PERCENTAGE | FIXED
  commissionRate: number;
  commissionAmount: number;
  paid: boolean;
  paidAt: string | null;
  createdAt: string;
}

/** Mirrors backend CommissionSummaryDTO exactly. */
export interface CommissionSummaryDTO {
  total: number;
  paid: number;
  pending: number;
  count: number;
}

@Injectable({ providedIn: 'root' })
export class AgencyCommissionService {
  private readonly base = `${apiBaseUrl}/api/agency-commissions`;

  constructor(private http: HttpClient) {}

  list(status?: string): Observable<CommissionDetailDTO[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<CommissionDetailDTO[]>(this.base, { params });
  }

  summary(): Observable<CommissionSummaryDTO> {
    return this.http.get<CommissionSummaryDTO>(`${this.base}/summary`);
  }

  markPaid(id: number): Observable<CommissionDetailDTO> {
    return this.http.put<CommissionDetailDTO>(`${this.base}/${id}/pay`, {});
  }
}
