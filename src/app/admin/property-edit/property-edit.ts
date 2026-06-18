import { Component, OnInit, ChangeDetectorRef, AfterViewInit, OnDestroy, ViewChild, ElementRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpEventType } from '@angular/common/http';
import * as L from 'leaflet';
import { firstValueFrom, of, combineLatest, Observable, Subscription } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, filter, finalize, map, switchMap, tap } from 'rxjs/operators';
import { apiBaseUrl } from '../../services/api-config';
import { GeocodingService } from '../../services/geocoding-service';
import { AdminAuthService } from '../services/admin-auth';
import { AgencyAdminItem, PropertiesAdminService } from '../services/properties-admin.service';
import { AiService, AIPriceResponse, AIRentalPriceResponse } from '../services/ai.service';
import { VirtualTourDTO, VirtualTourService } from '../services/virtual-tour.service';
import { VirtualTourModalComponent } from '../virtual-tour-modal/virtual-tour-modal.component';
import { GaussianSplatModalComponent } from '../gaussian-splat-modal/gaussian-splat-modal.component';
import { MapAnythingModalComponent } from '../mapanything-modal/mapanything-modal.component';

interface PropertyPayload {
  titre: string;
  description: string;
  type: string;
  prixVente: number | null;
  prixLocation: number | null;
  statut: string;
  surface: number | null;
  nbChambres: number | null;
  nbSallesDeBain: number | null;
  garage: boolean;
  piscine: boolean;
  jardin: boolean;
  meuble: boolean;
  etage: number | null;
  parkingSpaces: number | null;
  anneeConstruction: number | null;
  prochePlage: boolean;
  procheTransport: boolean;
  securite: boolean;
  climatisation: boolean;
  adresse: string;
  country: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  commissionPercentage: number | null;
  commissionType: string;
  isAffiliateEligible: boolean;
  rentalDurationMonths?: number | null;
}

@Component({
  selector: 'app-property-edit',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule, VirtualTourModalComponent, GaussianSplatModalComponent, MapAnythingModalComponent],
  templateUrl: './property-edit.html',
  styleUrl: './property-edit.scss',
})
export class PropertyEdit implements OnInit, AfterViewInit, OnDestroy {
  form!: FormGroup;
  isEditMode = false;
  propertyId: number | null = null;
  loading = false;
  saving = false;
  successMessage = '';
  errorMessage = '';
  activeSection = 'general';
  // ── Image management (unified) ───────────────────────────────────────────
  imageItems: Array<
    | { kind: 'existing'; id: number; url: string; isPrimary: boolean; fileName?: string }
    | { kind: 'new'; file: File; previewUrl: string; isPrimary: boolean }
  > = [];
  imagesToDelete: number[] = [];
  imageError: string | null = null;
  private originalPrimaryId: number | null = null;

  // ── Model / video ────────────────────────────────────────────────────────
  uploadingImage = false;
  modelPreviewName = '';
  modelPreviewUrl = '';
  selectedModelFile: File | null = null;
  uploadingModel = false;
  modelUploadProgress = 0;
  modelDragOver = false;
  modelError = '';
  videoPreviewName = '';
  videoPreviewUrl = '';
  selectedVideoFile: File | null = null;
  uploadingVideo = false;
  searchControl = new FormControl('');
  mapReady = false;
  isGeocoding = false;
  isReverseGeocoding = false;
  private map: L.Map | null = null;
  private marker: L.Marker | null = null;
  private formSyncLock = false;
  private subscriptions: Subscription[] = [];

  @ViewChild('mapContainer', { static: false }) mapContainer?: ElementRef<HTMLDivElement>;

  // ── Virtual tour ─────────────────────────────────────────────────────────
  showTourModal = false;
  existingTour: VirtualTourDTO | null = null;

  // ── Gaussian Splatting ───────────────────────────────────────────────────
  showGaussianModal = false;

  onSplatAccepted(model: any): void {
    this.showGaussianModal = false;
    this.modelPreviewUrl = `${apiBaseUrl}/api/models/public/${model.id}`;
    this.modelPreviewName = model.fileName || 'Gaussian Splat 3D';
    this.successMessage = 'Modèle Gaussian Splatting accepté avec succès.';
    this.cdr.markForCheck();
    setTimeout(() => { this.successMessage = ''; this.cdr.markForCheck(); }, 5000);
  }

  // ── MapAnything 3D reconstruction ────────────────────────────────────────
  showMapAnythingModal = false;

  onMapAnythingDone(event: { id: number; glbUrl: string }): void {
    this.showMapAnythingModal = false;
    this.modelPreviewUrl = event.glbUrl;
    this.modelPreviewName = 'Reconstruction 3D MapAnything';
    this.successMessage = 'Modèle 3D GLB généré et publié avec succès.';
    this.cdr.markForCheck();
    setTimeout(() => { this.successMessage = ''; this.cdr.markForCheck(); }, 5000);
  }

