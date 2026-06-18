import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ClientAuthService } from '../../services/client-auth.service';

@Component({
  selector: 'app-public-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="auth-wrap">
      <div class="auth-card">
        <h1>Connexion</h1>
        <p class="muted">Accédez à votre espace client pour suivre vos demandes et favoris.</p>

        <form (ngSubmit)="submit()" #f="ngForm">
          <div class="field">
            <label>Email</label>
            <input type="email" [(ngModel)]="email" name="email" required autocomplete="email" />
          </div>
          <div class="field">
            <label>Mot de passe</label>
            <input type="password" [(ngModel)]="password" name="password" required autocomplete="current-password" />
          </div>

          <p class="error" *ngIf="error">{{ error }}</p>

          <button type="submit" class="btn-primary" [disabled]="loading || !f.valid">
            {{ loading ? 'Connexion…' : 'Se connecter' }}
          </button>
        </form>

        <p class="footer-link">
          Pas encore de compte ? <a routerLink="/compte/register">Créer un compte</a>
        </p>
        <p class="footer-link muted">
          Vous êtes une agence ?
          <a routerLink="/admin/login">Espace Pro</a>
        </p>
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .auth-wrap {
      min-height: calc(100vh - 72px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 60px 24px;
      background:
        radial-gradient(800px 400px at 20% 0%, rgba(11,107,203,0.08), transparent 60%),
        radial-gradient(600px 400px at 100% 100%, rgba(245,158,11,0.07), transparent 60%);
    }
    .auth-card {
      width: 100%;
      max-width: 440px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 18px;
      padding: 36px;
      box-shadow: 0 20px 50px -16px rgba(15,23,42,0.18);
    }
    h1 { font-size: 26px; margin: 0 0 6px; color: #0f172a; }
    .muted { color: #64748b; margin: 0 0 24px; font-size: 14px; }
    .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
    .field label { font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
    .field input {
      padding: 12px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      font-size: 14px;
    }
    .field input:focus { outline: none; border-color: #0b6bcb; box-shadow: 0 0 0 3px rgba(11,107,203,0.15); }
    .btn-primary {
      width: 100%;
      padding: 13px;
      background: linear-gradient(135deg, #0b6bcb, #084c91);
      color: #fff; border: none; border-radius: 11px;
      font-weight: 600; font-size: 14px;
      cursor: pointer; margin-top: 10px;
    }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .error {
      background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c;
      border-radius: 9px; padding: 10px 12px; font-size: 13px; margin-top: 4px;
    }
    .footer-link { text-align: center; font-size: 14px; color: #475569; margin: 14px 0 0; }
    .footer-link a { color: #0b6bcb; text-decoration: none; font-weight: 600; }
  `],
})
export class PublicLoginComponent {
  private auth = inject(ClientAuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  email = '';
  password = '';
  error = '';
  loading = false;

  submit(): void {
    this.error = '';
    this.loading = true;
    this.cdr.detectChanges();
    this.auth.login(this.email.trim().toLowerCase(), this.password).subscribe({
      next: () => {
        this.loading = false;
        const redirect = this.route.snapshot.queryParamMap.get('redirect') || '/compte/dashboard';
        this.router.navigateByUrl(redirect);
      },
      error: (err) => {
        this.error = err?.error?.error || 'Email ou mot de passe incorrect';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }
}
