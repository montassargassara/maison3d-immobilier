import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBaseUrl } from '../../services/api-config';

export interface AIPriceRequest {
  city: string;
  country?: string;
  type: string;
  surface: number;
  bedrooms?: number;
  bathrooms?: number;
  garage?: boolean;
  piscine?: boolean;
  jardin?: boolean;
  meuble?: boolean;
  etage?: number;
  parkingSpaces?: number;
  anneeConstruction?: number | null;
  prochePlage?: boolean;
  procheTransport?: boolean;
  securite?: boolean;
  climatisation?: boolean;
}

export interface AIPriceResponse {
  estimatedPrice: number;
  confidence: number;
  minPrice: number;
  maxPrice: number;
  marketDemand: 'LOW' | 'MEDIUM' | 'HIGH';
  pricePerM2: number;
  modelVersion: string;
}

export interface AIRentalPriceResponse {
  estimatedMonthlyRent: number;
  confidence: number;
  minRent: number;
  maxRent: number;
  marketDemand: 'LOW' | 'MEDIUM' | 'HIGH';
  pricePerM2: number;
  modelVersion: string;
}

@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly base = `${apiBaseUrl}/api/ai`;

  constructor(private http: HttpClient) {}

  predictSalePrice(req: AIPriceRequest): Observable<AIPriceResponse> {
    return this.http.post<AIPriceResponse>(`${this.base}/predict-price`, req);
  }

  predictRentalPrice(req: AIPriceRequest): Observable<AIRentalPriceResponse> {
    return this.http.post<AIRentalPriceResponse>(`${this.base}/predict-rental`, req);
  }
}
