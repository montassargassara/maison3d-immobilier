import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription, finalize } from 'rxjs';
import { PublicPortalService } from '../../services/public-portal.service';
import { PublicPropertyCard } from '../../models/public-property.model';
import { PublicPropertyCardComponent } from '../../components/property-card.component';

@Component({
  selector: 'app-public-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PublicPropertyCardComponent],
  template: `
    <section class="hero">
      <div class="container hero-inner">
        <div class="hero-text">
          <span class="eyebrow">Marketplace immobilière premium</span>
          <h1>Trouvez le bien qui vous correspond, en toute confiance.</h1>
          <p class="lead">
            Annonces vérifiées, visites 3D immersives et accompagnement par un
            réseau d'agences certifiées partout en Tunisie et au-delà.
          </p>

          <div class="hero-search">
            <div class="tabs">
              <button type="button" [class.active]="mode === 'VENTE'" (click)="mode = 'VENTE'">Acheter</button>
              <button type="button" [class.active]="mode === 'LOCATION'" (click)="mode = 'LOCATION'">Louer</button>
            </div>
            <form (ngSubmit)="goSearch()" class="search-fields">
              <div class="field">
                <label>Localisation</label>
                <input [(ngModel)]="city" name="city" placeholder="Ville, quartier…" />
              </div>
              <div class="field">
                <label>Type de bien</label>
                <select [(ngModel)]="type" name="type">
                  <option value="">Tous</option>
                  <option *ngFor="let t of types" [value]="t">{{ formatType(t) }}</option>
                </select>
              </div>
              <div class="field small">
                <label>Budget max</label>
                <input type="number" [(ngModel)]="maxPrice" name="maxPrice" placeholder="∞" />
              </div>
              <button type="submit" class="btn-primary">Rechercher</button>
            </form>
          </div>

          <div class="trust-row">
            <div><strong>{{ totalListings || '—' }}</strong><span>Annonces actives</span></div>
            <div><strong>3D</strong><span>Visites premium</span></div>
            <div><strong>100%</strong><span>Annonces vérifiées</span></div>
          </div>
        </div>
        <div class="hero-art" aria-hidden="true">
          <div class="floating card-1"></div>
          <div class="floating card-2"></div>
          <div class="floating card-3"></div>
        </div>
      </div>
    </section>

    <section class="container section">
      <header class="section-head">
        <div>
          <h2>À vendre</h2>
          <p>Sélection des dernières opportunités d'achat.</p>
        </div>
        <a class="see-all" routerLink="/biens/vente">Voir tout →</a>
      </header>
      <div class="grid" *ngIf="!loadingSale; else loaderTpl">
        <app-public-property-card *ngFor="let p of saleFeatured" [property]="p"></app-public-property-card>
        <div class="empty" *ngIf="!saleFeatured.length">Aucune annonce de vente disponible pour le moment.</div>
      </div>
    </section>

    <section class="container section">
      <header class="section-head">
        <div>
          <h2>À louer</h2>
          <p>Les biens les plus récents disponibles à la location.</p>
        </div>
        <a class="see-all" routerLink="/biens/location">Voir tout →</a>
      </header>
      <div class="grid" *ngIf="!loadingRent; else loaderTpl">
        <app-public-property-card *ngFor="let p of rentFeatured" [property]="p"></app-public-property-card>
        <div class="empty" *ngIf="!rentFeatured.length">Aucune annonce de location disponible pour le moment.</div>
      </div>
    </section>

    <section class="container section value-prop">
      <div class="vp-card">
        <div class="vp-icon">3D</div>
        <h3>Visite 3D immersive</h3>
        <p>Explorez chaque bien comme si vous y étiez, depuis votre canapé.</p>
      </div>
      <div class="vp-card">
        <div class="vp-icon">✓</div>
        <h3>Annonces vérifiées</h3>
        <p>Chaque bien est publié par une agence certifiée et validé par nos équipes.</p>
      </div>
      <div class="vp-card">
        <div class="vp-icon">★</div>
        <h3>Accompagnement premium</h3>
        <p>Des conseillers à vos côtés, de la première visite à la signature.</p>
      </div>
    </section>

    <ng-template #loaderTpl>
      <div class="grid">
        <div class="skeleton" *ngFor="let _ of [1,2,3,4]"></div>
      </div>
    </ng-template>
  `,
  styles: [
    `
      :host { display: block; }
      .container { width: 100%; max-width: 1240px; margin: 0 auto; padding: 0 24px; }

      .hero {
        background:
          radial-gradient(1200px 600px at 80% -10%, rgba(11, 107, 203, 0.12), transparent 60%),
          radial-gradient(800px 400px at 0% 100%, rgba(245, 158, 11, 0.1), transparent 60%),
          linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%);
        padding: 72px 0 56px;
        position: relative;
        overflow: hidden;
      }
      .hero-inner {
        display: grid;
        grid-template-columns: 1.2fr 0.8fr;
        gap: 48px;
        align-items: center;
      }
      .eyebrow {
        display: inline-block;
        padding: 5px 12px;
        background: rgba(11, 107, 203, 0.1);
        color: #0b6bcb;
        font-size: 12px;
        font-weight: 600;
        border-radius: 999px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 18px;
      }
      h1 {
        font-size: 48px;
        line-height: 1.1;
        margin: 0 0 18px;
        color: #0f172a;
        letter-spacing: -0.02em;
        font-weight: 700;
      }
      .lead { font-size: 17px; color: #475569; max-width: 560px; line-height: 1.6; }

      .hero-search {
        margin-top: 28px;
        background: #fff;
        border-radius: 18px;
        padding: 8px 8px 16px;
        box-shadow: 0 18px 48px -16px rgba(15, 23, 42, 0.18);
        border: 1px solid #e2e8f0;
      }
      .tabs {
        display: flex;
        gap: 6px;
        padding: 6px;
        background: #f1f5f9;
        border-radius: 12px;
        width: max-content;
        margin: 4px 4px 12px;
      }
      .tabs button {
        border: none;
        background: transparent;
        padding: 8px 18px;
        font-weight: 600;
        font-size: 14px;
        color: #64748b;
        border-radius: 8px;
        cursor: pointer;
      }
      .tabs button.active {
        background: #fff;
        color: #0b6bcb;
        box-shadow: 0 2px 6px rgba(15, 23, 42, 0.06);
      }
      .search-fields {
        display: grid;
        grid-template-columns: 1.4fr 1fr 0.8fr auto;
        gap: 8px;
        padding: 0 8px;
        align-items: end;
      }
      .field { display: flex; flex-direction: column; gap: 4px; }
      .field label {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #64748b;
        padding-left: 2px;
      }
      .field input, .field select {
        padding: 12px 14px;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        font-size: 14px;
      }
      .field input:focus, .field select:focus {
        outline: none;
        border-color: #0b6bcb;
        box-shadow: 0 0 0 3px rgba(11, 107, 203, 0.15);
      }
      .btn-primary {
        padding: 13px 22px;
        background: linear-gradient(135deg, #0b6bcb, #084c91);
        border: none;
        color: #fff;
        font-weight: 600;
        border-radius: 10px;
        cursor: pointer;
        transition: transform 0.15s ease, box-shadow 0.2s ease;
      }
      .btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 8px 22px -6px rgba(11, 107, 203, 0.5);
      }

      .trust-row {
        display: flex;
        gap: 36px;
        margin-top: 32px;
      }
      .trust-row > div { display: flex; flex-direction: column; }
      .trust-row strong {
        font-size: 24px;
        color: #0f172a;
        font-weight: 700;
      }
      .trust-row span { font-size: 13px; color: #64748b; }

      .hero-art {
        position: relative;
        height: 460px;
      }
      .floating {
        position: absolute;
        border-radius: 20px;
        background: linear-gradient(135deg, #cbd5e1, #e2e8f0);
        box-shadow: 0 20px 50px -16px rgba(15, 23, 42, 0.25);
      }
      .card-1 { top: 0; right: 40px; width: 280px; height: 200px; background: linear-gradient(135deg, #0b6bcb, #084c91); }
      .card-2 { top: 140px; right: 0; width: 240px; height: 180px; background: linear-gradient(135deg, #f59e0b, #ea580c); }
      .card-3 { top: 270px; right: 80px; width: 260px; height: 170px; background: linear-gradient(135deg, #10b981, #059669); }

      .section { margin-top: 72px; }
      .section-head {
        display: flex;
        justify-content: space-between;
        align-items: end;
        margin-bottom: 24px;
      }
      .section-head h2 {
        font-size: 28px;
        margin: 0 0 4px;
        color: #0f172a;
        font-weight: 700;
        letter-spacing: -0.01em;
      }
      .section-head p { color: #64748b; margin: 0; }
      .see-all {
        text-decoration: none;
        color: #0b6bcb;
        font-weight: 600;
        font-size: 14px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 22px;
      }
      .empty {
        grid-column: 1 / -1;
        padding: 36px;
        text-align: center;
        color: #64748b;
        background: #fff;
        border-radius: 14px;
        border: 1px dashed #cbd5e1;
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

      .value-prop {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 22px;
      }
      .vp-card {
        background: #fff;
        padding: 28px;
        border-radius: 14px;
        border: 1px solid #e2e8f0;
      }
      .vp-icon {
        width: 44px; height: 44px;
        border-radius: 12px;
        background: linear-gradient(135deg, #0b6bcb, #084c91);
        color: #fff;
        display: flex; align-items: center; justify-content: center;
        font-weight: 700;
        margin-bottom: 14px;
      }
      .vp-card h3 { font-size: 18px; margin: 0 0 6px; color: #0f172a; }
      .vp-card p { color: #64748b; margin: 0; line-height: 1.6; }

      @media (max-width: 1024px) {
        .hero-inner { grid-template-columns: 1fr; }
        .hero-art { display: none; }
        .grid { grid-template-columns: repeat(2, 1fr); }
        .value-prop { grid-template-columns: 1fr; }
        h1 { font-size: 36px; }
      }
      @media (max-width: 600px) {
        .search-fields { grid-template-columns: 1fr 1fr; }
        .search-fields .btn-primary { grid-column: span 2; }
        .grid { grid-template-columns: 1fr; }
        .trust-row { gap: 20px; flex-wrap: wrap; }
      }
    `,
  ],
})
export class PublicHomeComponent implements OnInit, OnDestroy {
  private portal = inject(PublicPortalService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  saleFeatured: PublicPropertyCard[] = [];
  rentFeatured: PublicPropertyCard[] = [];
  loadingSale = true;
  loadingRent = true;
  totalListings = 0;
  types: string[] = [];

  mode: 'VENTE' | 'LOCATION' = 'VENTE';
  city = '';
  type = '';
  maxPrice?: number;

  private subs: Subscription[] = [];

  ngOnInit(): void {
    this.subs.push(
      this.portal.featuredVente(8)
        .pipe(finalize(() => { this.loadingSale = false; this.cdr.detectChanges(); }))
        .subscribe({
          next: (res) => { this.saleFeatured = res || []; this.totalListings += this.saleFeatured.length; },
          error: () => { this.saleFeatured = []; },
        })
    );
    this.subs.push(
      this.portal.featuredLocation(8)
        .pipe(finalize(() => { this.loadingRent = false; this.cdr.detectChanges(); }))
        .subscribe({
          next: (res) => { this.rentFeatured = res || []; this.totalListings += this.rentFeatured.length; },
          error: () => { this.rentFeatured = []; },
        })
    );
    this.subs.push(
      this.portal.types().subscribe({
        next: (t) => { this.types = t || []; this.cdr.detectChanges(); },
        error: () => { this.types = []; },
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  goSearch(): void {
    const path = this.mode === 'LOCATION' ? '/biens/location' : '/biens/vente';
    const queryParams: Record<string, any> = {};
    if (this.city) queryParams['city'] = this.city;
    if (this.type) queryParams['type'] = this.type;
    if (this.maxPrice) queryParams['maxPrice'] = this.maxPrice;
    this.router.navigate([path], { queryParams });
  }

  formatType(t: string): string {
    if (!t) return '';
    return t.charAt(0) + t.slice(1).toLowerCase();
  }
}