  async handleMapAnythingButtonClick(): Promise<void> {
    if (this.propertyId) {
      // Edit mode: property already exists — open the modal directly
      this.showMapAnythingModal = true;
      this.cdr.markForCheck();
      return;
    }

    // Create mode: the property has not been saved yet.
    // Validate the form, create the property, then open the modal with the new ID.

    if (this.pendingSaleApproval === 'PENDING') {
      this.errorMessage = "Une demande de vente est en attente d'approbation.";
      this.cdr.markForCheck();
      return;
    }
    if (this.isFinalized) {
      this.errorMessage = 'Ce bien est définitivement vendu. Aucune modification possible.';
      this.cdr.markForCheck();
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const errFields  = ['titre', 'description', 'type', 'statut'];
      const locFields  = ['adresse', 'country', 'city'];
      const priceFields = ['prixVente', 'prixLocation'];
      if (errFields.some(f => this.form.get(f)?.invalid))       this.activeSection = 'general';
      else if (locFields.some(f => this.form.get(f)?.invalid))  this.activeSection = 'location';
      else if (priceFields.some(f => this.form.get(f)?.invalid)) this.activeSection = 'pricing';
      this.errorMessage = 'Complétez les champs obligatoires avant de générer le modèle 3D.';
      this.cdr.markForCheck();
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.cdr.markForCheck();

    try {
      const created = await firstValueFrom(
        this.http.post<any>(this.apiUrl, this.buildPayload())
      );
      this.propertyId = created.id;
      this.isEditMode = true;
      console.log('[MapAnything] Bien créé id=%d — ouverture de la modale', this.propertyId);
      this.successMessage = 'Bien créé. Ouverture de la reconstruction 3D…';
      this.cdr.markForCheck();
      setTimeout(() => {
        this.successMessage = '';
        this.showMapAnythingModal = true;
        this.cdr.markForCheck();
      }, 600);
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Erreur lors de la création du bien.';
      console.error('[MapAnything] handleMapAnythingButtonClick — création échouée:', err);
      this.errorMessage = msg;
      this.cdr.markForCheck();
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  private buildPayload(): PropertyPayload {
    // Use getRawValue() to include disabled controls (e.g. statut locked for LOUE)
    const v = this.form.getRawValue();
    const isVente = v.categorie === 'VENTE';
    return {
      titre: v.titre,
      description: v.description,
      type: v.type,
      // When statut is locked (LOUE), send the existing value — backend enforces no change
      statut: v.statut,
      prixVente: isVente ? v.prixVente : null,
      prixLocation: isVente ? null : v.prixLocation,
      surface: v.surface,
      nbChambres: v.nbChambres,
      nbSallesDeBain: v.nbSallesDeBain ?? null,
      garage: !!v.garage,
      piscine: !!v.piscine,
      jardin: !!v.jardin,
      meuble: !!v.meuble,
      etage: v.etage ?? null,
      parkingSpaces: v.parkingSpaces ?? null,
      anneeConstruction: v.anneeConstruction ?? null,
      prochePlage: !!v.prochePlage,
      procheTransport: !!v.procheTransport,
      securite: !!v.securite,
      climatisation: !!v.climatisation,
      adresse: v.adresse,
      country: v.country,
      city: v.city,
      latitude: v.latitude,
      longitude: v.longitude,
      // Commission + affiliate workflow apply to VENTE only
      commissionPercentage: isVente ? v.commissionPercentage : null,
      commissionType: isVente ? v.commissionType : 'PERCENTAGE',
      isAffiliateEligible: isVente ? (v.isAffiliateEligible ?? false) : false,
      // Rental duration only relevant for LOCATION + LOUE status
      rentalDurationMonths: !isVente ? (v.rentalDurationMonths ?? null) : null,
    };
  }

  private readonly apiUrl = `${apiBaseUrl}/api/properties`;
  private readonly modelUploadUrl = `${apiBaseUrl}/api/models/property`;
  private readonly videoUploadUrl = `${apiBaseUrl}/api/videos/property`;
 
  readonly propertyTypes = [
    { value: 'APPARTEMENT', label: 'Appartement' },
    { value: 'MAISON', label: 'Maison' },
    { value: 'VILLA', label: 'Villa' },
    { value: 'TERRAIN', label: 'Terrain' },
    { value: 'COMMERCIAL', label: 'Commercial' },
    { value: 'LOFT', label: 'Loft' },
  ];
 
  readonly statuts = [
    { value: 'DISPONIBLE', label: 'Disponible' },
    { value: 'RESERVE', label: 'Réservé' },
    { value: 'VENDU', label: 'Vendu' },
    { value: 'LOUE', label: 'Loué' },
    { value: 'EN_ATTENTE', label: 'En attente' },
  ];

  readonly venteStatuses = ['DISPONIBLE', 'EN_ATTENTE', 'VENDU'];
  readonly locationStatuses = ['DISPONIBLE', 'EN_ATTENTE', 'LOUE'];
 
  readonly commissionTypes = [
    { value: 'PERCENTAGE', label: 'Pourcentage (%)' },
    { value: 'FIXED', label: 'Montant fixe (TND)' },
  ];
 
  get sections() {
    const base = [
      { id: 'general', label: 'Informations', icon: 'fa-file-alt' },
      { id: 'location', label: 'Localisation', icon: 'fa-map-marker-alt' },
      { id: 'pricing', label: 'Tarification', icon: 'fa-tag' },
      { id: 'media', label: 'Médias', icon: 'fa-images' },
      { id: 'advanced-media', label: 'Médias 3D/Video', icon: 'fa-cube' },
    ];
    if (this.isSuperAdmin && this.isEditMode && this.isSuperAdminOwned) {
      base.push({ id: 'sharing', label: 'Partage', icon: 'fa-share-nodes' });
    }
    return base;
  }

  // ─── Ownership / share state ───────────────────────────────────────────────
  currentOwnerType: string | null = null;
  availableAdmins: AgencyAdminItem[] = [];
  selectedAdminIds = new Set<number>();
  sharingLoading = false;
  shareSaved = false;

  // ─── Validation workflow state ────────────────────────────────────────────
  validationStatus: string | null = null;
  commissionLocked = false;
  priceLocked = false;
  rejectionReason: string | null = null;
  createdById: number | null = null;

  // ─── Sale approval state (NOUVEAU) ─────────────────────────────────────────
  pendingSaleApproval: 'PENDING' | 'APPROVED' | 'REJECTED' | null = null;
  pendingSaleStatut: string | null = null;
  pendingSaleRejectionReason: string | null = null;
  pendingSaleApproverRole: 'ADMIN' | 'SUPER_ADMIN' | null = null;
  approvingSale = false;

  // ─── Status lock state ────────────────────────────────────────────────────
  isStatusLocked = false;      // true for both VENDU (permanent) and LOUE (until end date)
  isFinalized = false;         // true ONLY for VENDU — blocks ALL edits permanently
  statusLockReason: string | null = null;
  rentalEndDate: string | null = null;   // ISO date from backend DTO

  readonly currentYear = new Date().getFullYear();

  // ─── AI price estimation ──────────────────────────────────────────────────
  aiEstimation: AIPriceResponse | AIRentalPriceResponse | null = null;
  aiEstimating = false;
  aiError: string | null = null;

  // ─── Status confirmation modal ────────────────────────────────────────────
  statusConfirmModalOpen = false;
  pendingStatusValue: string | null = null;   // the status the user wants to switch to
  prevStatusValue: string | null = null;      // to revert dropdown if user cancels
  // LOUE modal inputs
  loueMonths: number | null = null;
  loueEndDate: string | null = null;          // ISO date string (yyyy-MM-dd)
  
  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private geocodingService: GeocodingService,
    private authService: AdminAuthService,
    private propertiesService: PropertiesAdminService,
    private aiService: AiService,
    private virtualTourService: VirtualTourService
  ) {}

  get currentRole(): string {
    return (this.authService.getCurrentUser()?.role || '').toUpperCase();
  }

  get isSuperAdmin(): boolean {
    return this.currentRole === 'SUPER_ADMIN';
  }

  get isAdminRole(): boolean {
    return this.currentRole === 'ADMIN';
  }

  get isResponsable(): boolean {
    return this.currentRole === 'RESPONSABLE_COMMERCIAL';
  }

  get isCommercial(): boolean {
    return this.currentRole === 'COMMERCIAL';
  }

  /** Only ADMIN/SUPER_ADMIN can edit commission. Locked once set. */
  get canEditCommission(): boolean {
    if (!(this.isAdminRole || this.isSuperAdmin)) return false;
    return true;
  }

  /** COMMERCIAL never edits price; others blocked once priceLocked. */
  get canEditPrice(): boolean {
    if (this.isCommercial) return false;
    if (this.priceLocked && !(this.isAdminRole || this.isSuperAdmin)) return false;
    return true;
  }

  /** Approval buttons appear for upstream validators when the property is pending. */
  get canApprove(): boolean {
    if (!this.isEditMode) return false;
    if (this.validationStatus === 'PENDING_RESPONSABLE') {
      return this.isResponsable || this.isAdminRole || this.isSuperAdmin;
    }
    if (this.validationStatus === 'PENDING_ADMIN' || this.validationStatus === 'REJECTED') {
      return this.isAdminRole || this.isSuperAdmin;
    }
    return false;
  }

  /** Nouveau getter pour l'approbation de vente */
  get canApproveSale(): boolean {
    if (this.pendingSaleApproval !== 'PENDING') return false;
    if (this.currentRole === 'SUPER_ADMIN') return true;
    if (this.currentRole === 'ADMIN' && this.pendingSaleApproverRole === 'ADMIN') return true;
    return false;
  }

  get isSuperAdminOwned(): boolean {
    return this.currentOwnerType === 'SUPER_ADMIN_OWNED';
  }

  /**
   * True when the current user cannot mutate this property at all — entire form is disabled.
   * Covers three cases:
   *   1. SUPER_ADMIN viewing an AGENCY_OWNED property
   *   2. ADMIN viewing a SUPER_ADMIN_OWNED property
   *   3. RESPONSABLE_COMMERCIAL viewing a SUPER_ADMIN_OWNED property
   */
  get isReadOnly(): boolean {
    if (!this.isEditMode) return false;
    if (this.isSuperAdmin && this.currentOwnerType === 'AGENCY_OWNED') return true;
    if ((this.isAdminRole || this.isResponsable) && this.currentOwnerType === 'SUPER_ADMIN_OWNED') return true;
    return false;
  }

  /** @deprecated Use isReadOnly instead */
  get isReadOnlyForSuperAdmin(): boolean {
    return this.isReadOnly;
  }

  get readOnlyBannerMessage(): string {
    if (!this.isReadOnly) return '';
    if (this.isSuperAdmin) return 'Lecture seule — vous ne pouvez pas modifier ce bien (appartient à une agence).';
    if (this.isAdminRole) return 'Lecture seule — ce bien appartient au Super Admin. Vous pouvez le consulter et le vendre.';
    if (this.isResponsable) return 'Lecture seule — ce bien appartient au Super Admin. Vous pouvez uniquement le consulter.';
    return 'Lecture seule.';
  }
 
  ngOnInit(): void {
    console.log('🟢 PropertyEdit - Initialisation');
    this.buildForm();
    
    // ✅ Utiliser setTimeout pour éviter ExpressionChangedAfterItHasBeenCheckedError
    setTimeout(() => {
      this.route.paramMap
        .pipe(
          map(params => params.get('id')),
          tap(id => {
            this.errorMessage = '';
            if (!id) {
              this.isEditMode = false;
              this.propertyId = null;
              this.loading = false;
              return;
            }
            this.isEditMode = true;
            this.propertyId = Number(id);
            this.loading = true;
          }),
          switchMap(id => {
            if (!id) return of(null);
            const numericId = Number(id);
            if (Number.isNaN(numericId)) {
              this.errorMessage = 'Identifiant invalide.';
              return of(null);
            }
            return this.http.get<any>(`${this.apiUrl}/${numericId}`).pipe(
              catchError(error => {
                console.error('🔴 Erreur chargement:', error);
                this.errorMessage = 'Impossible de charger le bien.';
                return of(null);
              }),
              finalize(() => {
                this.loading = false;
              })
            );
          })
        )
        .subscribe(property => {
          if (property) {
            this.applyProperty(property);
          }
        });
    }, 0);
  }
 
  private buildForm(): void {
    this.form = this.fb.group({
      titre: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(255)]],
      description: ['', [Validators.maxLength(2000)]],
      type: ['APPARTEMENT', Validators.required],
      statut: ['DISPONIBLE', Validators.required],
      categorie: ['VENTE'],
      prixVente: [null],
      prixLocation: [null],
      surface: [null, [Validators.min(1)]],
      nbChambres: [null, [Validators.min(0)]],
      nbSallesDeBain: [null, [Validators.min(0)]],
      garage: [false],
      piscine: [false],
      jardin: [false],
      meuble: [false],
      etage: [null, [Validators.min(0), Validators.max(50)]],
      parkingSpaces: [null, [Validators.min(0)]],
      anneeConstruction: [null, [Validators.min(1900), Validators.max(new Date().getFullYear())]],
      prochePlage: [false],
      procheTransport: [false],
      securite: [false],
      climatisation: [false],
      adresse: ['', Validators.required],
      country: ['Tunisie'],
      city: [''],
      latitude: [null],
      longitude: [null],
      commissionPercentage: [null],
      commissionType: ['PERCENTAGE'],
      isAffiliateEligible: [false],
      rentalDurationMonths: [null, [Validators.min(1)]],
    });
 
    // ✅ Utiliser markForCheck() au lieu de detectChanges()
    this.form.get('categorie')?.valueChanges.subscribe(cat => {
      const prixVente = this.form.get('prixVente');
      const prixLocation = this.form.get('prixLocation');
      if (cat === 'VENTE') {
        prixVente?.setValidators([Validators.required, Validators.min(0)]);
        prixLocation?.clearValidators();
      } else {
        prixLocation?.setValidators([Validators.required, Validators.min(0)]);
        prixVente?.clearValidators();
        // Rentals never use the commission/affiliate workflow — wipe those fields
        // so stale values cannot leak into the payload.
        this.form.patchValue(
          {
            commissionPercentage: null,
            commissionType: 'PERCENTAGE',
            isAffiliateEligible: false,
          },
          { emitEvent: false }
        );
      }
      prixVente?.updateValueAndValidity();
      prixLocation?.updateValueAndValidity();
      this.ensureStatusMatchesCategory();
      this.cdr.markForCheck();  // ✅ markForCheck au lieu de detectChanges
    });
 
    this.form.get('categorie')?.setValue('VENTE');

    // Intercept status changes that require confirmation (VENDU or LOUE)
    this.form.get('statut')?.valueChanges.subscribe((newStatus: string) => {
      if (!this.isEditMode) return;
      if (newStatus === 'VENDU' || newStatus === 'LOUE') {
        // Revert immediately; we'll apply only after confirmation
        const current = this.prevStatusValue ?? 'DISPONIBLE';
        this.form.get('statut')?.setValue(current, { emitEvent: false });
        this.openStatusConfirmModal(newStatus, current);
      } else {
        this.prevStatusValue = newStatus;
      }
    });

    this.setupLocationSync();
    this.applyRoleBasedFieldLocks();
  }

