// src/app/services/client.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBaseUrl } from '../../services/api-config';
import { User } from '../../services/user.service';

export interface Client {
  id: number;
  email: string;
  nom: string;
  prenom: string;
  telephone?: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  budgetEstime?: number;
  zoneRecherchee?: string;
  commercialId?: number;
  commercialNom?: string;
  commercialPrenom?: string;
  createdBy?: number;
  createdByName?: string;
  visibilityType?: string;
  agencyAdminId?: number;
  sharedWithAgencyIds?: number[];
  sharedWithAgencyNames?: string[];
  nombreAchats?: number;
  nombreLocations?: number;
  nombreReservations?: number;
  totalAchats?: number;
  codeAffiliation?: string;
  tauxCommission?: number;
  source?: string;
  commissionGeneree?: number;
  nombreVentesLiees?: number;
  derniereNote?: string;
  derniereNoteDate?: string;
}

export interface CreateClientRequest {
  email: string;
  password: string;
  nom: string;
  prenom: string;
  telephone?: string;
  budgetEstime?: number;
  zoneRecherchee?: string;
  commercialId?: number;
  clientType: string;
  codeAffiliation?: string;
  tauxCommission?: number;
  source?: string;
  visibilityType: string;
  targetAgencyAdminId?: number;
  sharedAgencyIds?: number[];
}

export interface UpdateClientRequest {
  nom?: string;
  prenom?: string;
  telephone?: string;
  budgetEstime?: number;
  zoneRecherchee?: string;
  commercialId?: number;
  isActive?: boolean;
  // Affiliate-only — explicit country/city take precedence over zoneRecherchee
  country?: string;
  city?: string;
  codeAffiliation?: string;
  tauxCommission?: number;
  source?: string;
}

export interface ClientNote {
  id: number;
  clientId: number;
  commercialId: number;
  commercialNom: string;
  commercialPrenom: string;
  note: string;
  createdAt: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

@Injectable({
  providedIn: 'root'
})
export class ClientService {
  private apiUrl = `${apiBaseUrl}/api/clients`;

  constructor(private http: HttpClient) {}

  getClientStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}/stats`);
  }

  createClient(request: CreateClientRequest): Observable<Client> {
    return this.http.post<Client>(this.apiUrl, request);
  }

  getAllClients(page: number = 0, size: number = 10, sortBy: string = 'createdAt', sortDir: string = 'desc'): Observable<PageResponse<Client>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sortBy', sortBy)
      .set('sortDir', sortDir);
    return this.http.get<PageResponse<Client>>(this.apiUrl, { params });
  }

  searchClients(keyword: string, page: number = 0, size: number = 10): Observable<PageResponse<Client>> {
    const params = new HttpParams()
      .set('keyword', keyword)
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get<PageResponse<Client>>(`${this.apiUrl}/search`, { params });
  }

  getClientsByCommercial(commercialId: number, page: number = 0, size: number = 10): Observable<PageResponse<Client>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get<PageResponse<Client>>(`${this.apiUrl}/by-commercial/${commercialId}`, { params });
  }

  getClientById(id: number): Observable<Client> {
    return this.http.get<Client>(`${this.apiUrl}/${id}`);
  }

  updateClient(id: number, request: UpdateClientRequest): Observable<Client> {
    return this.http.put<Client>(`${this.apiUrl}/${id}`, request);
  }

  assignCommercial(clientId: number, commercialId: number): Observable<Client> {
    const params = new HttpParams().set('commercialId', commercialId.toString());
    return this.http.patch<Client>(`${this.apiUrl}/${clientId}/assign-commercial`, null, { params });
  }

  toggleClientStatus(id: number): Observable<Client> {
    return this.http.patch<Client>(`${this.apiUrl}/${id}/toggle-status`, null);
  }

  deleteClient(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  addClientNote(clientId: number, commercialId: number, note: string): Observable<ClientNote> {
    return this.http.post<ClientNote>(`${this.apiUrl}/${clientId}/notes`, { note }, {
      params: new HttpParams().set('commercialId', commercialId.toString())
    });
  }

  getClientNotes(clientId: number): Observable<ClientNote[]> {
    return this.http.get<ClientNote[]>(`${this.apiUrl}/${clientId}/notes`);
  }

  // Sharing methods for PRIVATE_CLIENT
  sharePrivateClientWithAgency(clientId: number, adminId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${clientId}/share/${adminId}`, {});
  }

  revokePrivateClientSharing(clientId: number, adminId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${clientId}/share/${adminId}`);
  }

  getAvailableAgenciesForSharing(clientId: number): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/${clientId}/available-agencies`);
  }

  // Utilitaires
  formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (e) {
      return dateString;
    }
  }

  formatCurrency(amount: number): string {
    if (amount === undefined || amount === null) return '0 TND';
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  getVisibilityTypeLabel(type: string | undefined): string {
    if (type === 'PRIVATE_CLIENT') return 'Client privé';
    return 'Client agence';
  }

  getVisibilityTypeIcon(type: string | undefined): string {
    if (type === 'PRIVATE_CLIENT') return 'fa-lock';
    return 'fa-building';
  }

  getVisibilityTypeClass(type: string | undefined): string {
    if (type === 'PRIVATE_CLIENT') return 'badge-private';
    return 'badge-agency';
  }

  getRoleColor(role: string): string {
    const colors: { [key: string]: string } = {
      'SUPER_ADMIN': '#dc3545',
      'ADMIN': '#007bff',
      'RESPONSABLE_COMMERCIAL': '#fd7e14',
      'COMMERCIAL': '#28a745',
      'CLIENT': '#17a2b8',
      'CLIENT_PUBLIC': '#17a2b8',
      'AFFILIATE': '#6f42c1',
      'AFFILIATE_CLIENT': '#6f42c1'
    };
    return colors[role] || '#6c757d';
  }

  getInitials(prenom: string, nom: string): string {
    return (prenom?.charAt(0) || '') + (nom?.charAt(0) || '');
  }

  generateAffiliateCode(): string {
    return 'AFF-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  getPropertyCountries(): Observable<string[]> {
    return this.http.get<string[]>(`${apiBaseUrl}/api/properties/public/countries`);
  }

  getPropertyCitiesByCountry(country: string): Observable<string[]> {
    const params = new HttpParams().set('country', country);
    return this.http.get<string[]>(`${apiBaseUrl}/api/properties/public/cities`, { params });
  }

  generateRandomPassword(length: number = 12): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}