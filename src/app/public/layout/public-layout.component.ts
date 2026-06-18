import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { ClientAuthService, ClientPublicProfile } from '../services/client-auth.service';

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="public-shell">
      <header class="public-header">
        <div class="container">
          <a class="brand" routerLink="/">
            <span class="brand-mark">M3D</span>
            <span class="brand-name">Maison<strong>3D</strong> Immobilier</span>
          </a>
          <nav class="nav-links">
            <a routerLink="/" [routerLinkActiveOptions]="{ exact: true }" routerLinkActive="active">Accueil</a>
            <a routerLink="/biens/vente" routerLinkActive="active">Acheter</a>
            <a routerLink="/biens/location" routerLinkActive="active">Louer</a>
          </nav>
          <div class="nav-cta">
            <ng-container *ngIf="user; else guestTpl">
              <div class="user-menu" (click)="toggleMenu($event)">
                <span class="avatar">{{ initials(user) }}</span>
                <span class="user-name">{{ user.prenom }}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
                <div class="dropdown" *ngIf="menuOpen" (click)="$event.stopPropagation()">
                  <a routerLink="/compte/dashboard" (click)="menuOpen = false">Mon espace</a>
                  <button type="button" (click)="logout()">Se déconnecter</button>
                </div>
              </div>
            </ng-container>
            <ng-template #guestTpl>
              <a class="btn-ghost" routerLink="/compte/login">Se connecter</a>
              <a class="btn-primary" routerLink="/compte/register">Créer un compte</a>
            </ng-template>
          </div>
        </div>
      </header>

      <main class="public-main">
        <router-outlet></router-outlet>
      </main>

      <footer class="public-footer">
        <div class="container footer-grid">
          <div>
            <div class="footer-brand">
              <span class="brand-mark">M3D</span>
              <span>Maison3D Immobilier</span>
            </div>
            <p class="footer-tag">
              La nouvelle référence de l'immobilier — visualisation 3D, recherche
              avancée et accompagnement personnalisé.
            </p>
          </div>
          <div>
            <h4>Naviguer</h4>
            <ul>
              <li><a routerLink="/">Accueil</a></li>
              <li><a routerLink="/biens/vente">Acheter un bien</a></li>
              <li><a routerLink="/biens/location">Louer un bien</a></li>
            </ul>
          </div>
          <div>
            <h4>Mon compte</h4>
            <ul>
              <li><a routerLink="/compte/login">Connexion</a></li>
              <li><a routerLink="/compte/register">Créer un compte</a></li>
              <li><a routerLink="/admin/login">Espace Pro</a></li>
            </ul>
          </div>
          <div>
            <h4>Confiance</h4>
            <ul class="badges">
              <li>Annonces vérifiées</li>
              <li>Visite 3D premium</li>
              <li>Réseau d'agences certifiées</li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom container">
          <span>© {{ year }} Maison3D Immobilier. Tous droits réservés.</span>
        </div>
      </footer>
    </div>
  `,
  styles: [
    `
      :host {
        --p-primary: #0b6bcb;
        --p-primary-dark: #084c91;
        --p-accent: #f59e0b;
        --p-text: #0f172a;
        --p-text-muted: #475569;
        --p-bg: #f7fafc;
        --p-card: #ffffff;
        --p-border: #e2e8f0;
        display: block;
      }
      .public-shell {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        background: var(--p-bg);
        color: var(--p-text);
        font-family: 'Inter', system-ui, sans-serif;
      }
      .container {
        width: 100%;
        max-width: 1240px;
        margin: 0 auto;
        padding: 0 24px;
      }
      .public-header {
        position: sticky;
        top: 0;
        z-index: 50;
        background: rgba(255, 255, 255, 0.92);
        backdrop-filter: blur(12px);
        border-bottom: 1px solid var(--p-border);
      }
      .public-header .container {
        display: flex;
        align-items: center;
        height: 72px;
        gap: 32px;
      }
      .brand {
        display: flex; align-items: center; gap: 12px;
        text-decoration: none; color: var(--p-text); font-weight: 600;
      }
      .brand-mark {
        display: inline-flex; align-items: center; justify-content: center;
        width: 38px; height: 38px;
        border-radius: 10px;
        background: linear-gradient(135deg, var(--p-primary), var(--p-primary-dark));
        color: #fff; font-weight: 800; font-size: 13px; letter-spacing: 0.5px;
      }
      .brand-name { font-size: 17px; }
      .nav-links {
        display: flex; gap: 8px; flex: 1; justify-content: center;
      }
      .nav-links a {
        text-decoration: none; color: var(--p-text-muted); font-weight: 500;
        padding: 8px 14px; border-radius: 8px; transition: all 0.15s ease;
      }
      .nav-links a:hover { color: var(--p-primary); background: rgba(11,107,203,0.06); }
      .nav-links a.active { color: var(--p-primary); background: rgba(11,107,203,0.1); }
      .nav-cta { display: flex; gap: 10px; align-items: center; }
      .nav-cta .btn-ghost {
        text-decoration: none; padding: 9px 16px;
        border: 1px solid var(--p-border); border-radius: 9px;
        color: var(--p-text); font-weight: 500;
      }
      .nav-cta .btn-ghost:hover { border-color: var(--p-primary); color: var(--p-primary); }
      .nav-cta .btn-primary {
        text-decoration: none; padding: 10px 18px; border-radius: 9px;
        background: linear-gradient(135deg, var(--p-primary), var(--p-primary-dark));
        color: #fff; font-weight: 600;
      }
      .nav-cta .btn-primary:hover { box-shadow: 0 6px 16px -4px rgba(11,107,203,0.45); }

      .user-menu {
        position: relative;
        display: flex; align-items: center; gap: 10px;
        padding: 6px 12px 6px 6px;
        border: 1px solid var(--p-border); border-radius: 999px;
        cursor: pointer; user-select: none;
      }
      .user-menu:hover { border-color: var(--p-primary); }
      .avatar {
        width: 32px; height: 32px; border-radius: 50%;
        background: linear-gradient(135deg, var(--p-primary), var(--p-primary-dark));
        color: #fff; font-weight: 700; font-size: 13px;
        display: inline-flex; align-items: center; justify-content: center;
      }
      .user-name { font-size: 14px; color: var(--p-text); font-weight: 500; }
      .dropdown {
        position: absolute; right: 0; top: calc(100% + 8px);
        background: #fff; border: 1px solid var(--p-border);
        border-radius: 12px; min-width: 180px;
        box-shadow: 0 18px 40px -16px rgba(15,23,42,0.18);
        padding: 6px; z-index: 60;
      }
      .dropdown a, .dropdown button {
        display: block; width: 100%; text-align: left;
        padding: 9px 12px; font-size: 14px;
        color: var(--p-text); text-decoration: none;
        border: none; background: none; cursor: pointer;
        border-radius: 8px;
      }
      .dropdown a:hover, .dropdown button:hover { background: #f1f5f9; }

      .public-main { flex: 1; }
      .public-footer {
        margin-top: 80px; background: #0f172a; color: #cbd5e1;
        padding: 56px 0 24px;
      }
      .footer-grid {
        display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 40px;
      }
      .footer-brand {
        display: flex; align-items: center; gap: 12px;
        font-weight: 700; color: #fff; margin-bottom: 12px;
      }
      .footer-tag { font-size: 14px; line-height: 1.6; max-width: 360px; }
      .public-footer h4 {
        color: #fff; font-size: 14px; text-transform: uppercase;
        letter-spacing: 0.05em; margin-bottom: 14px;
      }
      .public-footer ul {
        list-style: none; padding: 0; display: flex; flex-direction: column; gap: 8px;
      }
      .public-footer a { color: #cbd5e1; text-decoration: none; font-size: 14px; }
      .public-footer a:hover { color: #fff; }
      .badges li { font-size: 13px; color: #94a3b8; }
      .footer-bottom {
        margin-top: 40px; padding-top: 20px;
        border-top: 1px solid rgba(255,255,255,0.08);
        font-size: 13px; color: #64748b;
      }
      @media (max-width: 880px) {
        .public-header .container { gap: 12px; }
        .nav-links { display: none; }
        .footer-grid { grid-template-columns: 1fr 1fr; }
        .nav-cta .btn-ghost, .nav-cta .btn-primary { padding: 8px 12px; font-size: 13px; }
        .user-name { display: none; }
      }
      @media (max-width: 520px) {
        .footer-grid { grid-template-columns: 1fr; }
      }
    `,
  ],
})
export class PublicLayoutComponent implements OnInit, OnDestroy {
  private auth = inject(ClientAuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  year = new Date().getFullYear();
  user: ClientPublicProfile | null = null;
  menuOpen = false;

  private subs: Subscription[] = [];
  private docClickHandler = (e: MouseEvent) => {
    if (this.menuOpen) {
      this.menuOpen = false;
      this.cdr.detectChanges();
    }
  };

  ngOnInit(): void {
    this.subs.push(this.auth.user$.subscribe((u) => {
      this.user = u;
      this.cdr.detectChanges();
    }));
    if (typeof document !== 'undefined') {
      document.addEventListener('click', this.docClickHandler);
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    if (typeof document !== 'undefined') {
      document.removeEventListener('click', this.docClickHandler);
    }
  }

  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.menuOpen = !this.menuOpen;
  }

  logout(): void {
    this.auth.logout();
    this.menuOpen = false;
    this.router.navigateByUrl('/');
  }

  initials(u: ClientPublicProfile): string {
    return ((u.prenom?.charAt(0) || '') + (u.nom?.charAt(0) || '')).toUpperCase() || '?';
  }
}
