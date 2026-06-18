/**
 * Full Nominatim reverse-geocoding response typings.
 *
 * Reference: https://nominatim.org/release-docs/latest/api/Reverse/
 *
 * Tunisia administrative levels in OSM/Nominatim:
 *   admin_level 4  → Gouvernorat   (Tunis, Sfax, Sousse …)
 *   admin_level 6  → Délégation    (Sidi Hassine, La Goulette, El Mourouj …)
 *   admin_level 8  → Commune       (more granular)
 *   suburb         → Quartier / Délégation (most useful for real estate)
 *   city_district  → District within a major city
 */

export interface NominatimAddress {
  // ── Street level ──────────────────────────────────────────────────────────
  house_number?: string;
  road?: string;
  pedestrian?: string;
  footway?: string;
  cycleway?: string;

  // ── Neighbourhood level (most specific) ───────────────────────────────────
  neighbourhood?: string;  // very specific micro-area
  quarter?: string;        // quarter within a suburb
  suburb?: string;         // délégation / commune / named suburb — MOST USEFUL FOR TUNISIA
  city_district?: string;  // district within a major city

  // ── Municipality level ────────────────────────────────────────────────────
  municipality?: string;
  town?: string;            // independent towns (Hammam Lif, Radès, Bizerte…)
  village?: string;         // rural villages
  hamlet?: string;          // very small settlements
  isolated_dwelling?: string;

  // ── City / region level ───────────────────────────────────────────────────
  city?: string;            // major city — often too broad for Tunisian suburbs
  county?: string;          // sometimes the délégation, sometimes the gouvernorat
  state_district?: string;
  state?: string;           // gouvernorat (Tunis, Sfax, Sousse…)
  region?: string;

  // ── Country ───────────────────────────────────────────────────────────────
  postcode?: string;
  country?: string;
  country_code?: string;    // "tn" for Tunisia
}

export interface NominatimResult {
  place_id: number;
  licence: string;
  osm_type?: 'node' | 'way' | 'relation';
  osm_id?: number;
  lat: string;
  lon: string;
  display_name: string;
  address: NominatimAddress;
  boundingbox?: [string, string, string, string];
  type?: string;
  class?: string;
}

/**
 * Resolved location returned by GeocodingService.
 * Separates the real-estate "city" (délégation level) from the
 * administrative "district" (quartier level) and the AI model's "city"
 * (main administrative city for the model's city encoder).
 */
export interface ResolvedLocation {
  /** Best city name for real estate display (délégation / commune level). */
  city: string;

  /** Sub-district / quartier for the AI estimation model. Null if unavailable. */
  district: string | null;

  /**
   * Administrative parent city for the AI model's city encoder.
   * This is address.city (e.g., "Tunis") even when `city` = "Sidi Hassine".
   * Needed so the ML model can look up district features correctly.
   */
  adminCity: string | null;

  country: string;
  fullAddress: string;
  latitude: number;
  longitude: number;

  /**
   * Confidence in the resolved city name.
   *   HIGH   — came from suburb/city_district (délégation level)
   *   MEDIUM — came from town/municipality
   *   LOW    — fell back to city/county/state
   */
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}
