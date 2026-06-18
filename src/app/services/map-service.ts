// map.service.ts
import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { Property, GeoCoordinates } from '../models/property.model';

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private map: L.Map | null = null;
  private markers: L.Marker[] = [];
  private propertyLayer: L.LayerGroup | null = null;
  private tileLayer: L.TileLayer | null = null;
  private isInitialized = false;

  constructor() {
    this.fixLeafletIcons();
  }

  private fixLeafletIcons(): void {
    // Fix pour les icônes Leaflet
    const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
    const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
    const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';
    
    // Correction pour éviter l'erreur TypeScript
    const defaultIcon = L.Icon.Default.prototype as any;
    if (defaultIcon._getIconUrl) {
      delete defaultIcon._getIconUrl;
    }
    
    L.Icon.Default.mergeOptions({
      iconRetinaUrl,
      iconUrl,
      shadowUrl,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });
  }

  initializeMap(mapElement: HTMLElement, center: GeoCoordinates, zoom: number = 12): L.Map {
    console.log('MapService: Initializing map on element');
    console.log('Element dimensions:', mapElement.offsetWidth, 'x', mapElement.offsetHeight);
    
    if (!mapElement) {
      throw new Error('Map element is required');
    }

    // Détruire la carte existante si elle existe
    if (this.map) {
      this.destroy();
    }

    // Vérifier que l'élément est visible et a des dimensions
    if (mapElement.offsetWidth === 0 || mapElement.offsetHeight === 0) {
      console.warn('Map element has zero dimensions, forcing size');
      mapElement.style.height = '500px';
      mapElement.style.minHeight = '500px';
      
      // Attendre un frame pour que le style soit appliqué
      setTimeout(() => {
        this.initializeMap(mapElement, center, zoom);
      }, 100);
      return this.map!;
    }

    try {
      // Initialiser la carte
      this.map = L.map(mapElement, {
        center: [center.lat, center.lng],
        zoom: zoom,
        zoomControl: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        dragging: true,
        attributionControl: true,
        fadeAnimation: true,
        markerZoomAnimation: true,
        transform3DLimit: 8388608,
        maxZoom: 19,
        minZoom: 1
      });

      // Ajouter les tuiles OpenStreetMap par défaut
      this.tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        minZoom: 1,
        detectRetina: true
      }).addTo(this.map);

      // Créer un layer group pour les propriétés
      this.propertyLayer = L.layerGroup().addTo(this.map);

      // Ajouter les contrôles
      this.addMapControls();

      // Forcer un re-render après l'initialisation
      setTimeout(() => {
        if (this.map) {
          this.map.invalidateSize();
          console.log('Map initialized and invalidated size');
        }
      }, 300);

      this.isInitialized = true;
      return this.map;
      
    } catch (error) {
      console.error('Error initializing Leaflet map:', error);
      throw error;
    }
  }

  private addMapControls(): void {
    if (!this.map) return;

    // Contrôle d'échelle
    L.control.scale({ 
      imperial: false,
      position: 'bottomleft'
    }).addTo(this.map);

    // CORRECTION : Utiliser la syntaxe correcte pour créer un contrôle personnalisé
    const LocateControl = L.Control.extend({
      options: {
        position: 'topleft'
      },

      onAdd: () => {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        
        const button = L.DomUtil.create('a', 'leaflet-control-locate', container);
        button.href = '#';
        button.title = 'Localiser ma position';
        button.innerHTML = '📍';
        
        button.style.cssText = `
          display: block;
          width: 30px;
          height: 30px;
          line-height: 30px;
          text-align: center;
          background: white;
          border-radius: 4px;
          box-shadow: 0 1px 5px rgba(0,0,0,0.4);
          text-decoration: none;
          color: inherit;
        `;

        L.DomEvent.on(button, 'click', (e: Event) => {
          L.DomEvent.stopPropagation(e);
          L.DomEvent.preventDefault(e);
          this.locateUser();
        });

        return container;
      }
    });

    // Ajouter le contrôle à la carte
    const locateControl = new LocateControl();
    this.map.addControl(locateControl);
  }

  addPropertyMarker(property: Property): L.Marker {
    if (!this.map || !this.propertyLayer) {
      console.error('Map or property layer not initialized');
      throw new Error('Map not initialized');
    }

    try {
      // Créer le marqueur avec une icône personnalisée
      const icon = this.createPropertyIcon(property);
      const marker = L.marker(
        [property.coordinates.lat, property.coordinates.lng],
        { 
          icon,
          title: property.title,
          alt: property.title
        }
      );

      // Ajouter un popup
      const popupContent = this.createPopupContent(property);
      marker.bindPopup(popupContent, {
        maxWidth: 300,
        minWidth: 250,
        className: 'property-popup',
        autoClose: false,
        closeOnClick: false
      });

      // Événements interactifs
      marker.on('mouseover', () => {
        marker.openPopup();
      });

      marker.on('mouseout', () => {
        setTimeout(() => {
          if (!marker.getPopup()?.isOpen()) {
            marker.closePopup();
          }
        }, 100);
      });

      marker.on('click', (e: L.LeafletEvent) => {
        L.DomEvent.stopPropagation(e);
        this.onPropertyClick(property);
      });

      // Ajouter au layer
      marker.addTo(this.propertyLayer);
      this.markers.push(marker);

      return marker;
      
    } catch (error) {
      console.error('Error adding property marker:', error);
      throw error;
    }
  }

  private createPropertyIcon(property: Property): L.DivIcon {
    const color = this.getColorForType(property.type);
    
    return L.divIcon({
      html: `
        <div style="
          background-color: ${color};
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 5px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.2s;
        ">
          ${this.getIconForType(property.type)}
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
      className: 'property-marker'
    });
  }

  private getIconForType(type: string): string {
    const icons: { [key: string]: string } = {
      'house': '🏠',
      'apartment': '🏢',
      'villa': '🏡',
      'commercial': '🏪',
      'loft': '🏭'
    };
    return icons[type] || '🏠';
  }

  private getColorForType(type: string): string {
    const colors: { [key: string]: string } = {
      'house': '#3498db',
      'apartment': '#9b59b6',
      'villa': '#e74c3c',
      'commercial': '#2ecc71',
      'loft': '#f39c12'
    };
    return colors[type] || '#3498db';
  }

  private createPopupContent(property: Property): string {
    const imageUrl = property.images && property.images.length > 0 
      ? property.images[0] 
      : 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=300&h=200&fit=crop';
    
    return `
      <div class="property-popup-content" style="font-family: Arial, sans-serif;">
        <div style="
          height: 120px;
          background-image: url('${imageUrl}');
          background-size: cover;
          background-position: center;
          border-radius: 4px 4px 0 0;
          margin-bottom: 10px;
        "></div>
        <div style="padding: 10px;">
          <h4 style="margin: 0 0 5px; font-size: 16px; color: #2c3e50; font-weight: bold;">
            ${property.title}
          </h4>
          <p style="margin: 0 0 8px; color: #27ae60; font-weight: bold; font-size: 18px;">
            ${this.formatPrice(property.price)}
          </p>
          <p style="margin: 0 0 10px; font-size: 13px; color: #7f8c8d;">
            📍 ${property.address.city}, ${property.address.postalCode}
          </p>
          <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 12px; color: #34495e;">
            <span style="display: flex; align-items: center; gap: 4px;">🛏️ ${property.features.bedrooms}</span>
            <span style="display: flex; align-items: center; gap: 4px;">🚿 ${property.features.bathrooms}</span>
            <span style="display: flex; align-items: center; gap: 4px;">📐 ${property.features.area}m²</span>
          </div>
          <button 
            onclick="window.location.href='/property/${property.id}'"
            style="
              width: 100%;
              padding: 8px 12px;
              background: #3498db;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 14px;
              font-weight: bold;
              transition: background 0.3s;
            "
            onmouseover="this.style.background='#2980b9'"
            onmouseout="this.style.background='#3498db'">
            👁️ Voir les détails
          </button>
        </div>
      </div>
    `;
  }

  private formatPrice(price: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(price);
  }

  addProperties(properties: Property[]): void {
    console.log(`Adding ${properties.length} properties to map`);
    
    // Effacer les anciens marqueurs
    this.clearMarkers();

    if (properties.length === 0) {
      console.log('No properties to display');
      return;
    }

    // Ajouter les nouveaux marqueurs
    properties.forEach(property => {
      try {
        this.addPropertyMarker(property);
      } catch (error) {
        console.error(`Error adding marker for property ${property.id}:`, error);
      }
    });

    console.log(`Added ${this.markers.length} markers`);

    // Ajuster les limites de la carte si on a des marqueurs
    if (this.markers.length > 0) {
      this.fitToMarkers();
    } else {
      // Centrer sur la France par défaut
      this.centerOnCoordinates({ lat: 46.603354, lng: 1.888334 }, 6);
    }
  }

  clearMarkers(): void {
    if (this.propertyLayer) {
      this.propertyLayer.clearLayers();
    }
    this.markers = [];
  }

  fitToMarkers(): void {
    if (!this.map || this.markers.length === 0) return;

    const bounds = L.latLngBounds(
      this.markers.map(marker => marker.getLatLng())
    );
    
    // Ajouter un peu de padding
    this.map.fitBounds(bounds, {
      padding: [50, 50],
      maxZoom: 15,
      animate: true,
      duration: 1
    });
  }

  centerOnProperty(property: Property, zoom: number = 15): void {
    if (!this.map) return;

    this.map.setView(
      [property.coordinates.lat, property.coordinates.lng],
      zoom,
      { animate: true }
    );

    // Ouvrir le popup du marqueur correspondant
    const marker = this.markers.find(m => 
      Math.abs(m.getLatLng().lat - property.coordinates.lat) < 0.0001 &&
      Math.abs(m.getLatLng().lng - property.coordinates.lng) < 0.0001
    );
    
    if (marker) {
      setTimeout(() => {
        marker.openPopup();
      }, 300);
    }
  }

  centerOnCoordinates(coords: GeoCoordinates, zoom: number = 12): void {
    if (!this.map) return;
    
    this.map.setView([coords.lat, coords.lng], zoom, { animate: true });
  }

  locateUser(): void {
    if (!this.map || !navigator.geolocation) {
      console.error('Map or geolocation not available');
      return;
    }

    this.map.locate({ 
      setView: true, 
      maxZoom: 16,
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });

    this.map.on('locationfound', (e: L.LocationEvent) => {
      // CORRECTION : Utiliser les propriétés correctes de LatLng
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      
      // Ajouter un marqueur de position
      L.marker([lat, lng], {
        icon: L.divIcon({
          html: '<div style="background-color: #27ae60; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>',
          iconSize: [24, 24],
          iconAnchor: [12, 24]
        })
      })
      .addTo(this.map!)
      .bindPopup('Votre position actuelle')
      .openPopup();
      
      console.log('User located at:', lat, lng);
    });

    this.map.on('locationerror', (error: L.ErrorEvent) => {
      console.error('Geolocation error:', error.message);
      alert('Impossible de récupérer votre position. Vérifiez les permissions de localisation.');
    });
  }

  private onPropertyClick(property: Property): void {
    console.log('Property clicked:', property);
    // Cette méthode peut être étendue pour émettre un événement
  }

  setMapType(type: 'street' | 'satellite' | 'topographic'): void {
    if (!this.map || !this.tileLayer) return;

    // Retirer l'ancien layer
    this.map.removeLayer(this.tileLayer);

    let urlTemplate: string;
    let attribution: string;
    let options: L.TileLayerOptions = {
      maxZoom: 19,
      detectRetina: true
    };

    switch(type) {
      case 'satellite':
        urlTemplate = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
        attribution = 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';
        break;
      case 'topographic':
        urlTemplate = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
        attribution = 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)';
        options.maxZoom = 17;
        break;
      case 'street':
      default:
        urlTemplate = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
        break;
    }

    this.tileLayer = L.tileLayer(urlTemplate, {
      ...options,
      attribution: attribution
    }).addTo(this.map);

    // Forcer un re-render
    setTimeout(() => {
      this.map?.invalidateSize();
    }, 100);
  }

  addRadiusSearch(center: GeoCoordinates, radiusKm: number): void {
    if (!this.map) return;

    // Ajouter un cercle de recherche
    const circle = L.circle([center.lat, center.lng], {
      color: '#3388ff',
      fillColor: '#3388ff',
      fillOpacity: 0.1,
      weight: 2,
      radius: radiusKm * 1000
    }).addTo(this.map);

    // Ajouter un marqueur au centre
    L.marker([center.lat, center.lng], {
      icon: L.divIcon({
        html: '<div style="background-color: #ff5722; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 20]
      })
    }).addTo(this.map)
      .bindPopup(`Recherche dans un rayon de ${radiusKm}km`)
      .openPopup();
  }

  destroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this.clearMarkers();
    this.propertyLayer = null;
    this.tileLayer = null;
    this.isInitialized = false;
    console.log('Map destroyed');
  }

  getMap(): L.Map | null {
    return this.map;
  }

  isMapReady(): boolean {
    return this.isInitialized && this.map !== null;
  }

  // Méthode utilitaire pour re-centrer sur tous les marqueurs
  zoomToAllProperties(): void {
    this.fitToMarkers();
  }

  // Méthode pour ajouter un marqueur personnalisé
  addCustomMarker(lat: number, lng: number, options?: {
    title?: string;
    popupContent?: string;
    icon?: L.Icon | L.DivIcon;
  }): L.Marker {
    if (!this.map) {
      throw new Error('Map not initialized');
    }

    const marker = L.marker([lat, lng], {
      title: options?.title,
      icon: options?.icon
    });

    if (options?.popupContent) {
      marker.bindPopup(options.popupContent);
    }

    marker.addTo(this.map);
    this.markers.push(marker);
    
    return marker;
  }
}