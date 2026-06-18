import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  PropertiesAdminService,
  PropertyListItem,
  AdminInterestDTO,
  ConvertLeadRequest,
  ClientSearchResult,
  DirectSaleRequest,
} from '../services/properties-admin.service';
import { AdminAuthService } from '../services/admin-auth';
import { ShareRequestService, AgencyAdminItem } from '../services/share-request.service';
import { apiBaseUrl } from '../../services/api-config';
import {
  getStatusesForCategory,
  isStatusAllowedForCategory,
  PropertyCategory,
  PropertyStatus,
  RENTAL_STATUSES,
  SALE_STATUSES,
} from '../../models/property.model';

type SectionTab = 'section1' | 'section2';
type StatusFilter = 'TOUS' | 'DISPONIBLE' | 'EN_ATTENTE' | 'VENDU' | 'LOUE';

interface StatusChip {
  value: StatusFilter;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-properties-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './properties-admin.html',
  styleUrl: './properties-admin.scss',
})
export class PropertiesAdmin implements OnInit, OnDestroy {
  Math = Math;
  properties: PropertyListItem[] = [];
  filteredProperties: PropertyListItem[] = [];

  loading = false;
  errorMessage = '';
  successMessage = '';
  filtersOpen = false;

  // ─── Search & filter ────────────────────────────────────────────────────────
  searchTerm = '';
  typeFilter = '';
  cityFilter = '';
  categoryFilter = '';
  validationFilter = '';
  minPrice?: number;
  maxPrice?: number;
  showFinalized = false;

  // ─── Active section tab ─────────────────────────────────────────────────────
  activeSection: SectionTab = 'section1';

  // ─── Status filter chips (shared by both sections) ─────────────────────────
  readonly statusChips: StatusChip[] = [
    { value: 'TOUS',       label: 'Tous',        icon: 'fa-th-large' },
    { value: 'DISPONIBLE', label: 'Disponible',  icon: 'fa-circle-check' },
    { value: 'EN_ATTENTE', label: 'En attente',  icon: 'fa-clock' },
    { value: 'VENDU',      label: 'Vendu',       icon: 'fa-gavel' },
    { value: 'LOUE',       label: 'Loué',        icon: 'fa-key' },
  ];
  section1StatusFilter: StatusFilter = 'TOUS';
  section2StatusFilter: StatusFilter = 'TOUS';

  saleStatuses = SALE_STATUSES;
  rentalStatuses = RENTAL_STATUSES;

  propertyCategories = new Map<number, PropertyCategory | null>();

  // ─── Leads (CRM) panel ─────────────────────────────────────────────────────
  leads: AdminInterestDTO[] = [];
  leadsByPropertyId = new Map<number, AdminInterestDTO[]>();
  leadsLoading = false;
  leadsPanelOpen = false;
  leadsPanelProperty: PropertyListItem | null = null;

  readonly leadStatuses = [
    { value: 'PENDING',              label: 'Nouveau lead',         color: '#6b7280', terminal: false },
    { value: 'CONTACTED',            label: 'Contacté',             color: '#3b82f6', terminal: false },
    { value: 'VISITE_PROGRAMMEE',    label: 'Visite programmée',    color: '#8b5cf6', terminal: false },
    { value: 'EN_NEGOCIATION',       label: 'En négociation',       color: '#f59e0b', terminal: false },
    { value: 'CONVERTI_VENTE',       label: 'Converti — Vente',     color: '#10b981', terminal: true  },
    { value: 'CONVERTI_LOCATION',    label: 'Converti — Location',  color: '#06b6d4', terminal: true  },
    { value: 'REFUSE',               label: 'Refusé',               color: '#ef4444', terminal: true  },
  ];

  // ─── Lead modals ────────────────────────────────────────────────────────────
  refuseModalOpen = false;
  refuseLead: AdminInterestDTO | null = null;
  refuseMessage = '';

  rentalModalOpen = false;
  rentalLead: AdminInterestDTO | null = null;
  rentalStartDate = '';
  rentalDurationMonths: number | null = null;
  rentalAmount: number | null = null;
  rentalNotes = '';

  convertVenteConfirmOpen = false;
  convertVenteLead: AdminInterestDTO | null = null;

  // ─── Share modal ────────────────────────────────────────────────────────────
  shareModalOpen = false;
  shareTargetProperty: PropertyListItem | null = null;
  availableAdmins: AgencyAdminItem[] = [];
  selectedAdminIds = new Set<number>();
  sharingLoading = false;
  shareSuccessMessage = '';
  commissionType: 'PERCENTAGE' | 'FIXED' = 'PERCENTAGE';
  commissionValue: number = 0;
  shareMessage: string = '';
  shareError: string = '';

  // ─── Direct sale / rental modal ─────────────────────────────────────────────
  directSaleOpen = false;
  directSaleItem: PropertyListItem | null = null;
  directSaleTargetStatus: 'VENDU' | 'LOUE' = 'VENDU';
  directSaleSearchTerm = '';
  directSaleResults: ClientSearchResult[] = [];
  directSaleSearching = false;
  directSaleSelectedClient: ClientSearchResult | null = null;
  directSaleNewMode = false;
  directSaleNom = '';
  directSalePrenom = '';
  directSaleEmail = '';
  directSaleTelephone = '';
  directSaleRentalStart = '';
  directSaleRentalMonths: number | null = null;
  directSaleRentalAmount: number | null = null;
  directSaleRentalNotes = '';
  directSaleLoading = false;
  directSaleError = '';

