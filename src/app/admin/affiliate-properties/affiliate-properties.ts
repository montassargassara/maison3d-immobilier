import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AffiliateService } from '../services/affiliate.service';
import { AffiliatePropertyDTO, CreateSaleOfferRequest } from '../../models/affiliate.model';
import { apiBaseUrl } from '../../services/api-config';

@Component({
  selector: 'app-affiliate-properties',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './affiliate-properties.html',
  styleUrl: './affiliate-properties.scss',
})
export class AffiliatePropertiesComponent implements OnInit {

  properties: AffiliatePropertyDTO[] = [];
  filtered: AffiliatePropertyDTO[] = [];
  loading = false;
  errorMessage = '';
  successMessage = '';
  searchTerm = '';
  typeFilter = '';
  sortBy = 'commission';

  // Offer modal
  offerModalOpen = false;
  offerTarget: AffiliatePropertyDTO | null = null;
  offerForm: CreateSaleOfferRequest = this.emptyOffer();
  offerLoading = false;
  offerError = '';
  offerMinPrice = 0;

  readonly apiBase = apiBaseUrl;

  constructor(
    private affiliateService: AffiliateService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.affiliateService.getEligibleProperties().subscribe({
      next: data => {
        this.properties = data;
        this.applyFilters();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Erreur lors du chargement des biens.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  applyFilters(): void {
    let list = [...this.properties];
    if (this.searchTerm) {
      const q = this.searchTerm.toLowerCase();
      list = list.filter(p =>
        p.titre.toLowerCase().includes(q) ||
        (p.city?.toLowerCase().includes(q)) ||
        (p.region?.toLowerCase().includes(q))
      );
    }
    if (this.typeFilter) list = list.filter(p => p.type === this.typeFilter);
    if (this.sortBy === 'commission') list.sort((a, b) => (b.commissionPercentage ?? 0) - (a.commissionPercentage ?? 0));
    if (this.sortBy === 'price_asc') list.sort((a, b) => (a.prixVente ?? 0) - (b.prixVente ?? 0));
    if (this.sortBy === 'price_desc') list.sort((a, b) => (b.prixVente ?? 0) - (a.prixVente ?? 0));
    this.filtered = list;
  }

  openOfferModal(property: AffiliatePropertyDTO): void {
    this.offerTarget = property;
    const defaultPrice = property.prixVente ?? property.prixLocation ?? 0;
    this.offerMinPrice = defaultPrice;
    this.offerForm = this.emptyOffer();
    this.offerForm.propertyId = property.id;
    this.offerForm.offeredPrice = defaultPrice;
    this.offerError = '';
    this.offerModalOpen = true;
  }

  closeOfferModal(): void {
    this.offerModalOpen = false;
    this.offerTarget = null;
    this.offerError = '';
  }

  submitOffer(): void {
    if (!this.offerForm.buyerName || !this.offerForm.buyerEmail || !this.offerForm.offeredPrice) {
      this.offerError = 'Veuillez remplir tous les champs obligatoires.';
      return;
    }
    if (this.offerForm.offeredPrice < this.offerMinPrice) {
      this.offerError = `Le prix proposé ne peut pas être inférieur au prix du bien (${this.offerMinPrice.toLocaleString('fr-FR')} TND).`;
      return;
    }
    this.offerLoading = true;
    this.affiliateService.submitOffer(this.offerForm).subscribe({
      next: () => {
        this.successMessage = 'Offre soumise avec succès !';
        this.offerLoading = false;
        this.closeOfferModal();
        this.cdr.detectChanges();
      },
      error: err => {
        this.offerError = err?.error?.message || 'Erreur lors de la soumission.';
        this.offerLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  getImageUrl(path: string | undefined): string | null {
    if (!path) return null;
    return path.startsWith('http') ? path : `${this.apiBase}${path}`;
  }

  formatPrice(p: AffiliatePropertyDTO): string {
    const price = p.prixVente ?? p.prixLocation;
    if (!price) return '—';
    return price.toLocaleString('fr-FR') + ' TND';
  }

  clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  private emptyOffer(): CreateSaleOfferRequest {
    return { propertyId: 0, buyerName: '', buyerEmail: '', buyerPhone: '', offeredPrice: 0, message: '' };
  }
}
