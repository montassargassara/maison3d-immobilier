import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Property, FilterCriteria } from '../../models/property.model';
import { PropertyService } from '../../services/property';
import { PropertyCardComponent } from '../property-card/property-card';

@Component({
  selector: 'app-property-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    PropertyCardComponent 
  ],
  templateUrl: './property-list.html',
  styleUrls: ['./property-list.scss']
})
export class PropertyListComponent implements OnInit {
  properties: Property[] = [];
  filteredProperties: Property[] = [];
  featuredProperties: Property[] = [];
  
  searchTerm: string = '';
  
  // CORRECTION: Initialisation correcte avec valeurs par défaut
  filters: FilterCriteria = {
    minPrice: undefined,
    maxPrice: undefined,
    minBedrooms: undefined,
    minBathrooms: undefined,
    minArea: undefined,
    propertyTypes: [],
    locations: [],
    features: []
  };

  propertyTypes = [
    { value: 'house', label: 'Maison', icon: 'fa-home' },
    { value: 'apartment', label: 'Appartement', icon: 'fa-building' },
    { value: 'villa', label: 'Villa', icon: 'fa-crown' },
    { value: 'loft', label: 'Loft', icon: 'fa-warehouse' },
    { value: 'commercial', label: 'Commercial', icon: 'fa-store' }
  ];

  locations = ['Paris', 'Nice', 'Bordeaux', 'Lyon', 'Marseille'];
  featuresList = ['piscine', 'jardin', 'garage', 'terrasse', 'vue mer', 'cheminée'];

  showFilters = false;
  viewMode: 'grid' | 'list' = 'grid';

  constructor(
    private propertyService: PropertyService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.properties = this.propertyService.getProperties();
    this.filteredProperties = [...this.properties];
    this.featuredProperties = this.propertyService.getFeaturedProperties();
  }

  applyFilters(): void {
    this.filteredProperties = this.propertyService.searchProperties(this.filters);
  }

  clearFilters(): void {
    this.filters = {
      minPrice: undefined,
      maxPrice: undefined,
      minBedrooms: undefined,
      minBathrooms: undefined,
      minArea: undefined,
      propertyTypes: [],
      locations: [],
      features: []
    };
    this.searchTerm = '';
    this.filteredProperties = [...this.properties];
    this.applyFilters();
  }

  togglePropertyType(type: string): void {
    if (!this.filters.propertyTypes) {
      this.filters.propertyTypes = [];
    }
    
    const index = this.filters.propertyTypes.indexOf(type);
    if (index > -1) {
      this.filters.propertyTypes.splice(index, 1);
    } else {
      this.filters.propertyTypes.push(type);
    }
    this.applyFilters();
  }

  toggleLocation(location: string): void {
    if (!this.filters.locations) {
      this.filters.locations = [];
    }
    
    const index = this.filters.locations.indexOf(location);
    if (index > -1) {
      this.filters.locations.splice(index, 1);
    } else {
      this.filters.locations.push(location);
    }
    this.applyFilters();
  }

  toggleFeature(feature: string): void {
    if (!this.filters.features) {
      this.filters.features = [];
    }
    
    const index = this.filters.features.indexOf(feature);
    if (index > -1) {
      this.filters.features.splice(index, 1);
    } else {
      this.filters.features.push(feature);
    }
    this.applyFilters();
  }

  onSearch(): void {
    if (!this.searchTerm.trim()) {
      this.filteredProperties = [...this.properties];
      return;
    }

    const term = this.searchTerm.toLowerCase();
    this.filteredProperties = this.properties.filter(property =>
      property.title.toLowerCase().includes(term) ||
      property.description.toLowerCase().includes(term) ||
      property.address.city.toLowerCase().includes(term) ||
      (property.tags && property.tags.some(tag => tag.toLowerCase().includes(term)))
    );
  }

  onFavoriteToggle(propertyId: string): void {
    this.propertyService.toggleFavorite(propertyId);
    // Mettre à jour la liste des favoris
    this.featuredProperties = this.propertyService.getFeaturedProperties();
  }

  onPropertyClick(propertyId: string): void {
    this.router.navigate(['/property', propertyId]);
  }

  getPropertyCount(): number {
    return this.filteredProperties.length;
  }

  getActiveFilterCount(): number {
    let count = 0;
    if (this.filters.minPrice !== undefined && this.filters.minPrice !== null) count++;
    if (this.filters.maxPrice !== undefined && this.filters.maxPrice !== null) count++;
    if (this.filters.minBedrooms !== undefined && this.filters.minBedrooms !== null) count++;
    if (this.filters.minBathrooms !== undefined && this.filters.minBathrooms !== null) count++;
    if (this.filters.minArea !== undefined && this.filters.minArea !== null) count++;
    if (this.filters.propertyTypes && this.filters.propertyTypes.length > 0) count++;
    if (this.filters.locations && this.filters.locations.length > 0) count++;
    if (this.filters.features && this.filters.features.length > 0) count++;
    return count;
  }
}