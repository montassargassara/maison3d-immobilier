import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import {
  PropertiesAdminService,
  PropertyListItem,
  AdminInterestDTO,
} from '../services/properties-admin.service';
import { AdminAuthService } from '../services/admin-auth';
import { apiBaseUrl } from '../../services/api-config';
import { VirtualTourDTO, VirtualTourService } from '../services/virtual-tour.service';
import { VirtualTourViewerComponent } from '../virtual-tour-viewer/virtual-tour-viewer.component';
import { VirtualTourModalComponent } from '../virtual-tour-modal/virtual-tour-modal.component';

@Component({
  selector: 'app-property-detail-admin',
  standalone: true,
  imports: [CommonModule, RouterModule, VirtualTourViewerComponent, VirtualTourModalComponent],
  templateUrl: './property-detail-admin.html',
  styleUrl: './property-detail-admin.scss',
})
export class PropertyDetailAdmin implements OnInit {
  propertyId!: number;
  property: PropertyListItem | null = null;
  leads: AdminInterestDTO[] = [];
  loading = true;
  leadsLoading = true;
  errorMessage = '';

  activeTab: 'info' | 'leads' | 'media' | 'tour' = 'info';

  // Virtual tour
  virtualTour: VirtualTourDTO | null = null;
  tourLoading = false;
  showTourModal = false;

  readonly leadStatuses: Record<string, { label: string; color: string }> = {
    PENDING:            { label: 'Nouveau lead',        color: '#6b7280' },
    CONTACTED:          { label: 'Contacté',            color: '#3b82f6' },
    VISITE_PROGRAMMEE:  { label: 'Visite programmée',   color: '#8b5cf6' },
    EN_NEGOCIATION:     { label: 'En négociation',      color: '#f59e0b' },
    CONVERTI_VENTE:     { label: 'Converti — Vente',    color: '#10b981' },
    CONVERTI_LOCATION:  { label: 'Converti — Location', color: '#06b6d4' },
    REFUSE:             { label: 'Refusé',              color: '#ef4444' },
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private propertiesService: PropertiesAdminService,
    private authService: AdminAuthService,
    private cdr: ChangeDetectorRef,
    private virtualTourService: VirtualTourService,
  ) {}

  ngOnInit(): void {
    this.propertyId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadProperty();
    this.loadLeads();
    this.loadTour();
  }

  loadTour(): void {
    this.tourLoading = true;
    this.virtualTourService.getTour(this.propertyId).subscribe({
      next: tour => {
        this.virtualTour = (tour.status === 'NOT_CREATED') ? null : tour;
        this.tourLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.virtualTour = null;
        this.tourLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  openTourModal(): void {
    this.showTourModal = true;
  }

  onTourGenerated(tour: VirtualTourDTO): void {
    this.virtualTour = tour;
    this.cdr.detectChanges();
  }

  closeTourModal(): void {
    this.showTourModal = false;
  }

  get currentUserRole(): string {
    return this.authService.getCurrentUser()?.role?.toUpperCase() ?? '';
  }
  get isSuperAdmin(): boolean { return this.currentUserRole === 'SUPER_ADMIN'; }

  loadProperty(): void {
    this.loading = true;
    // Reuse the list endpoint and filter — backend enforces visibility
    this.propertiesService.getAllProperties().subscribe({
      next: list => {
        this.property = list.find(p => p.id === this.propertyId) ?? null;
        if (!this.property) {
          this.errorMessage = 'Bien non trouvé ou accès refusé.';
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Erreur lors du chargement du bien.';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  loadLeads(): void {
    this.leadsLoading = true;
    this.propertiesService.getLeadsForProperty(this.propertyId).subscribe({
      next: leads => {
        this.leads = leads;
        this.leadsLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.leadsLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/admin/properties']);
  }

  goEdit(): void {
    this.router.navigate(['/admin/properties/edit', this.propertyId]);
  }

  getImageUrl(item: PropertyListItem): string | null {
    if (!item.mainImageUrl) return null;
    return item.mainImageUrl.startsWith('http') ? item.mainImageUrl : `${apiBaseUrl}${item.mainImageUrl}`;
  }

  getPrice(item: PropertyListItem): number {
    if (item.prixVente && item.prixVente > 0) return item.prixVente;
    if (item.prixLocation && item.prixLocation > 0) return item.prixLocation;
    return 0;
  }

  formatPrice(item: PropertyListItem): string {
    const price = this.getPrice(item);
    if (!price) return '—';
    const formatted = new Intl.NumberFormat('fr-FR', {
      style: 'currency', currency: 'TND', maximumFractionDigits: 0,
    }).format(price);
    const category = item.prixVente && item.prixVente > 0 ? 'VENTE' : 'LOCATION';
    return category === 'LOCATION' ? `${formatted} / mois` : formatted;
  }

  getReference(item: PropertyListItem): string {
    return `PROP-${(item.id ?? 0).toString().padStart(5, '0')}`;
  }

  getLocation(item: PropertyListItem): string {
    return [item.city, item.country].filter(Boolean).join(', ') || '—';
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      DISPONIBLE: 'Disponible', EN_ATTENTE: 'En attente', VENDU: 'Vendu', LOUE: 'Loué',
    };
    return map[status] ?? status;
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      DISPONIBLE: 'badge-disponible', EN_ATTENTE: 'badge-attente',
      VENDU: 'badge-vendu', LOUE: 'badge-loue',
    };
    return map[status] ?? 'badge-default';
  }

  formatDate(value?: string): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
  }

  getLeadStatusLabel(status: string): string {
    return this.leadStatuses[status]?.label ?? status;
  }

  getLeadStatusColor(status: string): string {
    return this.leadStatuses[status]?.color ?? '#6b7280';
  }

  formatWhatsApp(tel: string): string {
    return tel.replace(/[\s\-\+\(\)]/g, '');
  }

  getCategory(item: PropertyListItem): 'VENTE' | 'LOCATION' | null {
    if (item.prixVente && item.prixVente > 0 && !(item.prixLocation && item.prixLocation > 0)) return 'VENTE';
    if (item.prixLocation && item.prixLocation > 0 && !(item.prixVente && item.prixVente > 0)) return 'LOCATION';
    return null;
  }

  get activeLeads(): AdminInterestDTO[] {
    return this.leads.filter(l => !l.locked);
  }

  get convertedLeads(): AdminInterestDTO[] {
    return this.leads.filter(l => l.locked);
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  get canEdit(): boolean {
    if (!this.property) return false;
    if (this.isSuperAdmin && this.property.ownerType === 'AGENCY_OWNED') return false;
    if (!this.isSuperAdmin && this.property.ownerType === 'SUPER_ADMIN_OWNED') return false;
    return true;
  }

  isPropertyLocked(item: PropertyListItem): boolean {
    return !!(item.isFinalized || item.statut === 'VENDU' || (item.statut === 'LOUE' && item.isStatusLocked));
  }
}
