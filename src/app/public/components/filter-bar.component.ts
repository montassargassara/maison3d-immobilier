import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PublicPortalService } from '../services/public-portal.service';
import { PublicSearchFilters } from '../models/public-property.model';

@Component({
  selector: 'app-public-filter-bar',
  standalone: true,
  imports: [FormsModule],
  template: `
    <form class="fb" (ngSubmit)="emit()">

      <!-- ── Recherche générale ────────────────────────────── -->
      <div class="fb-field fb-field--wide">
        <span class="fb-label">Recherche</span>
        <div class="fb-row">
          <svg class="fb-ico" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0
              1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clip-rule="evenodd"/>
          </svg>
          <input
            class="fb-input"
            type="text"
            [(ngModel)]="filters.q"
            name="q"
            placeholder="Titre, ville, quartier…"
          />
        </div>
      </div>

      <!-- ── Pays ─────────────────────────────────────────── -->
      <div class="fb-field">
        <span class="fb-label">Pays</span>
        <div class="fb-row">
          <select class="fb-select" [(ngModel)]="filters.country" name="country" (change)="onCountryChange()">
            <option value="">Tous les pays</option>
            @for (c of countries; track c) {
              <option [value]="c">{{ c }}</option>
            }
          </select>
        </div>
      </div>

      <!-- ── Ville (autocomplete) ──────────────────────────── -->
      <div class="fb-field fb-field--ac">
        <span class="fb-label">Ville</span>
        <div class="fb-row fb-ac-host">
          <svg class="fb-ico" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7
              0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
          </svg>
          <input
            class="fb-input"
            type="text"
            [value]="cityText"
            (input)="onCityInput($event)"
            (focus)="onCityFocus()"
            (blur)="onCityBlur()"
            placeholder="Ex: Sousse, Tunis…"
            name="citySearch"
            autocomplete="off"
          />
          <!-- dropdown suggestions -->
          @if (showCitySuggestions && filteredCities.length > 0) {
            <div class="fb-dropdown">
              @for (c of filteredCities; track c) {
                <button type="button" class="fb-dropdown-item" (mousedown)="selectCity(c)">{{ c }}</button>
              }
            </div>
          }
        </div>
      </div>

      <!-- ── Type de bien ──────────────────────────────────── -->
      <div class="fb-field">
        <span class="fb-label">Type de bien</span>
        <div class="fb-row">
          <select class="fb-select" [(ngModel)]="filters.type" name="type">
            <option value="">Tous</option>
            @for (t of types; track t) {
              <option [value]="t">{{ formatType(t) }}</option>
            }
          </select>
        </div>
      </div>

      <!-- ── Prix min ──────────────────────────────────────── -->
      <div class="fb-field fb-field--sm">
        <span class="fb-label">{{ category === 'LOCATION' ? 'Loyer min' : 'Prix min' }}</span>
        <div class="fb-row">
          <input
            class="fb-input"
            type="number"
            min="0"
            [(ngModel)]="filters.minPrice"
            name="minPrice"
            placeholder="0"
          />
          <span class="fb-unit">TND</span>
        </div>
      </div>

      <!-- ── Prix max ──────────────────────────────────────── -->
      <div class="fb-field fb-field--sm">
        <span class="fb-label">{{ category === 'LOCATION' ? 'Loyer max' : 'Prix max' }}</span>
        <div class="fb-row">
          <input
            class="fb-input"
            type="number"
            min="0"
            [(ngModel)]="filters.maxPrice"
            name="maxPrice"
            placeholder="∞"
          />
          <span class="fb-unit">TND</span>
        </div>
      </div>

      <!-- ── Pièces min ─────────────────────────────────────── -->
      <div class="fb-field fb-field--xs">
        <span class="fb-label">Pièces min</span>
        <div class="fb-row">
          <input
            class="fb-input"
            type="number"
            min="0"
            [(ngModel)]="filters.minRooms"
            name="minRooms"
            placeholder="0"
          />
        </div>
      </div>

      <!-- ── Bouton rechercher ──────────────────────────────── -->
      <div class="fb-actions">
        <button type="submit" class="fb-btn-primary">
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0
              1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clip-rule="evenodd"/>
          </svg>
          Rechercher
        </button>
        <button type="button" class="fb-btn-reset" (click)="reset()">Réinitialiser</button>
      </div>

    </form>
  `,
  styles: [`
    /* ═══════════════════════════════════════════════════════
       DESIGN TOKENS
    ═══════════════════════════════════════════════════════ */
    :host {
      display: block;
      --fb-radius:     14px;
      --fb-border:     #e2e8f0;
      --fb-bg:         #ffffff;
      --fb-shadow:     0 4px 32px -8px rgba(15,23,42,.12);
      --fb-label-fs:   10px;
      --fb-label-col:  #94a3b8;
      --fb-value-fs:   14px;
      --fb-value-col:  #0f172a;
      --fb-ph-col:     #cbd5e1;
      --fb-ico-col:    #94a3b8;
      --fb-hover-bg:   #f8fafc;
      --fb-focus-col:  #0b6bcb;
      --fb-blue:       #0b6bcb;
      --fb-blue-dk:    #084c91;
      --fb-cell-px:    16px;
      --fb-cell-py:    13px;
      --fb-row-h:      22px;   /* height of the input/select row */
    }

    /* ═══════════════════════════════════════════════════════
       FORM CONTAINER — single white card, grid columns
    ═══════════════════════════════════════════════════════ */
    .fb {
      background:   var(--fb-bg);
      border:       1.5px solid var(--fb-border);
      border-radius: var(--fb-radius);
      box-shadow:   var(--fb-shadow);
      display:      grid;
      /* Recherche | Pays | Ville | Type | PrixMin | PrixMax | Pièces | Button */
      grid-template-columns: 1.8fr 0.95fr 0.95fr 0.95fr 0.85fr 0.85fr 0.7fr auto;
      align-items:  stretch;
      position:     relative;
      overflow:     visible; /* never clip the dropdown */
    }

    /* ═══════════════════════════════════════════════════════
       EACH FIELD CELL
    ═══════════════════════════════════════════════════════ */
    .fb-field {
      display:        flex;
      flex-direction: column;
      justify-content: center;
      gap:            5px;
      padding:        var(--fb-cell-py) var(--fb-cell-px);
      border-right:   1.5px solid var(--fb-border);
      cursor:         text;
      transition:     background 0.15s ease;
      min-width:      0;        /* prevent grid blowout */
      position:       relative; /* anchor for dropdown */
    }
    .fb-field:hover       { background: var(--fb-hover-bg); }
    .fb-field:first-child { border-radius: var(--fb-radius) 0 0 var(--fb-radius); }

    /* column width variants */
    .fb-field--wide { flex-basis: auto; }
    .fb-field--sm   { }
    .fb-field--xs   { }

    /* ═══════════════════════════════════════════════════════
       LABEL  (always 1 line, no wrap)
    ═══════════════════════════════════════════════════════ */
    .fb-label {
      display:        block;
      font-size:      var(--fb-label-fs);
      font-weight:    700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color:          var(--fb-label-col);
      white-space:    nowrap;
      overflow:       hidden;
      text-overflow:  ellipsis;
      line-height:    1;
      /* Fixed height so every cell has same label row height */
      height:         12px;
    }

    /* ═══════════════════════════════════════════════════════
       INNER ROW  (icon + input/select + unit)
    ═══════════════════════════════════════════════════════ */
    .fb-row {
      display:     flex;
      align-items: center;
      gap:         6px;
      height:      var(--fb-row-h);
    }

    /* ── Icon ── */
    .fb-ico {
      width:       14px;
      height:      14px;
      color:       var(--fb-ico-col);
      flex-shrink: 0;
    }

    /* ── Inputs ── */
    .fb-input {
      flex:         1 1 0;
      min-width:    0;
      border:       none;
      outline:      none;
      background:   transparent;
      font-size:    var(--fb-value-fs);
      font-weight:  500;
      color:        var(--fb-value-col);
      padding:      0;
      height:       var(--fb-row-h);
      line-height:  var(--fb-row-h);
    }
    .fb-input::placeholder {
      color:       var(--fb-ph-col);
      font-weight: 400;
    }
    /* Remove number arrows */
    .fb-input[type="number"]::-webkit-inner-spin-button,
    .fb-input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; }
    .fb-input[type="number"] { -moz-appearance: textfield; }

    /* ── Selects ── */
    .fb-select {
      flex:              1 1 0;
      min-width:         0;
      border:            none;
      outline:           none;
      background:        transparent;
      font-size:         var(--fb-value-fs);
      font-weight:       500;
      color:             var(--fb-value-col);
      padding:           0 18px 0 0;
      height:            var(--fb-row-h);
      line-height:       var(--fb-row-h);
      cursor:            pointer;
      appearance:        none;
      -webkit-appearance: none;
      /* Custom chevron */
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 20 20' fill='%2394a3b8'%3E%3Cpath fill-rule='evenodd' d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z' clip-rule='evenodd'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 0 center;
    }

    /* ── Unit badge (TND) ── */
    .fb-unit {
      font-size:   11px;
      font-weight: 600;
      color:       var(--fb-ph-col);
      flex-shrink: 0;
    }

    /* ═══════════════════════════════════════════════════════
       AUTOCOMPLETE DROPDOWN
    ═══════════════════════════════════════════════════════ */
    .fb-field--ac { position: relative; }
    .fb-ac-host   { position: relative; }

    .fb-dropdown {
      position:    absolute;
      top:         calc(100% + var(--fb-cell-py) + 6px);
      left:        calc(-1 * var(--fb-cell-px));
      right:       calc(-1 * var(--fb-cell-px));
      background:  #fff;
      border:      1.5px solid var(--fb-border);
      border-radius: 12px;
      box-shadow:  0 12px 36px -8px rgba(15,23,42,.18);
      z-index:     300;
      max-height:  230px;
      overflow-y:  auto;
      padding:     4px;
    }
    .fb-dropdown-item {
      display:       block;
      width:         100%;
      padding:       9px 12px;
      font-size:     13.5px;
      color:         var(--fb-value-col);
      background:    none;
      border:        none;
      text-align:    left;
      cursor:        pointer;
      border-radius: 8px;
      transition:    background 0.1s;
      line-height:   1.4;
    }
    .fb-dropdown-item:hover { background: #f1f5f9; }

    /* ═══════════════════════════════════════════════════════
       ACTIONS  (button column)
    ═══════════════════════════════════════════════════════ */
    .fb-actions {
      display:         flex;
      flex-direction:  column;
      justify-content: center;
      align-items:     stretch;
      gap:             6px;
      padding:         var(--fb-cell-py) var(--fb-cell-px);
      border-radius:   0 var(--fb-radius) var(--fb-radius) 0;
    }

    .fb-btn-primary {
      display:         flex;
      align-items:     center;
      justify-content: center;
      gap:             6px;
      padding:         10px 18px;
      background:      linear-gradient(135deg, var(--fb-blue), var(--fb-blue-dk));
      border:          none;
      color:           #fff;
      font-size:       13.5px;
      font-weight:     700;
      border-radius:   9px;
      cursor:          pointer;
      white-space:     nowrap;
      letter-spacing:  0.01em;
      transition:      transform 0.15s ease, box-shadow 0.2s ease;
    }
    .fb-btn-primary svg {
      width:       14px;
      height:      14px;
      flex-shrink: 0;
    }
    .fb-btn-primary:hover {
      transform:  translateY(-1px);
      box-shadow: 0 6px 20px -4px rgba(11,107,203,.55);
    }
    .fb-btn-primary:active { transform: translateY(0); }

    .fb-btn-reset {
      background:  none;
      border:      none;
      font-size:   11px;
      color:       var(--fb-label-col);
      cursor:      pointer;
      text-align:  center;
      padding:     3px 0;
      transition:  color 0.15s;
      white-space: nowrap;
    }
    .fb-btn-reset:hover { color: #475569; }

    /* ═══════════════════════════════════════════════════════
       FOCUS RING  — outline on the CELL, not the bare input
    ═══════════════════════════════════════════════════════ */
    .fb-field:focus-within {
      background:  #eff6ff;
      border-right-color: var(--fb-focus-col);
      z-index: 1;
    }
    .fb-field:first-child:focus-within {
      border-radius: var(--fb-radius) 0 0 var(--fb-radius);
    }

    /* ═══════════════════════════════════════════════════════
       RESPONSIVE — TABLET  ≤ 1100px
       4 cols × 2 rows  +  button row
    ═══════════════════════════════════════════════════════ */
    @media (max-width: 1100px) {
      .fb {
        grid-template-columns: repeat(4, 1fr);
        border-radius: var(--fb-radius);
        overflow: hidden; /* clean clipping in multi-row mode */
      }

      /* All fields get a bottom border for the 2-row layout */
      .fb-field {
        border-right:  1.5px solid var(--fb-border);
        border-bottom: 1.5px solid var(--fb-border);
      }
      /* Remove right border on 4th column */
      .fb-field:nth-child(4n) { border-right: none; }
      /* First child no longer has special radius in wrapped mode */
      .fb-field:first-child { border-radius: 0; }

      /* Button spans full width */
      .fb-actions {
        grid-column:     1 / -1;
        flex-direction:  row;
        justify-content: flex-end;
        align-items:     center;
        border-top:      1.5px solid var(--fb-border);
        border-radius:   0;
        padding:         12px 16px;
        gap:             12px;
      }
      .fb-btn-primary { padding: 10px 24px; }

      /* Dropdown escapes overflow:hidden */
      .fb-field--ac { overflow: visible; }
      .fb-dropdown {
        top:  calc(100% + 4px);
        left: 0;
        right: 0;
      }

      /* Focus ring in wrapped mode — no left-radius artifact */
      .fb-field:focus-within { border-radius: 0; }
    }

    /* ═══════════════════════════════════════════════════════
       RESPONSIVE — MOBILE  ≤ 640px
       2 cols
    ═══════════════════════════════════════════════════════ */
    @media (max-width: 640px) {
      .fb {
        grid-template-columns: 1fr 1fr;
      }
      .fb-field:nth-child(4n)     { border-right: 1.5px solid var(--fb-border); }
      .fb-field:nth-child(even)   { border-right: none; }
      .fb-actions { padding: 12px; gap: 8px; }
      .fb-btn-primary { flex: 1; justify-content: center; }
    }

    /* ═══════════════════════════════════════════════════════
       RESPONSIVE — SMALL MOBILE  ≤ 420px
       1 col
    ═══════════════════════════════════════════════════════ */
    @media (max-width: 420px) {
      .fb { grid-template-columns: 1fr; }
      .fb-field       { border-right: none; }
      .fb-actions     { flex-direction: column; }
      .fb-btn-primary { width: 100%; }
      .fb-btn-reset   { text-align: left; }
    }
  `],
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
    this.filters.city = value.trim();
    this.filteredCities = this.getFilteredCities(value);
    this.showCitySuggestions = this.filteredCities.length > 0 && value.trim().length > 0;
    console.log('[DEBUG FilterBar] Ville saisie :', JSON.stringify(value), '| filters.city :', JSON.stringify(this.filters.city));
  }

  onCityFocus(): void {
    if (this.cityText.trim().length > 0) {
      this.filteredCities = this.getFilteredCities(this.cityText);
      this.showCitySuggestions = this.filteredCities.length > 0;
    }
  }

  onCityBlur(): void {
    setTimeout(() => { this.showCitySuggestions = false; }, 180);
  }

  selectCity(city: string): void {
    this.cityText = city;
    this.filters.city = city;
    this.showCitySuggestions = false;
    console.log('[DEBUG FilterBar] Suggestion sélectionnée :', JSON.stringify(city));
  }

  emit(): void {
    this.filters.city = this.cityText.trim() || undefined;
    this.showCitySuggestions = false;
    const cleaned = this.cleanFilters();
    console.log('[DEBUG FilterBar] === RECHERCHER cliqué ===');
    console.log('[DEBUG FilterBar] cityText :', JSON.stringify(this.cityText));
    console.log('[DEBUG FilterBar] Filtres envoyés :', JSON.stringify(cleaned));
    this.search.emit(cleaned);
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
