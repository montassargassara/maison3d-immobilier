import { Injectable } from '@angular/core';
import { Property, FilterCriteria } from '../models/property.model';

@Injectable({
  providedIn: 'root'
})
export class PropertyService {
  private properties: Property[] = [
    {
      id: '1',
      title: 'Villa Moderne avec Piscine à Nice',
      description: 'Magnifique villa contemporaine de 220m² avec piscine à débordement et vue panoramique sur la mer Méditerranée.',
      price: 1250000,
      type: 'villa',
      address: {
        street: '123 Avenue des Palmiers',
        city: 'Nice',
        postalCode: '06000',
        country: 'France'
      },
      coordinates: {
        lat: 43.7102,
        lng: 7.2620
      },
      features: {
        bedrooms: 4,
        bathrooms: 3,
        area: 220,
        yearBuilt: 2018,
        floors: 2,
        garage: true,
        garden: true,
        pool: true
      },
      images: [
        'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w-800&auto=format&fit=crop'
      ],
      model3dUrl: 'https://threejs.org/examples/models/gltf/DamagedHelmet/glTF/DamagedHelmet.gltf',
      floorPlanUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7',
      customizationOptions: [
        {
          id: 'wall-colors',
          name: 'Couleurs des murs',
          type: 'wallColor',
          options: [
            { id: 'white', name: 'Blanc mat', color: '#FFFFFF', price: 0 },
            { id: 'beige', name: 'Beige sable', color: '#F5E6D3', price: 1200 }
          ]
        }
      ],
      tags: ['piscine', 'vue mer', 'jardin', 'garage'],
      isFavorite: false,
      status: 'available',
      createdAt: new Date('2024-01-15'),
      agent: {
        name: 'Sophie Martin',
        phone: '+33 6 12 34 56 78',
        email: 'sophie@immobilier-nice.fr',
        photo: 'https://images.unsplash.com/photo-1494790108755-2616b786d4d1?w=200&auto=format&fit=crop'
      }
    },
    {
      id: '2',
      title: 'Appartement Haussmannien Paris 16ème',
      description: 'Superbe appartement de 95m² avec parquet herringbone, moulures et cheminée d\'époque.',
      price: 1850000,
      type: 'apartment',
      address: {
        street: '45 Avenue Victor Hugo',
        city: 'Paris',
        postalCode: '75116',
        country: 'France'
      },
      coordinates: {
        lat: 48.8698,
        lng: 2.2880
      },
      features: {
        bedrooms: 3,
        bathrooms: 2,
        area: 95,
        yearBuilt: 1910,
        floors: 3
      },
      images: [
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop'
      ],
      tags: ['haussmannien', 'parquet', 'cheminée'],
      isFavorite: true,
      status: 'available',
      createdAt: new Date('2024-01-20'),
      customizationOptions: []
    }
  ];

  constructor() {}

  getProperties(): Property[] {
    return this.properties;
  }

  getFeaturedProperties(): Property[] {
    return this.properties.filter(p => p.isFavorite);
  }

  getPropertyById(id: string): Property | undefined {
    return this.properties.find(p => p.id === id);
  }

  searchProperties(criteria: FilterCriteria): Property[] {
    return this.properties.filter(property => {
      let matches = true;
      
      if (criteria.minPrice && property.price < criteria.minPrice) matches = false;
      if (criteria.maxPrice && property.price > criteria.maxPrice) matches = false;
      if (criteria.minBedrooms && property.features.bedrooms < criteria.minBedrooms) matches = false;
      if (criteria.minBathrooms && property.features.bathrooms < criteria.minBathrooms) matches = false;
      if (criteria.minArea && property.features.area < criteria.minArea) matches = false;
      
      if (criteria.propertyTypes && criteria.propertyTypes.length > 0) {
        matches = matches && criteria.propertyTypes.includes(property.type);
      }
      
      return matches;
    });
  }

  toggleFavorite(propertyId: string): void {
    const property = this.getPropertyById(propertyId);
    if (property) {
      property.isFavorite = !property.isFavorite;
    }
  }
}