  /**
   * Disable price + commission controls based on role and lock state. The backend
   * is authoritative — these toggles are pure UX.
   */
  private applyRoleBasedFieldLocks(): void {
    // Read-only scenarios → freeze the entire form (SUPER_ADMIN on agency, ADMIN/RESPONSABLE on super-admin-owned)
    if (this.isReadOnly) {
      this.form?.disable({ emitEvent: false });
      return;
    }
    const priceCtrls = ['prixVente', 'prixLocation'];
    const commissionCtrls = ['commissionPercentage', 'commissionType', 'isAffiliateEligible'];
    priceCtrls.forEach(name => {
      const ctrl = this.form?.get(name);
      if (!ctrl) return;
      this.canEditPrice ? ctrl.enable({ emitEvent: false }) : ctrl.disable({ emitEvent: false });
    });
    commissionCtrls.forEach(name => {
      const ctrl = this.form?.get(name);
      if (!ctrl) return;
      this.canEditCommission ? ctrl.enable({ emitEvent: false }) : ctrl.disable({ emitEvent: false });
    });
  }

  // ─── Workflow actions (validate/reject) ───────────────────────────────────
  approveProperty(): void {
    if (!this.propertyId) return;

    // Commission is mandatory ONLY for the ADMIN/SUPER_ADMIN final approval of a
    // VENTE. RESPONSABLE_COMMERCIAL is an operational validator — never blocked
    // by commission, never edits pricing.
    const commissionPercentage = this.form.get('commissionPercentage')?.value ?? null;
    const isFinancialApprover = this.isAdminRole || this.isSuperAdmin;
    if (isFinancialApprover && this.isVente
        && (commissionPercentage == null || commissionPercentage <= 0)) {
      this.errorMessage =
        'Veuillez saisir la commission (%) puis « Sauvegarder » avant de valider le bien.';
      this.cdr.markForCheck();
      return;
    }

    this.errorMessage = '';
    this.http
      .put<any>(`${this.apiUrl}/${this.propertyId}/validate`, { commissionPercentage })
      .subscribe({
        next: updated => {
          this.successMessage = 'Bien validé.';
          this.validationStatus = updated.validationStatus;
          this.cdr.markForCheck();
        },
        error: err => {
          this.errorMessage = err?.error?.error || 'Validation impossible.';
          this.cdr.markForCheck();
        },
      });
  }

