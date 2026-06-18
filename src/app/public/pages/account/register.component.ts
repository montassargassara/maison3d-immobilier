import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { ClientAuthService } from '../../services/client-auth.service';
import { PublicPortalService } from '../../services/public-portal.service';

@Component({
  selector: 'app-public-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="reg-wrap">
      <div class="reg-card">

        <!-- Header -->
        <div class="reg-header">
          <div class="reg-brand">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="9" fill="#0b6bcb"/>
              <path d="M16 6L7 14v12h6v-7h6v7h6V14L16 6z" fill="white"/>
            </svg>
            <span>Maison3D</span>
          </div>
          <h1>Créer votre compte</h1>
          <p class="reg-sub">Rejoignez notre plateforme et trouvez le bien idéal</p>
        </div>

        <form (ngSubmit)="submit()" #f="ngForm" novalidate>

          <!-- Section: Identité -->
          <div class="form-section">
            <div class="section-label">
              <span class="section-icon">👤</span>
              Informations personnelles
            </div>
            <div class="row-2">
              <div class="field">
                <label>Prénom <span class="req">*</span></label>
                <input
                  type="text"
                  [(ngModel)]="prenom"
                  name="prenom"
                  required
                  minlength="2"
                  placeholder="ex : Montassar"
                  [class.field-error]="f.submitted && !prenom"
                />
              </div>
              <div class="field">
                <label>Nom <span class="req">*</span></label>
                <input
                  type="text"
                  [(ngModel)]="nom"
                  name="nom"
                  required
                  minlength="2"
                  placeholder="ex : Gassara"
                  [class.field-error]="f.submitted && !nom"
                />
              </div>
            </div>
            <div class="field">
              <label>Email <span class="req">*</span></label>
              <input
                type="email"
                [(ngModel)]="email"
                name="email"
                required
                placeholder="ex : contact@email.com"
                autocomplete="email"
                [class.field-error]="f.submitted && !email"
              />
            </div>
            <div class="field">
              <label>Téléphone <span class="req">*</span></label>
              <input
                type="tel"
                [(ngModel)]="telephone"
                name="telephone"
                required
                minlength="8"
                placeholder="ex : +216 20 000 000"
                [class.field-error]="f.submitted && !telephone"
              />
            </div>
            <div class="field">
              <label>Mot de passe <span class="req">*</span></label>
              <div class="pw-wrap">
                <input
                  [type]="showPw ? 'text' : 'password'"
                  [(ngModel)]="password"
                  name="password"
                  required
                  minlength="6"
                  placeholder="6 caractères minimum"
                  autocomplete="new-password"
                  [class.field-error]="f.submitted && !password"
                />
                <button type="button" class="pw-toggle" (click)="showPw = !showPw" tabindex="-1">
                  {{ showPw ? '🙈' : '👁️' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Section: Préférences immobilières -->
          <div class="form-section">
            <div class="section-label">
              <span class="section-icon">🏡</span>
              Vos préférences immobilières
              <span class="required-badge">Obligatoire</span>
            </div>

            <div class="field">
              <label>Budget estimé (TND) <span class="req">*</span></label>
              <div class="input-icon-wrap">
                <span class="input-icon">💰</span>
                <input
                  type="number"
                  [(ngModel)]="budgetEstime"
                  name="budgetEstime"
                  required
                  min="1"
                  placeholder="ex : 250000"
                  class="with-icon"
                  [class.field-error]="f.submitted && !budgetEstime"
                />
              </div>
              <p class="field-hint">Aide les agences à vous proposer des biens adaptés</p>
              @if (f.submitted && !budgetEstime) {
                <p class="field-error-msg">Le budget est requis</p>
              }
            </div>

            <div class="row-2">
              <div class="field">
                <label>Pays recherché <span class="req">*</span></label>
                <div class="select-wrap">
                  <select
                    [(ngModel)]="pays"
                    name="pays"
                    required
                    (change)="onPaysChange()"
                    [disabled]="loadingCountries"
                    [class.field-error]="f.submitted && !pays"
                  >
                    <option value="">{{ loadingCountries ? 'Chargement…' : '— Choisir —' }}</option>
                    @for (c of countries; track c) {
                      <option [value]="c">{{ c }}</option>
                    }
                  </select>
                  <span class="select-arrow">▾</span>
                </div>
                @if (f.submitted && !pays) {
                  <p class="field-error-msg">Le pays est requis</p>
                }
              </div>
              <div class="field">
                <label>Ville recherchée <span class="req">*</span></label>
                <div class="select-wrap">
                  <select
                    [(ngModel)]="ville"
                    name="ville"
                    required
                    [disabled]="!pays || loadingCities"
                    [class.field-error]="f.submitted && !ville"
                  >
                    <option value="">{{ villePlaceholder }}</option>
                    @for (c of cities; track c) {
                      <option [value]="c">{{ c }}</option>
                    }
                  </select>
                  <span class="select-arrow" [class.disabled]="!pays || loadingCities">▾</span>
                </div>
                @if (f.submitted && !ville) {
                  <p class="field-error-msg">La ville est requise</p>
                }
              </div>
            </div>
          </div>

          <!-- Error -->
          @if (error) {
            <div class="error-box">
              <span>⚠️</span> {{ error }}
            </div>
          }

          <!-- Submit -->
          <button type="submit" class="btn-submit" [disabled]="loading">
            @if (!loading) { <span>Créer mon compte →</span> }
            @if (loading) { <span class="spinner-row"><span class="spinner"></span> Création en cours…</span> }
          </button>

          <p class="terms">
            En créant un compte, vous acceptez nos
            <a href="#">Conditions d'utilisation</a> et notre
            <a href="#">Politique de confidentialité</a>.
          </p>
        </form>

        <div class="reg-footer">
          Vous avez déjà un compte ?
          <a routerLink="/compte/login">Se connecter</a>
        </div>

      </div>
    </section>
  `,
  styles: [`
    :host { display: block; }

    .reg-wrap {
      min-height: calc(100vh - 72px);
      display: flex; align-items: flex-start; justify-content: center;
      padding: 48px 20px 80px;
      background:
        radial-gradient(ellipse 900px 500px at 10% 0%, rgba(11,107,203,0.07), transparent 60%),
        radial-gradient(ellipse 600px 400px at 90% 100%, rgba(245,158,11,0.06), transparent 60%),
        #f8fafc;
    }

    .reg-card {
      width: 100%; max-width: 520px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      padding: 0;
      box-shadow: 0 24px 60px -16px rgba(15,23,42,0.14);
      overflow: hidden;
    }

    /* Header */
    .reg-header {
      background: linear-gradient(135deg, #0b6bcb 0%, #084c91 100%);
      padding: 32px 36px 28px;
      color: white;
    }
    .reg-brand {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 20px;
    }
    .reg-brand span {
      font-size: 16px; font-weight: 700; letter-spacing: -0.02em;
    }
    .reg-header h1 {
      font-size: 24px; font-weight: 700; margin: 0 0 6px;
      letter-spacing: -0.03em;
    }
    .reg-sub { margin: 0; font-size: 14px; opacity: 0.8; }

    /* Form body */
    form { padding: 28px 36px 4px; }

    .form-section {
      margin-bottom: 24px;
      padding: 20px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
    }

    .section-label {
      display: flex; align-items: center; gap: 8px;
      font-size: 12px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.07em;
      color: #475569; margin-bottom: 16px;
    }
    .section-icon { font-size: 16px; }
    .required-badge {
      margin-left: auto;
      background: #fff7ed; color: #c2410c;
      font-size: 10px; padding: 2px 8px;
      border-radius: 20px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.05em;
      border: 1px solid #fed7aa;
    }

    .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

    .field {
      display: flex; flex-direction: column; gap: 5px;
      margin-bottom: 12px;
    }
    .field:last-child { margin-bottom: 0; }

    .field label {
      font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.06em;
      color: #64748b;
    }
    .req { color: #ef4444; }

    .field input, .field select {
      padding: 11px 14px;
      border: 1.5px solid #e2e8f0;
      border-radius: 10px;
      font-size: 14px; color: #0f172a;
      background: #fff;
      transition: border-color 0.15s, box-shadow 0.15s;
      width: 100%;
    }
    .field input:focus {
      outline: none;
      border-color: #0b6bcb;
      box-shadow: 0 0 0 3px rgba(11,107,203,0.12);
    }
    .field input.field-error {
      border-color: #f87171;
      box-shadow: 0 0 0 3px rgba(248,113,113,0.12);
    }

    .field-hint {
      font-size: 11px; color: #94a3b8; margin: 0;
    }
    .field-error-msg {
      font-size: 11px; color: #ef4444; margin: 0;
    }
    .select-wrap select.field-error {
      border-color: #f87171;
      box-shadow: 0 0 0 3px rgba(248,113,113,0.12);
    }

    /* Password toggle */
    .pw-wrap { position: relative; }
    .pw-wrap input { padding-right: 44px; }
    .pw-toggle {
      position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer;
      font-size: 16px; line-height: 1; padding: 4px;
    }

    /* Number input with icon */
    .input-icon-wrap { position: relative; }
    .input-icon {
      position: absolute; left: 12px; top: 50%;
      transform: translateY(-50%); font-size: 16px;
      pointer-events: none;
    }
    .with-icon { padding-left: 38px !important; }

    /* Select */
    .select-wrap { position: relative; }
    .select-wrap select {
      appearance: none; -webkit-appearance: none;
      padding-right: 32px;
      cursor: pointer;
    }
    .select-wrap select:focus {
      outline: none;
      border-color: #0b6bcb;
      box-shadow: 0 0 0 3px rgba(11,107,203,0.12);
    }
    .select-wrap select:disabled { background: #f1f5f9; color: #94a3b8; cursor: not-allowed; }
    .select-arrow {
      position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
      font-size: 12px; color: #64748b; pointer-events: none;
    }
    .select-arrow.disabled { color: #cbd5e1; }

    /* Error */
    .error-box {
      display: flex; align-items: flex-start; gap: 8px;
      background: #fef2f2; border: 1px solid #fecaca;
      color: #b91c1c; border-radius: 10px;
      padding: 12px 14px; font-size: 13px;
      margin-bottom: 16px;
    }

    /* Submit */
    .btn-submit {
      width: 100%; padding: 14px;
      background: linear-gradient(135deg, #0b6bcb 0%, #084c91 100%);
      color: #fff; border: none; border-radius: 12px;
      font-weight: 700; font-size: 15px; letter-spacing: -0.01em;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(11,107,203,0.3);
      transition: opacity 0.15s, transform 0.1s;
    }
    .btn-submit:hover:not(:disabled) { opacity: 0.93; transform: translateY(-1px); }
    .btn-submit:active:not(:disabled) { transform: translateY(0); }
    .btn-submit:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }

    .spinner-row { display: flex; align-items: center; justify-content: center; gap: 10px; }
    .spinner {
      width: 16px; height: 16px;
      border: 2px solid rgba(255,255,255,0.35);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .terms {
      text-align: center; font-size: 12px; color: #94a3b8;
      margin: 12px 0 0; line-height: 1.5;
    }
    .terms a { color: #0b6bcb; text-decoration: none; }

    /* Footer */
    .reg-footer {
      text-align: center; padding: 20px 36px 28px;
      border-top: 1px solid #f1f5f9;
      font-size: 14px; color: #475569;
    }
    .reg-footer a {
      color: #0b6bcb; font-weight: 700; text-decoration: none; margin-left: 4px;
    }
    .reg-footer a:hover { text-decoration: underline; }

    /* Responsive */
    @media (max-width: 540px) {
      .reg-header { padding: 24px 20px; }
      form { padding: 20px 20px 4px; }
      .reg-footer { padding: 16px 20px 24px; }
      .row-2 { grid-template-columns: 1fr; }
    }
  `],
})
export class PublicRegisterComponent implements OnInit {
  private auth = inject(ClientAuthService);
  private portal = inject(PublicPortalService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  // Personal info
  nom = '';
  prenom = '';
  email = '';
  telephone = '';
  password = '';
  showPw = false;

  // Real estate preferences
  budgetEstime: number | null = null;
  pays = '';
  ville = '';

  // Meta
  error = '';
  loading = false;

  // Facets
  countries: string[] = [];
  cities: string[] = [];
  loadingCountries = false;
  loadingCities = false;

  get villePlaceholder(): string {
    if (!this.pays) return '— Choisir un pays d\'abord —';
    if (this.loadingCities) return 'Chargement…';
    return '— Choisir —';
  }

  ngOnInit(): void {
    this.loadingCountries = true;
    this.portal.countries().pipe(
      finalize(() => { this.loadingCountries = false; this.cdr.markForCheck(); })
    ).subscribe({
      next: (list) => { this.countries = list; },
      error: () => { this.countries = []; },
    });
  }

  onPaysChange(): void {
    this.ville = '';
    this.cities = [];
    if (!this.pays) return;
    this.loadingCities = true;
    this.portal.cities(this.pays).pipe(
      finalize(() => { this.loadingCities = false; this.cdr.markForCheck(); })
    ).subscribe({
      next: (list) => { this.cities = list; },
      error: () => { this.cities = []; },
    });
  }

  submit(): void {
    this.error = '';
    if (!this.budgetEstime || !this.pays || !this.ville) {
      this.cdr.markForCheck();
      return;
    }
    this.loading = true;
    this.cdr.markForCheck();

    const payload: Parameters<ClientAuthService['register']>[0] = {
      nom: this.nom.trim(),
      prenom: this.prenom.trim(),
      email: this.email.trim().toLowerCase(),
      telephone: this.telephone.trim(),
      password: this.password,
      budgetEstime: this.budgetEstime,
      pays: this.pays,
      ville: this.ville,
    };

    this.auth.register(payload).pipe(
      finalize(() => { this.loading = false; this.cdr.markForCheck(); })
    ).subscribe({
      next: () => {
        const redirect = this.route.snapshot.queryParamMap.get('redirect') || '/compte/dashboard';
        this.router.navigateByUrl(redirect);
      },
      error: (err) => {
        this.error = err?.error?.error || err?.error?.message || 'Impossible de créer le compte. Vérifiez vos informations.';
      },
    });
  }
}
