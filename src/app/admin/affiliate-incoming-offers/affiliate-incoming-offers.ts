import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AffiliateService } from '../services/affiliate.service';
import { AdminAuthService } from '../services/admin-auth';
import { SaleOfferDTO, RespondSaleOfferRequest, SaleOfferStatus } from '../../models/affiliate.model';

@Component({
  selector: 'app-affiliate-incoming-offers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './affiliate-incoming-offers.html',
  styleUrl: './affiliate-incoming-offers.scss',
})
export class AffiliateIncomingOffersComponent implements OnInit {

  offers: SaleOfferDTO[] = [];
  filtered: SaleOfferDTO[] = [];
  loading = false;
  errorMessage = '';
  successMessage = '';
  statusFilter: SaleOfferStatus | '' = '';

  // Respond modal
  respondModalOpen = false;
  respondTarget: SaleOfferDTO | null = null;
  respondAction: 'ACCEPTED' | 'REJECTED' = 'ACCEPTED';
  rejectReason = '';
  actionLoading = false;

  // Detail modal
  detailOffer: SaleOfferDTO | null = null;
  detailModalOpen = false;

  constructor(
    private affiliateService: AffiliateService,
    private authService: AdminAuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    const isSuperAdmin = this.authService.getCurrentUser()?.role?.toUpperCase() === 'SUPER_ADMIN';
    const source$ = isSuperAdmin
      ? this.affiliateService.getAllOffers()
      : this.affiliateService.getIncomingOffers();

    source$.subscribe({
      next: data => {
        this.offers = data;
        this.applyFilters();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Erreur lors du chargement des offres.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  applyFilters(): void {
    this.filtered = this.statusFilter
      ? this.offers.filter(o => o.status === this.statusFilter)
      : [...this.offers];
  }

  openDetail(offer: SaleOfferDTO): void {
    this.detailOffer = offer;
    this.detailModalOpen = true;
  }

  closeDetail(): void {
    this.detailModalOpen = false;
    this.detailOffer = null;
  }

  openRespondModal(offer: SaleOfferDTO, action: 'ACCEPTED' | 'REJECTED'): void {
    this.respondTarget = offer;
    this.respondAction = action;
    this.rejectReason = '';
    this.respondModalOpen = true;
  }

  closeRespondModal(): void {
    this.respondModalOpen = false;
    this.respondTarget = null;
    this.rejectReason = '';
  }

  confirmRespond(): void {
    if (!this.respondTarget) return;
    if (this.respondAction === 'REJECTED' && !this.rejectReason.trim()) return;
    this.actionLoading = true;
    const req: RespondSaleOfferRequest = {
      response: this.respondAction,
      rejectionReason: this.respondAction === 'REJECTED' ? this.rejectReason : undefined,
    };
    this.affiliateService.respondToOffer(this.respondTarget.id, req).subscribe({
      next: () => {
        const label = this.respondAction === 'ACCEPTED' ? 'acceptée' : 'rejetée';
        this.successMessage = `Offre ${label} avec succès.`;
        this.actionLoading = false;
        this.closeRespondModal();
        this.load();
      },
      error: () => {
        this.errorMessage = 'Erreur lors de la réponse.';
        this.actionLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  completeOffer(offer: SaleOfferDTO): void {
    this.actionLoading = true;
    this.affiliateService.completeOffer(offer.id).subscribe({
      next: () => {
        this.successMessage = 'Vente marquée comme complétée. Commission enregistrée.';
        this.actionLoading = false;
        this.load();
      },
      error: () => {
        this.errorMessage = 'Erreur lors de la complétion.';
        this.actionLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  pendingCount(): number {
    return this.offers.filter(o => o.status === 'PENDING').length;
  }

  formatStatus(status: string): string {
    return this.affiliateService.formatStatus(status);
  }

  getStatusClass(status: string): string {
    return this.affiliateService.getStatusClass(status);
  }

  fmt(val: number): string {
    if (!val && val !== 0) return '—';
    return val.toLocaleString('fr-FR', { minimumFractionDigits: 0 }) + ' TND';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
