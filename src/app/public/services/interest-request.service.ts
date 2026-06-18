import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBaseUrl } from '../../services/api-config';

export interface InterestRequestPayload {
  propertyId: number;
  fullName: string;
  telephone: string;
  message?: string;
  proposedBudget?: number;
}

export interface InterestRequestDTO {
  id: number;
  propertyId: number;
  propertyTitle: string;
  propertyCity?: string;
  propertyCountry?: string;
  propertyMainImageUrl?: string;
  fullName: string;
  email: string;
  telephone: string;
  message?: string;
  proposedBudget?: number;
  status: string;
  agencyName?: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class InterestRequestService {
  private http = inject(HttpClient);
  private base = `${apiBaseUrl}/api/client/interests`;

  submit(payload: InterestRequestPayload): Observable<InterestRequestDTO> {
    return this.http.post<InterestRequestDTO>(this.base, payload);
  }

  mine(): Observable<InterestRequestDTO[]> {
    return this.http.get<InterestRequestDTO[]>(`${this.base}/mine`);
  }
}
