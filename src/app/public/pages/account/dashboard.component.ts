import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Subscription, finalize } from 'rxjs';
import { ClientAuthService, ClientPublicProfile } from '../../services/client-auth.service';
import {
  InterestRequestDTO,
  InterestRequestService,
} from '../../services/interest-request.service';
import { PublicPortalService } from '../../services/public-portal.service';

@Component({
  selector: 'app-public-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="head">
      <div class="container">
        <span class="crumb">Espace client</span>
        <h1>Bonjour {{ profile?.prenom || '' }} 👋</h1>
        <p>Retrouvez ici vos demandes envoyées aux agences.</p>
      </div>
    </section>

    <div class="container content">
      <div class="grid">
        <div class="card profile-card">
          <h3>Mon profil</h3>
          <ul *ngIf="profile">
            <li><span>Nom</span><strong>{{ profile.prenom }} {{ profile.nom }}</strong></li>
            <li><span>Email</span><strong>{{ profile.email }}</strong></li>
            <li><span>Téléphone</span><strong>{{ profile.telephone || '—' }}</strong></li>
          </ul>
          <button type="button" class="btn-secondary" (click)="logout()">Se déconnecter</button>
        </div>

        <div class="card stats-card">
          <h3>Demandes envoyées</h3>
          <div class="stat-num">{{ interests.length }}</div>
          <p class="muted">Agences contactées : <strong>{{ uniqueAgencies() }}</strong></p>
          <a class="btn-link" routerLink="/biens/vente">Continuer à explorer →</a>
        </div>

        <div class="card explore-card">
          <h3>Envie d'aller plus loin ?</h3>
          <p>Découvrez les dernières opportunités sur le marché.</p>
          <div class="actions">
            <a class="btn-primary" routerLink="/biens/vente">Voir les ventes</a>
            <a class="btn-secondary" routerLink="/biens/location">Voir les locations</a>
          </div>
        </div>
      </div>

      <section class="interests">
        <header>
          <h2>Mes biens d'intérêt</h2>
          <p class="muted">Suivi de toutes vos demandes envoyées aux agences.</p>
        </header>

        <div *ngIf="loading" class="loading">Chargement…</div>

        <div class="empty" *ngIf="!loading && !interests.length">
          <h3>Aucune demande pour le moment</h3>
          <p>Cliquez sur « Intéressé par ce bien » sur une annonce pour démarrer.</p>
          <a class="btn-primary" routerLink="/biens/vente">Découvrir des biens</a>
        </div>

        <ul class="interest-list" *ngIf="!loading && interests.length">
          <li *ngFor="let it of interests">
            <a [routerLink]="['/biens', it.propertyId]" class="thumb">
              <img *ngIf="it.propertyMainImageUrl" [src]="resolveImg(it.propertyMainImageUrl)" [alt]="it.propertyTitle" />
              <div class="fallback" *ngIf="!it.propertyMainImageUrl">{{ initials(it.propertyTitle) }}</div>
            </a>
            <div class="info">
              <a [routerLink]="['/biens', it.propertyId]"><strong>{{ it.propertyTitle }}</strong></a>
              <span class="loc">{{ formatLoc(it) }}</span>
              <span class="agency" *ngIf="it.agencyName">Agence : {{ it.agencyName }}</span>
              <span class="date">Envoyée le {{ formatDate(it.createdAt) }}</span>
            </div>
            <span class="status" [class]="statusClass(it.status)">{{ statusLabel(it.status) }}</span>
          </li>
        </ul>
      </section>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .container { width: 100%; max-width: 1240px; margin: 0 auto; padding: 0 24px; }
    .head {
      background: linear-gradient(180deg, #eef2f7 0%, #f8fafc 100%);
      padding: 48px 0 32px;
      border-bottom: 1px solid #e2e8f0;
    }
    .crumb { font-size: 13px; color: #64748b; }
    .head h1 { margin: 6px 0; font-size: 30px; color: #0f172a; }
    .head p { color: #475569; margin: 0; }

    .content { padding: 32px 0 80px; }

    .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 36px; }
    .card {
      background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 22px;
    }
    .card h3 { margin: 0 0 14px; font-size: 16px; color: #0f172a; }
    .profile-card ul { list-style: none; padding: 0; margin: 0 0 14px; }
    .profile-card li {
      display: flex; justify-content: space-between;
      padding: 8px 0; font-size: 14px;
      border-bottom: 1px solid #f1f5f9;
    }
    .profile-card li:last-child { border-bottom: none; }
    .profile-card span { color: #64748b; }
    .profile-card strong { color: #0f172a; text-align: right; max-width: 60%; word-break: break-word; }

    .stat-num { font-size: 36px; font-weight: 700; color: #0b6bcb; line-height: 1; margin-bottom: 4px; }
    .muted { color: #64748b; font-size: 13px; margin: 0 0 8px; }
    .btn-link { color: #0b6bcb; text-decoration: none; font-weight: 600; font-size: 14px; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }

    .btn-primary, .btn-secondary {
      padding: 10px 16px; border-radius: 9px; font-weight: 600; font-size: 13px;
      border: none; cursor: pointer; text-decoration: none; display: inline-block;
    }
    .btn-primary {
      background: linear-gradient(135deg, #0b6bcb, #084c91); color: #fff;
    }
    .btn-secondary {
      background: #fff; color: #0f172a; border: 1px solid #e2e8f0;
    }

    .interests header { margin-bottom: 18px; }
    .interests h2 { font-size: 22px; color: #0f172a; margin: 0 0 4px; }
    .empty {
      padding: 40px 24px; text-align: center; background: #fff;
      border: 1px dashed #cbd5e1; border-radius: 14px;
    }
    .empty h3 { margin: 0 0 6px; color: #0f172a; }
    .empty p { color: #64748b; margin: 0 0 14px; }

    .interest-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 12px; }
    .interest-list li {
      background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
      padding: 14px; display: grid;
      grid-template-columns: 90px 1fr auto;
      gap: 16px; align-items: center;
    }
    .thumb {
      width: 90px; height: 70px; border-radius: 10px; overflow: hidden;
      background: #f1f5f9; display: block;
    }
    .thumb img { width: 100%; height: 100%; object-fit: cover; }
    .thumb .fallback {
      width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #cbd5e1, #94a3b8);
      color: #fff; font-weight: 700;
    }
    .info { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    .info a { color: #0f172a; text-decoration: none; font-size: 15px; }
    .info a:hover { color: #0b6bcb; }
    .info .loc { color: #475569; font-size: 13px; }
    .info .agency, .info .date { color: #64748b; font-size: 12px; }

    .status {
      padding: 5px 11px; border-radius: 999px; font-size: 11px;
      font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;
    }
    .status.pending { background: #fef3c7; color: #92400e; }
    .status.contacted { background: #dbeafe; color: #1e3a8a; }
    .status.closed { background: #e2e8f0; color: #475569; }

    .loading { text-align: center; padding: 32px; color: #64748b; }

    @media (max-width: 880px) {
      .grid { grid-template-columns: 1fr; }
      .interest-list li { grid-template-columns: 70px 1fr; }
      .interest-list li .status { grid-column: span 2; justify-self: start; }
    }
  `],
})
export class PublicDashboardComponent implements OnInit, OnDestroy {
  private auth = inject(ClientAuthService);
  private interestService = inject(InterestRequestService);
  private portal = inject(PublicPortalService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  profile: ClientPublicProfile | null = null;
  interests: InterestRequestDTO[] = [];
  loading = true;

  private subs: Subscription[] = [];

  ngOnInit(): void {
    this.subs.push(
      this.auth.user$.subscribe((u) => { this.profile = u; this.cdr.detectChanges(); })
    );
    // refresh profile from server (fills telephone, validates token)
    this.subs.push(this.auth.me().subscribe());

    this.subs.push(
      this.interestService.mine()
        .pipe(finalize(() => { this.loading = false; this.cdr.detectChanges(); }))
        .subscribe({
          next: (res) => { this.interests = res || []; },
          error: () => { this.interests = []; },
        })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/');
  }

  uniqueAgencies(): number {
    const set = new Set(this.interests.map((i) => i.agencyName).filter(Boolean));
    return set.size;
  }

  resolveImg(url: string): string {
    return this.portal.resolveImage(url);
  }

  initials(t: string): string {
    return (t || '?').slice(0, 2).toUpperCase();
  }

  formatLoc(it: InterestRequestDTO): string {
    return [it.propertyCity, it.propertyCountry].filter(Boolean).join(', ');
  }

  formatDate(d: string): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  statusLabel(s: string): string {
    const map: Record<string, string> = { PENDING: 'En attente', CONTACTED: 'Contacté', CLOSED: 'Clôturée' };
    return map[s] || s;
  }
  statusClass(s: string): string {
    return s.toLowerCase();
  }
}
