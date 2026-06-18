import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PublicAgency, PublicPropertyCard } from '../models/public-property.model';
import { PublicPortalService } from '../services/public-portal.service';

@Component({
  selector: 'app-public-property-card',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <a class="card" [routerLink]="['/biens', property.id]" *ngIf="property">

      <!-- Thumbnail -->
      <div class="thumb">
        <img *ngIf="imageUrl()" [src]="imageUrl()" [alt]="property.titre" loading="lazy" />
        <div class="thumb-fallback" *ngIf="!imageUrl()">
          <span>{{ initials() }}</span>
        </div>

        <!-- Overlay badges (top-left) -->
        <div class="badges-left">
          <span class="badge category" [class.rent]="property.category === 'LOCATION'">
            {{ property.category === 'LOCATION' ? 'Location' : 'Vente' }}
          </span>
        </div>

        <!-- Overlay badges (top-right) -->
        <div class="badges-right">
          <span class="badge tridi" *ngIf="property.hasModel3d">
            <i class="fas fa-cube"></i> 3D
          </span>
          <span class="badge furnished" *ngIf="property.meuble">Meublé</span>
        </div>

        <!-- Agency strip at bottom of thumb -->
        <div class="thumb-agency" [class.official]="agency()?.type === 'SUPER_ADMIN'">
          <span class="agency-dot"></span>
          <span class="agency-name">{{ agencyLabel() }}</span>
          <span class="agency-badge-type official-badge" *ngIf="agency()?.type === 'SUPER_ADMIN'">
            Officiel
          </span>
          <span class="agency-badge-type partner-badge" *ngIf="agency()?.type === 'AGENCY'">
            Partenaire
          </span>
        </div>
      </div>

      <!-- Body -->
      <div class="body">
        <h3 class="title">{{ property.titre }}</h3>

        <div class="location">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          <span>{{ locationLabel() }}</span>
        </div>

        <!-- Core facts -->
        <div class="meta">
          <span *ngIf="property.surface">
            <i class="fas fa-ruler-combined"></i> <strong>{{ property.surface }}</strong> m²
          </span>
          <span *ngIf="property.nbChambres">
            <i class="fas fa-bed"></i> <strong>{{ property.nbChambres }}</strong>
          </span>
          <span *ngIf="property.nbSallesDeBain">
            <i class="fas fa-shower"></i> <strong>{{ property.nbSallesDeBain }}</strong>
          </span>
          <span *ngIf="property.etage != null && property.etage! > 0">
            <i class="fas fa-building"></i> Étage {{ property.etage }}
          </span>
        </div>

        <!-- Amenity pills -->
        <div class="amenities" *ngIf="hasAmenities()">
          <span class="pill" *ngIf="property.garage">
            <i class="fas fa-car"></i> Garage
          </span>
          <span class="pill" *ngIf="property.piscine">
            <i class="fas fa-swimming-pool"></i> Piscine
          </span>
          <span class="pill" *ngIf="property.jardin">
            <i class="fas fa-tree"></i> Jardin
          </span>
          <span class="pill" *ngIf="property.climatisation">
            <i class="fas fa-snowflake"></i> Clim.
          </span>
          <span class="pill" *ngIf="property.securite">
            <i class="fas fa-shield-halved"></i> Sécurité
          </span>
          <span class="pill" *ngIf="property.parkingSpaces && property.parkingSpaces > 0">
            <i class="fas fa-square-parking"></i> Parking
          </span>
        </div>

        <!-- Footer: price -->
        <div class="footer">
          <span class="price">{{ priceLabel() }}</span>
        </div>
      </div>
    </a>
  `,
  styles: [`
    :host { display: block; }

    .card {
      display: flex;
      flex-direction: column;
      border-radius: 16px;
      overflow: hidden;
      background: #fff;
      border: 1px solid #e2e8f0;
      text-decoration: none;
      color: inherit;
      transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
      height: 100%;
    }
    .card:hover {
      transform: translateY(-4px);
      box-shadow: 0 20px 44px -16px rgba(15,23,42,.2);
      border-color: #bfdbfe;
    }

    /* ── Thumb ─────────────────────────────────────────── */
    .thumb {
      position: relative;
      aspect-ratio: 4 / 3;
      background: #f1f5f9;
      overflow: hidden;
    }
    .thumb img {
      width: 100%; height: 100%;
      object-fit: cover; display: block;
      transition: transform 0.45s ease;
    }
    .card:hover .thumb img { transform: scale(1.06); }
    .thumb-fallback {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #cbd5e1, #94a3b8);
      color: #fff; font-weight: 700; font-size: 28px; letter-spacing: 1px;
    }

    /* Overlaid badge rows */
    .badges-left, .badges-right {
      position: absolute; top: 10px;
      display: flex; flex-direction: column; gap: 5px;
    }
    .badges-left  { left: 10px; }
    .badges-right { right: 10px; align-items: flex-end; }

    .badge {
      font-size: 10px; font-weight: 700;
      text-transform: uppercase; letter-spacing: .05em;
      padding: 4px 9px; border-radius: 999px;
      backdrop-filter: blur(6px);
    }
    .category       { background: rgba(11,107,203,.92); color: #fff; }
    .category.rent  { background: rgba(16,185,129,.92); }
    .tridi          { background: rgba(245,158,11,.94); color: #fff;
                      display: inline-flex; align-items: center; gap: 4px; }
    .furnished      { background: rgba(99,102,241,.9); color: #fff; }

    /* ── Agency strip ──────────────────────────────────── */
    .thumb-agency {
      position: absolute; bottom: 0; left: 0; right: 0;
      display: flex; align-items: center; gap: 6px;
      padding: 6px 10px;
      background: linear-gradient(to top, rgba(15,23,42,.72) 0%, transparent 100%);
      color: #fff;
    }
    .thumb-agency.official {
      background: linear-gradient(to top, rgba(14,89,184,.82) 0%, transparent 100%);
    }

    .agency-dot {
      width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
      background: #60a5fa;
    }
    .thumb-agency.official .agency-dot { background: #fbbf24; }

    .agency-name {
      font-size: 11px; font-weight: 600;
      flex: 1; min-width: 0;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    .agency-badge-type {
      font-size: 9px; font-weight: 700; text-transform: uppercase;
      padding: 2px 7px; border-radius: 999px; flex-shrink: 0;
    }
    .official-badge { background: rgba(251,191,36,.22); color: #fde68a; border: 1px solid rgba(251,191,36,.35); }
    .partner-badge  { background: rgba(96,165,250,.18); color: #bfdbfe; border: 1px solid rgba(96,165,250,.3); }

    /* ── Body ──────────────────────────────────────────── */
    .body {
      padding: 14px 14px 16px;
      display: flex; flex-direction: column; gap: 8px; flex: 1;
    }
    .title {
      font-size: 15px; font-weight: 600; margin: 0; color: #0f172a; line-height: 1.4;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    .location {
      display: flex; align-items: center; gap: 4px;
      color: #64748b; font-size: 12px;
    }

    .meta {
      display: flex; gap: 12px; flex-wrap: wrap;
      font-size: 12px; color: #475569;
      padding-top: 8px; border-top: 1px dashed #e2e8f0;
      i { color: #94a3b8; margin-right: 2px; }
      strong { color: #0f172a; }
    }

    .amenities { display: flex; gap: 6px; flex-wrap: wrap; }
    .pill {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 10px; font-weight: 600; color: #4338ca;
      background: #ede9fe; border-radius: 999px; padding: 3px 8px;
      i { font-size: 9px; }
    }

    .footer {
      display: flex; justify-content: space-between; align-items: flex-end;
      margin-top: auto; padding-top: 8px;
    }
    .price { font-size: 17px; font-weight: 700; color: #0b6bcb; }
  `],
})
export class PublicPropertyCardComponent {
  @Input({ required: true }) property!: PublicPropertyCard;
  private portal = inject(PublicPortalService);

  agency(): PublicAgency | null { return this.property.agency ?? null; }

  imageUrl(): string { return this.portal.resolveImage(this.property.mainImageUrl); }
  initials(): string { return (this.property.titre || '?').slice(0, 2).toUpperCase(); }

  agencyLabel(): string {
    return this.agency()?.name ?? this.property.agencyName ?? 'Maison3D Immobilier';
  }

  locationLabel(): string {
    const parts = [this.property.city, this.property.country].filter(Boolean);
    return parts.length ? parts.join(', ') : 'Localisation non spécifiée';
  }

  priceLabel(): string {
    if (this.property.category === 'LOCATION' && this.property.prixLocation)
      return `${this.fmt(this.property.prixLocation)} TND/mois`;
    if (this.property.prixVente)
      return `${this.fmt(this.property.prixVente)} TND`;
    return 'Prix sur demande';
  }

  hasAmenities(): boolean {
    return !!(this.property.garage || this.property.piscine || this.property.jardin
           || this.property.climatisation || this.property.securite
           || (this.property.parkingSpaces && this.property.parkingSpaces > 0));
  }

  private fmt(n: number): string {
    return new Intl.NumberFormat('fr-FR').format(n);
  }
}
