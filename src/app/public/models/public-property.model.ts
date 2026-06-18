export interface PublicAgency {
  id?: number | null;
  /** Display name: agency's full name or "Maison3D Immobilier" for platform-owned. */
  name: string;
  /** "SUPER_ADMIN" = platform-owned listing | "AGENCY" = partner agency listing. */
  type: 'SUPER_ADMIN' | 'AGENCY' | string;
  phone?: string | null;
  email?: string | null;
  /** Pre-built WhatsApp deep-link from backend (null when no phone). */
  whatsappLink?: string | null;
  /** Physical or city address shown in the contact card. */
  address?: string | null;
  /** Public URL of the agency's logo/avatar — null falls back to styled initials. */
  logoUrl?: string | null;
}

export interface PublicPropertyCard {
  id: number;
  titre: string;
  type: string;
  category: 'VENTE' | 'LOCATION' | string | null;
  prixVente?: number | null;
  prixLocation?: number | null;
  surface?: number | null;
  nbChambres?: number | null;
  nbSallesDeBain?: number | null;
  garage?: boolean | null;
  piscine?: boolean | null;
  jardin?: boolean | null;
  meuble?: boolean | null;
  etage?: number | null;
  parkingSpaces?: number | null;
  climatisation?: boolean | null;
  securite?: boolean | null;
  city?: string | null;
  country?: string | null;
  region?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  mainImageUrl?: string | null;
  hasModel3d?: boolean;
  /** Legacy — prefer agency.name. */
  agencyName?: string | null;
  agency?: PublicAgency | null;
  createdAt?: string;
}

export interface PublicPropertyDetail extends PublicPropertyCard {
  description?: string | null;
  statut?: string | null;
  adresse?: string | null;
  anneeConstruction?: number | null;
  prochePlage?: boolean | null;
  procheTransport?: boolean | null;
  imageUrls?: string[];
  model3dUrl?: string | null;
  model3dFormat?: string | null;
  hasVideo?: boolean;
  mainVideoUrl?: string | null;
  videoUrls?: string[];
  agencyAdminId?: number | null;
}

export interface PublicSearchFilters {
  q?: string;
  country?: string;
  city?: string;
  type?: string;
  minPrice?: number;
  maxPrice?: number;
  minSurface?: number;
  maxSurface?: number;
  minRooms?: number;
}
