export interface Property {
  id: string;
  title: string;
  description: string;
  price: number;
  type: 'house' | 'apartment' | 'villa' | 'commercial' | 'loft';
  address: PropertyAddress;
  coordinates: GeoCoordinates;
  features: PropertyFeatures;
  images: string[];
  model3dUrl?: string;
  floorPlanUrl?: string;
  virtualTourUrl?: string;
  customizationOptions: CustomizationOption[];
  tags: string[];
  isFavorite: boolean;
  status: 'available' | 'sold' | 'reserved';
  createdAt: Date;
  agent?: PropertyAgent;
}

export interface PropertyAddress {
  street: string;
  city: string;
  postalCode: string;
  country: string;
}

export interface GeoCoordinates {
  lat: number;
  lng: number;
}

export interface PropertyFeatures {
  bedrooms: number;
  bathrooms: number;
  area: number;
  yearBuilt: number;
  floors?: number;
  garage?: boolean;
  garden?: boolean;
  pool?: boolean;
  terrace?: boolean;
  balcony?: boolean;
}

export interface CustomizationOption {
  id: string;
  name: string;
  type: 'wallColor' | 'flooring' | 'furniture' | 'lighting' | 'appliances' | 'roofColor' | 'windowFrame' | 'parquetColor' | 'facadeMaterial';
  options: CustomizationChoice[];
}

export interface CustomizationChoice {
  id: string;
  name: string;
  thumbnail?: string;
  color?: string;
  textureUrl?: string;
  price?: number;
  modelUrl?: string;
}

export interface PropertyAgent {
  name: string;
  phone: string;
  email: string;
  photo?: string;
  agency?: string;
  rating?: number;
}

export interface FilterCriteria {
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  minBathrooms?: number;
  minArea?: number;
  propertyTypes?: string[];
  locations?: string[];
  features?: string[];
}

// models/property.model.ts
export interface PropertyStatus {
  value: string;
  label: string;
  description?: string;
}

export const SALE_STATUSES: PropertyStatus[] = [
  { value: 'DISPONIBLE', label: 'Disponible', description: 'Bien disponible à la vente' },
  { value: 'EN_ATTENTE', label: 'En attente', description: 'En cours de négociation' },
  { value: 'VENDU', label: 'Vendu', description: 'Bien vendu' }
];

export const RENTAL_STATUSES: PropertyStatus[] = [
  { value: 'DISPONIBLE', label: 'Disponible', description: 'Bien disponible à la location' },
  { value: 'EN_ATTENTE', label: 'En attente', description: 'En cours de négociation' },
  { value: 'LOUE', label: 'Loué', description: 'Bien loué' }
];

export const ALL_STATUSES: PropertyStatus[] = [
  ...SALE_STATUSES,
  { value: 'RESERVE', label: 'Réservé', description: 'Bien réservé' }
];

export type PropertyCategory = 'VENTE' | 'LOCATION';

export function getStatusesForCategory(category: PropertyCategory | null): PropertyStatus[] {
  if (category === 'VENTE') return SALE_STATUSES;
  if (category === 'LOCATION') return RENTAL_STATUSES;
  return ALL_STATUSES;
}

export function isStatusAllowedForCategory(status: string, category: PropertyCategory | null): boolean {
  if (!category) return true;
  const allowedStatuses = getStatusesForCategory(category);
  return allowedStatuses.some(s => s.value === status);
}