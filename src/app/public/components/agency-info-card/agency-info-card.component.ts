import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PublicAgency } from '../../models/public-property.model';

/**
 * Reusable agency contact card shown on property detail pages and anywhere
 * agency info needs to be displayed publicly.
 *
 * Inputs:
 *  - agency       : PublicAgency object from the property DTO
 *  - showCta      : whether to show the "Intéressé par ce bien" button (default true)
 *  - isLoggedIn   : drives the login-hint text below the CTA
 *  - compact      : smaller variant for use inside cards (default false)
 *
 * Outputs:
 *  - ctaClick : emitted when the CTA button is clicked
 */
@Component({
  selector: 'app-agency-info-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="agency-card" [class.compact]="compact" [class.official]="isOfficial">

      <!-- ── Header: avatar + name + badge ─────────────────────────── -->
      <div class="card-header">
        <div class="avatar" [class.avatar--official]="isOfficial" [class.avatar--partner]="!isOfficial">
          <img *ngIf="agency?.logoUrl" [src]="agency!.logoUrl!" [alt]="agency!.name" class="avatar-img" />
          <span *ngIf="!agency?.logoUrl" class="avatar-initials">{{ initials }}</span>
        </div>
        <div class="header-meta">
          <span class="type-badge" [class.badge--official]="isOfficial" [class.badge--partner]="!isOfficial">
            <i class="fas" [class.fa-star]="isOfficial" [class.fa-handshake]="!isOfficial"></i>
            {{ isOfficial ? 'Agence officielle' : 'Agence partenaire' }}
          </span>
          <strong class="agency-name">{{ agency?.name || 'Maison3D Immobilier' }}</strong>
        </div>
      </div>

      <!-- ── Contact links ──────────────────────────────────────────── -->
      <div class="contact-list" *ngIf="hasAnyContact">
        <a *ngIf="agency?.phone" [href]="'tel:' + agency!.phone!" class="contact-row contact-row--phone">
          <span class="contact-icon"><i class="fas fa-phone"></i></span>
          <span class="contact-body">
            <span class="contact-label">Téléphone</span>
            <span class="contact-value">{{ agency!.phone }}</span>
          </span>
        </a>

        <a *ngIf="agency?.whatsappLink"
           [href]="agency!.whatsappLink!"
           target="_blank" rel="noopener noreferrer"
           class="contact-row contact-row--whatsapp">
          <span class="contact-icon"><i class="fab fa-whatsapp"></i></span>
          <span class="contact-body">
            <span class="contact-label">WhatsApp</span>
            <span class="contact-value">Discuter maintenant</span>
          </span>
        </a>

        <a *ngIf="agency?.email" [href]="'mailto:' + agency!.email!" class="contact-row contact-row--email">
          <span class="contact-icon"><i class="fas fa-envelope"></i></span>
          <span class="contact-body">
            <span class="contact-label">Email</span>
            <span class="contact-value">{{ agency!.email }}</span>
          </span>
        </a>

        <div *ngIf="agency?.address" class="contact-row contact-row--address">
          <span class="contact-icon"><i class="fas fa-location-dot"></i></span>
          <span class="contact-body">
            <span class="contact-label">Adresse</span>
            <span class="contact-value">{{ agency!.address }}</span>
          </span>
        </div>
      </div>

      <!-- ── Divider ────────────────────────────────────────────────── -->
      <div class="divider" *ngIf="showCta"></div>

      <!-- ── CTA ───────────────────────────────────────────────────── -->
      <ng-container *ngIf="showCta">
        <button class="btn-cta" type="button" (click)="ctaClick.emit()">
          <i class="fas fa-heart"></i>
          Intéressé par ce bien
        </button>
        <p class="login-hint" *ngIf="!isLoggedIn">
          <i class="fas fa-lock"></i>
          Connectez-vous pour envoyer votre intérêt.
        </p>
      </ng-container>

      <!-- ── Trust signals ──────────────────────────────────────────── -->
      <div class="trust" *ngIf="showCta">
        <span class="trust-item"><i class="fas fa-bolt"></i> Réponse rapide</span>
        <span class="trust-item"><i class="fas fa-shield-halved"></i> Annonce vérifiée</span>
        <span class="trust-item"><i class="fas fa-tag"></i> Sans frais cachés</span>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    /* ── Card shell ─────────────────────────────────────── */
    .agency-card {
      background: #fff;
      border-radius: 18px;
      border: 1px solid #e2e8f0;
      padding: 22px;
      box-shadow: 0 18px 40px -20px rgba(15,23,42,.16);
    }
    .agency-card.official {
      border-color: rgba(217,119,6,.25);
      box-shadow: 0 18px 40px -20px rgba(180,83,9,.18);
    }
    .agency-card.compact { padding: 14px; border-radius: 12px; }

    /* ── Header ─────────────────────────────────────────── */
    .card-header {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 18px;
    }
    .avatar {
      width: 54px; height: 54px; flex-shrink: 0;
      border-radius: 14px;
      display: flex; align-items: center; justify-content: center;
      overflow: hidden;
    }
    .avatar--official { background: linear-gradient(135deg, #d97706, #b45309); }
    .avatar--partner  { background: linear-gradient(135deg, #0b6bcb, #084c91); }
    .agency-card.compact .avatar { width: 42px; height: 42px; border-radius: 10px; }

    .avatar-img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .avatar-initials { color: #fff; font-size: 18px; font-weight: 700; letter-spacing: .5px; }
    .agency-card.compact .avatar-initials { font-size: 14px; }

    .header-meta { min-width: 0; }
    .type-badge {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
      padding: 3px 9px; border-radius: 999px; margin-bottom: 6px;
      i { font-size: 9px; }
    }
    .badge--official {
      background: rgba(251,191,36,.15); color: #92400e;
      border: 1px solid rgba(217,119,6,.3);
    }
    .badge--partner {
      background: rgba(11,107,203,.1); color: #1e40af;
      border: 1px solid rgba(11,107,203,.25);
    }
    .agency-name {
      display: block;
      font-size: 15px; font-weight: 700; color: #0f172a;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      max-width: 200px;
    }
    .agency-card.compact .agency-name { font-size: 13px; }

    /* ── Contact list ───────────────────────────────────── */
    .contact-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px; }

    .contact-row {
      display: flex; align-items: center; gap: 11px;
      padding: 10px 12px;
      border-radius: 10px;
      text-decoration: none;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      transition: background .18s, border-color .18s, transform .15s;
      cursor: pointer;
    }
    a.contact-row:hover { transform: translateX(3px); }
    .contact-row--phone:hover   { background: #eff6ff; border-color: #93c5fd; }
    .contact-row--whatsapp:hover{ background: #f0fdf4; border-color: #86efac; }
    .contact-row--email:hover   { background: #fdf4ff; border-color: #d8b4fe; }
    .contact-row--address { cursor: default; }
    .contact-row--address:hover { background: #f8fafc; border-color: #e2e8f0; transform: none; }

    .contact-icon {
      width: 36px; height: 36px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      border-radius: 9px; font-size: 14px;
    }
    .contact-row--phone   .contact-icon { background: #eff6ff; color: #1d4ed8; }
    .contact-row--whatsapp .contact-icon{ background: #f0fdf4; color: #15803d; }
    .contact-row--email   .contact-icon { background: #fdf4ff; color: #7e22ce; }
    .contact-row--address .contact-icon { background: #fff7ed; color: #c2410c; }

    .contact-body { display: flex; flex-direction: column; min-width: 0; }
    .contact-label {
      font-size: 10px; font-weight: 600; text-transform: uppercase;
      letter-spacing: .05em; color: #94a3b8;
    }
    .contact-value {
      font-size: 13px; font-weight: 600; color: #0f172a;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    /* ── Divider ────────────────────────────────────────── */
    .divider { height: 1px; background: #e2e8f0; margin-bottom: 16px; }

    /* ── CTA button ─────────────────────────────────────── */
    .btn-cta {
      width: 100%; padding: 13px 16px;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      border: none; border-radius: 11px; cursor: pointer;
      font-size: 14px; font-weight: 600; color: #fff;
      background: linear-gradient(135deg, #0b6bcb, #084c91);
      transition: transform .15s, box-shadow .2s;
      margin-bottom: 8px;
    }
    .btn-cta:hover {
      transform: translateY(-1px);
      box-shadow: 0 8px 20px -4px rgba(11,107,203,.45);
    }
    .btn-cta i { font-size: 13px; }

    .login-hint {
      text-align: center; font-size: 11px; color: #64748b;
      margin: 0 0 14px;
      display: flex; align-items: center; justify-content: center; gap: 5px;
      i { font-size: 10px; }
    }

    /* ── Trust signals ──────────────────────────────────── */
    .trust {
      display: flex; flex-direction: column; gap: 7px;
      padding-top: 14px; border-top: 1px dashed #e2e8f0;
    }
    .trust-item {
      display: flex; align-items: center; gap: 8px;
      font-size: 12px; color: #475569;
      i { color: #10b981; font-size: 11px; width: 14px; text-align: center; }
    }
  `],
})
export class AgencyInfoCardComponent {
  @Input({ required: true }) agency!: PublicAgency | null | undefined;
  @Input() showCta = true;
  @Input() isLoggedIn = false;
  @Input() compact = false;

  @Output() ctaClick = new EventEmitter<void>();

  get isOfficial(): boolean {
    return this.agency?.type === 'SUPER_ADMIN';
  }

  get initials(): string {
    const name = this.agency?.name || 'M3D';
    return name
      .split(/\s+/)
      .map(s => s.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  get hasAnyContact(): boolean {
    return !!(this.agency?.phone || this.agency?.email
           || this.agency?.whatsappLink || this.agency?.address);
  }
}
