// services/properties-admin.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { apiBaseUrl } from '../../services/api-config';

export interface AdminInterestDTO {
  id: number;
  propertyId: number;
  propertyTitle: string;
  /** VENTE or LOCATION — determines which conversion options are shown */
  propertyCategory?: string;
  fullName: string;
  email: string;
  telephone: string;
  message?: string;
  proposedBudget?: number;
  status: string;
  /** True once the lead reaches a terminal state (CONVERTI_* or REFUSE) */
  locked?: boolean;
  lockedAt?: string;
  rejectionMessage?: string;
  // Rental contract (populated when status = CONVERTI_LOCATION)
  rentalStartDate?: string;
  rentalEndDate?: string;
  rentalDurationMonths?: number;
  rentalAmount?: number;
  rentalNotes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ConvertLeadRequest {
  /** CONVERTI_VENTE | CONVERTI_LOCATION | REFUSE */
  targetStatus: string;
  // Rental contract fields (required for CONVERTI_LOCATION)
  rentalStartDate?: string;
  rentalDurationMonths?: number;
  rentalAmount?: number;
  rentalNotes?: string;
  // Refusal reason (optional for REFUSE)
  rejectionMessage?: string;
}

export interface PropertyListItem {
  id: number;
  titre: string;
  description: string;
  type: string;
  prixVente?: number;
  prixLocation?: number;
  statut: string;
  surface?: number;
  nbChambres?: number;
  adresse: string;
  country?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  mainImageName?: string;
  mainImageType?: string;
  mainImageSize?: number;
  mainImageUrl?: string;
  hasMainImage: boolean;
  model3dName?: string;
  model3dType?: string;
  model3dSize?: number;
  model3dUrl?: string;
  hasModel3d: boolean;
  // Ownership / multi-tenant fields
  ownerType?: string;          // 'SUPER_ADMIN_OWNED' | 'AGENCY_OWNED' | null (legacy)
  agencyAdminId?: number;
  agencyAdminName?: string;
  sharedWithAgencyIds?: number[];
  interestCount?: number;

  // Validation workflow
  validationStatus?: 'PENDING_RESPONSABLE' | 'PENDING_ADMIN' | 'APPROVED' | 'REJECTED' | null;
  ownerRole?: string;
  createdById?: number;
  createdByName?: string;
  commissionLocked?: boolean;
  priceLocked?: boolean;
  rejectionReason?: string;

  // Rental lock fields
  rentalStartDate?: string;
  rentalEndDate?: string;
  rentalDurationMonths?: number;
  isFinalized?: boolean;
  isStatusLocked?: boolean;
  statusLockReason?: string;

  // Direct sale buyer link
  buyerId?: number;
  buyerName?: string;
  buyerEmail?: string;
  buyerTelephone?: string;
  viaAffiliate?: boolean;
  affiliateName?: string;
  affiliateCommissionAmount?: number;
  affiliateCommissionPercentage?: number;
  affiliateCommissionType?: string;
  affiliateCommissionPaid?: boolean;

  // Pending sale approval workflow
  pendingSaleApproval?: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  pendingSaleStatut?: string;
  pendingSaleRejectionReason?: string;
  pendingSaleRequestedById?: number;
  pendingSaleRequestedByName?: string;
  pendingSaleApproverRole?: 'ADMIN' | 'SUPER_ADMIN' | null; // who must approve next

  // True when EN_ATTENTE is due to a cross-ownership SaleValidationRequest (not a simple owner hold)
  hasPendingValidation?: boolean;
}

export interface AgencyAdminItem {
  id: number;
  fullName: string;
  email: string;
  alreadyShared: boolean;
}

export interface ClientSearchResult {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  role: string;
  nombreAchats?: number;
}

export interface DirectSaleRequest {
  targetStatus: 'VENDU' | 'LOUE';
  existingClientId?: number;
  clientNom?: string;
  clientPrenom?: string;
  clientEmail?: string;
  clientTelephone?: string;
  // Rental fields
  rentalStartDate?: string;
  rentalDurationMonths?: number;
  rentalAmount?: number;
  rentalNotes?: string;
}

export interface UpdateStatusRequest {
  statut: string;
  propertyId?: number;
  rentalDurationMonths?: number;
}

export interface SharePropertyRequest {
  agencyAdminIds: number[];
}

@Injectable({
  providedIn: 'root'
})
export class PropertiesAdminService {
  constructor(private http: HttpClient) {}

  /** Returns only the properties the current user is allowed to see (filtered server-side). */
  getAllProperties(): Observable<PropertyListItem[]> {
    return this.http.get<PropertyListItem[]>(`${apiBaseUrl}/api/properties/list`);
  }

  /** Returns all VENDU (sold/finalized) properties visible to the current user. */
  getSoldProperties(): Observable<PropertyListItem[]> {
    return this.http.get<PropertyListItem[]>(`${apiBaseUrl}/api/properties/sold`);
  }

  /** Returns VENDU + LOUE combined, sorted by date — for Transactions & Ventes page. */
  getAllTransactions(): Observable<PropertyListItem[]> {
    return this.http.get<PropertyListItem[]>(`${apiBaseUrl}/api/properties/transactions`);
  }

