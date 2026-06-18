import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, finalize } from 'rxjs';
import { PublicPortalService } from '../../services/public-portal.service';
import { PublicPropertyCard, PublicSearchFilters } from '../../models/public-property.model';
import { PublicPropertyCardComponent } from '../../components/property-card.component';
import { PublicFilterBarComponent } from '../../components/filter-bar.component';

type Mode = 'VENTE' | 'LOCATION';

@Component({
  selector: 'app-public-listing',
  standalone: true,
  imports: [CommonModule, PublicPropertyCardComponent, PublicFilterBarComponent],
  template: `
    <section class="listing-hero">
      <div class="container">
        <span class="crumb">Accueil → {{ mode === 'VENTE' ? 'Acheter un bien' : 'Louer un bien' }}</span>
        <h1>{{ mode === 'VENTE' ? 'Biens à vendre' : 'Biens à louer' }}</h1>
        <p class="lead">
          {{ mode === 'VENTE'
            ? 'Découvrez notre sélection de biens à acheter, vérifiés par nos agences partenaires.'
            : 'Trouvez votre prochaine location parmi des centaines d\\'annonces vérifiées.' }}
        </p>
      </div>
    </section>

    <div class="container content">
      <app-public-filter-bar
        [category]="mode"
        [initialFilters]="filters"
        (search)="onSearch($event)">
      </app-public-filter-bar>

      <div class="results-meta">
        <strong>{{ properties.length }}</strong>
        <span>{{ properties.length === 1 ? 'annonce' : 'annonces' }} trouvée{{ properties.length === 1 ? '' : 's' }}</span>
        <div class="sort">
          <label>Trier par</label>
          <select [value]="sort" (change)="onSortChange($event)">
            <option value="recent">Plus récents</option>
            <option value="price-asc">Prix croissant</option>
            <option value="price-desc">Prix décroissant</option>
            <option value="surface-desc">Surface décroissante</option>
          </select>
        </div>
      </div>

      <div class="grid" *ngIf="!loading; else loaderTpl">
        <app-public-property-card *ngFor="let p of sorted()" [property]="p"></app-public-property-card>
        <div class="empty" *ngIf="!properties.length">
          <h3>Aucune annonce ne correspond à votre recherche</h3>
          <p>Essayez d'élargir vos critères ou supprimez certains filtres.</p>
        </div>
      </div>

      <ng-template #loaderTpl>
        <div class="grid">
          <div class="skeleton" *ngFor="let _ of skeletonItems"></div>
        </div>
      </ng-template>
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .container { width: 100%; max-width: 1240px; margin: 0 auto; padding: 0 24px; }

      .listing-hero {
        background: linear-gradient(180deg, #eef2f7 0%, #f8fafc 100%);
        padding: 56px 0 36px;
        border-bottom: 1px solid #e2e8f0;
      }
      .crumb {
        font-size: 13px;
        color: #64748b;
        font-weight: 500;
      }
      .listing-hero h1 {
        font-size: 36px;
        margin: 8px 0 6px;
        color: #0f172a;
        font-weight: 700;
        letter-spacing: -0.02em;
      }
      .lead { color: #475569; max-width: 640px; margin: 0; line-height: 1.6; }

      .content { margin-top: -16px; padding-bottom: 80px; position: relative; z-index: 2; }

      .results-meta {
        display: flex;
        align-items: center;
        gap: 12px;
        margin: 28px 0 18px;
      }
      .results-meta strong {
        font-size: 18px;
        color: #0f172a;
      }
      .results-meta span { color: #64748b; }
      .sort {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .sort label { font-size: 13px; color: #64748b; }
      .sort select {
        padding: 8px 12px;
        border: 1px solid #e2e8f0;
        border-radius: 9px;
        background: #fff;
        font-size: 13px;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 22px;
      }
      .skeleton {
        height: 320px;
        border-radius: 14px;
        background: linear-gradient(90deg, #eef2f7, #f8fafc, #eef2f7);
        background-size: 200% 100%;
        animation: shimmer 1.4s linear infinite;
      }
      @keyframes shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      .empty {
        grid-column: 1 / -1;
        padding: 56px 24px;
        text-align: center;
        background: #fff;
        border-radius: 14px;
        border: 1px dashed #cbd5e1;
      }
      .empty h3 { color: #0f172a; margin: 0 0 6px; }
      .empty p { color: #64748b; margin: 0; }

      @media (max-width: 1024px) {
        .grid { grid-template-columns: repeat(2, 1fr); }
        .listing-hero h1 { font-size: 28px; }
      }
      @media (max-width: 600px) {
        .grid { grid-template-columns: 1fr; }
        .results-meta { flex-wrap: wrap; }
      }
    `,
  ],
})
export class PublicListingComponent implements OnInit, OnDestroy {
  private portal = inject(PublicPortalService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  mode: Mode = 'VENTE';
  filters: PublicSearchFilters = {};
  properties: PublicPropertyCard[] = [];
  loading = true;
  sort: 'recent' | 'price-asc' | 'price-desc' | 'surface-desc' = 'recent';
  skeletonItems = [1, 2, 3, 4, 5, 6];

  private subs: Subscription[] = [];

  ngOnInit(): void {
    this.subs.push(
      this.route.data.subscribe((data) => {
        this.mode = (data['mode'] as Mode) || 'VENTE';
        this.filters = this.parseQueryParams();
        this.fetch();
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  onSearch(filters: PublicSearchFilters): void {
    this.filters = filters;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: filters,
      queryParamsHandling: 'merge',
    });
    this.fetch();
  }

  onSortChange(event: Event): void {
    this.sort = (event.target as HTMLSelectElement).value as any;
  }

  sorted(): PublicPropertyCard[] {
    const arr = [...this.properties];
    const priceOf = (p: PublicPropertyCard) =>
      this.mode === 'LOCATION' ? p.prixLocation || 0 : p.prixVente || 0;
    switch (this.sort) {
      case 'price-asc':
        return arr.sort((a, b) => priceOf(a) - priceOf(b));
      case 'price-desc':
        return arr.sort((a, b) => priceOf(b) - priceOf(a));
      case 'surface-desc':
        return arr.sort((a, b) => (b.surface || 0) - (a.surface || 0));
      default:
        return arr;
    }
  }

  private fetch(): void {
    this.loading = true;
    this.cdr.detectChanges();
    const obs = this.mode === 'LOCATION'
      ? this.portal.listForRent(this.filters)
      : this.portal.listForSale(this.filters);
    this.subs.push(
      obs
        .pipe(finalize(() => { this.loading = false; this.cdr.detectChanges(); }))
        .subscribe({
          next: (res) => { this.properties = res || []; },
          error: () => { this.properties = []; },
        })
    );
  }

  private parseQueryParams(): PublicSearchFilters {
    const qp = this.route.snapshot.queryParamMap;
    const out: PublicSearchFilters = {};
    const str = (k: keyof PublicSearchFilters) => {
      const v = qp.get(k as string);
      if (v) (out as any)[k] = v;
    };
    const num = (k: keyof PublicSearchFilters) => {
      const v = qp.get(k as string);
      if (v && !isNaN(+v)) (out as any)[k] = +v;
    };
    str('q'); str('country'); str('city'); str('type');
    num('minPrice'); num('maxPrice');
    num('minSurface'); num('maxSurface'); num('minRooms');
    return out;
  }
}
