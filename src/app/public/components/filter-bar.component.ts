import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PublicPortalService } from '../services/public-portal.service';
import { PublicSearchFilters } from '../models/public-property.model';

@Component({
  selector: 'app-public-filter-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <form class="filter-bar" (ngSubmit)="emit()">
      <div class="field grow">
        <label>Recherche</label>
        <input type="text" [(ngModel)]="filters.q" name="q"
               placeholder="Titre, ville, quartier…" />
      </div>

      <div class="field">
        <label>Pays</label>
        <select [(ngModel)]="filters.country" name="country" (change)="onCountryChange()">
          <option value="">Tous</option>
          <option *ngFor="let c of countries" [value]="c">{{ c }}</option>
        </select>
      </div>

      <div class="field">
        <label>Ville</label>
        <select [(ngModel)]="filters.city" name="city">
          <option value="">Toutes</option>
          <option *ngFor="let c of cities" [value]="c">{{ c }}</option>
        </select>
      </div>

      <div class="field">
        <label>Type</label>
        <select [(ngModel)]="filters.type" name="type">
          <option value="">Tous</option>
          <option *ngFor="let t of types" [value]="t">{{ formatType(t) }}</option>
        </select>
      </div>

      <div class="field small">
        <label>{{ category === 'LOCATION' ? 'Loyer min' : 'Prix min' }}</label>
        <input type="number" min="0" [(ngModel)]="filters.minPrice" name="minPrice" placeholder="0" />
      </div>

      <div class="field small">
        <label>{{ category === 'LOCATION' ? 'Loyer max' : 'Prix max' }}</label>
        <input type="number" min="0" [(ngModel)]="filters.maxPrice" name="maxPrice" placeholder="∞" />
      </div>

      <div class="field small">
        <label>Pièces min</label>
        <input type="number" min="0" [(ngModel)]="filters.minRooms" name="minRooms" placeholder="0" />
      </div>

      <div class="actions">
        <button type="submit" class="btn-primary">Rechercher</button>
        <button type="button" class="btn-link" (click)="reset()">Réinitialiser</button>
      </div>
    </form>
  `,
  styles: [
    `
      :host { display: block; }
      .filter-bar {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        padding: 18px 20px;
        display: grid;
        grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr 1fr auto;
        gap: 14px;
        align-items: end;
        box-shadow: 0 6px 20px -16px rgba(15, 23, 42, 0.18);
      }
      .field { display: flex; flex-direction: column; gap: 5px; }
      .field.grow { min-width: 0; }
      .field label {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #64748b;
      }
      .field input,
      .field select {
        padding: 10px 12px;
        border: 1px solid #e2e8f0;
        border-radius: 9px;
        font-size: 14px;
        background: #fff;
        color: #0f172a;
        transition: border-color 0.15s ease;
      }
      .field input:focus,
      .field select:focus {
        outline: none;
        border-color: #0b6bcb;
        box-shadow: 0 0 0 3px rgba(11, 107, 203, 0.15);
      }
      .actions {
        display: flex;
        flex-direction: column;
        gap: 4px;
        align-items: stretch;
      }
      .btn-primary {
        padding: 11px 18px;
        background: linear-gradient(135deg, #0b6bcb, #084c91);
        border: none;
        color: #fff;
        font-weight: 600;
        border-radius: 9px;
        cursor: pointer;
        transition: transform 0.15s ease, box-shadow 0.2s ease;
      }
      .btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 16px -4px rgba(11, 107, 203, 0.5);
      }
      .btn-link {
        background: none;
        border: none;
        font-size: 12px;
        color: #64748b;
        cursor: pointer;
        text-decoration: underline;
      }
      @media (max-width: 1080px) {
        .filter-bar { grid-template-columns: repeat(4, 1fr); }
        .actions { grid-column: span 4; flex-direction: row; justify-content: flex-end; }
      }
      @media (max-width: 600px) {
        .filter-bar { grid-template-columns: 1fr 1fr; }
        .actions { grid-column: span 2; }
      }
    `,
  ],
})
export class PublicFilterBarComponent implements OnInit {
  @Input() category: 'VENTE' | 'LOCATION' = 'VENTE';
  @Input() initialFilters: PublicSearchFilters = {};
  @Output() search = new EventEmitter<PublicSearchFilters>();

  filters: PublicSearchFilters = {};
  countries: string[] = [];
  cities: string[] = [];
  types: string[] = [];

  private portal = inject(PublicPortalService);

  ngOnInit(): void {
    this.filters = { ...this.initialFilters };
    this.portal.countries().subscribe((c) => (this.countries = c));
    this.portal.types().subscribe((t) => (this.types = t));
    this.refreshCities();
  }

  onCountryChange(): void {
    this.filters.city = '';
    this.refreshCities();
  }

  refreshCities(): void {
    this.portal.cities(this.filters.country).subscribe((c) => (this.cities = c));
  }

  emit(): void {
    this.search.emit(this.cleanFilters());
  }

  reset(): void {
    this.filters = {};
    this.refreshCities();
    this.search.emit({});
  }

  formatType(t: string): string {
    if (!t) return '';
    return t.charAt(0) + t.slice(1).toLowerCase();
  }

  private cleanFilters(): PublicSearchFilters {
    const out: PublicSearchFilters = {};
    Object.entries(this.filters).forEach(([k, v]) => {
      if (v === null || v === undefined || v === '') return;
      (out as any)[k] = v;
    });
    return out;
  }
}
