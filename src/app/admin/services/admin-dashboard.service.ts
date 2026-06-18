// admin-dashboard.service.ts - Version corrigée
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AdminAuthService } from './admin-auth';
import { apiBaseUrl } from '../../services/api-config';

export interface AdminStatsResponse {
  totalProperties: number;
  availableProperties: number;
  soldProperties: number;
  reservedProperties: number;
  totalUsers: number;
  activeUsers: number;
  totalAgents: number;
  monthlyRevenue: number;
  yearlyRevenue: number;
  popularAreas: Array<{ area: string; count: number }>;
  propertyTypes: Array<{ type: string; count: number }>;
  superAdminCount?: number;
  adminCount?: number;
  responsableCommercialCount?: number;
  commercialCount?: number;
  affiliateCount?: number;
  clientCount?: number;
}

export interface DashboardPropertyItem {
  id: number;
  titre: string;
  description?: string;
  type: string;
  prixVente?: number;
  prixLocation?: number;
  statut: string;
  surface?: number;
  nbChambres?: number;
  adresse?: string;
  country?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  mainImageUrl?: string;
  hasMainImage?: boolean;
}

export interface DashboardUser {
  id: number;
  email: string;
  nom: string;
  prenom: string;
  role: string;
  isActive: boolean;
  createdAt?: string;
}

export interface DashboardStats {
  totalProperties: number;
  availableProperties: number;
  soldProperties: number;
  reservedProperties: number;
  rentedProperties: number;
  pendingTransactions: number;
  totalClients: number | null;
  totalAffiliates: number | null;
  totalRevenue: number;
  monthlyRevenue: number;
  yearlyRevenue: number;
}

export interface DashboardSnapshot {
  stats: DashboardStats;
  monthlySales: number[];
  monthlyRentals: number[];
  monthlyRevenue: number[];
  propertyTypes: Array<{ type: string; count: number }>;
  statusCounts: Array<{ status: string; count: number }>;
  recentProperties: DashboardPropertyItem[];
  recentSales: DashboardPropertyItem[];
  recentClients: DashboardUser[];
  recentAffiliates: DashboardUser[];
  pendingValidations: DashboardPropertyItem[];
  isSuperAdmin: boolean;
}

export interface ClientCountResponse {
  count: number;
  role: string;
}

export interface DashboardValidationItem {
  id: number;
  titre: string;
  type: string;
  statut: string;
  ownerType?: string;
  agencyAdminId?: number;
  agencyAdminName?: string;
  createdAt?: string;
  updatedAt?: string;
  ownerRole?: string;
  createdById?: number;
  createdByName?: string;
  mainImageUrl?: string;
  hasMainImage?: boolean;
  city?: string;
  country?: string;
}

export interface ExpiredRentalItem {
  id: number;
  titre: string;
  type: string;
  statut: string;
  prixLocation?: number;
  city?: string;
  country?: string;
  rentalEndDate?: string;
  agencyAdminName?: string;
  mainImageUrl?: string;
  hasMainImage?: boolean;
}

export interface AgencyAffiliateStats {
  totalAffiliates: number;
  totalSalesViaAffiliation: number;
  totalCommissionsGlobal: number;
  totalCommissionsPaid: number;
  totalCommissionsPending: number;
  totalClientsApportes: number;
}

export interface AgencyAffiliateItem {
  affiliateId: number;
  prenom: string;
  nom: string;
  email: string;
  telephone?: string;
  status: string;
  clientsApportes: number;
  biensVendus: number;
  totalCommissions: number;
}

export interface AgencyCommissionItem {
  transactionId: number;
  affiliatePrenom: string;
  affiliateNom: string;
  propertyTitre: string;
  propertyAdresse: string;
  propertyCity?: string;
  propertyPrice: number;
  commissionPercentage: number;
  commissionAmount: number;
  transactionType: string;
  transactionDate: string;
  isPaid: boolean;
  clientEmail: string;
}

export interface RecentClient {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  role: string;
  createdAt: string;
  visibilityType: string;
  agencyAdminId: number;
}

@Injectable({
  providedIn: 'root',
})
export class AdminDashboardService {
  constructor(private http: HttpClient, private authService: AdminAuthService) {}

