import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AffiliateService } from '../services/affiliate.service';
import {
  AffiliateStatsDTO,
  AffiliateProfileDTO,
  AffiliateRegionDTO,
  SaleOfferDTO,
  SuggestedZoneDTO,
  AddZoneRequest,
} from '../../models/affiliate.model';

// Bank details shown to affiliate before payment
const BANK_RIB = {
  bank: 'Banque Nationale Agricole (BNA)',
  iban: 'TN59 0801 0000 1234 5678 9012',
  bic: 'BNATTNTT',
  holder: 'Maison3D Immobilier SARL',
};

@Component({
  selector: 'app-affiliate-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './affiliate-dashboard.html',
  styleUrl: './affiliate-dashboard.scss',
})
export class AffiliateDashboardComponent implements OnInit {

  stats: AffiliateStatsDTO | null = null;
  profile: AffiliateProfileDTO | null = null;
  recentOffers: SaleOfferDTO[] = [];
  suggestedZones: SuggestedZoneDTO[] = [];
  loading = false;
  errorMessage = '';
  successMessage = '';

  readonly bankRib = BANK_RIB;

  // ── Zone payment modal (multi-step) ──────────────────────────────────────
  paymentModalOpen = false;
  pendingZone: SuggestedZoneDTO | null = null;
  /** 'instructions' → show RIB/amount  |  'upload' → file picker  |  'submitted' → done */
  paymentStep: 'instructions' | 'upload' | 'submitted' = 'instructions';
  proofFile: File | null = null;
  proofPreviewUrl: string | null = null;
  paymentLoading = false;
  paymentError = '';

  // ── Remove zone confirmation ──────────────────────────────────────────────
  removeConfirmOpen = false;
  zoneToRemove: AffiliateRegionDTO | null = null;
  removeLoading = false;

  readonly MAX_ZONES = 3;

  constructor(
    private affiliateService: AffiliateService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;

    this.affiliateService.getMyProfile().subscribe({
      next: p => { this.profile = p; this.cdr.detectChanges(); },
      error: () => {}
    });

    this.affiliateService.getMyStats().subscribe({
      next: s => {
        this.stats = s;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Erreur lors du chargement du tableau de bord.';
        this.cdr.detectChanges();
      }
    });

    this.affiliateService.getMyOffers().subscribe({
      next: offers => { this.recentOffers = offers.slice(0, 5); this.cdr.detectChanges(); },
      error: () => {}
    });

    this.affiliateService.getSuggestedZones().subscribe({
      next: zones => { this.suggestedZones = zones; this.cdr.detectChanges(); },
      error: () => {}
    });
  }

  // ── Zone count / guard ────────────────────────────────────────────────────

  get currentZoneCount(): number {
    return this.profile?.regions?.length ?? 0;
  }

  get canAddZone(): boolean {
    return this.currentZoneCount < this.MAX_ZONES;
  }

  // ── Payment modal flow ────────────────────────────────────────────────────

  openPaymentModal(zone: SuggestedZoneDTO): void {
    if (!this.canAddZone) {
      this.errorMessage = `Vous avez atteint le maximum de ${this.MAX_ZONES} zones actives.`;
      return;
    }
    this.pendingZone = zone;
    this.paymentStep = zone.price === 0 ? 'upload' : 'instructions';
    this.proofFile = null;
    this.proofPreviewUrl = null;
    this.paymentError = '';
    this.paymentModalOpen = true;
    this.cdr.detectChanges();
  }

  closePaymentModal(): void {
    if (this.paymentStep === 'submitted') this.load();
    this.paymentModalOpen = false;
    this.pendingZone = null;
    this.proofFile = null;
    this.proofPreviewUrl = null;
    this.paymentError = '';
    this.paymentLoading = false;
    this.cdr.detectChanges();
  }

  nextToUpload(): void {
    this.paymentStep = 'upload';
    this.cdr.detectChanges();
  }

  onProofSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0] ?? null;
    this.proofFile = file;
    if (file) {
      const reader = new FileReader();
      reader.onload = e => {
        this.proofPreviewUrl = e.target?.result as string;
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(file);
    } else {
      this.proofPreviewUrl = null;
    }
    this.cdr.detectChanges();
  }

  submitPaymentRequest(): void {
    if (!this.pendingZone || !this.proofFile) return;
    this.paymentLoading = true;
    this.paymentError = '';

    const zone = this.pendingZone;

    if (zone.price === 0) {
      // Free first zone — use instant add-zone endpoint
      const req: AddZoneRequest = {
        country: zone.country ?? '',
        city: zone.city ?? zone.zoneName,
        paymentConfirmed: true,
      };
      this.affiliateService.addZone(req).subscribe({
        next: () => {
          this.paymentLoading = false;
          this.paymentStep = 'submitted';
          this.cdr.detectChanges();
        },
        error: err => {
          this.paymentLoading = false;
          this.paymentError = err?.error?.message ?? 'Erreur lors de l\'ajout de la zone.';
          this.cdr.detectChanges();
        }
      });
    } else {
      // Paid zone — submit payment request with proof
      this.affiliateService.submitZonePaymentRequest(
        zone.country ?? '',
        zone.city ?? zone.zoneName,
        zone.isPremium ?? false,
        this.proofFile
      ).subscribe({
        next: () => {
          this.paymentLoading = false;
          this.paymentStep = 'submitted';
          this.cdr.detectChanges();
        },
        error: err => {
          this.paymentLoading = false;
          this.paymentError = err?.error?.message ?? 'Erreur lors de l\'envoi de la demande.';
          this.cdr.detectChanges();
        }
      });
    }
  }

  // ── Remove zone ───────────────────────────────────────────────────────────

  openRemoveConfirm(region: AffiliateRegionDTO): void {
    this.zoneToRemove = region;
    this.removeConfirmOpen = true;
    this.cdr.detectChanges();
  }

  closeRemoveConfirm(): void {
    this.removeConfirmOpen = false;
    this.zoneToRemove = null;
    this.cdr.detectChanges();
  }

  confirmRemoveZone(): void {
    if (!this.zoneToRemove) return;
    this.removeLoading = true;
    this.affiliateService.removeZone(this.zoneToRemove.id).subscribe({
      next: () => {
        this.removeLoading = false;
        this.removeConfirmOpen = false;
        this.zoneToRemove = null;
        this.successMessage = 'Zone supprimée avec succès.';
        this.load();
        this.cdr.detectChanges();
      },
      error: () => {
        this.removeLoading = false;
        this.errorMessage = 'Erreur lors de la suppression de la zone.';
        this.cdr.detectChanges();
      }
    });
  }

  clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  formatStatus(status: string): string { return this.affiliateService.formatStatus(status); }
  getStatusClass(status: string): string { return this.affiliateService.getStatusClass(status); }

  fmt(val: number): string {
    if (!val && val !== 0) return '—';
    return val.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' TND';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  demandLabel(score: number): string {
    if (score >= 10) return 'Très forte';
    if (score >= 5)  return 'Forte';
    if (score >= 2)  return 'Modérée';
    if (score >= 1)  return 'Faible';
    return 'Nouvelle zone';
  }

  demandClass(score: number): string {
    if (score >= 10) return 'demand-very-high';
    if (score >= 5)  return 'demand-high';
    if (score >= 2)  return 'demand-medium';
    return 'demand-low';
  }

  zonePriceLabel(zone: SuggestedZoneDTO): string {
    if (zone.price === 0) return 'Gratuit';
    return `${zone.price} TND`;
  }

  zonePriceClass(zone: SuggestedZoneDTO): string {
    if (zone.price === 0) return 'zone-price-free';
    if (zone.isPremium)   return 'zone-price-premium';
    return 'zone-price-paid';
  }
}
