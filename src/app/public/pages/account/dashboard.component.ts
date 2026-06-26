import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
  imports: [FormsModule, RouterLink],
  template: `
    <!-- ── En-tête ─────────────────────────────────────────── -->
    <section class="head">
      <div class="container">
        <span class="crumb">Espace client</span>
        <h1>Bonjour {{ profile?.prenom || '' }} 👋</h1>
        <p>Retrouvez ici vos demandes envoyées aux agences.</p>
      </div>
    </section>

    <div class="container content">
      <div class="grid">

        <!-- ══════════════════════════════════════════════════
             CARTE PROFIL
        ═══════════════════════════════════════════════════ -->
        <div class="card profile-card">
          <div class="card-head">
            <h3>Mon profil</h3>
            @if (!editMode) {
              <button type="button" class="btn-edit" (click)="startEdit()" title="Modifier le profil">
                <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zm-2.207 2.207L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                </svg>
                Modifier
              </button>
            }
          </div>

          <!-- ── Vue lecture ── -->
          @if (!editMode && profile) {
            <ul class="profile-list">
              <li>
                <span class="field-label">Prénom &amp; Nom</span>
                <strong>{{ profile.prenom }} {{ profile.nom }}</strong>
              </li>
              <li>
                <span class="field-label">Email</span>
                <strong>{{ profile.email }}</strong>
              </li>
              <li>
                <span class="field-label">Téléphone</span>
                <strong>{{ profile.telephone || '—' }}</strong>
              </li>
            </ul>
          }

          <!-- ── Vue édition ── -->
          @if (editMode) {
            <form class="edit-form" (ngSubmit)="saveProfile()">

              <div class="form-row">
                <div class="form-group">
                  <label for="ep-prenom">Prénom</label>
                  <input
                    id="ep-prenom"
                    type="text"
                    [(ngModel)]="draft.prenom"
                    name="prenom"
                    placeholder="Votre prénom"
                    [class.invalid]="fieldError('prenom')"
                    required
                  />
                  @if (fieldError('prenom')) {
                    <span class="field-err">{{ fieldError('prenom') }}</span>
                  }
                </div>
                <div class="form-group">
                  <label for="ep-nom">Nom</label>
                  <input
                    id="ep-nom"
                    type="text"
                    [(ngModel)]="draft.nom"
                    name="nom"
                    placeholder="Votre nom"
                    [class.invalid]="fieldError('nom')"
                    required
                  />
                  @if (fieldError('nom')) {
                    <span class="field-err">{{ fieldError('nom') }}</span>
                  }
                </div>
              </div>

              <div class="form-group">
                <label for="ep-email">Email</label>
                <input
                  id="ep-email"
                  type="email"
                  [(ngModel)]="draft.email"
                  name="email"
                  placeholder="votre@email.com"
                  [class.invalid]="fieldError('email')"
                  required
                />
                @if (fieldError('email')) {
                  <span class="field-err">{{ fieldError('email') }}</span>
                }
              </div>

              <div class="form-group">
                <label for="ep-tel">Téléphone <span class="optional">(facultatif)</span></label>
                <input
                  id="ep-tel"
                  type="tel"
                  [(ngModel)]="draft.telephone"
                  name="telephone"
                  placeholder="Ex : 55 123 456"
                  [class.invalid]="fieldError('telephone')"
                />
                @if (fieldError('telephone')) {
                  <span class="field-err">{{ fieldError('telephone') }}</span>
                }
              </div>

              <!-- message d'erreur global -->
              @if (saveError) {
                <div class="alert alert-error">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7
                      4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1
                      1 0 00-1-1z" clip-rule="evenodd"/>
                  </svg>
                  {{ saveError }}
                </div>
              }

              <div class="form-actions">
                <button type="submit" class="btn-save" [disabled]="saving">
                  @if (saving) {
                    <span class="spinner"></span> Enregistrement…
                  } @else {
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8
                        8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1
                        1 0 011.414 0z" clip-rule="evenodd"/>
                    </svg>
                    Enregistrer
                  }
                </button>
                <button type="button" class="btn-cancel" (click)="cancelEdit()" [disabled]="saving">
                  Annuler
                </button>
              </div>

            </form>
          }

          <!-- ── Message de succès ── -->
          @if (saveSuccess) {
            <div class="alert alert-success">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1
                  1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0
                  001.414 0l4-4z" clip-rule="evenodd"/>
              </svg>
              Profil mis à jour avec succès.
            </div>
          }

          <div class="profile-footer">
            <button type="button" class="btn-logout" (click)="logout()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                <path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h6a1 1 0
                  000-2H4V5h5a1 1 0 000-2H3zm10.293 4.293a1 1 0 011.414 0L17 9.586V7a1
                  1 0 112 0v5a1 1 0 01-1 1h-5a1 1 0 010-2h2.586l-2.293-2.293a1 1 0
                  010-1.414z" clip-rule="evenodd"/>
              </svg>
              Se déconnecter
            </button>
          </div>
        </div>

        <!-- ── Statistiques ── -->
        <div class="card stats-card">
          <h3>Demandes envoyées</h3>
          <div class="stat-num">{{ interests.length }}</div>
          <p class="muted">Agences contactées : <strong>{{ uniqueAgencies() }}</strong></p>
          <a class="btn-link" routerLink="/biens/vente">Continuer à explorer →</a>
        </div>

        <!-- ── Explorer ── -->
        <div class="card explore-card">
          <h3>Envie d'aller plus loin ?</h3>
          <p>Découvrez les dernières opportunités sur le marché.</p>
          <div class="actions">
            <a class="btn-primary" routerLink="/biens/vente">Voir les ventes</a>
            <a class="btn-secondary" routerLink="/biens/location">Voir les locations</a>
          </div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════
           LISTE DES DEMANDES D'INTÉRÊT
      ═══════════════════════════════════════════════════ -->
      <section class="interests">
        <header>
          <h2>Mes biens d'intérêt</h2>
          <p class="muted">Suivi de toutes vos demandes envoyées aux agences.</p>
        </header>

        @if (loading) {
          <div class="loading">Chargement…</div>
        }

        @if (!loading && !interests.length) {
          <div class="empty">
            <h3>Aucune demande pour le moment</h3>
            <p>Cliquez sur « Intéressé par ce bien » sur une annonce pour démarrer.</p>
            <a class="btn-primary" routerLink="/biens/vente">Découvrir des biens</a>
          </div>
        }

        @if (!loading && interests.length) {
          <ul class="interest-list">
            @for (it of interests; track it.id) {
              <li>
                <a [routerLink]="['/biens', it.propertyId]" class="thumb">
                  @if (it.propertyMainImageUrl) {
                    <img [src]="resolveImg(it.propertyMainImageUrl)" [alt]="it.propertyTitle" />
                  } @else {
                    <div class="fallback">{{ initials(it.propertyTitle) }}</div>
                  }
                </a>
                <div class="info">
                  <a [routerLink]="['/biens', it.propertyId]"><strong>{{ it.propertyTitle }}</strong></a>
                  <span class="loc">{{ formatLoc(it) }}</span>
                  @if (it.agencyName) {
                    <span class="agency">Agence : {{ it.agencyName }}</span>
                  }
                  <span class="date">Envoyée le {{ formatDate(it.createdAt) }}</span>
                </div>
                <span class="status" [class]="statusClass(it.status)">{{ statusLabel(it.status) }}</span>
              </li>
            }
          </ul>
        }
      </section>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .container { width: 100%; max-width: 1240px; margin: 0 auto; padding: 0 24px; }

    /* ── En-tête ──────────────────────────────────────── */
    .head {
      background: linear-gradient(180deg, #eef2f7 0%, #f8fafc 100%);
      padding: 48px 0 32px;
      border-bottom: 1px solid #e2e8f0;
    }
    .crumb { font-size: 13px; color: #64748b; }
    .head h1 { margin: 6px 0; font-size: 30px; color: #0f172a; }
    .head p  { color: #475569; margin: 0; }

    .content { padding: 32px 0 80px; }

    /* ── Grille de cartes ──────────────────────────────── */
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 20px;
      margin-bottom: 36px;
      align-items: start;
    }
    .card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 22px;
    }
    .card h3 { margin: 0 0 14px; font-size: 16px; color: #0f172a; }

    /* ══════════════════════════════════════════════════
       CARTE PROFIL
    ═══════════════════════════════════════════════════ */
    .card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
    }
    .card-head h3 { margin: 0; }

    /* Bouton crayon */
    .btn-edit {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 6px 12px;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      color: #475569;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .btn-edit:hover { background: #e2e8f0; color: #0f172a; }

    /* Liste en lecture seule */
    .profile-list {
      list-style: none;
      padding: 0;
      margin: 0 0 14px;
    }
    .profile-list li {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 9px 0;
      font-size: 14px;
      border-bottom: 1px solid #f1f5f9;
      gap: 12px;
    }
    .profile-list li:last-child { border-bottom: none; }
    .field-label { color: #64748b; flex-shrink: 0; }
    .profile-list strong {
      color: #0f172a;
      text-align: right;
      word-break: break-word;
    }

    /* ── Formulaire d'édition ──────────────────────────── */
    .edit-form { margin-bottom: 12px; }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 12px;
    }
    .form-group label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #64748b;
    }
    .form-group .optional {
      text-transform: none;
      font-weight: 400;
      letter-spacing: 0;
      color: #94a3b8;
    }
    .form-group input {
      height: 40px;
      padding: 0 12px;
      border: 1.5px solid #e2e8f0;
      border-radius: 9px;
      font-size: 14px;
      color: #0f172a;
      background: #fff;
      transition: border-color 0.15s;
      box-sizing: border-box;
      width: 100%;
    }
    .form-group input:focus {
      outline: none;
      border-color: #0b6bcb;
      box-shadow: 0 0 0 3px rgba(11,107,203,.12);
    }
    .form-group input.invalid {
      border-color: #ef4444;
      box-shadow: 0 0 0 3px rgba(239,68,68,.10);
    }
    .field-err {
      font-size: 11px;
      color: #ef4444;
      font-weight: 500;
    }

    /* Boutons du formulaire */
    .form-actions {
      display: flex;
      gap: 8px;
      margin-top: 4px;
    }
    .btn-save {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 9px 18px;
      background: linear-gradient(135deg, #0b6bcb, #084c91);
      border: none;
      color: #fff;
      font-size: 13px;
      font-weight: 700;
      border-radius: 9px;
      cursor: pointer;
      transition: opacity 0.15s, transform 0.15s;
    }
    .btn-save:hover:not(:disabled) { transform: translateY(-1px); }
    .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }

    .btn-cancel {
      padding: 9px 14px;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 9px;
      font-size: 13px;
      font-weight: 600;
      color: #475569;
      cursor: pointer;
      transition: background 0.15s;
    }
    .btn-cancel:hover:not(:disabled) { background: #e2e8f0; }
    .btn-cancel:disabled { opacity: 0.6; cursor: not-allowed; }

    /* Spinner inline */
    .spinner {
      display: inline-block;
      width: 12px;
      height: 12px;
      border: 2px solid rgba(255,255,255,.4);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Alertes */
    .alert {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border-radius: 9px;
      font-size: 13px;
      font-weight: 500;
      margin-top: 12px;
    }
    .alert-success {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: #166534;
    }
    .alert-error {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #991b1b;
    }

    /* Pied de carte */
    .profile-footer { margin-top: 16px; padding-top: 14px; border-top: 1px solid #f1f5f9; }
    .btn-logout {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 9px;
      font-size: 13px;
      font-weight: 600;
      color: #64748b;
      cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .btn-logout:hover { background: #fff1f2; border-color: #fecaca; color: #ef4444; }

    /* ── Cartes stats / explore ────────────────────────── */
    .stat-num { font-size: 36px; font-weight: 700; color: #0b6bcb; line-height: 1; margin-bottom: 4px; }
    .muted { color: #64748b; font-size: 13px; margin: 0 0 8px; }
    .btn-link { color: #0b6bcb; text-decoration: none; font-weight: 600; font-size: 14px; }
    .explore-card p { color: #475569; font-size: 14px; margin: 0 0 14px; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }

    .btn-primary, .btn-secondary {
      padding: 10px 16px; border-radius: 9px; font-weight: 600; font-size: 13px;
      border: none; cursor: pointer; text-decoration: none; display: inline-block;
      transition: opacity 0.15s;
    }
    .btn-primary:hover, .btn-secondary:hover { opacity: 0.88; }
    .btn-primary  { background: linear-gradient(135deg, #0b6bcb, #084c91); color: #fff; }
    .btn-secondary { background: #fff; color: #0f172a; border: 1px solid #e2e8f0; }

    /* ── Section intérêts ──────────────────────────────── */
    .interests header { margin-bottom: 18px; }
    .interests h2 { font-size: 22px; color: #0f172a; margin: 0 0 4px; }
    .empty {
      padding: 40px 24px; text-align: center; background: #fff;
      border: 1px dashed #cbd5e1; border-radius: 14px;
    }
    .empty h3 { margin: 0 0 6px; color: #0f172a; }
    .empty p   { color: #64748b; margin: 0 0 14px; }

    .interest-list {
      list-style: none; padding: 0; margin: 0;
      display: flex; flex-direction: column; gap: 12px;
    }
    .interest-list li {
      background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
      padding: 14px; display: grid;
      grid-template-columns: 90px 1fr auto;
      gap: 16px; align-items: center;
    }
    .thumb {
      width: 90px; height: 70px; border-radius: 10px; overflow: hidden;
      background: #f1f5f9; display: block; flex-shrink: 0;
    }
    .thumb img { width: 100%; height: 100%; object-fit: cover; }
    .thumb .fallback {
      width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #cbd5e1, #94a3b8);
      color: #fff; font-weight: 700;
    }
    .info { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    .info a    { color: #0f172a; text-decoration: none; font-size: 15px; }
    .info a:hover { color: #0b6bcb; }
    .info .loc    { color: #475569; font-size: 13px; }
    .info .agency, .info .date { color: #64748b; font-size: 12px; }

    .status {
      padding: 5px 11px; border-radius: 999px; font-size: 11px;
      font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;
      white-space: nowrap;
    }
    .status.pending   { background: #fef3c7; color: #92400e; }
    .status.contacted { background: #dbeafe; color: #1e3a8a; }
    .status.closed    { background: #e2e8f0; color: #475569; }

    .loading { text-align: center; padding: 32px; color: #64748b; }

    /* ── Responsive ────────────────────────────────────── */
    @media (max-width: 880px) {
      .grid { grid-template-columns: 1fr; }
      .interest-list li { grid-template-columns: 70px 1fr; }
      .interest-list li .status { grid-column: span 2; justify-self: start; }
    }
    @media (max-width: 480px) {
      .form-row { grid-template-columns: 1fr; }
      .form-actions { flex-direction: column; }
      .btn-save, .btn-cancel { width: 100%; justify-content: center; }
    }
  `],
})
export class PublicDashboardComponent implements OnInit, OnDestroy {
  private auth   = inject(ClientAuthService);
  private interestService = inject(InterestRequestService);
  private portal = inject(PublicPortalService);
  private router = inject(Router);
  private cdr    = inject(ChangeDetectorRef);