  getDashboardSnapshot(): Observable<DashboardSnapshot> {
    const role = this.authService.getCurrentUser()?.role?.toUpperCase() || '';
    const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'SUPERADMIN';

    // Correction: Utiliser /api/users au lieu de /api/super-admin
    const stats$ = isSuperAdmin
      ? this.http.get<AdminStatsResponse>(`${apiBaseUrl}/api/users/dashboard/stats`).pipe(
          catchError(() => of(null))
        )
      : of(null);

    const properties$ = this.http
      .get<DashboardPropertyItem[]>(`${apiBaseUrl}/api/properties/list`)
      .pipe(catchError(() => of([])));

    const recent$ = this.http
      .get<DashboardPropertyItem[]>(`${apiBaseUrl}/api/properties/recent-light`, {
        params: { limit: '6' },
      })
      .pipe(catchError(() => of([])));

    // Correction: Utiliser /api/users/role/CLIENT
    const clients$ = isSuperAdmin
      ? this.http
          .get<DashboardUser[]>(`${apiBaseUrl}/api/users/role/CLIENT`)
          .pipe(catchError(() => of([])))
      : of([]);

    // Correction: Utiliser /api/users/role/AFFILIATE
    const affiliates$ = isSuperAdmin
      ? this.http
          .get<DashboardUser[]>(`${apiBaseUrl}/api/users/role/AFFILIATE`)
          .pipe(catchError(() => of([])))
      : of([]);

    return forkJoin({
      stats: stats$,
      properties: properties$,
      recent: recent$,
      clients: clients$,
      affiliates: affiliates$,
    }).pipe(
      map(({ stats, properties, recent, clients, affiliates }) => {
        const statusCounts = this.countByStatus(properties);
        const rentedCount = statusCounts.find(s => s.status === 'LOUE')?.count || 0;
        const pendingCount = statusCounts.find(s => s.status === 'EN_ATTENTE')?.count || 0;
        const reservedFallback = statusCounts.find(s => s.status === 'RESERVE')?.count || 0;
        const soldFallback = statusCounts.find(s => s.status === 'VENDU')?.count || 0;
        const availableFallback = statusCounts.find(s => s.status === 'DISPONIBLE')?.count || 0;

        const reservedCount = (stats?.reservedProperties ?? reservedFallback);
        const soldCount = (stats?.soldProperties ?? soldFallback);
        const availableCount = (stats?.availableProperties ?? availableFallback);

        const totalProperties = stats?.totalProperties ?? properties.length;
        const revenueTotals = this.calculateRevenueTotals(properties);

        const totalRevenue = stats?.yearlyRevenue ?? revenueTotals.total;
        const monthlyRevenue = stats?.monthlyRevenue ?? revenueTotals.last30Days;
        const yearlyRevenue = stats?.yearlyRevenue ?? revenueTotals.last365Days;

        const monthlySeries = this.calculateMonthlySeries(properties);

        const propertyTypes = stats?.propertyTypes?.length
          ? stats.propertyTypes
          : this.countByType(properties);

        const recentSales = properties
          .filter(p => (p.statut || '').toUpperCase() === 'VENDU')
          .sort((a, b) => this.sortByDateDesc(a.updatedAt, b.updatedAt))
          .slice(0, 6);

        const pendingValidations = properties
          .filter(p => ['EN_ATTENTE', 'PENDING', 'A_VALIDER'].includes((p.statut || '').toUpperCase()))
          .sort((a, b) => this.sortByDateDesc(a.createdAt, b.createdAt))
          .slice(0, 6);

        return {
          stats: {
            totalProperties,
            availableProperties: availableCount,
            soldProperties: soldCount,
            reservedProperties: reservedCount,
            rentedProperties: rentedCount,
            pendingTransactions: pendingCount || reservedCount,
            totalClients: stats?.clientCount ?? (isSuperAdmin ? clients.length : null),
            totalAffiliates: stats?.affiliateCount ?? (isSuperAdmin ? affiliates.length : null),
            totalRevenue,
            monthlyRevenue,
            yearlyRevenue,
          },
          monthlySales: monthlySeries.monthlySales,
          monthlyRentals: monthlySeries.monthlyRentals,
          monthlyRevenue: monthlySeries.monthlyRevenue,
          propertyTypes,
          statusCounts,
          recentProperties: recent,
          recentSales,
          recentClients: clients
            .sort((a, b) => this.sortByDateDesc(a.createdAt, b.createdAt))
            .slice(0, 6),
          recentAffiliates: affiliates
            .sort((a, b) => this.sortByDateDesc(a.createdAt, b.createdAt))
            .slice(0, 6),
          pendingValidations,
          isSuperAdmin,
        } as DashboardSnapshot;
      })
    );
  }

  private sortByDateDesc(valueA?: string, valueB?: string): number {
    const dateA = valueA ? new Date(valueA).getTime() : 0;
    const dateB = valueB ? new Date(valueB).getTime() : 0;
    return dateB - dateA;
  }

  private countByStatus(properties: DashboardPropertyItem[]): Array<{ status: string; count: number }> {
    const counts = new Map<string, number>();

    for (const property of properties) {
      const status = (property.statut || 'INCONNU').toUpperCase();
      counts.set(status, (counts.get(status) || 0) + 1);
    }

    return Array.from(counts.entries()).map(([status, count]) => ({ status, count }));
  }

