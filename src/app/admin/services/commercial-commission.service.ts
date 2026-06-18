import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBaseUrl } from '../../services/api-config';
// Reuse the shared commission DTOs — single source, no duplicated interface.
import { CommissionDetailDTO, CommissionSummaryDTO } from './agency-commission.service';

export type { CommissionDetailDTO, CommissionSummaryDTO };

/** Mirrors backend CommercialPerformanceDTO exactly. */
export interface CommercialPerformanceDTO {
  commercialId: number;
  name: string;
  email: string;
  role: string;
  agencyName: string;
  active: boolean;
  commissionRate: number;
  salesCount: number;
  rentalsCount: number;
  dealsClosed: number;
  revenueGenerated: number;
  revenueThisMonth: number;
  commissionsEarned: number;
  commissionsPaid: number;
  commissionsPending: number;
}

@Injectable({ providedIn: 'root' })
export class CommercialCommissionService {
  private readonly base = `${apiBaseUrl}/api/commercial-commissions`;

  constructor(private http: HttpClient) {}

  list(status?: string): Observable<CommissionDetailDTO[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<CommissionDetailDTO[]>(this.base, { params });
  }

  summary(): Observable<CommissionSummaryDTO> {
    return this.http.get<CommissionSummaryDTO>(`${this.base}/summary`);
  }

  performance(): Observable<CommercialPerformanceDTO[]> {
    return this.http.get<CommercialPerformanceDTO[]>(`${this.base}/performance`);
  }

  markPaid(id: number): Observable<CommissionDetailDTO> {
    return this.http.put<CommissionDetailDTO>(`${this.base}/${id}/pay`, {});
  }
}
