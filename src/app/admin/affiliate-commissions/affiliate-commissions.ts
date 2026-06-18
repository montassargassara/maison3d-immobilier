import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AffiliateService } from '../services/affiliate.service';
import { AffiliateTransactionDTO } from '../../models/affiliate.model';

@Component({
  selector: 'app-affiliate-commissions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './affiliate-commissions.html',
  styleUrl: './affiliate-commissions.scss',
})
export class AffiliateCommissionsComponent implements OnInit {

  transactions: AffiliateTransactionDTO[] = [];
  filtered: AffiliateTransactionDTO[] = [];
  loading = false;
  errorMessage = '';
  successMessage = '';
  paidFilter = '';
  searchTerm = '';
  actionLoading = false;

  totalRevenue = 0;
  totalPaid = 0;
  totalPending = 0;

  constructor(
    private affiliateService: AffiliateService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.affiliateService.getAllTransactions().subscribe({
      next: data => {
        this.transactions = data;
        this.computeTotals();
        this.applyFilters();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Erreur lors du chargement des transactions.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  computeTotals(): void {
    this.totalRevenue = this.transactions.reduce((s, t) => s + t.commissionAmount, 0);
    this.totalPaid = this.transactions.filter(t => t.isPaid).reduce((s, t) => s + t.commissionAmount, 0);
    this.totalPending = this.totalRevenue - this.totalPaid;
  }

  applyFilters(): void {
    this.filtered = this.transactions.filter(t => {
      const matchPaid = !this.paidFilter || (this.paidFilter === 'paid' ? t.isPaid : !t.isPaid);
      const matchSearch = !this.searchTerm ||
        t.affiliateName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        t.propertyTitle.toLowerCase().includes(this.searchTerm.toLowerCase());
      return matchPaid && matchSearch;
    });
  }

  markPaid(transaction: AffiliateTransactionDTO): void {
    // Anti double-clic / anti race-condition : une seule action à la fois.
    if (this.actionLoading) return;
    this.actionLoading = true;
    this.clearMessages();

    this.affiliateService.markCommissionPaid(transaction.id).subscribe({
      next: updated => {
        if (!updated || updated.id == null) {
          // Le backend renvoie désormais le DTO mis à jour. Si pour une
          // raison quelconque le corps est absent, on resynchronise depuis
          // le serveur (récupération réelle, pas de fausse donnée locale).
          this.load();
          this.successMessage = 'Commission marquée comme payée.';
          this.actionLoading = false;
          return;
        }
        // Mise à jour immuable : aucune mutation directe, aucun findIndex non protégé.
        this.transactions = this.transactions.map(t =>
          t.id === updated.id ? updated : t
        );
        this.computeTotals();
        this.applyFilters();
        this.successMessage = 'Commission marquée comme payée.';
        this.actionLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Erreur lors du marquage.';
        this.actionLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  fmt(val: number): string {
    return val.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' TND';
  }
}
