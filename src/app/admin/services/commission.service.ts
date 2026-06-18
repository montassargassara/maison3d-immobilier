import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBaseUrl } from '../../services/api-config';

export interface MyPerformanceDTO {
  salesCount: number;
  rentalsCount: number;
  totalCommission: number;
  pendingCommission: number;
  paidCommission: number;
  commissionRate: number;
  months: string[];
  monthlyCommissions: number[];
}

export interface CommissionRowDTO {
  id: number;
  source: 'AFFILIATE' | 'AGENCY' | 'STAFF';
  beneficiaryName: string;
  beneficiaryEmail: string;
  propertyId: number | null;
  propertyTitle: string;
  transactionType: string;
  propertyPrice: number;
  commissionAmount: number;
  paid: boolean;
  date: string;
}

@Injectable({ providedIn: 'root' })
export class CommissionService {
  private readonly base = `${apiBaseUrl}/api/commissions`;

  constructor(private http: HttpClient) {}

  getMyPerformance(): Observable<MyPerformanceDTO> {
    return this.http.get<MyPerformanceDTO>(`${this.base}/my-performance`);
  }

  list(status?: 'PENDING' | 'PAID'): Observable<CommissionRowDTO[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<CommissionRowDTO[]>(this.base, { params });
  }

  markPaid(id: number): Observable<unknown> {
    return this.http.put(`${this.base}/${id}/pay`, {});
  }
}
