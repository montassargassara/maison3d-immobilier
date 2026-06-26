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

      <div class="field autocomplete-wrap">
        <label>Ville</label>
        <div class="autocomplete-container">
          <input
            type="text"
            [value]="cityText"
            (input)="onCityInput($event)"
            (focus)="onCityFocus()"
            (blur)="onCityBlur()"
            placeholder="Ex: Sousse, Tunis…"
            name="citySearch"
            autocomplete="off"
          />
          <div class="autocomplete-dropdown" *ngIf="showCitySuggestions && filteredCities.length > 0">
            <div
              class="autocomplete-item"
              *ngFor="let city of filteredCities"
              (mousedown)="selectCity(city)"
            >{{ city }}</div>
          </div>
        </div>
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

      /* Autocomplete */
      .autocomplete-wrap { position: relative; }
      .autocomplete-container { position: relative; }
      .autocomplete-dropdown {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        right: 0;
        background: #fff;
        border: 1px solid #cbd5e1;
        border-radius: 9px;
        box-shadow: 0 8px 24px -8px rgba(15, 23, 42, 0.2);
        z-index: 100;
        max-height: 200px;
        overflow-y: auto;
      }
      .autocomplete-item {
        padding: 9px 12px;
        font-size: 14px;
        color: #0f172a;
        cursor: pointer;
        transition: background 0.1s ease;
      }
      .autocomplete-item:hover {
        background: #f1f5f9;
      }
      .autocomplete-item:first-child { border-radius: 9px 9px 0 0; }
      .autocomplete-item:last-child  { border-radius: 0 0 9px 9px; }

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
  filteredCities: string[] = [];
  types: string[] = [];

  cityText = '';
  showCitySuggestions = false;

  private portal = inject(PublicPortalService);

  ngOnInit(): void {
    this.filters = { ...this.initialFilters };
    this.cityText = this.filters.city ?? '';
    this.portal.countries().subscribe((c) => (this.countries = c));
    this.portal.types().subscribe((t) => (this.types = t));
    this.refreshCities();
  }

  onCountryChange(): void {
    this.filters.city = '';
    this.cityText = '';
    this.filteredCities = [];
    this.showCitySuggestions = false;
    this.refreshCities();
  }

  refreshCities(): void {
    this.portal.cities(this.filters.country).subscribe((c) => {
      this.cities = c;
      this.filteredCities = this.getFilteredCities(this.cityText);
    });
  }

  onCityInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.cityText = value;
    // Keep whatever the user typed as the city filter — backend does partial matching
    this.filters.city = value.trim();
    this.filteredCities = this.getFilteredCities(value);
    this.showCitySuggestions = this.filteredCities.length > 0 && value.trim().length > 0;
  }

  onCityFocus(): void {
    if (this.cityText.trim().length > 0) {
      this.filteredCities = this.getFilteredCities(this.cityText);
      this.showCitySuggestions = this.filteredCities.length > 0;
    }
  }

  onCityBlur(): void {
    // Small delay so mousedown on a suggestion fires first
    setTimeout(() => { this.showCitySuggestions = false; }, 180);
  }

  selectCity(city: string): void {
    this.cityText = city;
    this.filters.city = city;
    this.showCitySuggestions = false;
  }

  emit(): void {
    // Commit whatever text is in the city input before emitting
    this.filters.city = this.cityText.trim() || undefined;
    this.showCitySuggestions = false;
    this.search.emit(this.cleanFilters());
  }

  reset(): void {
    this.filters = {};
    this.cityText = '';
    this.filteredCities = [];
    this.showCitySuggestions = false;
    this.refreshCities();
    this.search.emit({});
  }

  formatType(t: string): string {
    if (!t) return '';
    return t.charAt(0) + t.slice(1).toLowerCase();
  }

  private getFilteredCities(text: string): string[] {
    if (!text || !text.trim()) return this.cities.slice(0, 10);
    const needle = this.normalize(text.trim());
    return this.cities.filter(c => this.normalize(c).includes(needle));
  }

  /** Lowercase + strip diacritics for accent-insensitive matching. */
  private normalize(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
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
