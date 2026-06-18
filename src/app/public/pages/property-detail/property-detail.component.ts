import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subscription, finalize } from 'rxjs';
import { PublicPortalService } from '../../services/public-portal.service';
import { PublicPropertyCard, PublicPropertyDetail } from '../../models/public-property.model';
import { PublicPropertyCardComponent } from '../../components/property-card.component';
import { ClientAuthService } from '../../services/client-auth.service';
import { InterestModalComponent } from '../../components/interest-modal/interest-modal.component';
import { AgencyInfoCardComponent } from '../../components/agency-info-card/agency-info-card.component';
import { ModelViewerComponent } from '../../../components/model-viewer/model-viewer.component';
import { SplatViewerComponent } from '../../components/splat-viewer/splat-viewer.component';
import { VirtualTourDTO, VirtualTourService } from '../../../admin/services/virtual-tour.service';
import { VirtualTourViewerComponent } from '../../../admin/virtual-tour-viewer/virtual-tour-viewer.component';

@Component({
  selector: 'app-public-property-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, PublicPropertyCardComponent, InterestModalComponent, ModelViewerComponent, SplatViewerComponent, VirtualTourViewerComponent, AgencyInfoCardComponent],
  template: `
    <ng-container *ngIf="!loading && property; else loaderTpl">
      <section class="hero">
        <div class="container">
          <nav class="crumbs">
            <a routerLink="/">Accueil</a> ›
            <a [routerLink]="property.category === 'LOCATION' ? '/biens/location' : '/biens/vente'">
              {{ property.category === 'LOCATION' ? 'Locations' : 'Ventes' }}
            </a> ›
            <span>{{ property.titre }}</span>
          </nav>
          <div class="head">
            <div>
              <span class="badge" [class.rent]="property.category === 'LOCATION'">
                {{ property.category === 'LOCATION' ? 'À louer' : 'À vendre' }}
              </span>
              <h1>{{ property.titre }}</h1>
              <div class="loc">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                <span>{{ locationLabel() }}</span>
              </div>
            </div>
            <div class="price-block">
              <div class="price">{{ priceLabel() }}</div>
              <div class="price-meta" *ngIf="pricePerSqm()">{{ pricePerSqm() }} TND/m²</div>
            </div>
          </div>
        </div>
      </section>

      <section class="container gallery-wrap">
        <div class="gallery" [class.single]="(property.imageUrls?.length || 0) <= 1">
          <div class="main-img">
            <img *ngIf="activeImage()" [src]="activeImage()" [alt]="property.titre" />
            <div class="img-fallback" *ngIf="!activeImage()">
              <span>{{ property.titre.slice(0, 2).toUpperCase() }}</span>
            </div>
            <span class="tridi-badge" *ngIf="property.hasModel3d">Visite 3D disponible</span>
          </div>
          <div class="thumbs" *ngIf="(property.imageUrls?.length || 0) > 1">
            <button
              type="button"
              *ngFor="let url of property.imageUrls; let i = index"
              [class.active]="i === activeImageIdx"
              (click)="activeImageIdx = i">
              <img [src]="resolve(url)" [alt]="'Photo ' + (i + 1)" />
            </button>
          </div>
        </div>
      </section>

      <section class="container body">
        <div class="main-col">
          <div class="quick-facts">
            <div *ngIf="property.surface">
              <i class="fas fa-ruler-combined qf-icon"></i>
              <span class="label">Surface</span>
              <strong>{{ property.surface }} m²</strong>
            </div>
            <div *ngIf="property.nbChambres">
              <i class="fas fa-bed qf-icon"></i>
              <span class="label">Chambres</span>
              <strong>{{ property.nbChambres }}</strong>
            </div>
            <div *ngIf="property.nbSallesDeBain">
              <i class="fas fa-shower qf-icon"></i>
              <span class="label">Salles de bain</span>
              <strong>{{ property.nbSallesDeBain }}</strong>
            </div>
            <div *ngIf="property.etage != null && property.etage! > 0">
              <i class="fas fa-building qf-icon"></i>
              <span class="label">Étage</span>
              <strong>{{ property.etage }}</strong>
            </div>
            <div *ngIf="property.parkingSpaces && property.parkingSpaces > 0">
              <i class="fas fa-square-parking qf-icon"></i>
              <span class="label">Parking</span>
              <strong>{{ property.parkingSpaces }} place{{ property.parkingSpaces > 1 ? 's' : '' }}</strong>
            </div>
            <div *ngIf="property.anneeConstruction">
              <i class="fas fa-calendar-check qf-icon"></i>
              <span class="label">Construction</span>
              <strong>{{ property.anneeConstruction }}</strong>
            </div>
            <div *ngIf="property.type">
              <i class="fas fa-home qf-icon"></i>
              <span class="label">Type</span>
              <strong>{{ formatType(property.type) }}</strong>
            </div>
            <div *ngIf="property.statut">
              <i class="fas fa-tag qf-icon"></i>
              <span class="label">Statut</span>
              <strong>{{ formatStatus(property.statut) }}</strong>
            </div>
          </div>

          <!-- Amenity pills -->
          <div class="section-block amenities-panel" *ngIf="hasAmenities()">
            <h2>Équipements &amp; atouts</h2>
            <div class="amenity-pills">
              <span class="a-pill" *ngIf="property.garage">
                <i class="fas fa-car"></i> Garage
              </span>
              <span class="a-pill" *ngIf="property.piscine">
                <i class="fas fa-swimming-pool"></i> Piscine
              </span>
              <span class="a-pill" *ngIf="property.jardin">
                <i class="fas fa-tree"></i> Jardin
              </span>
              <span class="a-pill" *ngIf="property.meuble">
                <i class="fas fa-couch"></i> Meublé
              </span>
              <span class="a-pill" *ngIf="property.climatisation">
                <i class="fas fa-snowflake"></i> Climatisation
              </span>
              <span class="a-pill" *ngIf="property.securite">
                <i class="fas fa-shield-halved"></i> Système de sécurité
              </span>
              <span class="a-pill" *ngIf="property.prochePlage">
                <i class="fas fa-umbrella-beach"></i> Proche plage
              </span>
              <span class="a-pill" *ngIf="property.procheTransport">
                <i class="fas fa-bus"></i> Proche transports
              </span>
            </div>
          </div>

          <article class="section-block" *ngIf="property.description">
            <h2>Description</h2>
            <p class="description">{{ property.description }}</p>
          </article>

          <div class="section-block immersive" *ngIf="hasImmersive()">
            <h2>Expérience immersive</h2>
            <p class="muted">Découvrez ce bien comme si vous y étiez.</p>

            <div class="immersive-grid" [class.single]="!property.hasVideo || !property.hasModel3d">
              <div class="immersive-card video" *ngIf="property.hasVideo && property.mainVideoUrl">
                <div class="im-head">
                  <span class="im-icon">▶</span>
                  <div>
                    <strong>Vidéo de présentation</strong>
                    <span class="im-sub">Visite guidée filmée</span>
                  </div>
                </div>
                <div class="video-frame">
                  <video controls preload="metadata" [poster]="resolve(property.mainImageUrl)">
                    <source [src]="resolve(property.mainVideoUrl)" />
                    Votre navigateur ne supporte pas la lecture vidéo.
                  </video>
                </div>
              </div>

              <!-- ═══════════════════════════════════════════════
                   GAUSSIAN SPLAT VIEWER — photoréaliste ksplat/splat
                   ═══════════════════════════════════════════════ -->
              <div class="immersive-card tridi" *ngIf="property.hasModel3d && property.model3dUrl && isSplatModel()">
                <div class="im-head">
                  <div class="im-icon-3d">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                      <circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                  </div>
                  <div>
                    <strong>Visite 3D Photoréaliste</strong>
                    <span class="im-sub">Gaussian Splatting · Orbite · Zoom · Exploration libre</span>
                  </div>
                </div>
                <app-splat-viewer
                  [modelUrl]="resolve(property.model3dUrl)"
                  [format]="property.model3dFormat || 'ksplat'"
                  height="480px">
                </app-splat-viewer>
              </div>

              <!-- ═══════════════════════════════════════════════
                   MESH VIEWER — Three.js GLB/GLTF/OBJ/FBX
                   ═══════════════════════════════════════════════ -->
              <div class="immersive-card tridi" *ngIf="property.hasModel3d && property.model3dUrl && !isSplatModel()">
                <div class="im-head">
                  <div class="im-icon-3d">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    </svg>
                  </div>
                  <div>
                    <strong>Visite 3D Interactive</strong>
                    <span class="im-sub">Rotation · Zoom · Exploration libre · GLB, GLTF, OBJ, FBX</span>
                  </div>
                </div>
                <app-model-viewer
                  [src]="resolve(property.model3dUrl)"
                  [format]="property.model3dFormat || undefined"
                  [autoRotate]="true"
                  height="480px">
                </app-model-viewer>
              </div>
            </div>

            <!-- ── Virtual Tour ── -->
            <div class="vt-public-wrap" *ngIf="virtualTour?.status === 'COMPLETED'">
              <div class="im-head">
                <div class="im-icon-vr">
                  <i class="fas fa-vr-cardboard"></i>
                </div>
                <div>
                  <strong>Visite Virtuelle 360°</strong>
                  <span class="im-sub">{{ virtualTour!.sceneCount }} scènes · Navigation interactive · Plein écran · Mobile</span>
                </div>
              </div>
              <app-virtual-tour-viewer [tour]="virtualTour!"></app-virtual-tour-viewer>
            </div>

          </div>

          <div class="section-block" *ngIf="hasMap()">
            <h2>Localisation</h2>
            <div class="map-frame">
              <iframe
                [src]="mapSrc()"
                width="100%"
                height="320"
                style="border:0"
                loading="lazy"
                referrerpolicy="no-referrer-when-downgrade"
                title="Localisation du bien">
              </iframe>
            </div>
            <p class="address" *ngIf="property.adresse">{{ property.adresse }}</p>
          </div>
        </div>

        <aside class="sidebar">
          <app-agency-info-card
            [agency]="property.agency"
            [showCta]="true"
            [isLoggedIn]="isLoggedIn()"
            (ctaClick)="onInterested()">
          </app-agency-info-card>
        </aside>
      </section>

      <section class="container similar" *ngIf="similar.length">
        <header>
          <h2>Biens similaires</h2>
          <p>Sélection de biens qui pourraient également vous intéresser.</p>
        </header>
        <div class="grid">
          <app-public-property-card *ngFor="let p of similar" [property]="p"></app-public-property-card>
        </div>
      </section>
    </ng-container>

    <app-interest-modal
      *ngIf="interestOpen && property"
      [propertyId]="property.id"
      [propertyTitle]="property.titre"
      [propertyPrice]="property.category === 'LOCATION' ? (property.prixLocation ?? null) : (property.prixVente ?? null)"
      (closed)="onInterestClosed($event)">
    </app-interest-modal>

    <ng-template #loaderTpl>
      <div class="container loading-wrap">
        <div class="skeleton-hero"></div>
        <div class="skeleton-block"></div>
      </div>
    </ng-template>
  `,
  styles: [
    `
      :host { display: block; }
      .container { width: 100%; max-width: 1240px; margin: 0 auto; padding: 0 24px; }

      .hero {
        background: linear-gradient(180deg, #eef2f7 0%, #f8fafc 100%);
        padding: 32px 0 28px;
        border-bottom: 1px solid #e2e8f0;
      }
      .crumbs {
        font-size: 13px;
        color: #64748b;
        margin-bottom: 12px;
      }
      .crumbs a { color: #0b6bcb; text-decoration: none; }
      .head {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: 20px;
        flex-wrap: wrap;
      }
      .badge {
        display: inline-block;
        padding: 5px 12px;
        background: #0b6bcb;
        color: #fff;
        font-size: 12px;
        font-weight: 600;
        border-radius: 999px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 12px;
      }
      .badge.rent { background: #10b981; }
      h1 {
        font-size: 32px;
        margin: 0 0 8px;
        color: #0f172a;
        font-weight: 700;
        letter-spacing: -0.01em;
      }
      .loc {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #475569;
        font-size: 15px;
      }
      .price-block { text-align: right; }
      .price {
        font-size: 30px;
        font-weight: 700;
        color: #0b6bcb;
      }
      .price-meta { color: #64748b; font-size: 13px; margin-top: 2px; }

      .gallery-wrap { margin-top: 28px; }
      .gallery {
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
      }
      .main-img {
        position: relative;
        aspect-ratio: 16 / 9;
        max-height: 520px;
        border-radius: 18px;
        overflow: hidden;
        background: #f1f5f9;
      }
      .main-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .img-fallback {
        position: absolute; inset: 0;
        display: flex; align-items: center; justify-content: center;
        background: linear-gradient(135deg, #cbd5e1, #94a3b8);
        color: #fff; font-size: 56px; font-weight: 700;
      }
      .tridi-badge {
        position: absolute;
        top: 16px; right: 16px;
        padding: 7px 14px;
        background: rgba(245, 158, 11, 0.95);
        color: #fff;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 600;
      }
      .thumbs {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
        gap: 8px;
      }
      .thumbs button {
        border: 2px solid transparent;
        padding: 0;
        border-radius: 10px;
        overflow: hidden;
        cursor: pointer;
        background: none;
        aspect-ratio: 4 / 3;
      }
      .thumbs button.active { border-color: #0b6bcb; }
      .thumbs img { width: 100%; height: 100%; object-fit: cover; display: block; }

      .body {
        margin-top: 32px;
        display: grid;
        grid-template-columns: 1fr 360px;
        gap: 32px;
        align-items: start;
        padding-bottom: 60px;
      }
      .quick-facts {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 12px;
        background: #fff;
        padding: 20px;
        border-radius: 14px;
        border: 1px solid #e2e8f0;
      }
      .quick-facts > div { display: flex; flex-direction: column; gap: 4px; }
      .quick-facts .label {
        font-size: 11px;
        color: #64748b;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .quick-facts strong {
        font-size: 17px;
        color: #0f172a;
      }
      .qf-icon {
        font-size: 13px;
        color: #0b6bcb;
        margin-bottom: 2px;
      }

      /* Amenity pills */
      .amenities-panel h2 { font-size: 20px; margin: 0 0 14px; color: #0f172a; }
      .amenity-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .a-pill {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 8px 16px;
        background: #f0f4ff;
        color: #3730a3;
        border: 1px solid #c7d2fe;
        border-radius: 999px;
        font-size: 13px;
        font-weight: 600;
        i { font-size: 12px; color: #4f46e5; }
      }
      .section-block {
        margin-top: 28px;
      }
      .section-block h2 {
        font-size: 20px;
        margin: 0 0 12px;
        color: #0f172a;
      }
      .description {
        color: #334155;
        line-height: 1.75;
        white-space: pre-line;
      }
      .map-frame {
        border-radius: 14px;
        overflow: hidden;
        border: 1px solid #e2e8f0;
      }
      .address { color: #64748b; font-size: 14px; margin-top: 10px; }

      .sidebar { position: sticky; top: 92px; }

      .immersive .muted { color: #64748b; margin: 0 0 16px; font-size: 14px; }
      .immersive-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }
      .immersive-grid.single { grid-template-columns: 1fr; }
      .immersive-card {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        padding: 18px;
      }
      .im-head {
        display: flex; align-items: center; gap: 12px; margin-bottom: 12px;
      }
      .im-icon {
        width: 38px; height: 38px; border-radius: 10px;
        display: inline-flex; align-items: center; justify-content: center;
        background: linear-gradient(135deg, #0b6bcb, #084c91);
        color: #fff; font-weight: 700; font-size: 13px;
      }
      .immersive-card.tridi .im-icon {
        background: linear-gradient(135deg, #f59e0b, #ea580c);
      }
      .im-head strong { display: block; color: #0f172a; font-size: 15px; }
      .im-sub { color: #64748b; font-size: 12px; }
      .video-frame {
        border-radius: 12px; overflow: hidden;
        background: #0f172a; aspect-ratio: 16 / 9;
      }
      .video-frame video { width: 100%; height: 100%; display: block; }
      /* app-model-viewer fills the card naturally */
      .immersive-card.tridi app-model-viewer { display: block; }
      .im-actions { margin-top: 10px; text-align: right; }
      .btn-link {
        color: #0b6bcb; text-decoration: none; font-weight: 600; font-size: 13px;
      }
      .btn-link:hover { text-decoration: underline; }

      .similar { margin: 56px auto 80px; }
      .similar header { margin-bottom: 22px; }
      .similar h2 {
        font-size: 24px;
        margin: 0 0 4px;
        color: #0f172a;
      }
      .similar p { color: #64748b; margin: 0; }
      .grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 22px;
      }

      .loading-wrap { padding: 56px 24px; }
      .skeleton-hero {
        height: 380px;
        border-radius: 18px;
        background: linear-gradient(90deg, #eef2f7, #f8fafc, #eef2f7);
        background-size: 200% 100%;
        animation: shimmer 1.4s linear infinite;
      }
      .skeleton-block {
        height: 240px;
        border-radius: 14px;
        margin-top: 24px;
        background: linear-gradient(90deg, #eef2f7, #f8fafc, #eef2f7);
        background-size: 200% 100%;
        animation: shimmer 1.4s linear infinite;
      }
      @keyframes shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }

      @media (max-width: 1024px) {
        .body { grid-template-columns: 1fr; }
        .sidebar { position: static; }
        .grid { grid-template-columns: repeat(2, 1fr); }
      }
      @media (max-width: 1024px) {
        .immersive-grid { grid-template-columns: 1fr; }
      }
      /* ─── 3D card icon ─── */
      .im-icon-3d {
        width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
        display: inline-flex; align-items: center; justify-content: center;
        background: linear-gradient(135deg, #6366f1, #4338ca);
        color: #fff;
      }

      @media (max-width: 600px) {
        .quick-facts { grid-template-columns: 1fr 1fr; }
        .grid { grid-template-columns: 1fr; }
        .head { flex-direction: column; align-items: flex-start; }
        .price-block { text-align: left; }
        h1 { font-size: 24px; }
      }
    `,
  ],
})
export class PublicPropertyDetailComponent implements OnInit, OnDestroy {
  private portal = inject(PublicPortalService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);
  private cdr = inject(ChangeDetectorRef);
  private clientAuth = inject(ClientAuthService);
  private tourService = inject(VirtualTourService);

