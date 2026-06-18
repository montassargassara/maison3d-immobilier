import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AgencyCommissionService,
  CommissionDetailDTO,
  CommissionSummaryDTO,
} from '../services/agency-commission.service';

/**
 * Suivi des commissions agences.
 *
 * Une commission agence est créée automatiquement (entité unifiée Commission,
 * beneficiaryType="AGENCY") lorsqu'une agence vend un bien SUPER_ADMIN_OWNED
 * partagé ET accepté, et que la vente est approuvée en validation.
 * Aucun calcul frontend — le backend est la seule source de vérité.
 */
@Component({
  selector: 'app-agency-commissions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './agency-commissions.html',
  styleUrl: './agency-commissions.scss',
})
export class AgencyCommissionsComponent implements OnInit {

  rows: CommissionDetailDTO[] = [];
  filtered: CommissionDetailDTO[] = [];
  summary: CommissionSummaryDTO = { total: 0, paid: 0, pending: 0, count: 0 };

  loading = false;
  actionLoading = false;
  errorMessage = '';
  successMessage = '';
  paidFilter = '';
  searchTerm = '';

  constructor(
    private service: AgencyCommissionService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.service.list().subscribe({
      next: data => {
        this.rows = data;
        this.applyFilters();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Erreur lors du chargement des commissions agences.';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
    this.service.summary().subscribe({
      next: s => { this.summary = s; this.cdr.detectChanges(); },
      error: () => {},
    });
  }

  applyFilters(): void {
    const term = this.searchTerm.toLowerCase();
    this.filtered = this.rows.filter(r => {
      const matchPaid = !this.paidFilter || (this.paidFilter === 'paid' ? r.paid : !r.paid);
      const matchSearch = !term ||
        r.beneficiaryName.toLowerCase().includes(term) ||
        r.propertyTitle.toLowerCase().includes(term) ||
        r.buyerName.toLowerCase().includes(term);
      return matchPaid && matchSearch;
    });
  }

  markPaid(row: CommissionDetailDTO): void {
    // Anti double-clic / anti race-condition : une seule action à la fois.
    if (this.actionLoading || row.paid) return;
    this.actionLoading = true;
    this.clearMessages();

    this.service.markPaid(row.id).subscribe({
      next: updated => {
        if (!updated || updated.id == null) {
          // Corps absent → resynchronisation réelle depuis le serveur.
          this.successMessage = 'Commission marquée comme payée.';
          this.actionLoading = false;
          this.load();
          return;
        }
        // Mise à jour immuable — aucun findIndex non protégé, aucune mutation directe.
        this.rows = this.rows.map(r => (r.id === updated.id ? updated : r));
        this.applyFilters();
        this.recomputeSummaryAfterPay(updated);
        this.successMessage = 'Commission marquée comme payée.';
        this.actionLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Erreur lors du marquage de la commission.';
        this.actionLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  /** Reflète le paiement dans les totaux sans refaire un appel réseau. */
  private recomputeSummaryAfterPay(paid: CommissionDetailDTO): void {
    this.summary = {
      ...this.summary,
      paid: this.round1(this.summary.paid + paid.commissionAmount),
      pending: this.round1(Math.max(0, this.summary.pending - paid.commissionAmount)),
    };
  }

  trackById(_: number, r: CommissionDetailDTO): number {
    return r.id;
  }

  clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  fmt(val: number): string {
    return (val || 0).toLocaleString('fr-FR', {
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }) + ' TND';
  }

  rateLabel(r: CommissionDetailDTO): string {
    return r.commissionType === 'FIXED' ? 'Forfait' : `${r.commissionRate}%`;
  }

  private round1(v: number): number {
    return Math.round(v * 10) / 10;
  }
}
