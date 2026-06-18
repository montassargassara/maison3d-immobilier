// src/app/admin/client-management/client-management.component.ts
import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { UserService, User } from '../../services/user.service';
import { AdminAuthService } from '../services/admin-auth';
import { Client, ClientNote, ClientService, CreateClientRequest, UpdateClientRequest } from '../services/client.service';
import { PropertiesAdminService, PropertyListItem, DirectSaleRequest } from '../services/properties-admin.service';
import { AffiliateService } from '../services/affiliate.service';
import { AffiliateStatsDTO, AffiliateTransactionDTO, AffiliateCustomerDTO } from '../../models/affiliate.model';
import { apiBaseUrl } from '../../services/api-config';

declare var bootstrap: any;

@Component({
  selector: 'app-client-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './client-management.component.html',
  styleUrls: ['./client-management.component.scss']
})
export class ClientManagementComponent implements OnInit, OnDestroy, AfterViewInit {
  public Math = Math;
  
  clients: Client[] = [];
  filteredClients: Client[] = [];
  selectedClient: Client | null = null;
  currentUser: any = null;
  commercials: User[] = [];
  clientNotes: ClientNote[] = [];
  agencies: User[] = [];
  availableAgencies: User[] = [];
  
  loading = false;
  errorMessage = '';
  successMessage = '';
  
  // Filters
  searchTerm = '';
  clientTypeFilter = '';
  visibilityTypeFilter = '';
  statusFilter = '';
  buyerStatusFilter = '';
  minBudget: number | null = null;
  maxBudget: number | null = null;
  
  sortField = 'createdAt';
  sortDirection: 'asc' | 'desc' = 'desc';
  
  page = 0;
  pageSize = 10;
  totalElements = 0;
  totalPages = 0;
  
  stats = {
    totalClientsNormaux: 0,
    totalClientsAffilies: 0,
    totalClientsActifs: 0,
    clientsAcheteurs: 0,
    ventesMois: 0,
    commissionsMois: 0
  };
  
  @ViewChild('createClientModal') createModalElement!: ElementRef;
  @ViewChild('editClientModal') editModalElement!: ElementRef;
  @ViewChild('detailsModal') detailsModalElement!: ElementRef;
  @ViewChild('noteModal') noteModalElement!: ElementRef;
  @ViewChild('historyModal') historyModalElement!: ElementRef;
  @ViewChild('shareModal') shareModalElement!: ElementRef;
  
  private createModal: any;
  private editModal: any;
  private detailsModal: any;
  private noteModal: any;
  private historyModal: any;
  private shareModal: any;
  
  clientForm: FormGroup;
  editForm: FormGroup;
  noteForm: FormGroup;
  showPassword = false;
  generatedPassword = '';
  isAffiliateForm = false;
  availableCountries: string[] = [];
  availableCities: string[] = [];
  // Separate lists for the edit modal so they don't collide with the create modal's state
  editCountries: string[] = [];
  editCities: string[] = [];
  selectedSharedAgencyIds: number[] = [];
  activeDropdown: HTMLElement | null = null;

  // ── Tab state ───────────────────────────────────────────────────────────────
  activeTab: 'clients' | 'affiliates' | 'affiliate-customers' = 'clients';

  // ── Clients apportés par affiliés (CRM leads — jamais des comptes User) ──────
  affiliateCustomers: AffiliateCustomerDTO[] = [];
  loadingAffiliateCustomers = false;
  affiliateCustomersLoaded = false;

  // ── Assigner un bien modal ──────────────────────────────────────────────────
  assignPropOpen = false;
  assignPropClient: Client | null = null;
  assignPropList: PropertyListItem[] = [];
  assignPropSelected: PropertyListItem | null = null;
  assignPropStatus: 'VENDU' | 'LOUE' = 'VENDU';
  assignPropRentalStart = '';
  assignPropRentalMonths: number | null = null;
  assignPropRentalAmount: number | null = null;
  assignPropRentalNotes = '';
  assignPropLoading = false;
  assignPropError = '';
  assignPropSearch = '';

  @ViewChild('assignPropertyModal') assignPropertyModalElement!: ElementRef;
  private assignPropertyModalInstance: any;

  private subscriptions: Subscription[] = [];

  // ── Affiliate detail state ──────────────────────────────────────────────────
  affiliateStats: AffiliateStatsDTO | null = null;
  affiliateTransactions: AffiliateTransactionDTO[] = [];
  loadingAffiliateDetail = false;