  profile: ClientPublicProfile | null = null;
  interests: InterestRequestDTO[] = [];
  loading = true;

  // ── État du formulaire d'édition ──────────────────
  editMode  = false;
  saving    = false;
  saveSuccess = false;
  saveError: string | null = null;
  validationErrors: Record<string, string> = {};

  draft = { prenom: '', nom: '', email: '', telephone: '' };

  private subs: Subscription[] = [];
  private successTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.subs.push(
      this.auth.user$.subscribe((u) => { this.profile = u; this.cdr.detectChanges(); })
    );
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
    if (this.successTimer) clearTimeout(this.successTimer);
  }

  // ── Actions profil ────────────────────────────────

  startEdit(): void {
    if (!this.profile) return;
    this.draft = {
      prenom:    this.profile.prenom    ?? '',
      nom:       this.profile.nom       ?? '',
      email:     this.profile.email     ?? '',
      telephone: this.profile.telephone ?? '',
    };
    this.validationErrors = {};
    this.saveError   = null;
    this.saveSuccess = false;
    this.editMode    = true;
  }

  cancelEdit(): void {
    this.editMode = false;
    this.saveError = null;
    this.validationErrors = {};
  }

  saveProfile(): void {
    this.validationErrors = {};
    this.saveError = null;

    // Validation locale
    if (!this.draft.prenom.trim()) this.validationErrors['prenom'] = 'Le prénom est requis.';
    if (!this.draft.nom.trim())    this.validationErrors['nom']    = 'Le nom est requis.';
    if (!this.draft.email.trim())  this.validationErrors['email']  = 'L\'email est requis.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.draft.email.trim()))
      this.validationErrors['email'] = 'Email invalide.';

    if (Object.keys(this.validationErrors).length > 0) {
      this.cdr.detectChanges();
      return;
    }

    this.saving = true;
    this.subs.push(
      this.auth.updateProfile({
        prenom:    this.draft.prenom.trim(),
        nom:       this.draft.nom.trim(),
        email:     this.draft.email.trim(),
        telephone: this.draft.telephone.trim() || undefined,
      }).pipe(
        finalize(() => { this.saving = false; this.cdr.detectChanges(); })
      ).subscribe({
        next: () => {
          this.editMode    = false;
          this.saveSuccess = true;
          this.cdr.detectChanges();
          // Masquer le message après 4 secondes
          this.successTimer = setTimeout(() => {
            this.saveSuccess = false;
            this.cdr.detectChanges();
          }, 4000);
        },
        error: (err) => {
          const msg = err?.error?.error;
          this.saveError = msg || 'Une erreur est survenue. Réessayez.';
          this.cdr.detectChanges();
        },
      })
    );
  }

  fieldError(field: string): string | null {
    return this.validationErrors[field] ?? null;
  }

  // ── Auth ──────────────────────────────────────────

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/');
  }

  // ── Intérêts ─────────────────────────────────────

  uniqueAgencies(): number {
    return new Set(this.interests.map((i) => i.agencyName).filter(Boolean)).size;
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
    const map: Record<string, string> = {
      PENDING:   'En attente',
      CONTACTED: 'Contacté',
      CLOSED:    'Clôturée',
    };
    return map[s] || s;
  }

  statusClass(s: string): string {
    return s.toLowerCase();
  }
}
