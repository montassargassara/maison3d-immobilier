import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AffiliateService } from '../services/affiliate.service';
import { SaleOfferDTO, SaleOfferStatus } from '../../models/affiliate.model';

@Component({
  selector: 'app-affiliate-offers',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './affiliate-offers.html',
  styleUrl: './affiliate-offers.scss',
})
export class AffiliateOffersComponent implements OnInit {

  offers: SaleOfferDTO[] = [];
  filtered: SaleOfferDTO[] = [];
  loading = false;
  errorMessage = '';
  successMessage = '';
  statusFilter: SaleOfferStatus | '' = '';

  // Cancel confirm
  cancelTarget: SaleOfferDTO | null = null;
  cancelModalOpen = false;
  actionLoading = false;

  // Detail modal
  detailOffer: SaleOfferDTO | null = null;
  detailModalOpen = false;

  constructor(
    private affiliateService: AffiliateService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.affiliateService.getMyOffers().subscribe({
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

  openCancelModal(offer: SaleOfferDTO): void {
    this.cancelTarget = offer;
    this.cancelModalOpen = true;
  }

  closeCancelModal(): void {
    this.cancelModalOpen = false;
    this.cancelTarget = null;
  }

  confirmCancel(): void {
    if (!this.cancelTarget) return;
    this.actionLoading = true;
    this.affiliateService.cancelOffer(this.cancelTarget.id).subscribe({
      next: () => {
        this.successMessage = 'Offre annulée.';
        this.actionLoading = false;
        this.closeCancelModal();
        this.load();
      },
      error: () => {
        this.errorMessage = 'Erreur lors de l\'annulation.';
        this.actionLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
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