  constructor(
    private clientService: ClientService,
    private userService: UserService,
    private authService: AdminAuthService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private propertiesService: PropertiesAdminService,
    private affiliateService: AffiliateService
  ) {
    this.clientForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      nom: ['', [Validators.required]],
      prenom: ['', [Validators.required]],
      telephone: ['', [Validators.pattern(/^(?:(?:\+|00)216|0)?[2-9][0-9]{7}$/)]],
      clientType: ['NORMAL', [Validators.required]],
      budgetEstime: [null],
      zoneRecherchee: [''],
      country: [''],
      city: [''],
      commercialId: [null],
      visibilityType: ['AGENCY_CLIENT', [Validators.required]],
      targetAgencyAdminId: [null],
      codeAffiliation: [''],
      tauxCommission: [5],
      source: ['']
    }, { validators: this.passwordMatchValidator });

    this.editForm = this.fb.group({
      nom: ['', [Validators.required]],
      prenom: ['', [Validators.required]],
      telephone: ['', [Validators.pattern(/^(?:(?:\+|00)216|0)?[2-9][0-9]{7}$/)]],
      budgetEstime: [null],
      zoneRecherchee: [''],
      commercialId: [null],
      isActive: [true],
      // Affiliate-only zone selection (mirrors Ajouter Affilié)
      country: [''],
      city: [''],
      codeAffiliation: [''],
      tauxCommission: [5],
      source: ['']
    });

    this.noteForm = this.fb.group({
      note: ['', [Validators.required, Validators.minLength(10)]]
    });
  }

  ngOnInit(): void {
    console.log('🟢 ClientManagement - Initialisation');
    // ✅ Récupérer l'utilisateur courant correctement
    this.currentUser = this.authService.getCurrentUser();
    console.log('📌 currentUser:', this.currentUser);
    
    // ✅ Charger les données en parallèle
    this.loadAgencies();
    this.loadCommercials();
    this.loadStats();
    this.loadClients();
    this.cdr.detectChanges();
  }

  ngAfterViewInit(): void {
    this.initModals();
    this.cdr.detectChanges();
  }

  private initModals(): void {
    if (this.createModalElement) this.createModal = new bootstrap.Modal(this.createModalElement.nativeElement);
    if (this.editModalElement) this.editModal = new bootstrap.Modal(this.editModalElement.nativeElement);
    if (this.detailsModalElement) this.detailsModal = new bootstrap.Modal(this.detailsModalElement.nativeElement);
    if (this.noteModalElement) this.noteModal = new bootstrap.Modal(this.noteModalElement.nativeElement);
    if (this.historyModalElement) this.historyModal = new bootstrap.Modal(this.historyModalElement.nativeElement);
    if (this.shareModalElement) this.shareModal = new bootstrap.Modal(this.shareModalElement.nativeElement);
    if (this.assignPropertyModalElement) this.assignPropertyModalInstance = new bootstrap.Modal(this.assignPropertyModalElement.nativeElement);
  }

  loadAgencies(): void {
    if (this.currentUser?.role === 'SUPER_ADMIN') {
      this.userService.getUsersByRole('ADMIN').subscribe({
        next: (agencies) => { this.agencies = agencies; this.cdr.detectChanges(); },
        error: (error) => console.error('Erreur chargement agences:', error)
      });
    }
  }

  loadCommercials(): void {
    // ✅ Pour COMMERCIAL, ne pas charger la liste des commerciaux
    if (this.currentUser?.role === 'COMMERCIAL') {
      this.commercials = [];
      return;
    }
    
    this.userService.getUsersByRole('COMMERCIAL').subscribe({
      next: (commercials) => { this.commercials = commercials; this.cdr.detectChanges(); },
      error: (error) => console.error('Erreur chargement commerciaux:', error)
    });
  }

  loadStats(): void {
    this.clientService.getClientStats().subscribe({
      next: (stats) => { this.stats = stats; this.cdr.detectChanges(); },
      error: (error) => console.error('Erreur chargement stats:', error)
    });
  }

  loadClients(): void {
    this.loading = true;
    this.cdr.detectChanges();

    const sub = this.clientService.getAllClients(this.page, this.pageSize, this.sortField, this.sortDirection).subscribe({
      next: (response) => {
        console.log(`✅ ${response.content.length} clients chargés`);
        this.clients = response.content.map(client => ({
          ...client,
          visibilityType: client.visibilityType || 'AGENCY_CLIENT',
          sharedWithAgencyIds: client.sharedWithAgencyIds || []
        }));
        this.applyFilters();
        this.totalElements = response.totalElements;
        this.totalPages = response.totalPages;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Erreur chargement clients:', error);
        this.errorMessage = 'Erreur lors du chargement des clients';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
    this.subscriptions.push(sub);
  }

  setActiveTab(tab: 'clients' | 'affiliates' | 'affiliate-customers'): void {
    this.activeTab = tab;
    this.clientTypeFilter = '';
    this.searchTerm = '';
    this.page = 0;
    if (tab === 'affiliate-customers') {
      this.loadAffiliateCustomers();
    } else {
      this.applyFilters();
    }
  }

  loadAffiliateCustomers(): void {
    if (this.affiliateCustomersLoaded) return;
    this.loadingAffiliateCustomers = true;
    this.cdr.detectChanges();
    const sub = this.affiliateService.getAllAffiliateCustomers().subscribe({
      next: (rows) => {
        this.affiliateCustomers = rows;
        this.affiliateCustomersLoaded = true;
        this.loadingAffiliateCustomers = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.affiliateCustomers = [];
        this.loadingAffiliateCustomers = false;
        this.cdr.detectChanges();
      },
    });
    this.subscriptions.push(sub);
  }

  get filteredAffiliateCustomers(): AffiliateCustomerDTO[] {
    if (!this.searchTerm) return this.affiliateCustomers;
    const t = this.searchTerm.toLowerCase();
    return this.affiliateCustomers.filter(c =>
      (c.buyerName || '').toLowerCase().includes(t) ||
      (c.buyerEmail || '').toLowerCase().includes(t) ||
      (c.affiliateName || '').toLowerCase().includes(t) ||
      (c.propertyTitle || '').toLowerCase().includes(t)
    );
  }

  /**
   * Statut métier réel du deal affilié, dérivé de la SEULE source de vérité
   * (SaleOffer.status via offerStatus). Un AffiliateCustomerRelation n'existe
   * que lorsque completeOffer() a tourné → COMPLETED ⇒ Vente/Location finalisée.
   */
  affiliateDealStatus(ac: AffiliateCustomerDTO): { label: string; cls: string } {
    const s = (ac.offerStatus || 'COMPLETED').toUpperCase();
    if (s === 'COMPLETED') {
      return ac.transactionType === 'RENT'
        ? { label: 'Location finalisée', cls: 'csp-active' }
        : { label: 'Vente finalisée', cls: 'csp-active' };
    }
    if (s === 'ACCEPTED')  return { label: 'Acceptée',  cls: 'csp-accent' };
    if (s === 'PENDING')   return { label: 'En attente', cls: 'csp-inactive' };
    if (s === 'REJECTED')  return { label: 'Rejetée',   cls: 'csp-inactive' };
    if (s === 'CANCELLED') return { label: 'Annulée',   cls: 'csp-inactive' };
    return { label: 'Complétée', cls: 'csp-active' };
  }

  applyFilters(): void {
    let filtered = [...this.clients];

    // Tab isolation
    if (this.activeTab === 'affiliates') {
      filtered = filtered.filter(c => c.role === 'AFFILIATE');
    } else {
      filtered = filtered.filter(c => c.role !== 'AFFILIATE');
    }

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.email.toLowerCase().includes(term) ||
        c.nom.toLowerCase().includes(term) ||
        c.prenom.toLowerCase().includes(term) ||
        (c.telephone && c.telephone.toLowerCase().includes(term))
      );
    }

    if (this.clientTypeFilter) {
      filtered = filtered.filter(c => c.role === this.clientTypeFilter);
    }
    
    if (this.visibilityTypeFilter) {
      filtered = filtered.filter(c => c.visibilityType === this.visibilityTypeFilter);
    }
    
    if (this.statusFilter) {
      filtered = filtered.filter(c => c.isActive === (this.statusFilter === 'active'));
    }
    
    if (this.buyerStatusFilter === 'buyers') {
      filtered = filtered.filter(c => (c.nombreAchats || 0) > 0);
    } else if (this.buyerStatusFilter === 'non-buyers') {
      filtered = filtered.filter(c => (c.nombreAchats || 0) === 0);
    }
    
    if (this.minBudget !== null) {
      filtered = filtered.filter(c => (c.budgetEstime || 0) >= this.minBudget!);
    }
    
    if (this.maxBudget !== null) {
      filtered = filtered.filter(c => (c.budgetEstime || 0) <= this.maxBudget!);
    }
    
    this.filteredClients = filtered;
    this.cdr.detectChanges();
  }

  sort(field: string): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.loadClients();
  }

  getSortIcon(field: string): string {
    if (this.sortField !== field) return 'fas fa-sort';
    return this.sortDirection === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
  }

  changePage(newPage: number): void { 
    this.page = newPage; 
    this.loadClients(); 
  }
  
  changePageSize(newSize: number): void { 
    this.pageSize = newSize; 
    this.page = 0; 
    this.loadClients(); 
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.clientTypeFilter = '';
    this.visibilityTypeFilter = '';
    this.statusFilter = '';
    this.buyerStatusFilter = '';
    this.minBudget = null;
    this.maxBudget = null;
    this.applyFilters();
  }

  onClientTypeChange(): void {
    this.isAffiliateForm = this.clientForm.get('clientType')?.value === 'AFFILIATE';
    const countryCtrl = this.clientForm.get('country')!;
    const cityCtrl = this.clientForm.get('city')!;
    const visibilityCtrl = this.clientForm.get('visibilityType')!;

    if (this.isAffiliateForm) {
      countryCtrl.setValidators([Validators.required]);
      cityCtrl.setValidators([Validators.required]);
      visibilityCtrl.clearValidators();
      visibilityCtrl.setValue('AGENCY_CLIENT');
      this.clientForm.patchValue({ codeAffiliation: this.clientService.generateAffiliateCode() });
      this.loadAffiliateCountries();
    } else {
      countryCtrl.clearValidators();
      countryCtrl.setValue('');
      cityCtrl.clearValidators();
      cityCtrl.setValue('');
      visibilityCtrl.setValidators([Validators.required]);
      this.availableCities = [];
      this.clientForm.patchValue({ codeAffiliation: '', tauxCommission: 5, source: '' });
      this.loadAffiliateCountries();
    }
    countryCtrl.updateValueAndValidity();
    cityCtrl.updateValueAndValidity();
    visibilityCtrl.updateValueAndValidity();
    this.cdr.detectChanges();
  }

  loadAffiliateCountries(): void {
    this.clientService.getPropertyCountries().subscribe({
      next: (countries) => { this.availableCountries = countries; this.availableCities = []; this.cdr.detectChanges(); },
      error: (err) => console.error('Erreur chargement pays:', err)
    });
  }

  onCountryChange(): void {
    const country = this.clientForm.get('country')?.value;
    this.clientForm.patchValue({ city: '' });
    this.availableCities = [];
    if (country) {
      this.clientService.getPropertyCitiesByCountry(country).subscribe({
        next: (cities) => { this.availableCities = cities; this.cdr.detectChanges(); },
        error: (err) => console.error('Erreur chargement villes:', err)
      });
    }
  }

  toggleSharedAgency(event: any): void {
    const agencyId = Number(event.target.value);
    if (event.target.checked) {
      if (!this.selectedSharedAgencyIds.includes(agencyId)) {
        this.selectedSharedAgencyIds.push(agencyId);
      }
    } else {
      const index = this.selectedSharedAgencyIds.indexOf(agencyId);
      if (index > -1) this.selectedSharedAgencyIds.splice(index, 1);
    }
  }

  toggleSharedAgencyById(agencyId: number): void {
    const index = this.selectedSharedAgencyIds.indexOf(agencyId);
    if (index > -1) {
      this.selectedSharedAgencyIds.splice(index, 1);
    } else {
      this.selectedSharedAgencyIds.push(agencyId);
    }
    this.cdr.detectChanges();
  }

  isAgencySelected(agencyId: number): boolean { 
    return this.selectedSharedAgencyIds.includes(agencyId); 
  }

  openCreateModal(): void {
    this.resetClientForm();
    this.isAffiliateForm = false;
    this.selectedSharedAgencyIds = [];
    this.loadAffiliateCountries();
    this.createModal?.show();
    this.cdr.detectChanges();
  }
  
  closeCreateModal(): void { 
    this.createModal?.hide(); 
    this.cdr.detectChanges(); 
  }

  openEditModal(client: Client): void {
    this.selectedClient = client;
    this.isAffiliateForm = client.role === 'AFFILIATE';

    // Common fields
    this.editForm.patchValue({
      nom: client.nom,
      prenom: client.prenom,
      telephone: client.telephone || '',
      isActive: client.isActive,
    });

    const countryCtrl = this.editForm.get('country')!;
    const cityCtrl = this.editForm.get('city')!;

    if (this.isAffiliateForm) {
      // Country/city become required for affiliates — same rule as the Add form
      countryCtrl.setValidators([Validators.required]);
      cityCtrl.setValidators([Validators.required]);

      // Affiliate-only fields are not exposed in the new edit UI; clear validators
      // and reset values so they don't leak stale data into the payload.
      this.editForm.patchValue({
        budgetEstime: null,
        zoneRecherchee: '',
        codeAffiliation: client.codeAffiliation || '',
        tauxCommission: client.tauxCommission || 5,
        source: client.source || '',
      });

      // Parse the joined "Country, City" string saved during creation
      const { country, city } = this.parseZone(client.zoneRecherchee);
      this.editCities = [];
      this.editForm.patchValue({ country: '', city: '' });

      this.clientService.getPropertyCountries().subscribe({
        next: (countries) => {
          this.editCountries = countries;
          if (country) {
            this.editForm.patchValue({ country });
            this.clientService.getPropertyCitiesByCountry(country).subscribe({
              next: (cities) => {
                this.editCities = cities;
                if (city) this.editForm.patchValue({ city });
                this.cdr.detectChanges();
              },
              error: (err) => console.error('Erreur chargement villes:', err),
            });
          }
          this.cdr.detectChanges();
        },
        error: (err) => console.error('Erreur chargement pays:', err),
      });
    } else {
      // Normal client — country/city dropdowns (replaces free-text zoneRecherchee)
      countryCtrl.clearValidators();
      cityCtrl.clearValidators();
      this.editCities = [];
      this.editForm.patchValue({
        budgetEstime: client.budgetEstime ?? null,
        zoneRecherchee: '',
        country: '',
        city: '',
        codeAffiliation: '',
        tauxCommission: 5,
        source: '',
      });

      // Parse "Country, City" stored in zoneRecherchee for normal clients too
      const { country, city } = this.parseZone(client.zoneRecherchee);
      this.clientService.getPropertyCountries().subscribe({
        next: (countries) => {
          this.editCountries = countries;
          if (country) {
            this.editForm.patchValue({ country });
            this.clientService.getPropertyCitiesByCountry(country).subscribe({
              next: (cities) => {
                this.editCities = cities;
                if (city) this.editForm.patchValue({ city });
                this.cdr.detectChanges();
              },
              error: (err) => console.error('Erreur chargement villes:', err),
            });
          }
          this.cdr.detectChanges();
        },
        error: (err) => console.error('Erreur chargement pays:', err),
      });
    }
    countryCtrl.updateValueAndValidity();
    cityCtrl.updateValueAndValidity();

    this.editModal?.show();
    this.cdr.detectChanges();
  }

  /** Reload city list when admin changes country in the edit form. */
  onEditCountryChange(): void {
    const country = this.editForm.get('country')?.value;
    this.editForm.patchValue({ city: '' });
    this.editCities = [];
    if (country) {
      this.clientService.getPropertyCitiesByCountry(country).subscribe({
        next: (cities) => { this.editCities = cities; this.cdr.detectChanges(); },
        error: (err) => console.error('Erreur chargement villes:', err),
      });
    }
  }

  /** Splits the legacy "Country, City" zoneRecherchee string. */
  private parseZone(raw: string | undefined | null): { country: string; city: string } {
    if (!raw) return { country: '', city: '' };
    const parts = raw.split(',', 2).map(p => p.trim());
    return {
      country: parts[0] || '',
      city: parts.length > 1 ? parts[1] : '',
    };
  }

  closeEditModal(): void {
    this.editModal?.hide();
    this.selectedClient = null;
    this.editCountries = [];
    this.editCities = [];
    this.cdr.detectChanges();
  }

  clientSales: PropertyListItem[] = [];
  clientRentals: PropertyListItem[] = [];
  loadingPurchases = false;
  detailActiveTab: 'sales' | 'rentals' = 'sales';

  openDetailsModal(client: Client): void {
    this.selectedClient = client;
    this.clientSales = [];
    this.clientRentals = [];
    this.affiliateStats = null;
    this.affiliateTransactions = [];
    this.detailActiveTab = 'sales';
    this.detailsModal?.show();
    this.cdr.detectChanges();

    if (client.role === 'AFFILIATE') {
      this.loadingAffiliateDetail = true;
      this.affiliateService.getAffiliateStats(client.id).subscribe({
        next: (stats) => { this.affiliateStats = stats; this.cdr.markForCheck(); },
        error: () => { this.cdr.markForCheck(); },
      });
      this.affiliateService.getAffiliateTransactions(client.id).subscribe({
        next: (txns) => {
          this.affiliateTransactions = txns;
          this.loadingAffiliateDetail = false;
          this.cdr.markForCheck();
        },
        error: () => { this.loadingAffiliateDetail = false; this.cdr.markForCheck(); },
      });
    } else {
      this.loadingPurchases = true;
      this.propertiesService.getClientPurchases(client.id).subscribe({
        next: (list) => {
          this.clientSales = list.filter(p => p.statut === 'VENDU');
          this.clientRentals = list.filter(p => p.statut === 'LOUE');
          this.loadingPurchases = false;
          this.cdr.markForCheck();
        },
        error: () => { this.loadingPurchases = false; this.cdr.markForCheck(); },
      });
    }
  }

  closeDetailsModal(): void {
    this.detailsModal?.hide();
    this.selectedClient = null;
    this.clientSales = [];
    this.clientRentals = [];
    this.affiliateStats = null;
    this.affiliateTransactions = [];
    this.cdr.detectChanges();
  }

  purchaseImageUrl(p: PropertyListItem): string {
    if (!p.mainImageUrl) return '';
    return p.mainImageUrl.startsWith('http') ? p.mainImageUrl : `${apiBaseUrl}${p.mainImageUrl}`;
  }

  fmtDate(d: string | undefined): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  fmtAmount(v: number | undefined | null): string {
    if (!v && v !== 0) return '—';
    return v.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' TND';
  }

  getRankingTier(client: Client): { emoji: string; label: string; cssClass: string } {
    const sales = client.nombreVentesLiees || 0;
    if (sales >= 10) return { emoji: '🥇', label: 'Top Performer', cssClass: 'tier-gold' };
    if (sales >= 5)  return { emoji: '🥈', label: 'Expert', cssClass: 'tier-silver' };
    if (sales >= 2)  return { emoji: '🥉', label: 'Confirmé', cssClass: 'tier-bronze' };
    return { emoji: '⭐', label: 'Débutant', cssClass: 'tier-star' };
  }

  getRankingTierFromStats(): { emoji: string; label: string; cssClass: string } {
    const sales = this.affiliateStats?.totalSales || 0;
    if (sales >= 10) return { emoji: '🥇', label: 'Top Performer', cssClass: 'tier-gold' };
    if (sales >= 5)  return { emoji: '🥈', label: 'Expert', cssClass: 'tier-silver' };
    if (sales >= 2)  return { emoji: '🥉', label: 'Confirmé', cssClass: 'tier-bronze' };
    return { emoji: '⭐', label: 'Débutant', cssClass: 'tier-star' };
  }

  getAffiliateSaleTransactions(): AffiliateTransactionDTO[] {
    return this.affiliateTransactions.filter(t => !t.transactionType || t.transactionType === 'SALE');
  }

  openNoteModal(client: Client): void { 
    this.selectedClient = client; 
    this.noteForm.reset(); 
    this.noteModal?.show(); 
    this.cdr.detectChanges(); 
  }
  
  closeNoteModal(): void { 
    this.noteModal?.hide(); 
    this.selectedClient = null; 
    this.cdr.detectChanges(); 
  }

  openHistoryModal(client: Client): void { 
    this.selectedClient = client; 
    this.loadClientNotes(client.id); 
    this.historyModal?.show(); 
    this.cdr.detectChanges(); 
  }
  
  closeHistoryModal(): void { 
    this.historyModal?.hide(); 
    this.selectedClient = null; 
    this.clientNotes = []; 
    this.cdr.detectChanges(); 
  }

  openShareModal(client: Client): void {
    this.selectedClient = client;
    this.loadAvailableAgencies(client.id);
    this.shareModal?.show();
    this.cdr.detectChanges();
  }
  
  closeShareModal(): void { 
    this.shareModal?.hide(); 
    this.selectedClient = null; 
    this.availableAgencies = []; 
    this.cdr.detectChanges(); 
  }

  loadAvailableAgencies(clientId: number): void {
    if (this.currentUser?.role !== 'SUPER_ADMIN') return;
    
    this.clientService.getAvailableAgenciesForSharing(clientId).subscribe({
      next: (agencies) => { this.availableAgencies = agencies; this.cdr.detectChanges(); },
      error: (error) => console.error('Erreur chargement agences disponibles:', error)
    });
  }

  shareWithAgency(adminId: number): void {
    if (!this.selectedClient) return;
    this.clientService.sharePrivateClientWithAgency(this.selectedClient.id, adminId).subscribe({
      next: () => {
        this.successMessage = 'Client partagé avec succès';
        this.loadClients();
        this.loadAvailableAgencies(this.selectedClient!.id);
        setTimeout(() => this.hideMessageAfterDelay('success'), 3000);
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.errorMessage = error.error?.message || 'Erreur lors du partage';
        this.cdr.detectChanges();
      }
    });
  }

  revokeSharing(adminId: number): void {
    if (!this.selectedClient) return;
    this.clientService.revokePrivateClientSharing(this.selectedClient.id, adminId).subscribe({
      next: () => {
        this.successMessage = 'Partage révoqué avec succès';
        this.loadClients();
        this.loadAvailableAgencies(this.selectedClient!.id);
        setTimeout(() => this.hideMessageAfterDelay('success'), 3000);
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.errorMessage = error.error?.message || 'Erreur lors de la révocation';
        this.cdr.detectChanges();
      }
    });
  }

  loadClientNotes(clientId: number): void {
    this.clientService.getClientNotes(clientId).subscribe({
      next: (notes) => { this.clientNotes = notes; this.cdr.detectChanges(); },
      error: (error) => console.error('Erreur chargement notes:', error)
    });
  }

  createClient(): void {
    if (this.clientForm.invalid) { 
      this.markFormGroupTouched(this.clientForm); 
      return; 
    }
    
    this.loading = true;
    const fv = this.clientForm.value;
    
    const isAffiliate = fv.clientType === 'AFFILIATE';
    const request: CreateClientRequest = {
      email: fv.email,
      password: fv.password,
      nom: fv.nom,
      prenom: fv.prenom,
      telephone: fv.telephone || undefined,
      budgetEstime: isAffiliate ? undefined : (fv.budgetEstime || undefined),
      zoneRecherchee: [fv.country, fv.city].filter(Boolean).join(', ') || undefined,
      commercialId: fv.commercialId || undefined,
      clientType: fv.clientType,
      visibilityType: isAffiliate ? 'AGENCY_CLIENT' : fv.visibilityType,
      targetAgencyAdminId: !isAffiliate && fv.visibilityType === 'AGENCY_CLIENT' && this.currentUser?.role === 'SUPER_ADMIN' ? fv.targetAgencyAdminId : undefined,
      sharedAgencyIds: !isAffiliate && fv.visibilityType === 'PRIVATE_CLIENT' ? this.selectedSharedAgencyIds : [],
      codeAffiliation: isAffiliate ? fv.codeAffiliation : undefined,
      tauxCommission: undefined,
      source: isAffiliate ? fv.source : undefined
    };
    
    this.clientService.createClient(request).subscribe({
      next: (newClient) => {
        this.successMessage = `Client ${newClient.prenom} ${newClient.nom} créé avec succès`;
        this.loadStats();
        this.loadClients();
        this.resetClientForm();
        this.selectedSharedAgencyIds = [];
        this.closeCreateModal();
        this.loading = false;
        this.cdr.detectChanges();
        setTimeout(() => this.hideMessageAfterDelay('success'), 3000);
      },
      error: (error) => {
        console.error('Erreur création client:', error);
        this.errorMessage = error.error?.message || 'Erreur lors de la création';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  updateClient(): void {
    if (!this.selectedClient || this.editForm.invalid) { 
      this.markFormGroupTouched(this.editForm); 
      return; 
    }
    
    this.loading = true;
    const fv = this.editForm.value;
    const isAffiliate = this.selectedClient.role === 'AFFILIATE';

    const budgetRaw = fv.budgetEstime;
    const budgetValue = (budgetRaw !== null && budgetRaw !== '' && !isNaN(Number(budgetRaw)))
      ? Number(budgetRaw)
      : undefined;

    const request: UpdateClientRequest = {
      nom: fv.nom,
      prenom: fv.prenom,
      telephone: fv.telephone || undefined,
      budgetEstime: isAffiliate ? undefined : budgetValue,
      // Always build zoneRecherchee from the dropdowns (works for both affiliate and normal)
      zoneRecherchee: [fv.country, fv.city].filter(Boolean).join(', ') || undefined,
      isActive: fv.isActive,
      // Pass country/city for all client types so the backend can update zoneRecherchee
      country: fv.country || undefined,
      city: fv.city || undefined,
    };

    if (isAffiliate) {
      request.codeAffiliation = fv.codeAffiliation || undefined;
      request.tauxCommission = fv.tauxCommission;
      request.source = fv.source || undefined;
    }
    
    this.clientService.updateClient(this.selectedClient.id, request).subscribe({
      next: (updatedClient) => {
        this.successMessage = `Client ${updatedClient.prenom} ${updatedClient.nom} mis à jour`;
        this.loadStats();
        this.loadClients();
        this.closeEditModal();
        this.loading = false;
        this.cdr.detectChanges();
        setTimeout(() => this.hideMessageAfterDelay('success'), 3000);
      },
      error: (error) => {
        console.error('Erreur mise à jour:', error);
        this.errorMessage = error.error?.message || 'Erreur lors de la mise à jour';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  addNote(): void {
    if (!this.selectedClient || this.noteForm.invalid) { 
      this.markFormGroupTouched(this.noteForm); 
      return; 
    }
    
    this.loading = true;
    const commercialId = this.currentUser?.userId || this.currentUser?.id;
    
    this.clientService.addClientNote(this.selectedClient.id, commercialId, this.noteForm.get('note')?.value).subscribe({
      next: () => { 
        this.successMessage = 'Note ajoutée'; 
        this.closeNoteModal(); 
        this.loading = false; 
        this.cdr.detectChanges(); 
        setTimeout(() => this.hideMessageAfterDelay('success'), 3000); 
      },
      error: (error) => { 
        console.error('Erreur ajout note:', error); 
        this.errorMessage = error.error?.message || 'Erreur'; 
        this.loading = false; 
        this.cdr.detectChanges(); 
      }
    });
  }

  toggleClientStatus(client: Client): void {
    if (!confirm(`Voulez-vous vraiment ${client.isActive ? 'désactiver' : 'activer'} ce client ?`)) return;
    
    this.loading = true;
    this.clientService.toggleClientStatus(client.id).subscribe({
      next: () => { 
        this.successMessage = `Client ${client.isActive ? 'désactivé' : 'activé'}`; 
        this.loadStats(); 
        this.loadClients(); 
        this.loading = false; 
        this.cdr.detectChanges(); 
      },
      error: (error) => { 
        console.error('Erreur changement statut:', error); 
        this.errorMessage = error.error?.message || 'Erreur'; 
        this.loading = false; 
        this.cdr.detectChanges(); 
      }
    });
  }

  deleteClient(client: Client): void {
    if (!confirm(`Supprimer ${client.email} ?`)) return;
    
    this.loading = true;
    this.clientService.deleteClient(client.id).subscribe({
      next: () => { 
        this.successMessage = `Client ${client.email} supprimé`; 
        this.loadStats(); 
        this.loadClients(); 
        this.loading = false; 
        this.cdr.detectChanges(); 
      },
      error: (error) => { 
        console.error('Erreur suppression:', error); 
        this.errorMessage = error.error?.message || 'Erreur'; 
        this.loading = false; 
        this.cdr.detectChanges(); 
      }
    });
  }

  generatePassword(): void {
    this.generatedPassword = this.clientService.generateRandomPassword();
    this.clientForm.patchValue({ 
      password: this.generatedPassword, 
      confirmPassword: this.generatedPassword 
    });
    this.showPassword = true;
  }

  togglePasswordVisibility(): void { 
    this.showPassword = !this.showPassword; 
  }
  
  resetClientForm(): void {
    this.clientForm.reset({ clientType: 'NORMAL', visibilityType: 'AGENCY_CLIENT', tauxCommission: 5 });
    const countryCtrl = this.clientForm.get('country')!;
    const cityCtrl = this.clientForm.get('city')!;
    const visibilityCtrl = this.clientForm.get('visibilityType')!;
    countryCtrl.clearValidators();
    cityCtrl.clearValidators();
    visibilityCtrl.setValidators([Validators.required]);
    countryCtrl.updateValueAndValidity();
    cityCtrl.updateValueAndValidity();
    visibilityCtrl.updateValueAndValidity();
    this.availableCountries = [];
    this.availableCities = [];
    this.generatedPassword = '';
    this.showPassword = false;
    this.isAffiliateForm = false;
    // city list always cleared on reset; countries reloaded by openCreateModal
  }
  
  passwordMatchValidator(form: FormGroup): any { 
    return form.get('password')?.value === form.get('confirmPassword')?.value ? null : { passwordMismatch: true }; 
  }
  
  markFormGroupTouched(formGroup: FormGroup): void { 
    Object.values(formGroup.controls).forEach(c => { 
      c.markAsTouched(); 
      if (c instanceof FormGroup) this.markFormGroupTouched(c); 
    }); 
  }
  
  hideMessageAfterDelay(type: 'success' | 'error'): void { 
    setTimeout(() => { 
      if (type === 'success') this.successMessage = ''; 
      else this.errorMessage = ''; 
      this.cdr.detectChanges(); 
    }, 5000); 
  }

  // ========== DISPLAY HELPERS ==========
  formatDate(dateString: string): string { 
    return this.clientService.formatDate(dateString); 
  }
  
  formatCurrency(amount: number): string { 
    return this.clientService.formatCurrency(amount); 
  }
  
  getVisibilityTypeLabel(type: string | undefined): string { 
    if (type === 'PRIVATE_CLIENT') return 'Client privé';
    return 'Client agence';
  }
  
  getVisibilityTypeIcon(type: string | undefined): string { 
    if (type === 'PRIVATE_CLIENT') return 'fa-lock';
    return 'fa-building';
  }
  
  getVisibilityTypeClass(type: string | undefined): string { 
    if (type === 'PRIVATE_CLIENT') return 'badge-private';
    return 'badge-agency';
  }
  
  getRoleText(role: string): string {
    const roles: any = {
      'SUPER_ADMIN': 'Super Admin',
      'ADMIN': 'Administrateur',
      'RESPONSABLE_COMMERCIAL': 'Resp. Commercial',
      'COMMERCIAL': 'Commercial',
      'CLIENT': 'Client',
      'CLIENT_PUBLIC': 'Client',
      'AFFILIATE': 'Affilié'
    };
    return roles[role] || role;
  }
  
  getRoleColor(role: string): string { 
    return this.clientService.getRoleColor(role); 
  }
  
  getInitials(prenom: string, nom: string): string { 
    return this.clientService.getInitials(prenom, nom); 
  }
  
  getClientTypeBadgeClass(role: string): string { 
    return role === 'AFFILIATE' ? 'badge-affiliate' : 'badge-client'; 
  }
  
  // ✅ CORRECTION - canEdit avec vérification null
  canEdit(client: Client): boolean {
    if (!this.currentUser || !client) return false;
    
    const role = this.currentUser.role?.toUpperCase();
    
    // SUPER_ADMIN peut tout modifier
    if (role === 'SUPER_ADMIN') return true;
    
    // ADMIN peut modifier tous les clients
    if (role === 'ADMIN') return true;
    
    // RESPONSABLE_COMMERCIAL peut modifier les clients
    if (role === 'RESPONSABLE_COMMERCIAL') return true;
    
    // COMMERCIAL ne peut modifier que les clients normaux (pas les affiliés)
    if (role === 'COMMERCIAL') {
      return client.role === 'CLIENT' || client.role === 'CLIENT_PUBLIC';
    }
    
    return false;
  }
  
  canViewAffiliateDetails(client: Client): boolean { 
    if (!this.currentUser || !client) return false;
    const role = this.currentUser.role?.toUpperCase();
    return role !== 'COMMERCIAL' && client.role === 'AFFILIATE'; 
  }
  
  canManageSharing(client: Client): boolean { 
    if (!this.currentUser || !client) return false;
    return this.currentUser.role === 'SUPER_ADMIN' && client.visibilityType === 'PRIVATE_CLIENT'; 
  }

  toggleDropdown(event: MouseEvent, dropdownId: string): void {
    event.stopPropagation();
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;

    // Close any other open dropdown
    if (this.activeDropdown && this.activeDropdown !== dropdown) {
      this.activeDropdown.classList.remove('show');
    }

    const willOpen = !dropdown.classList.contains('show');

    if (willOpen) {
      // Position using fixed coords so no parent overflow clips us
      const btn = event.currentTarget as HTMLElement;
      const rect = btn.getBoundingClientRect();
      const menuW = 220; // matches min-width in SCSS
      const menuH = dropdown.scrollHeight || 280;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Horizontal: prefer right-align to the button; flip left if it would overflow
      let left = rect.right - menuW;
      if (left < 8) left = rect.left;
      if (left + menuW > vw - 8) left = vw - menuW - 8;

      // Vertical: prefer below; flip above if not enough space below
      let top = rect.bottom + 4;
      if (top + menuH > vh - 8) top = rect.top - menuH - 4;
      if (top < 8) top = 8;

      dropdown.style.top  = `${top}px`;
      dropdown.style.left = `${left}px`;
      dropdown.classList.add('show');
      this.activeDropdown = dropdown;
    } else {
      dropdown.classList.remove('show');
      this.activeDropdown = null;
    }
  }

  @HostListener('document:click') onDocumentClick(): void {
    if (this.activeDropdown) {
      this.activeDropdown.classList.remove('show');
      this.activeDropdown = null;
    }
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  onWindowChange(): void {
    if (this.activeDropdown) {
      this.activeDropdown.classList.remove('show');
      this.activeDropdown = null;
    }
  }
  
  viewAffiliateDetails(client: Client): void {
    this.selectedClient = client;
    this.detailsModal?.show();
  }

  // ── Assigner un bien ────────────────────────────────────────────────────────

  assignImageUrl(p: PropertyListItem): string | null {
    if (!p.mainImageUrl) return null;
    if (p.mainImageUrl.startsWith('http')) return p.mainImageUrl;
    return `${apiBaseUrl}${p.mainImageUrl}`;
  }

  get assignPropFiltered(): PropertyListItem[] {
    if (!this.assignPropSearch) return this.assignPropList;
    const term = this.assignPropSearch.toLowerCase();
    return this.assignPropList.filter(p =>
      p.titre.toLowerCase().includes(term) ||
      (p.city ?? '').toLowerCase().includes(term) ||
      p.type.toLowerCase().includes(term)
    );
  }

  get assignRentalEndPreview(): string {
    if (!this.assignPropRentalStart || !this.assignPropRentalMonths) return '';
    const d = new Date(this.assignPropRentalStart);
    d.setMonth(d.getMonth() + Number(this.assignPropRentalMonths));
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  get assignCanConfirm(): boolean {
    if (!this.assignPropSelected) return false;
    if (this.assignPropStatus === 'LOUE') {
      return !!(this.assignPropRentalStart && this.assignPropRentalMonths && this.assignPropRentalMonths >= 1);
    }
    return true;
  }

  openAssignPropertyModal(client: Client): void {
    this.assignPropClient = client;
    this.assignPropSelected = null;
    this.assignPropStatus = 'VENDU';
    this.assignPropRentalStart = '';
    this.assignPropRentalMonths = null;
    this.assignPropRentalAmount = null;
    this.assignPropRentalNotes = '';
    this.assignPropError = '';
    this.assignPropSearch = '';
    this.assignPropList = [];
    this.assignPropLoading = true;
    this.assignPropertyModalInstance?.show();
    this.propertiesService.getAllProperties().subscribe({
      next: (list) => {
        this.assignPropList = list.filter(p => p.statut === 'DISPONIBLE' && p.isActive);
        this.assignPropLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.assignPropError = 'Impossible de charger les biens disponibles.';
        this.assignPropLoading = false;
        this.cdr.detectChanges();
      }
    });
    this.cdr.detectChanges();
  }

  closeAssignPropertyModal(): void {
    this.assignPropertyModalInstance?.hide();
    this.assignPropClient = null;
    this.assignPropSelected = null;
    this.cdr.detectChanges();
  }

  selectAssignProp(p: PropertyListItem): void {
    this.assignPropSelected = p;
    // Auto-set status based on property prices
    if (p.prixVente && p.prixVente > 0) {
      this.assignPropStatus = 'VENDU';
    } else if (p.prixLocation && p.prixLocation > 0) {
      this.assignPropStatus = 'LOUE';
    }
    this.cdr.detectChanges();
  }

  confirmAssignProperty(): void {
    if (!this.assignPropClient || !this.assignPropSelected || !this.assignCanConfirm) return;
    this.assignPropError = '';
    this.assignPropLoading = true;
    const req: DirectSaleRequest = {
      targetStatus: this.assignPropStatus,
      existingClientId: this.assignPropClient.id,
    };
    if (this.assignPropStatus === 'LOUE') {
      req.rentalStartDate = this.assignPropRentalStart;
      req.rentalDurationMonths = this.assignPropRentalMonths ?? undefined;
      req.rentalAmount = this.assignPropRentalAmount ?? undefined;
      req.rentalNotes = this.assignPropRentalNotes || undefined;
    }
    this.propertiesService.directSale(this.assignPropSelected.id, req).subscribe({
      next: () => {
        this.successMessage = `Bien "${this.assignPropSelected!.titre}" assigné à ${this.assignPropClient!.prenom} ${this.assignPropClient!.nom}`;
        this.assignPropLoading = false;
        this.closeAssignPropertyModal();
        this.loadStats();
        this.loadClients();
        setTimeout(() => this.hideMessageAfterDelay('success'), 3000);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.assignPropError = err.error?.message || 'Erreur lors de l\'assignation du bien.';
        this.assignPropLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}