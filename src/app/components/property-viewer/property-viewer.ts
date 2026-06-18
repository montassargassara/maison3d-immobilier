import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Property, CustomizationOption } from '../../models/property.model';
import { PropertyService } from '../../services/property';
import { ThreeJsService } from '../../services/threejs';
import { MapService } from '../../services/map-service';

@Component({
  selector: 'app-property-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './property-viewer.html',
  styleUrls: ['./property-viewer.scss']
})
export class PropertyViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('threeContainer', { static: false }) threeContainer!: ElementRef;
  @ViewChild('locationMap', { static: false }) locationMap!: ElementRef;
  
  property!: Property;
  selectedOption: CustomizationOption | null = null;
  selectedColor: string = '#FFFFFF';
  showGrid: boolean = true;
  showAxes: boolean = false;
  lightingIntensity: number = 1;
  currentImageIndex: number = 0;
  isLoading: boolean = true;
  isMapLoading: boolean = false;
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private propertyService: PropertyService,
    private threeJsService: ThreeJsService,
    private mapService: MapService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const property = this.propertyService.getPropertyById(id);
      if (property) {
        this.property = property;
      } else {
        this.router.navigate(['/']);
      }
    }
  }

  ngAfterViewInit(): void {
    // Initialiser 3D en premier
    this.initialize3DViewer();
    
    // Initialiser la carte après un délai
    setTimeout(() => {
      this.initializeLocationMap();
    }, 500);
  }

  ngOnDestroy(): void {
    this.threeJsService.cleanup();
    this.mapService.destroy();
  }

  private async initialize3DViewer(): Promise<void> {
    try {
      this.isLoading = true;
      
      // Vérifier que le container existe
      if (!this.threeContainer?.nativeElement) {
        console.error('Container Three.js non trouvé');
        this.isLoading = false;
        return;
      }
      
      // Initialiser Three.js
      this.threeJsService.initializeScene(this.threeContainer);
      
      // Charger modèle 3D
      if (this.property.model3dUrl) {
        await this.threeJsService.loadModel(this.property.model3dUrl);
      }
      
      this.isLoading = false;
    } catch (error) {
      console.error('Erreur 3D:', error);
      this.isLoading = false;
    }
  }

  private async initializeLocationMap(): Promise<void> {
    try {
      this.isMapLoading = true;
      
      if (!this.locationMap?.nativeElement) {
        console.error('Container carte non trouvé');
        this.isMapLoading = false;
        return;
      }

      // Forcer les dimensions du conteneur
      this.locationMap.nativeElement.style.height = '300px';
      this.locationMap.nativeElement.style.minHeight = '300px';
      
      // Attendre un peu pour le rendu
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Initialiser la carte avec l'élément
      this.mapService.initializeMap(
        this.locationMap.nativeElement,
        this.property.coordinates,
        15
      );

      // Ajouter le marqueur et centrer
      setTimeout(() => {
        this.mapService.addPropertyMarker(this.property);
        this.mapService.centerOnProperty(this.property, 16);
        
        // Forcer un re-render
        const map = this.mapService.getMap();
        if (map) {
          setTimeout(() => {
            map.invalidateSize();
            this.isMapLoading = false;
          }, 200);
        } else {
          this.isMapLoading = false;
        }
      }, 300);
      
    } catch (error) {
      console.error('Erreur carte:', error);
      this.isMapLoading = false;
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    this.threeJsService.onResize(this.threeContainer);
    // Redimensionner la carte
    this.forceMapResize();
  }

  // Méthode pour forcer le redimensionnement de la carte
  forceMapResize(): void {
    const map = this.mapService.getMap();
    if (map) {
      setTimeout(() => {
        map.invalidateSize(true);
      }, 100);
    }
  }

  // Méthode de debug
  debugMap(): void {
    const map = this.mapService.getMap();
    console.log('Map instance:', map);
    console.log('Map container:', this.locationMap?.nativeElement);
    console.log('Container dimensions:', 
      this.locationMap?.nativeElement?.offsetWidth, 
      'x', 
      this.locationMap?.nativeElement?.offsetHeight
    );
  }

  selectCustomization(option: CustomizationOption): void {
    this.selectedOption = option;
  }

  applyCustomization(optionId: string): void {
    if (!this.selectedOption) return;
    
    const selected = this.selectedOption.options.find(opt => opt.id === optionId);
    if (!selected || !selected.color) return;

    this.selectedColor = selected.color;
    this.threeJsService.changeMaterialColor('wall', selected.color);
  }

  toggleFavorite(): void {
    this.propertyService.toggleFavorite(this.property.id);
  }

  takeScreenshot(): void {
    const screenshot = this.threeJsService.takeScreenshot();
    const link = document.createElement('a');
    link.href = screenshot;
    link.download = `maison-${this.property.id}.png`;
    link.click();
  }

  toggleGrid(): void {
    this.showGrid = !this.showGrid;
    this.threeJsService.toggleGrid(this.showGrid);
  }

  toggleAxes(): void {
    this.showAxes = !this.showAxes;
    this.threeJsService.toggleAxes(this.showAxes);
  }

  onLightingChange(): void {
    this.threeJsService.setLighting(this.lightingIntensity);
  }

  previousImage(): void {
    if (this.property.images.length > 0) {
      this.currentImageIndex = this.currentImageIndex > 0 
        ? this.currentImageIndex - 1 
        : this.property.images.length - 1;
    }
  }

  nextImage(): void {
    if (this.property.images.length > 0) {
      this.currentImageIndex = this.currentImageIndex < this.property.images.length - 1 
        ? this.currentImageIndex + 1 
        : 0;
    }
  }

  locateOnMap(): void {
    this.mapService.locateUser();
  }

  getDirections(): void {
    // Ouvrir Google Maps avec l'adresse
    const address = `${this.property.address.street}, ${this.property.address.postalCode} ${this.property.address.city}`;
    const encodedAddress = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`, '_blank');
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(price);
  }
}