  /** Returns all LOUE (actively rented) properties visible to the current user. */
  getRentedProperties(): Observable<PropertyListItem[]> {
    return this.http.get<PropertyListItem[]>(`${apiBaseUrl}/api/properties/rented`);
  }

  /** Returns all properties where the given user is recorded as buyer/tenant. */
  getClientPurchases(userId: number): Observable<PropertyListItem[]> {
    return this.http.get<PropertyListItem[]>(`${apiBaseUrl}/api/properties/buyer/${userId}`);
  }

  updatePropertyStatus(id: number, status: string, rentalDurationMonths?: number): Observable<PropertyListItem> {
    const request: UpdateStatusRequest = { statut: status, propertyId: id, rentalDurationMonths };
    return this.http.patch<PropertyListItem>(`${apiBaseUrl}/api/properties/${id}/status`, request);
  }

  deleteProperty(id: number): Observable<void> {
    return this.http.delete<void>(`${apiBaseUrl}/api/properties/${id}`);
  }

  getPropertyCategory(id: number): Observable<{ category: string }> {
    return this.http.get<{ category: string }>(`${apiBaseUrl}/api/properties/${id}/category`);
  }

  getAllowedStatusesForCategory(category: string): Observable<string[]> {
    return this.http.get<string[]>(`${apiBaseUrl}/api/properties/categories/${category}/allowed-statuses`);
  }

  // ─── Sharing (Super Admin only) ───────────────────────────────────────────

  /** Returns all agency admins with their sharing status for a property. */
  getSharingInfo(propertyId: number): Observable<AgencyAdminItem[]> {
    return this.http.get<AgencyAdminItem[]>(`${apiBaseUrl}/api/properties/${propertyId}/sharing`);
  }

  /** Replaces the full shared-agency set for a property. */
  updateSharing(propertyId: number, agencyAdminIds: number[]): Observable<PropertyListItem> {
    const body: SharePropertyRequest = { agencyAdminIds };
    return this.http.put<PropertyListItem>(`${apiBaseUrl}/api/properties/${propertyId}/sharing`, body);
  }

  /** Revokes sharing for a single agency admin. */
  revokeSharing(propertyId: number, adminId: number): Observable<void> {
    return this.http.delete<void>(`${apiBaseUrl}/api/properties/${propertyId}/sharing/${adminId}`);
  }

  // ─── Pending sale approval (ADMIN / SUPER_ADMIN) ──────────────────────────

  approvePendingSale(propertyId: number): Observable<PropertyListItem> {
    return this.http.put<PropertyListItem>(`${apiBaseUrl}/api/properties/${propertyId}/approve-sale`, {});
  }

  rejectPendingSale(propertyId: number, reason: string): Observable<PropertyListItem> {
    return this.http.put<PropertyListItem>(`${apiBaseUrl}/api/properties/${propertyId}/reject-sale`, { reason });
  }

  // ─── CRM Leads (admin-side interest requests) ─────────────────────────────

  getMyLeads(): Observable<AdminInterestDTO[]> {
    return this.http.get<AdminInterestDTO[]>(`${apiBaseUrl}/api/admin/interests/my-leads`);
  }

  updateInterestStatus(id: number, status: string): Observable<AdminInterestDTO> {
    return this.http.put<AdminInterestDTO>(`${apiBaseUrl}/api/admin/interests/${id}/status`, { status });
  }

  convertLead(id: number, req: ConvertLeadRequest): Observable<AdminInterestDTO> {
    return this.http.put<AdminInterestDTO>(`${apiBaseUrl}/api/admin/interests/${id}/convert`, req);
  }

  // ─── Direct sale / rental ─────────────────────────────────────────────────

  /** Quick client search for the buyer-selection modal (max 8 results). */
  searchClientsQuick(keyword: string): Observable<ClientSearchResult[]> {
    return this.http.get<any>(`${apiBaseUrl}/api/clients/search`, {
      params: { keyword, page: '0', size: '8' },
    }).pipe(
      map((res: any) => {
        const raw: any[] = Array.isArray(res) ? res : (res?.content ?? []);
        return raw
          .filter(c => c.role !== 'AFFILIATE')
          .map(c => ({
            id: c.id,
            nom: c.nom ?? '',
            prenom: c.prenom ?? '',
            email: c.email ?? '',
            telephone: c.telephone,
            role: c.role ?? '',
            nombreAchats: c.nombreAchats ?? 0,
          }));
      })
    );
  }

  /** Link a buyer to a property and set it as VENDU or LOUE directly. */
  directSale(propertyId: number, req: DirectSaleRequest): Observable<PropertyListItem> {
    return this.http.post<PropertyListItem>(`${apiBaseUrl}/api/properties/${propertyId}/direct-sale`, req);
  }

  /** Admin-side single property detail (uses the public endpoint — admin JWT is accepted). */
  getPropertyAdminDetail(id: number): Observable<any> {
    return this.http.get<any>(`${apiBaseUrl}/api/properties/${id}`);
  }

  /** All leads for a specific property (filtered from my-leads). */
  getLeadsForProperty(propertyId: number): Observable<AdminInterestDTO[]> {
    return this.getMyLeads().pipe(
      map(leads => leads.filter(l => l.propertyId === propertyId))
    );
  }
}