  property: PublicPropertyDetail | null = null;
  similar: PublicPropertyCard[] = [];
  virtualTour: VirtualTourDTO | null = null;
  loading = true;
  activeImageIdx = 0;
  interestOpen = false;
  private subs: Subscription[] = [];

  ngOnInit(): void {
    this.subs.push(
      this.route.paramMap.subscribe((params) => {
        const id = Number(params.get('id'));
        if (!id) return;
        this.loadDetail(id);
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  private loadDetail(id: number): void {
    this.loading = true;
    this.activeImageIdx = 0;
    this.property = null;
    this.similar = [];
    this.virtualTour = null;
    this.cdr.detectChanges();

    // Load virtual tour in parallel — endpoint always returns 200.
    // Store only when COMPLETED so the viewer guard (virtualTour?.status === 'COMPLETED') works.
    this.tourService.getTourPublic(id).subscribe({
      next: tour => {
        this.virtualTour = (tour?.status === 'COMPLETED') ? tour : null;
        this.cdr.detectChanges();
      },
      error: () => { this.virtualTour = null; },
    });

    this.subs.push(
      this.portal.detail(id)
        .pipe(finalize(() => { this.loading = false; this.cdr.detectChanges(); }))
        .subscribe({
          next: (res) => {
            this.property = res;
            if (typeof window !== 'undefined') {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          },
          error: () => { this.property = null; },
        })
    );

    this.subs.push(
      this.portal.similar(id, 4).subscribe({
        next: (res) => { this.similar = res || []; this.cdr.detectChanges(); },
        error: () => { this.similar = []; },
      })
    );
  }

  resolve(url: string | null | undefined): string {
    return this.portal.resolveImage(url);
  }

  activeImage(): string {
    if (!this.property) return '';
    const list = this.property.imageUrls || [];
    if (list.length) return this.resolve(list[this.activeImageIdx]);
    return this.resolve(this.property.mainImageUrl);
  }

  locationLabel(): string {
    if (!this.property) return '';
    return [this.property.city, this.property.country].filter(Boolean).join(', ');
  }

  priceLabel(): string {
    if (!this.property) return '';
    if (this.property.category === 'LOCATION' && this.property.prixLocation) {
      return `${this.formatNumber(this.property.prixLocation)} TND/mois`;
    }
    if (this.property.prixVente) {
      return `${this.formatNumber(this.property.prixVente)} TND`;
    }
    return 'Prix sur demande';
  }

  pricePerSqm(): string | null {
    if (!this.property?.surface || !this.property.prixVente) return null;
    return this.formatNumber(Math.round(this.property.prixVente / this.property.surface));
  }

  hasMap(): boolean {
    return !!(this.property?.latitude && this.property?.longitude);
  }

  mapSrc(): SafeResourceUrl | string {
    if (!this.property?.latitude || !this.property?.longitude) return '';
    const lat = this.property.latitude;
    const lng = this.property.longitude;
    const delta = 0.01;
    const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
    const url = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  formatType(t: string): string {
    if (!t) return '';
    return t.charAt(0) + t.slice(1).toLowerCase();
  }

  formatStatus(s: string): string {
    const map: Record<string, string> = {
      DISPONIBLE: 'Disponible',
      EN_ATTENTE: 'En attente',
      VENDU: 'Vendu',
      LOUE: 'Loué',
      RESERVE: 'Réservé',
    };
    return map[s] || s;
  }

  isSplatModel(): boolean {
    const fmt = this.property?.model3dFormat?.toLowerCase();
    return fmt === 'ksplat' || fmt === 'splat' || fmt === 'ply' || fmt === 'splat-ply';
  }

  hasImmersive(): boolean {
    return !!(this.property?.hasVideo || this.property?.hasModel3d || this.virtualTour?.status === 'COMPLETED');
  }

  hasAmenities(): boolean {
    const p = this.property as any;
    return !!(p?.garage || p?.piscine || p?.jardin || p?.meuble
           || p?.climatisation || p?.securite || p?.prochePlage || p?.procheTransport);
  }

  isLoggedIn(): boolean {
    return this.clientAuth.isLoggedIn();
  }

  onInterested(): void {
    if (!this.property) return;
    if (!this.clientAuth.isLoggedIn()) {
      this.router.navigate(['/compte/login'], {
        queryParams: { redirect: `/biens/${this.property.id}` },
      });
      return;
    }
    this.interestOpen = true;
    this.cdr.detectChanges();
  }

  onInterestClosed(_submitted: boolean): void {
    this.interestOpen = false;
    this.cdr.detectChanges();
  }

  private formatNumber(n: number): string {
    return new Intl.NumberFormat('fr-FR').format(n);
  }
}