  // ─── Backwards-compat modal state ───────────────────────────────────────────
  venduConfirmOpen = false;
  loueModalOpen = false;
  pendingStatusItem: PropertyListItem | null = null;
  loueMonths: number | null = null;

  constructor(
    private propertiesService: PropertiesAdminService,
    private shareRequestService: ShareRequestService,
    private authService: AdminAuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadProperties();
    this.loadLeads();
  }

  // ─── Auth helpers ────────────────────────────────────────────────────────────

  get currentUserRole(): string {
    return this.authService.getCurrentUser()?.role?.toUpperCase() ?? '';
  }

  get currentUserId(): number | undefined {
    return this.authService.getCurrentUser()?.id;
  }

  get isSuperAdmin(): boolean { return this.currentUserRole === 'SUPER_ADMIN'; }
  get isAdmin(): boolean      { return this.currentUserRole === 'ADMIN'; }
  get isCommercial(): boolean { return this.currentUserRole === 'COMMERCIAL'; }
  get isResponsableCommercial(): boolean { return this.currentUserRole === 'RESPONSABLE_COMMERCIAL'; }

  /**
   * Who may FINALISE a sale directly (no validation): SUPER_ADMIN + ADMIN only.
   * Drives approval-only actions.
   */
  get canApproveSales(): boolean { return this.isSuperAdmin || this.isAdmin; }

  /**
   * Who may INITIATE a sale/rental from the card. The sale icon is visible to
   * all internal staff — but the backend forces COMMERCIAL /
   * RESPONSABLE_COMMERCIAL through the validation workflow (they are never
   * property owners). UI visible ≠ authorisation to finalise directly.
   */
  get canInitiateSale(): boolean {
    return this.isSuperAdmin || this.isAdmin
        || this.isCommercial || this.isResponsableCommercial;
  }

  // ─── Section labels ──────────────────────────────────────────────────────────

  get section1Title(): string {
    return this.isSuperAdmin ? 'Mes biens' : 'Biens de mon agence';
  }

  get section2Title(): string {
    return this.isSuperAdmin ? 'Biens des agences' : 'Biens partagés — Super Admin';
  }

  get section1Count(): number { return this.section1Properties.length; }
  get section2Count(): number { return this.section2Properties.length; }

  // ─── Property sectioning ─────────────────────────────────────────────────────

  get section1Properties(): PropertyListItem[] {
    const base = this.isSuperAdmin
      ? this.filteredProperties.filter(p => p.ownerType === 'SUPER_ADMIN_OWNED' || !p.ownerType)
      : this.filteredProperties.filter(p => p.ownerType === 'AGENCY_OWNED');
    return this.applyStatusChip(base, this.section1StatusFilter);
  }

  get section2Properties(): PropertyListItem[] {
    const base = this.isSuperAdmin
      ? this.filteredProperties.filter(p => p.ownerType === 'AGENCY_OWNED')
      : this.filteredProperties.filter(p => p.ownerType === 'SUPER_ADMIN_OWNED');
    return this.applyStatusChip(base, this.section2StatusFilter);
  }

  get activeProperties(): PropertyListItem[] {
    return this.activeSection === 'section1' ? this.section1Properties : this.section2Properties;
  }

  get activeStatusFilter(): StatusFilter {
    return this.activeSection === 'section1' ? this.section1StatusFilter : this.section2StatusFilter;
  }

  setStatusFilter(chip: StatusFilter): void {
    if (this.activeSection === 'section1') {
      this.section1StatusFilter = chip;
    } else {
      this.section2StatusFilter = chip;
    }
  }

  applyStatusChip(props: PropertyListItem[], chip: StatusFilter): PropertyListItem[] {
    if (chip === 'TOUS') return props;
    return props.filter(p => p.statut === chip);
  }

  getChipCount(section: SectionTab, chip: StatusFilter): number {
    const base = this.isSuperAdmin
      ? (section === 'section1'
          ? this.filteredProperties.filter(p => p.ownerType === 'SUPER_ADMIN_OWNED' || !p.ownerType)
          : this.filteredProperties.filter(p => p.ownerType === 'AGENCY_OWNED'))
      : (section === 'section1'
          ? this.filteredProperties.filter(p => p.ownerType === 'AGENCY_OWNED')
          : this.filteredProperties.filter(p => p.ownerType === 'SUPER_ADMIN_OWNED'));
    return this.applyStatusChip(base, chip).length;
  }

  // ─── KPI chips ───────────────────────────────────────────────────────────────

  get totalCount(): number     { return this.filteredProperties.length; }
  get disponibleCount(): number { return this.filteredProperties.filter(p => p.statut === 'DISPONIBLE').length; }
  get enAttenteCount(): number  { return this.filteredProperties.filter(p => p.statut === 'EN_ATTENTE').length; }
  get pendingLeadsCount(): number { return this.leads.filter(l => l.status === 'PENDING').length; }
  get pendingValidationCount(): number {
    return this.filteredProperties.filter(p => p.hasPendingValidation).length;
  }

  get finalizedCount(): number {
    return this.properties.filter(p => p.statut === 'VENDU' || (p as any).isFinalized).length;
  }

  // ─── Data loading ─────────────────────────────────────────────────────────────