  private countByType(properties: DashboardPropertyItem[]): Array<{ type: string; count: number }> {
    const counts = new Map<string, number>();

    for (const property of properties) {
      const type = (property.type || 'AUTRE').toUpperCase();
      counts.set(type, (counts.get(type) || 0) + 1);
    }

    return Array.from(counts.entries()).map(([type, count]) => ({ type, count }));
  }

  private calculateRevenueTotals(properties: DashboardPropertyItem[]): {
    total: number;
    last30Days: number;
    last365Days: number;
  } {
    const now = new Date();
    const last30Days = new Date();
    last30Days.setDate(now.getDate() - 30);

    const last365Days = new Date();
    last365Days.setDate(now.getDate() - 365);

    let total = 0;
    let revenue30 = 0;
    let revenue365 = 0;

    for (const property of properties) {
      if ((property.statut || '').toUpperCase() !== 'VENDU') {
        continue;
      }

      const price = property.prixVente || 0;
      total += price;

      const date = this.getPropertyDate(property);
      if (!date) continue;

      if (date >= last365Days) {
        revenue365 += price;
      }

      if (date >= last30Days) {
        revenue30 += price;
      }
    }

    return {
      total,
      last30Days: revenue30,
      last365Days: revenue365,
    };
  }

  private calculateMonthlySeries(properties: DashboardPropertyItem[]): {
    monthlySales: number[];
    monthlyRentals: number[];
    monthlyRevenue: number[];
  } {
    const monthlySales = Array(12).fill(0);
    const monthlyRentals = Array(12).fill(0);
    const monthlyRevenue = Array(12).fill(0);

    const year = new Date().getFullYear();

    for (const property of properties) {
      const status = (property.statut || '').toUpperCase();
      const date = this.getPropertyDate(property);
      if (!date || date.getFullYear() !== year) {
        continue;
      }

      const monthIndex = date.getMonth();

      if (status === 'VENDU') {
        monthlySales[monthIndex] += 1;
        monthlyRevenue[monthIndex] += property.prixVente || 0;
      }

      if (status === 'LOUE' || status === 'RENTED') {
        monthlyRentals[monthIndex] += 1;
      }
    }

    return { monthlySales, monthlyRentals, monthlyRevenue };
  }

  private getPropertyDate(property: DashboardPropertyItem): Date | null {
    const raw = property.updatedAt || property.createdAt;
    if (!raw) return null;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // Dans admin-dashboard.service.ts, corrigez les URLs:

  /**
   * Récupère le nombre de clients visibles pour l'utilisateur connecté
   */
  getClientCount(): Observable<ClientCountResponse> {
    // ✅ URL CORRECTE avec /api/dashboard/
    return this.http.get<ClientCountResponse>(`${apiBaseUrl}/api/dashboard/client-count`);
  }

  /**
   * Récupère les clients récents visibles
   */
  getRecentClients(limit: number = 6): Observable<RecentClient[]> {
    return this.http.get<RecentClient[]>(`${apiBaseUrl}/api/dashboard/recent-clients`, {
      params: { limit: limit.toString() }
    });
  }

  /**
   * Récupère les biens LOUÉ dont le contrat est expiré
   */
  getExpiredRentals(): Observable<ExpiredRentalItem[]> {
    return this.http.get<ExpiredRentalItem[]>(`${apiBaseUrl}/api/properties/expired-rentals`);
  }

  /**
   * Récupère les validations récentes filtrées par rôle
   */
  getDashboardValidations(limit: number = 6): Observable<DashboardValidationItem[]> {
    return this.http.get<DashboardValidationItem[]>(`${apiBaseUrl}/api/dashboard/validations`, {
      params: { limit: limit.toString() }
    });
  }

  // ── Agency Affiliate Management (ADMIN only) ─────────────────────────────

  getAgencyAffiliateStats(): Observable<AgencyAffiliateStats> {
    return this.http.get<AgencyAffiliateStats>(`${apiBaseUrl}/api/dashboard/agency-affiliate-stats`);
  }

  getAgencyAffiliates(): Observable<AgencyAffiliateItem[]> {
    return this.http.get<AgencyAffiliateItem[]>(`${apiBaseUrl}/api/dashboard/agency-affiliates`);
  }

  getAgencyAffiliateCommissions(limit: number = 20): Observable<AgencyCommissionItem[]> {
    return this.http.get<AgencyCommissionItem[]>(`${apiBaseUrl}/api/dashboard/agency-affiliate-commissions`, {
      params: { limit: limit.toString() }
    });
  }
}