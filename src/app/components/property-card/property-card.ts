import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Property } from '../../models/property.model';

@Component({
  selector: 'app-property-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './property-card.html',
  styleUrls: ['./property-card.scss']
})
export class PropertyCardComponent {
  @Input() property!: Property;
  @Output() favoriteToggle = new EventEmitter<string>();
  @Output() propertyClick = new EventEmitter<string>();

  getStatusClass(): string {
    switch (this.property.status) {
      case 'available': return 'bg-success';
      case 'sold': return 'bg-danger';
      case 'reserved': return 'bg-warning';
      default: return 'bg-secondary';
    }
  }

  getStatusText(): string {
    switch (this.property.status) {
      case 'available': return 'Disponible';
      case 'sold': return 'Vendu';
      case 'reserved': return 'Réservé';
      default: return 'Inconnu';
    }
  }

  onFavoriteClick(event: Event): void {
    event.stopPropagation();
    this.favoriteToggle.emit(this.property.id);
  }

  onCardClick(): void {
    this.propertyClick.emit(this.property.id);
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(price);
  }
}