  loadProperties(): void {
    this.loading = true;
    this.errorMessage = '';
    this.propertiesService.getAllProperties().subscribe({
      next: properties => {
        this.properties = properties;
        this.loadCategoriesForProperties();
        this.applyFilters();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Erreur lors du chargement des biens.';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  loadLeads(): void {
    this.leadsLoading = true;
    this.propertiesService.getMyLeads().subscribe({
      next: leads => {
        this.leads = leads;
        this.leadsByPropertyId.clear();
        for (const lead of leads) {
          const arr = this.leadsByPropertyId.get(lead.propertyId) ?? [];
          arr.push(lead);
          this.leadsByPropertyId.set(lead.propertyId, arr);
        }
        this.leadsLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.leadsLoading = false; this.cdr.detectChanges(); },
    });
  }

  loadCategoriesForProperties(): void {
    this.properties.forEach(p => this.getPropertyCategory(p));
  }

  // ─── Category helpers ─────────────────────────────────────────────────────────

  getPropertyCategory(property: PropertyListItem): PropertyCategory | null {
    if (this.propertyCategories.has(property.id)) {
      return this.propertyCategories.get(property.id) ?? null;
    }
    const cat = this.calculateCategory(property);
    this.propertyCategories.set(property.id, cat);
    return cat;
  }

  calculateCategory(property: PropertyListItem): PropertyCategory | null {
    if (property.prixVente && property.prixVente > 0 && !(property.prixLocation && property.prixLocation > 0)) return 'VENTE';
    if (property.prixLocation && property.prixLocation > 0 && !(property.prixVente && property.prixVente > 0)) return 'LOCATION';
    return null;
  }

  getStatusesForProperty(property: PropertyListItem): PropertyStatus[] {
    return getStatusesForCategory(this.getPropertyCategory(property));
  }

  isStatusDisabledForProperty(property: PropertyListItem, statusValue: string): boolean {
    return !isStatusAllowedForCategory(statusValue, this.getPropertyCategory(property));
  }

  getCategoryLabel(property: PropertyListItem): string {
    const cat = this.getPropertyCategory(property);
    return cat === 'VENTE' ? 'Vente' : cat === 'LOCATION' ? 'Location' : 'Inconnu';
  }

  getCategory(item: PropertyListItem): string {
    return this.getCategoryLabel(item);
  }

  // ─── Pending validation badge ─────────────────────────────────────────────────

  /** EN_ATTENTE due to cross-ownership validation (not a simple owner hold) */
  isCrossValidationPending(property: PropertyListItem): boolean {
    return property.statut === 'EN_ATTENTE' && !!property.hasPendingValidation;
  }

  getEnAttenteLabel(property: PropertyListItem): string {
    if (this.isCrossValidationPending(property)) return 'Validation propriétaire requise';
    return 'En attente';
  }

  // ─── Leads panel ─────────────────────────────────────────────────────────────

  getLeadCount(property: PropertyListItem): number {
    return this.leadsByPropertyId.get(property.id)?.length ?? property.interestCount ?? 0;
  }

  get currentPropertyLeads(): AdminInterestDTO[] {
    if (!this.leadsPanelProperty) return [];
    return this.leadsByPropertyId.get(this.leadsPanelProperty.id) ?? [];
  }

  openLeadsPanel(property: PropertyListItem, event: Event): void {
    event.stopPropagation();
    this.leadsPanelProperty = property;
    this.leadsPanelOpen = true;
    this.syncBodyScroll();
    this.cdr.detectChanges();
  }

  closeLeadsPanel(): void {
    this.leadsPanelOpen = false;
    this.leadsPanelProperty = null;
    this.syncBodyScroll();
    this.cdr.detectChanges();
  }

  getAvailableLeadStatuses(lead: AdminInterestDTO): typeof this.leadStatuses {
    if (lead.locked) return [];
    const category = lead.propertyCategory
      ?? (this.leadsPanelProperty ? this.getPropertyCategory(this.leadsPanelProperty)?.toString() : null);
    return this.leadStatuses.filter(s => {
      if (s.value === 'CONVERTI_VENTE'    && category === 'LOCATION') return false;
      if (s.value === 'CONVERTI_LOCATION' && category === 'VENTE')    return false;
      return true;
    });
  }

  updateLeadStatus(lead: AdminInterestDTO, status: string): void {
    if (lead.locked) return;
    if (status === 'CONVERTI_VENTE') {
      this.convertVenteLead = lead;
      this.convertVenteConfirmOpen = true;
      this.syncBodyScroll();
      this.cdr.detectChanges();
      return;
    }
    if (status === 'CONVERTI_LOCATION') {
      this.rentalLead = lead;
      this.rentalStartDate = new Date().toISOString().substring(0, 10);
      this.rentalDurationMonths = null;
      this.rentalAmount = null;
      this.rentalNotes = '';
      this.rentalModalOpen = true;
      this.syncBodyScroll();
      this.cdr.detectChanges();
      return;
    }
    if (status === 'REFUSE') {
      this.refuseLead = lead;
      this.refuseMessage = '';
      this.refuseModalOpen = true;
      this.syncBodyScroll();
      this.cdr.detectChanges();
      return;
    }
    this.propertiesService.updateInterestStatus(lead.id, status).subscribe({
      next: updated => { Object.assign(lead, updated); this.syncLeadInMap(updated); this.cdr.detectChanges(); },
    });
  }

  // ─── Lead conversion confirmations ───────────────────────────────────────────

  confirmConvertVente(): void {
    if (!this.convertVenteLead) return;
    const lead = this.convertVenteLead;
    this.convertVenteConfirmOpen = false;
    this.convertVenteLead = null;
    this.syncBodyScroll();
    this.executeConvert(lead, { targetStatus: 'CONVERTI_VENTE' });
  }

  cancelConvertVente(): void {
    this.convertVenteConfirmOpen = false;
    this.convertVenteLead = null;
    this.syncBodyScroll();
    this.cdr.detectChanges();
  }

  get rentalEndDatePreview(): string | null {
    if (!this.rentalStartDate || !this.rentalDurationMonths || this.rentalDurationMonths < 1) return null;
    const end = new Date(this.rentalStartDate);
    end.setMonth(end.getMonth() + this.rentalDurationMonths);
    return end.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  get rentalModalValid(): boolean {
    return !!(this.rentalStartDate && this.rentalDurationMonths && this.rentalDurationMonths >= 1);
  }

  confirmConvertLocation(): void {
    if (!this.rentalLead || !this.rentalModalValid) return;
    const lead = this.rentalLead;
    const req: ConvertLeadRequest = {
      targetStatus: 'CONVERTI_LOCATION',
      rentalStartDate: this.rentalStartDate,
      rentalDurationMonths: this.rentalDurationMonths!,
      rentalAmount: this.rentalAmount ?? undefined,
      rentalNotes: this.rentalNotes || undefined,
    };
    this.rentalModalOpen = false;
    this.rentalLead = null;
    this.syncBodyScroll();
    this.executeConvert(lead, req);
  }

  cancelRentalModal(): void {
    this.rentalModalOpen = false;
    this.rentalLead = null;
    this.syncBodyScroll();
    this.cdr.detectChanges();
  }

  confirmRefuse(): void {
    if (!this.refuseLead) return;
    const lead = this.refuseLead;
    const req: ConvertLeadRequest = { targetStatus: 'REFUSE', rejectionMessage: this.refuseMessage || undefined };
    this.refuseModalOpen = false;
    this.refuseLead = null;
    this.syncBodyScroll();
    this.executeConvert(lead, req);
  }

  cancelRefuse(): void {
    this.refuseModalOpen = false;
    this.refuseLead = null;
    this.syncBodyScroll();
    this.cdr.detectChanges();
  }

  private executeConvert(lead: AdminInterestDTO, req: ConvertLeadRequest): void {
    this.propertiesService.convertLead(lead.id, req).subscribe({
      next: updated => {
        Object.assign(lead, updated);
        this.syncLeadInMap(updated);
        if (req.targetStatus === 'CONVERTI_VENTE' || req.targetStatus === 'CONVERTI_LOCATION') {
          this.loadProperties();
        }
        this.cdr.detectChanges();
      },
      error: err => {
        this.showError(err?.error?.error || 'Erreur lors de la conversion du lead.');
      },
    });
  }

  private syncLeadInMap(updated: AdminInterestDTO): void {
    const arr = this.leadsByPropertyId.get(updated.propertyId);
    if (arr) { const idx = arr.findIndex(l => l.id === updated.id); if (idx >= 0) arr[idx] = updated; }
    const gi = this.leads.findIndex(l => l.id === updated.id);
    if (gi >= 0) this.leads[gi] = updated;
  }

  getLeadStatusLabel(status: string): string { return this.leadStatuses.find(s => s.value === status)?.label ?? status; }
  getLeadStatusColor(status: string): string { return this.leadStatuses.find(s => s.value === status)?.color ?? '#6b7280'; }
  formatWhatsApp(telephone: string): string { return telephone.replace(/[\s\-\+\(\)]/g, ''); }

  // ─── Ownership helpers ────────────────────────────────────────────────────────

  getOwnershipBadge(property: PropertyListItem): string {
    if (property.ownerType === 'SUPER_ADMIN_OWNED') {
      const n = property.sharedWithAgencyIds?.length ?? 0;
      return n > 0 ? `Partagé (${n} agence${n > 1 ? 's' : ''})` : 'Super Admin';
    }
    if (property.ownerType === 'AGENCY_OWNED') {
      return property.agencyAdminName ? property.agencyAdminName : 'Agence';
    }
    return '';
  }

  getOwnershipClass(property: PropertyListItem): string {
    if (property.ownerType === 'SUPER_ADMIN_OWNED') {
      return (property.sharedWithAgencyIds?.length ?? 0) > 0 ? 'badge-shared' : 'badge-super-admin';
    }
    if (property.ownerType === 'AGENCY_OWNED') return 'badge-agency';
    return '';
  }

  canShare(property: PropertyListItem): boolean {
    return this.isSuperAdmin && property.ownerType === 'SUPER_ADMIN_OWNED';
  }

  canEditProperty(property: PropertyListItem): boolean {
    if (!this.authService.getCurrentUser()) return false;
    if (this.isSuperAdmin) {
      const isAgencyOwned = property.ownerType === 'AGENCY_OWNED'
        || property.ownerRole === 'ADMIN'
        || property.ownerRole === 'RESPONSABLE_COMMERCIAL'
        || property.ownerRole === 'COMMERCIAL';
      if (isAgencyOwned) return false;
    }
    if (this.isAdmin && property.ownerType === 'SUPER_ADMIN_OWNED') return false;
    if (this.currentUserRole === 'RESPONSABLE_COMMERCIAL' && property.ownerType === 'SUPER_ADMIN_OWNED') return false;
    if (this.isCommercial && property.createdById !== this.currentUserId) return false;
    return true;
  }

  canChangeStatus(property: PropertyListItem): boolean {
    if (this.canEditProperty(property)) return true;
    if (this.isSuperAdmin && property.ownerType === 'AGENCY_OWNED') return true;
    if (this.isAdmin && property.ownerType === 'SUPER_ADMIN_OWNED') return true;
    if (this.currentUserRole === 'COMMERCIAL' || this.currentUserRole === 'RESPONSABLE_COMMERCIAL') return true;
    return false;
  }

  statusChangeNeedsApproval(property: PropertyListItem): boolean {
    if (this.isSuperAdmin && property.ownerType === 'AGENCY_OWNED') return true;
    if (this.isAdmin && property.ownerType === 'SUPER_ADMIN_OWNED') return true;
    if (this.currentUserRole === 'COMMERCIAL' || this.currentUserRole === 'RESPONSABLE_COMMERCIAL') return true;
    return false;
  }

  approvalChainLabel(property: PropertyListItem): string {
    if (this.isSuperAdmin && property.ownerType === 'AGENCY_OWNED') return "L'Admin de l'agence doit valider.";
    if (this.isAdmin && property.ownerType === 'SUPER_ADMIN_OWNED') return 'Le Super Admin doit valider.';
    if (this.currentUserRole === 'RESPONSABLE_COMMERCIAL' || this.isCommercial) {
      return property.ownerType === 'SUPER_ADMIN_OWNED'
        ? "L'Admin, puis le Super Admin, doivent valider."
        : "L'Admin de votre agence doit valider.";
    }
    return '';
  }

  // ─── Pending sale approval (old workflow) ────────────────────────────────────

  hasPendingSale(property: PropertyListItem): boolean {
    return property.pendingSaleApproval === 'PENDING';
  }

  canApproveSaleFor(property: PropertyListItem): boolean {
    if (!this.canApproveSales || !this.hasPendingSale(property)) return false;
    if (this.isSuperAdmin) return property.pendingSaleApproverRole === 'SUPER_ADMIN';
    if (this.isAdmin) return property.pendingSaleApproverRole === 'ADMIN';
    return false;
  }

  approveSale(property: PropertyListItem): void {
    this.propertiesService.approvePendingSale(property.id).subscribe({
      next: updated => { Object.assign(property, updated); this.applyFilters(); this.cdr.detectChanges(); },
      error: err => this.showError(err?.error?.error || 'Impossible d\'approuver la vente.'),
    });
  }

  rejectSale(property: PropertyListItem): void {
    const reason = prompt('Raison du refus (optionnelle):') ?? '';
    this.propertiesService.rejectPendingSale(property.id, reason).subscribe({
      next: updated => { Object.assign(property, updated); this.applyFilters(); this.cdr.detectChanges(); },
      error: err => this.showError(err?.error?.error || 'Impossible de refuser la vente.'),
    });
  }

  getPendingSaleLabel(property: PropertyListItem): string {
    if (!property.pendingSaleApproval) return '';
    const requester = property.pendingSaleRequestedByName ?? 'Inconnu';
    const target = property.pendingSaleStatut ?? '?';
    switch (property.pendingSaleApproval) {
      case 'PENDING':   { const w = property.pendingSaleApproverRole === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'; return `"${target}" demandé par ${requester} — en attente de ${w}`; }
      case 'APPROVED':  return `Vente approuvée (${target})`;
      case 'REJECTED':  return `Vente refusée${property.pendingSaleRejectionReason ? ': ' + property.pendingSaleRejectionReason : ''}`;
      default:          return '';
    }
  }

  // ─── Share modal ──────────────────────────────────────────────────────────────

  openShareModal(property: PropertyListItem): void {
    this.shareTargetProperty = property;
    this.shareSuccessMessage = '';
    this.shareError = '';
    this.commissionType = 'PERCENTAGE';
    this.commissionValue = 0;
    this.shareMessage = '';
    this.selectedAdminIds.clear();
    this.sharingLoading = true;
    this.shareModalOpen = true;
    this.syncBodyScroll();
    this.cdr.detectChanges();
    this.shareRequestService.getAgenciesWithStatus(property.id).subscribe({
      next: admins => { this.availableAdmins = admins; this.sharingLoading = false; this.cdr.detectChanges(); },
      error: () => { this.sharingLoading = false; this.cdr.detectChanges(); },
    });
  }

  closeShareModal(): void {
    this.shareModalOpen = false;
    this.shareTargetProperty = null;
    this.availableAdmins = [];
    this.selectedAdminIds.clear();
    this.shareSuccessMessage = '';
    this.shareError = '';
    this.syncBodyScroll();
    this.cdr.detectChanges();
  }

  toggleAdmin(adminId: number): void {
    const admin = this.availableAdmins.find(a => a.id === adminId);
    if (admin?.shareRequestStatus === 'PENDING' || admin?.alreadyShared) return;
    this.selectedAdminIds.has(adminId) ? this.selectedAdminIds.delete(adminId) : this.selectedAdminIds.add(adminId);
  }

  isAdminSelected(adminId: number): boolean { return this.selectedAdminIds.has(adminId); }

  isAdminLocked(admin: AgencyAdminItem): boolean {
    return admin.alreadyShared || admin.shareRequestStatus === 'PENDING';
  }

  getAdminStatusLabel(admin: AgencyAdminItem): string {
    if (admin.alreadyShared) return 'Accepté';
    switch (admin.shareRequestStatus) {
      case 'PENDING':   return 'En attente';
      case 'REJECTED':  return 'Refusé';
      case 'CANCELLED': return 'Annulé';
      default:          return '';
    }
  }

  getAdminStatusClass(admin: AgencyAdminItem): string {
    if (admin.alreadyShared) return 'admin-status-accepted';
    switch (admin.shareRequestStatus) {
      case 'PENDING':   return 'admin-status-pending';
      case 'REJECTED':  return 'admin-status-rejected';
      case 'CANCELLED': return 'admin-status-cancelled';
      default:          return '';
    }
  }

  get commissionPreview(): string {
    if (!this.commissionValue) return 'Aucune commission';
    return this.commissionType === 'PERCENTAGE' ? `${this.commissionValue}%` : `${this.commissionValue.toLocaleString('fr-FR')} TND`;
  }

  sendShareRequests(): void {
    if (!this.shareTargetProperty) return;
    if (this.selectedAdminIds.size === 0) { this.shareError = 'Sélectionnez au moins une agence.'; this.cdr.detectChanges(); return; }
    if (this.commissionValue < 0) { this.shareError = 'La commission ne peut pas être négative.'; this.cdr.detectChanges(); return; }
    this.sharingLoading = true;
    this.shareError = '';
    this.shareRequestService.createRequests(this.shareTargetProperty.id, {
      agencyAdminIds: Array.from(this.selectedAdminIds),
      commissionType: this.commissionType,
      commissionPercentage: this.commissionValue,
      message: this.shareMessage || undefined,
    }).subscribe({
      next: results => {
        this.shareSuccessMessage = `${results.length} demande(s) envoyée(s).`;
        this.sharingLoading = false;
        this.applyFilters();
        this.cdr.detectChanges();
        setTimeout(() => this.closeShareModal(), 2000);
      },
      error: err => {
        this.shareError = err?.error?.message || 'Impossible d\'envoyer les demandes.';
        this.sharingLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  // ─── Filters ──────────────────────────────────────────────────────────────────

  applyFilters(): void {
    const term = this.searchTerm.trim().toLowerCase();
    let filtered = [...this.properties];

    if (!this.showFinalized) {
      filtered = filtered.filter(p => p.statut !== 'VENDU' && !(p as any).isFinalized);
    }

    if (term) {
      filtered = filtered.filter(item =>
        (item.titre || '').toLowerCase().includes(term) ||
        this.getReference(item).toLowerCase().includes(term) ||
        (item.adresse || '').toLowerCase().includes(term) ||
        (item.city || '').toLowerCase().includes(term)
      );
    }

    if (this.typeFilter)       filtered = filtered.filter(i => i.type === this.typeFilter);
    if (this.cityFilter)       filtered = filtered.filter(i => (i.city || '') === this.cityFilter);
    if (this.categoryFilter)   filtered = filtered.filter(i => this.getCategory(i) === this.categoryFilter);
    if (this.validationFilter) filtered = filtered.filter(i => (i.validationStatus || 'APPROVED') === this.validationFilter);
    if (this.minPrice != null) filtered = filtered.filter(i => this.getPrice(i) >= this.minPrice!);
    if (this.maxPrice != null) filtered = filtered.filter(i => this.getPrice(i) <= this.maxPrice!);

    this.filteredProperties = filtered;
    this.cdr.detectChanges();
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.typeFilter = '';
    this.cityFilter = '';
    this.categoryFilter = '';
    this.validationFilter = '';
    this.minPrice = undefined;
    this.maxPrice = undefined;
    this.section1StatusFilter = 'TOUS';
    this.section2StatusFilter = 'TOUS';
    this.applyFilters();
  }

  // ─── Status change flow ───────────────────────────────────────────────────────

  updateStatus(item: PropertyListItem, newStatus: string): void {
    if (newStatus === item.statut || this.isPropertyLocked(item)) return;
    const category = this.getPropertyCategory(item);
    if (!isStatusAllowedForCategory(newStatus, category)) {
      this.showError(category === 'VENTE'
        ? 'Une propriété en vente ne peut pas avoir le statut "Loué"'
        : 'Une propriété en location ne peut pas avoir le statut "Vendu"');
      return;
    }
    if (newStatus === 'VENDU' || newStatus === 'LOUE') {
      this.openDirectSaleModal(item, newStatus as 'VENDU' | 'LOUE');
      return;
    }
    this.applyStatusUpdate(item, newStatus);
  }

  // ─── Direct sale / rental modal ───────────────────────────────────────────────

  openDirectSaleModal(item: PropertyListItem, status: 'VENDU' | 'LOUE'): void {
    this.directSaleItem = item;
    this.directSaleTargetStatus = status;
    this.directSaleSearchTerm = '';
    this.directSaleResults = [];
    this.directSaleSearching = false;
    this.directSaleSelectedClient = null;
    this.directSaleNewMode = false;
    this.directSaleNom = '';
    this.directSalePrenom = '';
    this.directSaleEmail = '';
    this.directSaleTelephone = '';
    this.directSaleRentalStart = new Date().toISOString().substring(0, 10);
    this.directSaleRentalMonths = null;
    this.directSaleRentalAmount = null;
    this.directSaleRentalNotes = '';
    this.directSaleLoading = false;
    this.directSaleError = '';
    this.directSaleOpen = true;
    this.syncBodyScroll();
    this.cdr.detectChanges();
  }

  closeDirectSaleModal(): void {
    this.directSaleOpen = false;
    this.directSaleItem = null;
    this.directSaleLoading = false;
    this.directSaleError = '';
    this.syncBodyScroll();
    this.cdr.detectChanges();
  }

  searchDirectSaleClients(): void {
    const term = this.directSaleSearchTerm.trim();
    if (!term) { this.directSaleResults = []; return; }
    this.directSaleSearching = true;
    this.propertiesService.searchClientsQuick(term).subscribe({
      next: results => { this.directSaleResults = results; this.directSaleSearching = false; this.cdr.detectChanges(); },
      error: () => { this.directSaleSearching = false; this.cdr.detectChanges(); },
    });
  }

  selectDirectSaleClient(client: ClientSearchResult): void {
    this.directSaleSelectedClient = client;
    this.directSaleNewMode = false;
    this.directSaleResults = [];
    this.directSaleSearchTerm = `${client.prenom} ${client.nom} — ${client.email}`;
    this.cdr.detectChanges();
  }

  clearDirectSaleClient(): void {
    this.directSaleSelectedClient = null;
    this.directSaleSearchTerm = '';
    this.directSaleResults = [];
    this.cdr.detectChanges();
  }

  get directSaleRentalEndPreview(): string | null {
    if (!this.directSaleRentalStart || !this.directSaleRentalMonths || this.directSaleRentalMonths < 1) return null;
    const end = new Date(this.directSaleRentalStart);
    end.setMonth(end.getMonth() + this.directSaleRentalMonths);
    return end.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  get directSaleCanConfirm(): boolean {
    const hasClient = !!this.directSaleSelectedClient
      || (this.directSaleNewMode && !!this.directSaleNom.trim() && !!this.directSaleEmail.trim());
    if (!hasClient) return false;
    if (this.directSaleTargetStatus === 'LOUE') {
      return !!(this.directSaleRentalStart && this.directSaleRentalMonths && this.directSaleRentalMonths >= 1);
    }
    return true;
  }

  confirmDirectSale(): void {
    if (!this.directSaleItem || !this.directSaleCanConfirm) return;
    const req: DirectSaleRequest = { targetStatus: this.directSaleTargetStatus };
    if (this.directSaleSelectedClient) {
      req.existingClientId = this.directSaleSelectedClient.id;
    } else {
      req.clientNom       = this.directSaleNom.trim();
      req.clientPrenom    = this.directSalePrenom.trim() || undefined;
      req.clientEmail     = this.directSaleEmail.trim();
      req.clientTelephone = this.directSaleTelephone.trim() || undefined;
    }
    if (this.directSaleTargetStatus === 'LOUE') {
      req.rentalStartDate      = this.directSaleRentalStart;
      req.rentalDurationMonths = this.directSaleRentalMonths!;
      req.rentalAmount         = this.directSaleRentalAmount ?? undefined;
      req.rentalNotes          = this.directSaleRentalNotes || undefined;
    }
    const item = this.directSaleItem;
    this.directSaleLoading = true;
    this.directSaleError = '';
    this.cdr.detectChanges();
    this.propertiesService.directSale(item.id, req).subscribe({
      next: updated => {
        Object.assign(item, updated);
        this.applyFilters();
        this.directSaleOpen = false;
        this.directSaleItem = null;
        this.directSaleLoading = false;
        this.syncBodyScroll();
        this.cdr.detectChanges();
      },
      error: err => {
        this.directSaleError = err?.error?.error || 'Erreur lors de la finalisation.';
        this.directSaleLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  cancelStatusChange(): void {
    this.venduConfirmOpen = false;
    this.loueModalOpen = false;
    this.pendingStatusItem = null;
    this.loueMonths = null;
    this.directSaleOpen = false;
    this.directSaleItem = null;
    this.syncBodyScroll();
    this.cdr.detectChanges();
  }

  private applyStatusUpdate(item: PropertyListItem, status: string, rentalDurationMonths?: number): void {
    const oldStatus = item.statut;
    this.propertiesService.updatePropertyStatus(item.id, status, rentalDurationMonths).subscribe({
      next: updated => {
        item.statut                     = updated.statut;
        item.isFinalized                = updated.isFinalized;
        item.isStatusLocked             = updated.isStatusLocked;
        item.statusLockReason           = updated.statusLockReason;
        item.rentalEndDate              = updated.rentalEndDate;
        item.rentalDurationMonths       = updated.rentalDurationMonths;
        item.pendingSaleApproval        = updated.pendingSaleApproval;
        item.pendingSaleStatut          = updated.pendingSaleStatut;
        item.pendingSaleRejectionReason = updated.pendingSaleRejectionReason;
        item.pendingSaleRequestedById   = updated.pendingSaleRequestedById;
        item.pendingSaleRequestedByName = updated.pendingSaleRequestedByName;
        item.pendingSaleApproverRole    = updated.pendingSaleApproverRole;
        this.applyFilters();
        this.cdr.detectChanges();
      },
      error: error => {
        item.statut = oldStatus;
        this.showError(error.error?.error || error.error?.message || 'Impossible de modifier le statut.');
        this.applyFilters();
        this.cdr.detectChanges();
      },
    });
  }

  deleteProperty(item: PropertyListItem): void {
    if (!confirm(`Supprimer « ${item.titre} » ?`)) return;
    this.propertiesService.deleteProperty(item.id).subscribe({
      next: () => {
        this.properties = this.properties.filter(p => p.id !== item.id);
        this.propertyCategories.delete(item.id);
        this.applyFilters();
        this.cdr.detectChanges();
      },
      error: error => this.showError(error.error?.error || 'Impossible de supprimer le bien.'),
    });
  }

  // ─── Display helpers ──────────────────────────────────────────────────────────

  getPrice(item: PropertyListItem): number {
    if (item.prixVente && item.prixVente > 0) return item.prixVente;
    if (item.prixLocation && item.prixLocation > 0) return item.prixLocation;
    return 0;
  }

  formatPrice(item: PropertyListItem): string {
    const price = this.getPrice(item);
    if (!price) return '—';
    const formatted = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'TND', maximumFractionDigits: 0 }).format(price);
    return this.getCategory(item) === 'LOCATION' ? `${formatted} / mois` : formatted;
  }

  getReference(item: PropertyListItem): string {
    return `PROP-${(item.id ?? 0).toString().padStart(5, '0')}`;
  }

  getLocation(item: PropertyListItem): string {
    return [item.city, item.country].filter(Boolean).join(', ') || '—';
  }

  getImageUrl(item: PropertyListItem): string | null {
    if (!item.mainImageUrl) return null;
    return item.mainImageUrl.startsWith('http') ? item.mainImageUrl : `${apiBaseUrl}${item.mainImageUrl}`;
  }

  onImageError(item: PropertyListItem): void {
    item.mainImageUrl = undefined;
    item.hasMainImage = false;
  }

  formatDate(value?: string): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  }

  formatLeadDate(value?: string): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    const diffDays = Math.floor((Date.now() - date.getTime()) / 86400000);
    if (diffDays === 0) return 'Aujourd\'hui';
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7)  return `Il y a ${diffDays} jours`;
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(date);
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'DISPONIBLE': return 'Disponible';
      case 'VENDU':      return 'Vendu';
      case 'LOUE':       return 'Loué';
      case 'EN_ATTENTE': return 'En attente';
      default:           return status || 'Inconnu';
    }
  }

  getStatusClass(status: string, property?: PropertyListItem): string {
    switch (status) {
      case 'DISPONIBLE': return 'status-disponible';
      case 'VENDU':      return 'status-vendu';
      case 'LOUE':       return 'status-loue';
      case 'EN_ATTENTE':
        return property && this.isCrossValidationPending(property)
          ? 'status-validation'
          : 'status-attente';
      default: return 'status-default';
    }
  }

  isPropertyLocked(property: PropertyListItem): boolean {
    return !!(property.isFinalized || property.statut === 'VENDU' || property.statut === 'LOUE' && property.isStatusLocked);
  }

  getValidationLabel(status?: string | null): string {
    switch (status) {
      case 'PENDING_RESPONSABLE': return 'En attente Responsable';
      case 'PENDING_ADMIN':       return 'En attente Admin';
      case 'APPROVED':            return 'Approuvé';
      case 'REJECTED':            return 'Refusé';
      default:                    return 'Approuvé';
    }
  }

  getValidationClass(status?: string | null): string {
    switch (status) {
      case 'PENDING_RESPONSABLE':
      case 'PENDING_ADMIN': return 'badge-pending';
      case 'REJECTED':      return 'badge-rejected';
      default:              return 'badge-approved';
    }
  }

  get pendingCount(): number {
    return this.properties.filter(p =>
      p.validationStatus === 'PENDING_RESPONSABLE' || p.validationStatus === 'PENDING_ADMIN').length;
  }

  get availableTypes(): string[] {
    return Array.from(new Set(this.properties.map(i => i.type).filter(Boolean))).sort();
  }

  get availableCities(): string[] {
    return Array.from(new Set(this.properties.map(i => i.city).filter((c): c is string => !!c && c.trim() !== ''))).sort();
  }

  get loueEndDatePreview(): string | null {
    if (!this.loueMonths || this.loueMonths < 1) return null;
    const end = new Date();
    end.setMonth(end.getMonth() + this.loueMonths);
    return end.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  get loueConfirmEnabled(): boolean { return !!(this.loueMonths && this.loueMonths >= 1); }

  trackById(_: number, item: PropertyListItem): number { return item.id; }
  trackByLeadId(_: number, lead: AdminInterestDTO): number { return lead.id; }

  // ─── Body scroll lock ─────────────────────────────────────────────────────────

  private get anyModalOpen(): boolean {
    return this.shareModalOpen || this.directSaleOpen || this.refuseModalOpen
        || this.rentalModalOpen || this.convertVenteConfirmOpen || this.leadsPanelOpen;
  }

  private syncBodyScroll(): void {
    document.body.style.overflow = this.anyModalOpen ? 'hidden' : '';
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }

  private showError(msg: string): void {
    this.errorMessage = msg;
    this.cdr.detectChanges();
    setTimeout(() => { this.errorMessage = ''; this.cdr.detectChanges(); }, 4000);
  }
}
