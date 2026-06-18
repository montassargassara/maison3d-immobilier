import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { NominatimAddress, NominatimResult, ResolvedLocation } from './nominatim.types';

/**
 * Geocoding service backed by Nominatim (OpenStreetMap).
 *
 * City resolution strategy for Tunisia
 * ─────────────────────────────────────
 * Nominatim returns several overlapping administrative fields. For Tunisian
 * real estate the correct granularity is the *délégation / commune* level,
 * NOT the administrative city (gouvernorat capital).
 *
 * Example — Sidi Hassine:
 *   address.suburb   = "Sidi Hassine"   ← correct for real estate
 *   address.city     = "Tunis"          ← too broad, wrong for listings
 *
 * Priority table for the `city` field:
 *   1. suburb        — délégation / commune (most specific, highest priority)
 *   2. city_district — named district within a major city
 *   3. quarter       — specific quarter within a suburb (rare)
 *   4. municipality  — municipal entity when suburb is absent
 *   5. town          — independent towns (Hammam Lif, Radès…)
 *   6. village       — rural settlements
 *   7. hamlet        — very small settlements
 *   8. city          — fallback to main administrative city
 *   9. county        — region level
 *  10. state         — gouvernorat (last resort)
 */
@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private readonly SEARCH_URL  = 'https://nominatim.openstreetmap.org/search';
  private readonly REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';

  // Nominatim usage policy: identify the application in the User-Agent header
  private readonly HEADERS = new HttpHeaders({
    'Accept-Language': 'fr,en;q=0.9',  // Prefer French names (Tunisia context)
  });

  constructor(private http: HttpClient) {}

  // ── Forward geocoding ─────────────────────────────────────────────────────

  /** Search by address string → array of Nominatim results. */
  geocodeAddress(address: string): Observable<NominatimResult[]> {
    return this.http.get<NominatimResult[]>(this.SEARCH_URL, {
      headers: this.HEADERS,
      params: {
        q:              address,
        format:         'json',
        limit:          '5',
        addressdetails: '1',
        countrycodes:   'tn',   // Prioritize Tunisia results
      },
    });
  }

  // ── Reverse geocoding ─────────────────────────────────────────────────────

  /**
   * Reverse geocode (lat, lon) → raw Nominatim result.
   * NOTE: `addressdetails=1` is mandatory — without it the `address` object
   * is absent and all field extraction silently fails.
   */
  reverseGeocode(lat: number, lng: number): Observable<NominatimResult> {
    return this.http.get<NominatimResult>(this.REVERSE_URL, {
      headers: this.HEADERS,
      params: {
        lat:            lat.toString(),
        lon:            lng.toString(),
        format:         'json',
        addressdetails: '1',   // ← CRITICAL: was missing before
        zoom:           '18',  // Highest detail level
      },
    });
  }

  /**
   * Reverse geocode and return a fully resolved `ResolvedLocation`.
   * This is the recommended method for the property-edit form.
   */
  resolveLocation(lat: number, lng: number): Observable<ResolvedLocation> {
    return this.reverseGeocode(lat, lng).pipe(
      map(result => this.buildResolvedLocation(result, lat, lng))
    );
  }

  // ── City / district extraction ────────────────────────────────────────────

  /**
   * Extract the best city name for a Tunisian real estate listing.
   *
   * Prefers délégation-level names (suburb, city_district) over the broad
   * administrative city. This ensures "Sidi Hassine" is preserved rather
   * than being collapsed to "Tunis".
   */
  extractCity(address: NominatimAddress): string {
    // Tier 1 — délégation / commune level (HIGHEST PRIORITY for Tunisia RE)
    if (address.suburb?.trim())        return this._clean(address.suburb);
    if (address.city_district?.trim()) return this._clean(address.city_district);
    if (address.quarter?.trim())       return this._clean(address.quarter);

    // Tier 2 — municipal entities
    if (address.municipality?.trim())  return this._clean(address.municipality);

    // Tier 3 — independent towns and rural areas
    if (address.town?.trim())          return this._clean(address.town);
    if (address.village?.trim())       return this._clean(address.village);
    if (address.hamlet?.trim())        return this._clean(address.hamlet);

    // Tier 4 — administrative city (often gouvernorat capital — fallback only)
    if (address.city?.trim())          return this._clean(address.city);

    // Tier 5 — last resort
    if (address.county?.trim())        return this._clean(address.county);
    if (address.state?.trim())         return this._clean(address.state);

    return '';
  }

  /**
   * Extract the sub-district / quartier for the AI estimation model.
   *
   * When `suburb` was used as the city, we look one level deeper for the
   * district. Otherwise `suburb` itself is the district.
   */
  extractDistrict(address: NominatimAddress): string | null {
    const cityUsed = this.extractCity(address);

    // If suburb was used as city, look for a more specific sub-area
    if (address.suburb && this._clean(address.suburb) === cityUsed) {
      const deeper = address.quarter || address.neighbourhood;
      if (deeper?.trim()) return this._clean(deeper);
      // No deeper area found — district is same as city for AI model
      return cityUsed;
    }

    // If city_district was used, suburb is the district
    if (address.city_district && this._clean(address.city_district) === cityUsed) {
      if (address.suburb?.trim()) return this._clean(address.suburb);
      return cityUsed;
    }

    // Otherwise, use suburb as the district (it's more specific than city)
    if (address.suburb?.trim()) return this._clean(address.suburb);
    if (address.city_district?.trim()) return this._clean(address.city_district);

    return null;
  }

  /**
   * Returns the confidence level of the extracted city name.
   *   HIGH   → came from suburb or city_district (délégation level)
   *   MEDIUM → came from town or municipality
   *   LOW    → fell back to city, county, or state
   */
  extractCityConfidence(address: NominatimAddress): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (address.suburb?.trim() || address.city_district?.trim() || address.quarter?.trim()) {
      return 'HIGH';
    }
    if (address.municipality?.trim() || address.town?.trim() || address.village?.trim()) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  buildResolvedLocation(
    result: NominatimResult,
    lat: number,
    lng: number
  ): ResolvedLocation {
    const address = result.address || {};
    return {
      city:        this.extractCity(address),
      district:    this.extractDistrict(address),
      adminCity:   address.city || address.county || null,
      country:     address.country || '',
      fullAddress: result.display_name || '',
      latitude:    lat,
      longitude:   lng,
      confidence:  this.extractCityConfidence(address),
    };
  }

  /** Trim and normalize whitespace. */
  private _clean(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
  }
}
