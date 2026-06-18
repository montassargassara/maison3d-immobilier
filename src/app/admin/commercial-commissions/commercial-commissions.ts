import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CommercialCommissionService,
  CommissionDetailDTO,
  CommissionSummaryDTO,
} from '../services/commercial-commission.service';
import { AdminAuthService } from '../services/admin-auth';

/**
 * Suivi des commissions commerciaux (STAFF).
 *
 * Entité unifiée Commission (beneficiaryType="STAFF"). Une commission STAFF
 * n'existe qu'APRÈS validation approuvée par un ADMIN/SUPER_ADMIN.
 * Aucun calcul frontend — le backend est la seule source de vérité.
 * Scope serveur : SUPER_ADMIN (tout) · ADMIN (son agence) · commercial (soi).
 */
@Component({
  selector: 'app-commercial-commissions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './commercial-commissions.html',
  styleUrl: './commercial-commissions.scss',
})
export class CommercialCommissionsComponent implements OnInit {

  rows: CommissionDetailDTO[] = [];
  filtered: CommissionDetailDTO[] = [];
  summary: CommissionSummaryDTO = { total: 0, paid: 0, pending: 0, count: 0 };

  loading = false;
  actionLoading = false;
  errorMessage = '';
  successMessage = '';
  paidFilter = '';
  searchTerm = '';

  /** Only ADMIN / SUPER_ADMIN may mark a staff commission paid. */
  canMarkPaid = false;

  constructor(
    private service: CommercialCommissionService,
    private auth: AdminAuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const role = this.auth.getCurrentUser()?.role?.toUpperCase();
    this.canMarkPaid = role === 'SUPER_ADMIN' || role === 'ADMIN';
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
        this.errorMessage = 'Erreur lors du chargement des commissions commerciaux.';
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
    if (this.actionLoading || row.paid || !this.canMarkPaid) return;
    this.actionLoading = true;
    this.clearMessages();

    this.service.markPaid(row.id).subscribe({
      next: updated => {
        if (!updated || updated.id == null) {
          this.successMessage = 'Commission marquée comme payée.';
          this.actionLoading = false;
          this.load();
          return;
        }
        this.rows = this.rows.map(r => (r.id === updated.id ? updated : r));
        this.applyFilters();
        this.summary = {
          ...this.summary,
          paid: this.round1(this.summary.paid + updated.commissionAmount),
          pending: this.round1(Math.max(0, this.summary.pending - updated.commissionAmount)),
        };
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

  trackById(_: number, r: CommissionDetailDTO): number {
    return r.id;
  }

  roleLabel(role: string | null): string {
    if (role === 'RESPONSABLE_COMMERCIAL') return 'Responsable';
    if (role === 'COMMERCIAL') return 'Commercial';
    return role || '—';
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
