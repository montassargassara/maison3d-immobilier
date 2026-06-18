import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AffiliateService } from '../services/affiliate.service';
import { AffiliateTransactionDTO } from '../../models/affiliate.model';

@Component({
  selector: 'app-affiliate-earnings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './affiliate-earnings.html',
  styleUrl: './affiliate-earnings.scss',
})
export class AffiliateEarningsComponent implements OnInit {

  transactions: AffiliateTransactionDTO[] = [];
  filtered: AffiliateTransactionDTO[] = [];
  loading = false;
  errorMessage = '';
  paidFilter = '';

  totalEarned = 0;
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
    this.affiliateService.getMyTransactions().subscribe({
      next: data => {
        this.transactions = data;
        this.computeTotals();
        this.applyFilters();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Erreur lors du chargement des gains.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  computeTotals(): void {
    this.totalEarned = this.transactions.reduce((s, t) => s + t.commissionAmount, 0);
    this.totalPaid = this.transactions.filter(t => t.isPaid).reduce((s, t) => s + t.commissionAmount, 0);
    this.totalPending = this.totalEarned - this.totalPaid;
  }

  applyFilters(): void {
    this.filtered = this.paidFilter
      ? this.transactions.filter(t => this.paidFilter === 'paid' ? t.isPaid : !t.isPaid)
      : [...this.transactions];
  }

  fmt(val: number): string {
    if (!val && val !== 0) return '—';
    return val.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' TND';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