  rejectProperty(): void {
    if (!this.propertyId) return;
    const reason = window.prompt('Raison du refus (obligatoire) :') || '';
    if (!reason.trim()) return;
    this.http.put<any>(`${this.apiUrl}/${this.propertyId}/reject`, { reason }).subscribe({
      next: updated => {
        this.successMessage = 'Bien refusé.';
        this.validationStatus = updated.validationStatus;
        this.rejectionReason = updated.rejectionReason;
        this.cdr.markForCheck();
      },
      error: err => {
        this.errorMessage = err?.error?.error || 'Refus impossible.';
        this.cdr.markForCheck();
      },
    });
  }
 
  // ─── Sale approval actions (NOUVEAU) ────────────────────────────────────────
  
  approveSale(): void {
    if (!this.propertyId) return;
    this.approvingSale = true;
    this.http.put<any>(`${this.apiUrl}/${this.propertyId}/approve-sale`, {}).subscribe({
      next: updated => {
        this.successMessage = 'Vente approuvée avec succès.';
        this.pendingSaleApproval = updated.pendingSaleApproval;
        this.pendingSaleStatut = updated.pendingSaleStatut;
        if (updated.statut === this.pendingSaleStatut) {
          // Le statut a été appliqué
          this.form.patchValue({ statut: updated.statut });
        }
        this.approvingSale = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.errorMessage = err?.error?.error || 'Impossible d\'approuver la vente.';
        this.approvingSale = false;
        this.cdr.markForCheck();
      }
    });
  }

  rejectSale(): void {
    if (!this.propertyId) return;
    const reason = window.prompt('Raison du refus (obligatoire) :') || '';
    if (!reason.trim()) return;
    
    this.approvingSale = true;
    this.http.put<any>(`${this.apiUrl}/${this.propertyId}/reject-sale`, { reason }).subscribe({
      next: updated => {
        this.successMessage = 'Demande de vente refusée.';
        this.pendingSaleApproval = updated.pendingSaleApproval;
        this.pendingSaleRejectionReason = updated.pendingSaleRejectionReason;
        this.approvingSale = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.errorMessage = err?.error?.error || 'Impossible de refuser la vente.';
        this.approvingSale = false;
        this.cdr.markForCheck();
      }
    });
  }
 
  private applyProperty(property: any): void {
    console.log('📝 Application des données au formulaire');
    const medias = Array.isArray(property?.medias) ? property.medias : [];
    const imageMedias = medias.filter((media: any) => media?.type === 'IMAGE');
    const videoMedias = medias.filter((media: any) => media?.type === 'VIDEO');
    const modelMedias = medias.filter((media: any) => media?.type === 'MODEL_3D');
    const categorie = property.prixVente ? 'VENTE' : 'LOCATION';

    // Capture ownership so the Partage section can be conditionally shown
    this.currentOwnerType = property.ownerType ?? null;
    this.validationStatus = property.validationStatus ?? null;
    this.commissionLocked = !!property.commissionLocked;
    this.priceLocked = !!property.priceLocked;
    this.rejectionReason = property.rejectionReason ?? null;
    this.createdById = property.createdById ?? null;
    
    // NOUVEAU: Récupération des champs d'approbation de vente
    this.pendingSaleApproval = property.pendingSaleApproval ?? null;
    this.pendingSaleStatut = property.pendingSaleStatut ?? null;
    this.pendingSaleRejectionReason = property.pendingSaleRejectionReason ?? null;
    this.pendingSaleApproverRole = property.pendingSaleApproverRole ?? null;

    // Status lock (VENDU / LOUE en cours / EN_ATTENTE affilié)
    this.isStatusLocked = !!property.isStatusLocked;
    this.isFinalized = !!property.isFinalized;   // permanent VENDU lock
    this.statusLockReason = property.statusLockReason ?? null;
    this.rentalEndDate = property.rentalEndDate ?? null;
    this.prevStatusValue = property.statut ?? 'DISPONIBLE';

    if (this.isSuperAdmin && property.ownerType === 'SUPER_ADMIN_OWNED' && this.propertyId) {
      this.loadSharingInfo(this.propertyId);
    }
    this.applyRoleBasedFieldLocks();
    
    this.form.patchValue({
      titre: property.titre,
      description: property.description,
      type: property.type,
      statut: property.statut,
      categorie,
      prixVente: property.prixVente,
      prixLocation: property.prixLocation,
      surface: property.surface,
      nbChambres: property.nbChambres,
      nbSallesDeBain: (property as any).nbSallesDeBain ?? null,
      garage: !!(property as any).garage,
      piscine: !!(property as any).piscine,
      jardin: !!(property as any).jardin,
      meuble: !!(property as any).meuble,
      etage: (property as any).etage ?? null,
      parkingSpaces: (property as any).parkingSpaces ?? null,
      anneeConstruction: (property as any).anneeConstruction ?? null,
      prochePlage: !!(property as any).prochePlage,
      procheTransport: !!(property as any).procheTransport,
      securite: !!(property as any).securite,
      climatisation: !!(property as any).climatisation,
      adresse: property.adresse,
      country: property.country,
      city: property.city,
      latitude: property.latitude,
      longitude: property.longitude,
      commissionPercentage: property.commissionPercentage,
      commissionType: property.commissionType || 'PERCENTAGE',
      isAffiliateEligible: property.isAffiliateEligible ?? false,
      rentalDurationMonths: property.rentalDurationMonths ?? null,
    });

    // VENDU (finalized): lock the entire form — no edits possible at all
    if (this.isFinalized) {
      this.form.disable({ emitEvent: false });
    } else if (this.isStatusLocked) {
      // LOUE active rental / EN_ATTENTE affiliate: only lock the status dropdown
      this.form.get('statut')?.disable({ emitEvent: false });
    }

    if (property.model3dUrl) {
      this.modelPreviewUrl = this.resolveMediaUrl(property.model3dUrl);
    }
    if (property.model3dName) {
      this.modelPreviewName = property.model3dName;
    }

    // Build unified imageItems array
    this.imageItems = [];
    this.imagesToDelete = [];
    this.originalPrimaryId = null;

    if (imageMedias.length) {
      this.imageItems = imageMedias.map((media: any) => ({
        kind: 'existing' as const,
        id: Number(media.id),
        url: this.resolveMediaUrl(media.url),
        isPrimary: !!media.isPrimary,
        fileName: media.fileName,
      }));

      // Ensure exactly one primary
      const hasPrimary = this.imageItems.some(i => i.isPrimary);
      if (!hasPrimary && this.imageItems.length > 0) {
        (this.imageItems[0] as any).isPrimary = true;
      }

      const primary = this.imageItems.find(i => i.isPrimary);
      this.originalPrimaryId = primary?.kind === 'existing' ? primary.id : null;
    }

    const primaryVideo = videoMedias.find((media: any) => media?.isPrimary) || videoMedias[0];
    if (property.mainVideoUrl || primaryVideo?.url) {
      this.videoPreviewUrl = this.resolveMediaUrl(property.mainVideoUrl || primaryVideo?.url);
    }
    if (property.mainVideoName || primaryVideo?.fileName) {
      this.videoPreviewName = property.mainVideoName || primaryVideo?.fileName || '';
    }

    if (!this.modelPreviewUrl) {
      const primaryModel = modelMedias[0];
      if (primaryModel?.url) {
        this.modelPreviewUrl = this.resolveMediaUrl(primaryModel.url);
      }
      if (!this.modelPreviewName && primaryModel?.fileName) {
        this.modelPreviewName = primaryModel.fileName;
      }
    }
    
    this.cdr.markForCheck();  // ✅ markForCheck au lieu de detectChanges

    this.syncMapWithForm();
    this.ensureStatusMatchesCategory();
  }

