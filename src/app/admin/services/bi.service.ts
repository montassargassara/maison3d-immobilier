import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBaseUrl } from '../../services/api-config';

export interface BIKpiDTO {
  totalProperties: number;
  disponibleCount: number;
  venduCount: number;
  loueCount: number;
  agencyCount: number;
  affiliateCount: number;
  clientCount: number;
  totalRevenue: number;
  currentMonthRevenue: number;
  previousMonthRevenue: number;
  totalCommissions: number;
  currentMonthCommissions: number;
  conversionRate: number;
  revenueTrend: number;
  salesTrend: number;
  commissionsTrend: number;
  currentMonthSales: number;
  previousMonthSales: number;
  stagnantProperties: number;
}

export interface BITrendDTO {
  months: string[];
  salesCounts: number[];
  rentalCounts: number[];
  revenues: number[];
  commissions: number[];
  newClients: number[];
}

export interface BITopCityDTO {
  city: string;
  country: string;
  soldCount: number;
  activeCount: number;
  totalRevenue: number;
}

export interface BITypeBreakdownDTO {
  type: string;
  totalCount: number;
  soldCount: number;
  activeCount: number;
  percentage: number;
}

export interface BIAgencyRankDTO {
  id: number;
  agencyName: string;
  email: string;
  propertiesSold: number;
  propertiesActive: number;
  revenue: number;
  commissions: number;
  rank: number;
}

export interface BIAffiliateRankDTO {
  id: number;
  name: string;
  email: string;
  salesCompleted: number;
  totalCommissions: number;
  rank: number;
}

export interface BIInsightDTO {
  type: 'success' | 'warning' | 'danger' | 'info';
  icon: string;
  title: string;
  message: string;
}

export interface BILocationKpiDTO {
  activeRentals: number;
  expiringIn30Days: number;
  totalLocationProperties: number;
  currentMonthRevenue: number;
  previousMonthRevenue: number;
  revenueTrend: number;
  annualProjectedRevenue: number;
  averageMonthlyRevenue: number;
  occupancyRate: number;
}

export interface BILocationTrendDTO {
  months: string[];
  monthlyRevenues: number[];
  durationLabels: string[];
  durationCounts: number[];
  agencyNames: string[];
  agencyRevenues: number[];
}

export interface BIRevenueBreakdownDTO {
  scope: 'GLOBAL' | 'AGENCY';
  globalGross: number;
  globalNet: number;
  agencyGross: number;
  agencyNet: number;
  superAdminGross: number;
  superAdminNet: number;
  totalCommissions: number;
}

export interface BICommissionDTO {
  scope: 'GLOBAL' | 'AGENCY';
  affiliateTotal: number;
  agencyTotal: number;
  staffTotal: number;
  grandTotal: number;
  affiliatePending: number;
  agencyPending: number;
  staffPending: number;
  pendingTotal: number;
  pendingCount: number;
  affiliatePaid: number;
  agencyPaid: number;
  staffPaid: number;
  paidTotal: number;
  paidCount: number;
}

export interface BIStaffRankDTO {
  id: number;
  name: string;
  email: string;
  role: string;
  salesCount: number;
  totalCommission: number;
  pendingCommission: number;
  rank: number;
}

export interface BIAffiliateImpactDTO {
  clientsBrought: number;
  salesViaAffiliates: number;
  revenueViaAffiliates: number;
  commissionsPaid: number;
  commissionsPending: number;
}

@Injectable({ providedIn: 'root' })
export class BiService {
  private readonly base = `${apiBaseUrl}/api/bi`;

  constructor(private http: HttpClient) {}

  getKpis(): Observable<BIKpiDTO> {
    return this.http.get<BIKpiDTO>(`${this.base}/kpis`);
  }

  getTrends(): Observable<BITrendDTO> {
    return this.http.get<BITrendDTO>(`${this.base}/trends`);
  }

  getRevenueBreakdown(): Observable<BIRevenueBreakdownDTO> {
    return this.http.get<BIRevenueBreakdownDTO>(`${this.base}/revenue-breakdown`);
  }

  getCommissionBreakdown(): Observable<BICommissionDTO> {
    return this.http.get<BICommissionDTO>(`${this.base}/commission-breakdown`);
  }

  getStaffRanking(limit = 8): Observable<BIStaffRankDTO[]> {
    return this.http.get<BIStaffRankDTO[]>(`${this.base}/staff-ranking`,
      { params: new HttpParams().set('limit', limit) });
  }

  getAffiliateImpact(): Observable<BIAffiliateImpactDTO> {
    return this.http.get<BIAffiliateImpactDTO>(`${this.base}/affiliate-impact`);
  }

  getTopCities(limit = 8): Observable<BITopCityDTO[]> {
    return this.http.get<BITopCityDTO[]>(`${this.base}/top-cities`,
      { params: new HttpParams().set('limit', limit) });
  }

  getTypeBreakdown(): Observable<BITypeBreakdownDTO[]> {
    return this.http.get<BITypeBreakdownDTO[]>(`${this.base}/type-breakdown`);
  }

  getAgencyRanking(limit = 10): Observable<BIAgencyRankDTO[]> {
    return this.http.get<BIAgencyRankDTO[]>(`${this.base}/agency-ranking`,
      { params: new HttpParams().set('limit', limit) });
  }

  getAffiliateRanking(limit = 10): Observable<BIAffiliateRankDTO[]> {
    return this.http.get<BIAffiliateRankDTO[]>(`${this.base}/affiliate-ranking`,
      { params: new HttpParams().set('limit', limit) });
  }

  getInsights(): Observable<BIInsightDTO[]> {
    return this.http.get<BIInsightDTO[]>(`${this.base}/insights`);
  }

  getRentalKpis(): Observable<BILocationKpiDTO> {
    return this.http.get<BILocationKpiDTO>(`${this.base}/location/kpis`);
  }

  getRentalTrends(): Observable<BILocationTrendDTO> {
    return this.http.get<BILocationTrendDTO>(`${this.base}/location/trends`);
  }
}
