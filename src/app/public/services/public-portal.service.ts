import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBaseUrl } from '../../services/api-config';
import {
  PublicPropertyCard,
  PublicPropertyDetail,
  PublicSearchFilters,
} from '../models/public-property.model';

@Injectable({ providedIn: 'root' })
export class PublicPortalService {
  private http = inject(HttpClient);
  private base = `${apiBaseUrl}/api/properties/public/portal`;

  listForSale(filters: PublicSearchFilters = {}): Observable<PublicPropertyCard[]> {
    const params = this.toParams(filters);
    console.log('[DEBUG PortalService] listForSale — filters reçus :', JSON.stringify(filters));
    console.log('[DEBUG PortalService] listForSale — paramètres HTTP :', params.toString());
    return this.http.get<PublicPropertyCard[]>(`${this.base}/vente`, { params });
  }

  listForRent(filters: PublicSearchFilters = {}): Observable<PublicPropertyCard[]> {
    const params = this.toParams(filters);
    console.log('[DEBUG PortalService] listForRent — filters reçus :', JSON.stringify(filters));
    console.log('[DEBUG PortalService] listForRent — paramètres HTTP :', params.toString());
    return this.http.get<PublicPropertyCard[]>(`${this.base}/location`, { params });
  }

  featuredVente(limit = 6): Observable<PublicPropertyCard[]> {
    return this.http.get<PublicPropertyCard[]>(`${this.base}/featured/vente`, {
      params: new HttpParams().set('limit', limit),
    });
  }

  featuredLocation(limit = 6): Observable<PublicPropertyCard[]> {
    return this.http.get<PublicPropertyCard[]>(`${this.base}/featured/location`, {
      params: new HttpParams().set('limit', limit),
    });
  }

  detail(id: number): Observable<PublicPropertyDetail> {
    return this.http.get<PublicPropertyDetail>(`${this.base}/${id}`);
  }

  similar(id: number, limit = 4): Observable<PublicPropertyCard[]> {
    return this.http.get<PublicPropertyCard[]>(`${this.base}/${id}/similar`, {
      params: new HttpParams().set('limit', limit),
    });
  }

  countries(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/facets/countries`);
  }

  cities(country?: string): Observable<string[]> {
    let params = new HttpParams();
    if (country) params = params.set('country', country);
    return this.http.get<string[]>(`${this.base}/facets/cities`, { params });
  }

  types(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/facets/types`);
  }

  /** Resolves an image URL coming from the backend (relative) into an absolute URL. */
  resolveImage(url: string | null | undefined): string {
    if (!url) return '';
    return url.startsWith('http') ? url : `${apiBaseUrl}${url}`;
  }

  private toParams(filters: PublicSearchFilters): HttpParams {
    let params = new HttpParams();
    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        console.log('[DEBUG PortalService] toParams — clé ignorée (vide/null) :', key, '=', JSON.stringify(value));
        return;
      }
      params = params.set(key, String(value));
      console.log('[DEBUG PortalService] toParams — ajouté :', key, '=', JSON.stringify(String(value)));
    });
    return params;
  }
}