  ngAfterViewInit(): void {
    if (this.activeSection === 'location') {
      setTimeout(() => this.initializeMap(), 100);
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    // Revoke object URLs to prevent memory leaks
    this.imageItems.forEach(item => {
      if (item.kind === 'new') URL.revokeObjectURL(item.previewUrl);
    });
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
 
  setSection(id: string): void {
    this.activeSection = id;
    if (id === 'location') {
      if (!this.map) {
        setTimeout(() => this.initializeMap(), 100);
      } else {
        setTimeout(() => this.map?.invalidateSize(true), 150);
      }
    }
    this.cdr.markForCheck();  // ✅ markForCheck au lieu de detectChanges
  }
 
  get isVente(): boolean {
    return this.form.get('categorie')?.value === 'VENTE';
  }

  get modelSizeLabel(): string {
    if (!this.selectedModelFile?.size) return 'Fichier existant';
    const sizeMb = this.selectedModelFile.size / 1024 / 1024;
    return `${sizeMb.toFixed(1)} MB`;
  }

  get videoSizeLabel(): string {
    if (!this.selectedVideoFile?.size) return 'Fichier existant';
    const sizeMb = this.selectedVideoFile.size / 1024 / 1024;
    return `${sizeMb.toFixed(1)} MB`;
  }
 
  // ── Computed helpers ─────────────────────────────────────────────────────

  get primaryImagePreview(): string | null {
    const p = this.imageItems.find(i => i.isPrimary);
    if (!p) return null;
    return p.kind === 'existing' ? p.url : p.previewUrl;
  }

  get hasPrimaryImage(): boolean {
    return this.imageItems.some(i => i.isPrimary);
  }

  // ── Image operations ──────────────────────────────────────────────────────

  onImageSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.addImageFiles(Array.from(input.files));
    input.value = '';
  }

  onImageDrop(event: DragEvent): void {
    event.preventDefault();
    const files = Array.from(event.dataTransfer?.files || []).filter(f => f.type.startsWith('image/'));
    this.addImageFiles(files);
  }

  private addImageFiles(files: File[]): void {
    this.imageError = null;
    files.forEach(file => {
      if (!file.type.startsWith('image/')) {
        this.imageError = 'Format non supporté. Utilisez JPG, PNG ou WebP.';
        return;
      }
      const isPrimary = !this.hasPrimaryImage;
      this.imageItems.push({ kind: 'new', file, previewUrl: URL.createObjectURL(file), isPrimary });
    });
    this.cdr.markForCheck();
  }

  setItemAsPrimary(index: number): void {
    this.imageError = null;
    this.imageItems.forEach(item => (item as any).isPrimary = false);
    (this.imageItems[index] as any).isPrimary = true;
    this.cdr.markForCheck();
  }

  removeImageItem(index: number): void {
    const item = this.imageItems[index];
    if (!item) return;
    const wasPrimary = item.isPrimary;

    if (item.kind === 'existing') {
      this.imagesToDelete.push(item.id);
    } else {
      URL.revokeObjectURL(item.previewUrl);
    }

    this.imageItems.splice(index, 1);

    // Auto-assign primary to first remaining item if we removed the primary
    if (wasPrimary && this.imageItems.length > 0) {
      (this.imageItems[0] as any).isPrimary = true;
    }

    this.cdr.markForCheck();
  }

  moveImageItem(fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    if (fromIndex >= this.imageItems.length || toIndex >= this.imageItems.length) return;
    const [moved] = this.imageItems.splice(fromIndex, 1);
    this.imageItems.splice(toIndex, 0, moved);
    this.cdr.markForCheck();
  }

  getImageLabel(item: typeof this.imageItems[number]): string {
    return item.kind === 'new' ? item.file.name : (item.fileName || 'Image existante');
  }

  getImageSrc(item: typeof this.imageItems[number]): string {
    return item.kind === 'existing' ? item.url : item.previewUrl;
  }

  onModelSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    this.modelError = '';
    if (!this.isValidModelFile(file)) {
      this.modelError = 'Format non supporté. Formats acceptés : GLB, GLTF, OBJ, FBX, PLY.';
      return;
    }
    this.selectedModelFile = file;
    this.modelPreviewName = file.name;
    this.cdr.markForCheck();
  }

  onModelDrop(event: DragEvent): void {
    event.preventDefault();
    this.modelDragOver = false;
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    this.modelError = '';
    if (!this.isValidModelFile(file)) {
      this.modelError = 'Format non supporté. Formats acceptés : GLB, GLTF, OBJ, FBX, PLY.';
      this.cdr.markForCheck();
      return;
    }
    this.selectedModelFile = file;
    this.modelPreviewName = file.name;
    this.cdr.markForCheck();
  }

  onModelDragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.modelDragOver) {
      this.modelDragOver = true;
      this.cdr.markForCheck();
    }
  }

  onModelDragLeave(event: DragEvent): void {
    this.modelDragOver = false;
    this.cdr.markForCheck();
  }

  clearModel(): void {
    this.selectedModelFile = null;
    this.modelPreviewName = '';
    this.modelError = '';
    this.cdr.markForCheck();
  }

  getModelFormat(): string {
    const name = (this.selectedModelFile?.name || this.modelPreviewName).toLowerCase();
    if (name.endsWith('.glb'))  return 'glb';
    if (name.endsWith('.gltf')) return 'gltf';
    if (name.endsWith('.obj'))  return 'obj';
    if (name.endsWith('.fbx'))  return 'fbx';
    if (name.endsWith('.ply'))  return 'ply';
    return '3d';
  }

  onVideoSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    if (!this.isValidVideoFile(file)) {
      this.errorMessage = 'Format video non supporte (MP4).';
      return;
    }
    this.selectedVideoFile = file;
    this.videoPreviewName = file.name;
    this.cdr.markForCheck();
  }

  onVideoDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    if (!this.isValidVideoFile(file)) {
      this.errorMessage = 'Format video non supporte (MP4).';
      return;
    }
    this.selectedVideoFile = file;
    this.videoPreviewName = file.name;
    this.cdr.markForCheck();
  }

  clearVideo(): void {
    this.selectedVideoFile = null;
    this.videoPreviewName = '';
    this.cdr.markForCheck();
  }
 
  estimatePrice(): void {
    const v       = this.form.getRawValue();
    const city    = v.city;
    const type    = v.type;
    const surface = v.surface;

    if (!city || !type || !surface || surface <= 0) {
      this.aiError = 'Veuillez renseigner la ville, le type et la surface avant d\'estimer.';
      this.cdr.markForCheck();
      return;
    }

    const req = {
      city,
      type,
      surface,
      bedrooms:          v.nbChambres        ?? 0,
      bathrooms:         v.nbSallesDeBain     ?? 1,
      garage:            !!v.garage,
      piscine:           !!v.piscine,
      jardin:            !!v.jardin,
      meuble:            !!v.meuble,
      etage:             v.etage             ?? 0,
      parkingSpaces:     v.parkingSpaces      ?? 0,
      anneeConstruction: v.anneeConstruction  ?? null,
      prochePlage:       !!v.prochePlage,
      procheTransport:   !!v.procheTransport,
      securite:          !!v.securite,
      climatisation:     !!v.climatisation,
    };

    this.aiEstimating = true;
    this.aiError = null;
    this.aiEstimation = null;
    this.cdr.markForCheck();

    const call$: Observable<AIPriceResponse | AIRentalPriceResponse> = this.isVente
      ? this.aiService.predictSalePrice(req)
      : this.aiService.predictRentalPrice(req);

    call$
      .pipe(finalize(() => { this.aiEstimating = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: (res: AIPriceResponse | AIRentalPriceResponse) => { this.aiEstimation = res; },
        error: () => { this.aiError = 'Service IA indisponible. Vérifiez que le microservice Python tourne sur le port 8000.'; },
      });
  }

  get aiSaleEstimation(): AIPriceResponse | null {
    return this.isVente ? (this.aiEstimation as AIPriceResponse) : null;
  }

  get aiRentalEstimation(): AIRentalPriceResponse | null {
    return !this.isVente ? (this.aiEstimation as AIRentalPriceResponse) : null;
  }

  applyAIPrice(): void {
    if (!this.aiEstimation) return;
    const price = this.isVente
      ? (this.aiEstimation as AIPriceResponse).estimatedPrice
      : (this.aiEstimation as AIRentalPriceResponse).estimatedMonthlyRent;
    const field = this.isVente ? 'prixVente' : 'prixLocation';
    this.form.get(field)?.setValue(price);
    this.form.get(field)?.markAsTouched();
    this.cdr.markForCheck();
  }

  getFieldError(fieldName: string): string {
    const control = this.form.get(fieldName);
    if (!control?.invalid || !control.touched) return '';
    if (control.errors?.['required']) return 'Ce champ est obligatoire.';
    if (control.errors?.['minlength']) return `Minimum ${control.errors['minlength'].requiredLength} caractères.`;
    if (control.errors?.['maxlength']) return `Maximum ${control.errors['maxlength'].requiredLength} caractères.`;
    if (control.errors?.['min']) return 'La valeur doit être positive.';
    return 'Valeur invalide.';
  }
 
  isInvalid(fieldName: string): boolean {
    const c = this.form.get(fieldName);
    return !!(c?.invalid && c.touched);
  }
 
  async onSubmit(): Promise<void> {
    // ✅ NOUVEAU: Vérifier si une demande de vente est en attente
    if (this.pendingSaleApproval === 'PENDING') {
      this.errorMessage = 'Une demande de vente est en attente d\'approbation. Veuillez attendre la réponse avant de modifier le bien.';
      return;
    }

    // VENDU (finalized): entire form is disabled — block all saves permanently
    if (this.isFinalized) {
      this.errorMessage = 'Ce bien est définitivement vendu. Aucune modification n\'est possible.';
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const errFields = ['titre', 'description', 'type', 'statut'];
      const locFields = ['adresse', 'country', 'city'];
      const priceFields = ['prixVente', 'prixLocation'];
      if (errFields.some(f => this.form.get(f)?.invalid)) this.activeSection = 'general';
      else if (locFields.some(f => this.form.get(f)?.invalid)) this.activeSection = 'location';
      else if (priceFields.some(f => this.form.get(f)?.invalid)) this.activeSection = 'pricing';
      this.cdr.markForCheck();
      return;
    }

    // Validate primary image: required when images are present
    if (this.imageItems.length > 0 && !this.hasPrimaryImage) {
      this.errorMessage = 'Une image principale est obligatoire. Cliquez sur "Définir comme principale" sur l\'une de vos photos.';
      this.activeSection = 'media';
      this.cdr.markForCheck();
      return;
    }
 
    this.saving = true;
    this.successMessage = '';
    this.errorMessage = '';
    this.cdr.markForCheck();
 
    const payload = this.buildPayload();

    try {
      let savedId: number;

      if (this.isEditMode && this.propertyId) {
        await firstValueFrom(this.http.put<any>(`${this.apiUrl}/${this.propertyId}`, payload));
        savedId = this.propertyId;
      } else {
        const created = await firstValueFrom(this.http.post<any>(this.apiUrl, payload));
        savedId = created.id;
      }

      // ── Image pipeline ─────────────────────────────────────────────────────
      // 1. Upload new images (primary first to ensure mainImageId is set correctly)
      const newPrimary = this.imageItems.find(i => i.kind === 'new' && i.isPrimary) as
        | { kind: 'new'; file: File; isPrimary: boolean } | undefined;
      const newOthers = this.imageItems.filter(i => i.kind === 'new' && !i.isPrimary) as
        Array<{ kind: 'new'; file: File; isPrimary: boolean }>;

      if (newPrimary) {
        await this.uploadSingleImage(savedId, newPrimary.file, true);
      }
      for (const item of newOthers) {
        await this.uploadSingleImage(savedId, item.file, false);
      }

      // 2. Change primary among existing images if user picked a different one
      const newPrimaryExisting = this.imageItems.find(i => i.kind === 'existing' && i.isPrimary) as
        | { kind: 'existing'; id: number } | undefined;
      if (!newPrimary && newPrimaryExisting && newPrimaryExisting.id !== this.originalPrimaryId) {
        await this.setPrimaryImageBackend(savedId, newPrimaryExisting.id);
      }

      // 3. Delete queued images
      if (this.imagesToDelete.length) {
        await this.deleteImages(savedId, this.imagesToDelete);
      }

      if (this.selectedModelFile && savedId) {
        await this.uploadModel(savedId, this.selectedModelFile);
      }

      if (this.selectedVideoFile && savedId) {
        await this.uploadVideo(savedId, this.selectedVideoFile);
      }

      this.successMessage = this.isEditMode
        ? 'Bien modifié avec succès !'
        : 'Bien créé avec succès !';
      this.cdr.markForCheck();

      setTimeout(() => {
        this.router.navigate(['/admin/properties']);
      }, 1800);
    } catch (err: any) {
      this.errorMessage = err?.error?.message || err?.message || 'Une erreur est survenue.';
      this.cdr.markForCheck();
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  private async uploadSingleImage(propertyId: number, file: File, isPrimary: boolean): Promise<void> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('isPrimary', String(isPrimary));
    await firstValueFrom(
      this.http.post(`${apiBaseUrl}/api/images/property/${propertyId}/upload`, formData)
    );
  }

  private async setPrimaryImageBackend(propertyId: number, imageId: number): Promise<void> {
    await firstValueFrom(
      this.http.put(
        `${apiBaseUrl}/api/images/${imageId}/set-primary`,
        {},
        { params: { propertyId } }
      )
    );
  }

  private async deleteImages(propertyId: number, imageIds: number[]): Promise<void> {
    const deletes = imageIds.map(imageId =>
      firstValueFrom(
        // responseType: 'text' because backend now returns JSON Map but we don't need the body
        this.http.delete(`${apiBaseUrl}/api/images/${imageId}`, {
          params: { propertyId },
          responseType: 'json',
        })
      )
    );
    await Promise.all(deletes);
  }

  private uploadModel(propertyId: number, file: File): Promise<void> {
    this.uploadingModel = true;
    this.modelUploadProgress = 0;
    this.cdr.markForCheck();

    const formData = new FormData();
    formData.append('file', file);

    return new Promise((resolve, reject) => {
      this.http
        .post(`${this.modelUploadUrl}/${propertyId}/upload`, formData, {
          reportProgress: true,
          observe: 'events',
        })
        .pipe(
          finalize(() => {
            this.uploadingModel = false;
            this.modelUploadProgress = 0;
            this.cdr.markForCheck();
          }),
        )
        .subscribe({
          next: event => {
            if (event.type === HttpEventType.UploadProgress && event.total) {
              this.modelUploadProgress = Math.round((100 * event.loaded) / event.total);
              this.cdr.markForCheck();
            }
            if (event.type === HttpEventType.Response) resolve();
          },
          error: err => reject(err),
        });
    });
  }

  private async uploadVideo(propertyId: number, file: File): Promise<void> {
    this.uploadingVideo = true;
    this.cdr.markForCheck();
    try {
      const formData = new FormData();
      formData.append('file', file);
      await firstValueFrom(this.http.post(`${this.videoUploadUrl}/${propertyId}/upload`, formData));
    } finally {
      this.uploadingVideo = false;
      this.cdr.markForCheck();
    }
  }

  private isValidModelFile(file: File): boolean {
    const name = file.name.toLowerCase();
    return (
      name.endsWith('.glb')  ||
      name.endsWith('.gltf') ||
      name.endsWith('.obj')  ||
      name.endsWith('.fbx')  ||
      name.endsWith('.ply')
    );
  }

  private isValidVideoFile(file: File): boolean {
    const name = file.name.toLowerCase();
    return name.endsWith('.mp4') || file.type === 'video/mp4';
  }


  private resolveMediaUrl(rawUrl?: string | null): string {
    if (!rawUrl) return '';
    if (rawUrl.startsWith('http')) return rawUrl;

    const normalized = this.normalizePublicMediaPath(rawUrl);
    return `${apiBaseUrl}${normalized}`;
  }

  private normalizePublicMediaPath(rawUrl: string): string {
    return rawUrl;
  }
 
  // ─── Sharing (Super Admin only) ─────────────────────────────────────────────

  loadSharingInfo(propertyId: number): void {
    this.sharingLoading = true;
    this.propertiesService.getSharingInfo(propertyId).subscribe({
      next: admins => {
        this.availableAdmins = admins;
        this.selectedAdminIds = new Set(admins.filter(a => a.alreadyShared).map(a => a.id));
        this.sharingLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.sharingLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  toggleAdmin(adminId: number): void {
    if (this.selectedAdminIds.has(adminId)) {
      this.selectedAdminIds.delete(adminId);
    } else {
      this.selectedAdminIds.add(adminId);
    }
  }

  isAdminSelected(adminId: number): boolean {
    return this.selectedAdminIds.has(adminId);
  }

  saveSharing(): void {
    if (!this.propertyId) return;
    this.sharingLoading = true;
    this.shareSaved = false;
    const ids = Array.from(this.selectedAdminIds);

    this.propertiesService.updateSharing(this.propertyId, ids).subscribe({
      next: () => {
        this.shareSaved = true;
        this.sharingLoading = false;
        this.cdr.markForCheck();
        setTimeout(() => { this.shareSaved = false; this.cdr.markForCheck(); }, 2500);
      },
      error: () => {
        this.sharingLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────

  cancel(): void {
    this.router.navigate(['/admin/properties']);
  }

  // ─── Status confirmation modal ────────────────────────────────────────────

  openStatusConfirmModal(targetStatus: string, currentStatus: string): void {
    this.pendingStatusValue = targetStatus;
    this.prevStatusValue = currentStatus;
    this.loueMonths = null;
    this.loueEndDate = null;
    this.statusConfirmModalOpen = true;
    this.cdr.markForCheck();
  }

  cancelStatusConfirm(): void {
    this.statusConfirmModalOpen = false;
    this.pendingStatusValue = null;
    // Dropdown already reverted in the valueChanges handler
    this.cdr.markForCheck();
  }

  confirmStatusChange(): void {
    if (!this.pendingStatusValue) return;

    if (this.pendingStatusValue === 'LOUE') {
      if (!this.loueMonths && !this.loueEndDate) {
        return; // validation shown in template
      }
      // Compute months from date if chosen by date
      if (this.loueEndDate && !this.loueMonths) {
        const months = this.monthsBetween(new Date(), new Date(this.loueEndDate));
        this.form.patchValue({ rentalDurationMonths: Math.max(1, months) }, { emitEvent: false });
      } else if (this.loueMonths) {
        this.form.patchValue({ rentalDurationMonths: this.loueMonths }, { emitEvent: false });
      }
    }

    // Apply the status without triggering the guard again
    this.prevStatusValue = this.pendingStatusValue;
    this.form.get('statut')?.setValue(this.pendingStatusValue, { emitEvent: false });
    this.statusConfirmModalOpen = false;
    this.pendingStatusValue = null;
    this.cdr.markForCheck();
  }

  get loueConfirmEnabled(): boolean {
    if (this.pendingStatusValue !== 'LOUE') return true;
    return !!(this.loueMonths || this.loueEndDate);
  }

  /** Compute end-date preview for LOUE confirmation */
  get loueEndDatePreview(): string {
    if (this.loueEndDate) return this.loueEndDate;
    if (this.loueMonths) {
      const d = new Date();
      d.setMonth(d.getMonth() + this.loueMonths);
      return d.toISOString().slice(0, 10);
    }
    return '';
  }

  get today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private monthsBetween(start: Date, end: Date): number {
    return (end.getFullYear() - start.getFullYear()) * 12
         + (end.getMonth() - start.getMonth());
  }

  get availableStatusOptions(): Array<{ value: string; label: string }> {
    const categorie = this.form.get('categorie')?.value;
    const allowed = categorie === 'LOCATION' ? this.locationStatuses : this.venteStatuses;
    return this.statuts.filter(status => allowed.includes(status.value));
  }

  private ensureStatusMatchesCategory(): void {
    const currentStatus = this.form.get('statut')?.value;
    const categorie = this.form.get('categorie')?.value;
    const allowed = categorie === 'LOCATION' ? this.locationStatuses : this.venteStatuses;
    if (!allowed.includes(currentStatus)) {
      this.form.patchValue({ statut: allowed[0] }, { emitEvent: false });
    }
  }

  private setupLocationSync(): void {
    const address$ = this.form.get('adresse')?.valueChanges || of('');
    const city$ = this.form.get('city')?.valueChanges || of('');
    const country$ = this.form.get('country')?.valueChanges || of('');

    const sub1 = combineLatest([address$, city$, country$])
      .pipe(
        debounceTime(600),
        filter(() => !this.formSyncLock),
        map(([adresse, city, country]) => [adresse, city, country].filter(Boolean).join(', ').trim()),
        distinctUntilChanged(),
        filter(query => query.length > 2)
      )
      .subscribe(query => {
        this.searchControl.setValue(query, { emitEvent: false });
        this.geocodeAndMove(query);
      });
    this.subscriptions.push(sub1);

    const lat$ = this.form.get('latitude')?.valueChanges || of(null);
    const lng$ = this.form.get('longitude')?.valueChanges || of(null);

    const sub2 = combineLatest([lat$, lng$])
      .pipe(
        debounceTime(300),
        filter(() => !this.formSyncLock)
      )
      .subscribe(([lat, lng]) => {
        if (lat == null || lng == null) return;
        this.setMarkerPosition(Number(lat), Number(lng), true);
      });
    this.subscriptions.push(sub2);
  }

  private initializeMap(): void {
    if (!this.mapContainer?.nativeElement) return;
    this.fixLeafletIcons();
    this.loadLeafletCss();
    this.ensureMapContainerDimensions();

    const defaultLat = Number(this.form.get('latitude')?.value) || 36.8065;
    const defaultLng = Number(this.form.get('longitude')?.value) || 10.1815;
    const defaultZoom = this.form.get('latitude')?.value && this.form.get('longitude')?.value ? 14 : 6;

    this.map = L.map(this.mapContainer.nativeElement, {
      center: [defaultLat, defaultLng],
      zoom: defaultZoom,
      zoomControl: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      dragging: true,
      attributionControl: true,
      fadeAnimation: true,
      markerZoomAnimation: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
      detectRetina: true,
    }).addTo(this.map);

    this.marker = L.marker([defaultLat, defaultLng], { draggable: true }).addTo(this.map);

    this.marker.on('dragend', () => {
      const position = this.marker?.getLatLng();
      if (!position) return;
      this.ngZone.run(() => {
        this.updateFormFromCoords(position.lat, position.lng, true);
      });
    });

    this.map.on('click', event => {
      const latlng = event.latlng;
      this.ngZone.run(() => {
        this.setMarkerPosition(latlng.lat, latlng.lng, true);
        this.updateFormFromCoords(latlng.lat, latlng.lng, true);
      });
    });

    setTimeout(() => {
      this.map?.invalidateSize(true);
      this.mapReady = true;
      this.cdr.markForCheck();
    }, 200);
  }

  private ensureMapContainerDimensions(): void {
    const element = this.mapContainer?.nativeElement;
    if (!element) return;
    if (element.offsetHeight < 200) {
      element.style.height = '360px';
      element.style.minHeight = '360px';
    }
  }

  private loadLeafletCss(): void {
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      link.crossOrigin = '';
      document.head.appendChild(link);
    }
  }

  private fixLeafletIcons(): void {
    const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
    const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
    const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

    const defaultIcon = L.Icon.Default.prototype as any;
    if (defaultIcon._getIconUrl) {
      delete defaultIcon._getIconUrl;
    }

    L.Icon.Default.mergeOptions({
      iconRetinaUrl,
      iconUrl,
      shadowUrl,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });
  }

  onSearchLocation(): void {
    const query = (this.searchControl.value || '').trim();
    if (!query) return;
    this.geocodeAndMove(query);
  }

  onUseCurrentLocation(): void {
    if (!navigator.geolocation) {
      this.errorMessage = 'Geolocalisation indisponible.';
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude } = position.coords;
        this.ngZone.run(() => {
          this.setMarkerPosition(latitude, longitude, true);
          this.updateFormFromCoords(latitude, longitude, true);
        });
      },
      () => {
        this.errorMessage = 'Impossible de recuperer votre position.';
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  private geocodeAndMove(query: string): void {
    if (!this.map) return;
    this.isGeocoding = true;
    this.geocodingService.geocodeAddress(query)
      .pipe(finalize(() => {
        this.isGeocoding = false;
        this.cdr.markForCheck();
      }))
      .subscribe(result => {
        const item = Array.isArray(result) ? result[0] : null;
        if (!item) return;
        const lat = Number(item.lat);
        const lng = Number(item.lon);
        this.ngZone.run(() => {
          this.setMarkerPosition(lat, lng, true);
          this.updateFormFromCoords(lat, lng, false, item);
        });
      });
  }

  private updateFormFromCoords(
    lat: number,
    lng: number,
    withReverseGeocode: boolean,
    geocodeResult?: any
  ): void {
    this.formSyncLock = true;
    this.form.patchValue({ latitude: lat, longitude: lng }, { emitEvent: false });
    this.formSyncLock = false;
    this.cdr.markForCheck();

    if (!withReverseGeocode && geocodeResult) {
      this.applyGeocodeResult(geocodeResult, lat, lng);
      return;
    }

    if (!withReverseGeocode) return;
    this.isReverseGeocoding = true;
    this.geocodingService.reverseGeocode(lat, lng)
      .pipe(finalize(() => {
        this.isReverseGeocoding = false;
        this.cdr.markForCheck();
      }))
      .subscribe(result => {
        if (!result) return;
        this.ngZone.run(() => {
          this.applyGeocodeResult(result, lat, lng);
        });
      });
  }

  private applyGeocodeResult(result: any, lat: number, lng: number): void {
    const resolved = this.geocodingService.buildResolvedLocation(result, lat, lng);
    const displayName = resolved.fullAddress || this.form.get('adresse')?.value || '';

    this.formSyncLock = true;
    this.form.patchValue(
      {
        adresse:   displayName,
        city:      resolved.city,
        country:   resolved.country,
        latitude:  lat,
        longitude: lng,
      },
      { emitEvent: false }
    );
    this.formSyncLock = false;
    this.cdr.markForCheck();
  }

  private setMarkerPosition(lat: number, lng: number, animate: boolean): void {
    if (!this.map || !this.marker) return;
    this.marker.setLatLng([lat, lng]);
    this.map.setView([lat, lng], Math.max(this.map.getZoom(), 13), { animate });
  }

  private syncMapWithForm(): void {
    const lat = Number(this.form.get('latitude')?.value);
    const lng = Number(this.form.get('longitude')?.value);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;
    if (!this.map) return;
    this.setMarkerPosition(lat, lng, false);
  }


  // ── Virtual tour ──────────────────────────────────────────────────────────

  handleTourButtonClick(): void {
    // In create mode the modal opens in standalone mode (no property needed).
    // In edit mode load any existing tour first so the viewer can pre-populate.
    if (!this.isEditMode || !this.propertyId) {
      this.existingTour = null;
      this.showTourModal = true;
      this.cdr.markForCheck();
    } else {
      this.openTourModal();
    }
  }

  openTourModal(): void {
    if (this.propertyId) {
      this.virtualTourService.getTour(this.propertyId).subscribe({
        next: tour => {
          this.existingTour = (tour.status === 'NOT_CREATED') ? null : tour;
          this.showTourModal = true;
          this.cdr.markForCheck();
        },
        error: () => { this.existingTour = null; this.showTourModal = true; this.cdr.markForCheck(); },
      });
    } else {
      this.showTourModal = true;
    }
  }

  onTourGenerated(tour: VirtualTourDTO): void {
    this.existingTour = tour;
    this.cdr.markForCheck();
  }

  closeTourModal(): void {
    this.showTourModal = false;
  }

}