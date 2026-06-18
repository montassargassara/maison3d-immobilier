import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Property } from '../../models/property.model';
import { PropertyService } from '../../services/property';
import { MapService } from '../../services/map-service';

@Component({
  selector: 'app-property-map',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './property-map-component.html',
  styleUrls: ['./property-map-component.scss']
})
export class PropertyMapComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;
  
  @Input() properties: Property[] = [];
  @Input() showFilters: boolean = true;
  @Input() initialView: { lat: number; lng: number; zoom: number } = {
    lat: 46.603354,
    lng: 1.888334,
    zoom: 6
  };
  
  @Output() propertySelected = new EventEmitter<Property>();
  @Output() mapReady = new EventEmitter<boolean>();
  
  // Filtres
  priceRange = { min: 0, max: 5000000 };
  propertyTypes: string[] = [];
  bedroomRange = { min: 0, max: 10 };
  mapType: 'street' | 'satellite' | 'topographic' = 'street';
  showHeatmap = false;
  showClusters = false;
  searchRadius = 10; // km
  
  filteredProperties: Property[] = [];
  isLoading = false;
  isMapInitialized = false;
  mapLoadAttempts = 0;
  maxLoadAttempts = 3;
  
  // Types disponibles
  availableTypes = [
    { value: 'house', label: 'Maisons', icon: '🏠' },
    { value: 'apartment', label: 'Appartements', icon: '🏢' },
    { value: 'villa', label: 'Villas', icon: '🏡' },
    { value: 'commercial', label: 'Commercial', icon: '🏪' },
    { value: 'loft', label: 'Lofts', icon: '🏭' }
  ];

  constructor(
    private propertyService: PropertyService,
    private mapService: MapService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (this.properties.length === 0) {
      this.properties = this.propertyService.getProperties();
    }
    this.filteredProperties = [...this.properties];
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initializeMap();
    }, 200);
  }

  ngOnDestroy(): void {
    this.mapService.destroy();
  }

  private initializeMap(): void {
    if (!this.mapContainer?.nativeElement) {
      console.error('Map container not found');
      return;
    }

    try {
      this.isLoading = true;
      this.mapLoadAttempts++;
      
      // S'assurer que le conteneur a des dimensions
      this.ensureMapContainerDimensions();
      
      // Charger le CSS Leaflet si nécessaire
      this.loadLeafletCSS();
      
      // Attendre que le CSS soit chargé
      setTimeout(() => {
        console.log('Initializing map, attempt:', this.mapLoadAttempts);
        console.log('Container dimensions:', 
          this.mapContainer.nativeElement.offsetWidth, 
          'x', 
          this.mapContainer.nativeElement.offsetHeight
        );
        
        // Initialiser la carte avec l'élément DOM
        this.mapService.initializeMap(
          this.mapContainer.nativeElement,
          this.initialView,
          this.initialView.zoom
        );

        // Ajouter les propriétés à la carte après un délai
        setTimeout(() => {
          this.mapService.addProperties(this.filteredProperties);
          
          // Forcer un re-render
          this.forceMapResize();
          
          this.isMapInitialized = true;
          this.isLoading = false;
          this.mapReady.emit(true);
          
          console.log('Map initialized successfully');
          
        }, 500);
        
      }, 300);
      
    } catch (error) {
      console.error('Error initializing map:', error);
      this.isLoading = false;
      
      // Réessayer si le nombre d'essais n'est pas dépassé
      if (this.mapLoadAttempts < this.maxLoadAttempts) {
        setTimeout(() => {
          this.initializeMap();
        }, 1000);
      }
    }
  }

  private ensureMapContainerDimensions(): void {
    const element = this.mapContainer.nativeElement;
    
    // Forcer des dimensions explicites
    if (element.offsetHeight < 100) {
      element.style.height = '500px';
      element.style.minHeight = '500px';
    }
    
    if (element.offsetWidth < 100) {
      element.style.width = '100%';
    }
  }

  private loadLeafletCSS(): void {
    // Vérifier si le CSS Leaflet est déjà chargé
    if (!document.querySelector('link[href*="leaflet"]')) {
      console.log('Loading Leaflet CSS...');
      
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      link.crossOrigin = '';
      
      link.onload = () => {
        console.log('Leaflet CSS loaded successfully');
      };
      
      link.onerror = (error) => {
        console.error('Failed to load Leaflet CSS:', error);
      };
      
      document.head.appendChild(link);
    }
  }

  // Méthode pour forcer le redimensionnement
  forceMapResize(): void {
    setTimeout(() => {
      const map = this.mapService.getMap();
      if (map) {
        map.invalidateSize(true);
        console.log('Map resized');
      }
    }, 200);
  }

  // Méthode de debug
  debugMap(): void {
    const map = this.mapService.getMap();
    console.log('=== MAP DEBUG ===');
    console.log('Map instance:', map);
    console.log('Container:', this.mapContainer?.nativeElement);
    console.log('Container dimensions:', 
      this.mapContainer?.nativeElement?.offsetWidth, 
      'x', 
      this.mapContainer?.nativeElement?.offsetHeight
    );
    console.log('Map initialized:', this.isMapInitialized);
    console.log('Filtered properties:', this.filteredProperties.length);
    console.log('==================');
  }

  applyFilters(): void {
    this.isLoading = true;

    // Filtrer les propriétés
    this.filteredProperties = this.properties.filter(property => {
      // Filtre par prix
      if (property.price < this.priceRange.min || property.price > this.priceRange.max) {
        return false;
      }

      // Filtre par type
      if (this.propertyTypes.length > 0 && !this.propertyTypes.includes(property.type)) {
        return false;
      }

      // Filtre par chambres
      if (property.features.bedrooms < this.bedroomRange.min || 
          property.features.bedrooms > this.bedroomRange.max) {
        return false;
      }

      return true;
    });

    // Mettre à jour la carte
    if (this.isMapInitialized) {
      this.mapService.addProperties(this.filteredProperties);
      
      // Forcer un re-render après mise à jour
      setTimeout(() => {
        this.forceMapResize();
        this.isLoading = false;
      }, 300);
    } else {
      this.isLoading = false;
    }
  }

  resetFilters(): void {
    this.priceRange = { min: 0, max: 5000000 };
    this.propertyTypes = [];
    this.bedroomRange = { min: 0, max: 10 };
    this.showHeatmap = false;
    this.showClusters = false;
    
    this.applyFilters();
  }

  onPropertyTypeToggle(type: string): void {
    const index = this.propertyTypes.indexOf(type);
    if (index > -1) {
      this.propertyTypes.splice(index, 1);
    } else {
      this.propertyTypes.push(type);
    }
  }

  onMapTypeChange(): void {
    if (this.isMapInitialized) {
      this.mapService.setMapType(this.mapType);
      this.forceMapResize();
    }
  }

  onShowHeatmapChange(): void {
    if (this.showHeatmap) {
      console.log('Note: Pour activer la heatmap, installez leaflet.heat');
    }
  }

  onShowClustersChange(): void {
    if (this.showClusters) {
      console.log('Note: Pour activer les clusters, installez leaflet.markercluster');
    }
  }

  onSearchByLocation(): void {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const center = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          
          // Centrer la carte sur la position
          const map = this.mapService.getMap();
          if (map) {
            map.setView([center.lat, center.lng], 13);
          }
          
          // Ajouter un rayon de recherche
          this.mapService.addRadiusSearch(center, this.searchRadius);
          
          // Forcer un re-render
          this.forceMapResize();
        },
        (error) => {
          console.error('Geolocation error:', error);
          alert('Impossible d\'accéder à votre position. Vérifiez les permissions.');
        }
      );
    }
  }

  onPropertyClick(property: Property): void {
    this.propertySelected.emit(property);
    this.router.navigate(['/property', property.id]);
  }

  exportMapAsImage(): void {
    const map = this.mapService.getMap();
    if (map) {
      // Méthode alternative pour exporter la carte sans html2canvas
      this.exportMapUsingCanvas();
    } else {
      alert('La carte n\'est pas initialisée');
    }
  }

  private exportMapUsingCanvas(): void {
    const mapElement = document.getElementById('property-map');
    if (!mapElement) {
      alert('Élément carte non trouvé');
      return;
    }

    // Créer un canvas temporaire
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      alert('Impossible de créer le contexte canvas');
      return;
    }

    // Définir la taille du canvas
    canvas.width = mapElement.clientWidth;
    canvas.height = mapElement.clientHeight;

    // Remplir avec une couleur de fond
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dessiner un message
    ctx.fillStyle = '#333';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Export de carte non disponible', canvas.width / 2, canvas.height / 2);
    ctx.font = '14px Arial';
    ctx.fillText('Installez html2canvas pour activer cette fonctionnalité', canvas.width / 2, canvas.height / 2 + 30);

    // Créer un lien de téléchargement
    const link = document.createElement('a');
    link.download = 'carte-proprietes.png';
    link.href = canvas.toDataURL('image/png');
    link.click();

    // Afficher un message d'information
    console.log('Pour activer l\'export de carte, installez: npm install html2canvas');
  }

  getPropertyStats(): {
    total: number;
    averagePrice: number;
    averageArea: number;
    types: { [key: string]: number };
  } {
    const stats = {
      total: this.filteredProperties.length,
      averagePrice: 0,
      averageArea: 0,
      types: {} as { [key: string]: number }
    };

    if (stats.total > 0) {
      const totalPrice = this.filteredProperties.reduce((sum, p) => sum + p.price, 0);
      const totalArea = this.filteredProperties.reduce((sum, p) => sum + p.features.area, 0);
      
      stats.averagePrice = Math.round(totalPrice / stats.total);
      stats.averageArea = Math.round(totalArea / stats.total);
      
      // Compter par type
      this.filteredProperties.forEach(property => {
        stats.types[property.type] = (stats.types[property.type] || 0) + 1;
      });
    }

    return stats;
  }

  formatNumber(num: number): string {
    return new Intl.NumberFormat('fr-FR').format(num);
  }

  // Méthode pour obtenir la couleur selon le type
  getColorForType(type: string): string {
    const colors: { [key: string]: string } = {
      'house': '#3498db',
      'apartment': '#9b59b6',
      'villa': '#e74c3c',
      'commercial': '#2ecc71',
      'loft': '#f39c12'
    };
    return colors[type] || '#3498db';
  }
}