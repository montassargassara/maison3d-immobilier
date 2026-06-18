import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  AdminDashboardService,
  AgencyAffiliateItem,
  AgencyAffiliateStats,
  AgencyCommissionItem,
} from '../services/admin-dashboard.service';

@Component({
  selector: 'app-agency-affiliates',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './agency-affiliates.component.html',
  styleUrl: './agency-affiliates.component.scss',
})
export class AgencyAffiliatesComponent implements OnInit {
  loading = true;

  stats: AgencyAffiliateStats | null = null;
  affiliates: AgencyAffiliateItem[] = [];
  commissions: AgencyCommissionItem[] = [];

  filterDate = '';
  affiliateSearch = '';

  constructor(
    private dashboardService: AdminDashboardService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.loading = true;

    this.dashboardService.getAgencyAffiliateStats().subscribe({
      next: s => { this.stats = s; this.checkLoading(); },
      error: () => this.checkLoading(),
    });

    this.dashboardService.getAgencyAffiliates().subscribe({
      next: list => { this.affiliates = list; this.checkLoading(); },
      error: () => this.checkLoading(),
    });

    this.dashboardService.getAgencyAffiliateCommissions(50).subscribe({
      next: list => { this.commissions = list; this.checkLoading(); },
      error: () => this.checkLoading(),
    });
  }

  private _loaded = 0;
  private checkLoading(): void {
    this._loaded++;
    if (this._loaded >= 3) { this.loading = false; this.cdr.detectChanges(); }
  }

  get filteredAffiliates(): AgencyAffiliateItem[] {
    const q = this.affiliateSearch.trim().toLowerCase();
    if (!q) return this.affiliates;
    return this.affiliates.filter(
      a =>
        (a.prenom + ' ' + a.nom).toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q)
    );
  }

  get filteredCommissions(): AgencyCommissionItem[] {
    if (!this.filterDate) return this.commissions;
    const cutoff = new Date(this.filterDate).getTime();
    return this.commissions.filter(
      c => new Date(c.transactionDate).getTime() >= cutoff
    );
  }

  getInitials(a: AgencyAffiliateItem): string {
    return (
      (a.prenom?.charAt(0) || '') + (a.nom?.charAt(0) || '')
    ).toUpperCase() || '?';
  }

  getStatusClass(status: string): string {
    switch ((status ?? '').toUpperCase()) {
      case 'ACTIVE':    return 'badge-active';
      case 'PENDING':   return 'badge-pending';
      case 'SUSPENDED': return 'badge-suspended';
      case 'REJECTED':  return 'badge-rejected';
      default:          return 'badge-pending';
    }
  }

  getStatusLabel(status: string): string {
    switch ((status ?? '').toUpperCase()) {
      case 'ACTIVE':    return 'Actif';
      case 'PENDING':   return 'En attente';
      case 'SUSPENDED': return 'Suspendu';
      case 'REJECTED':  return 'Rejeté';
      default:          return status ?? '—';
    }
  }

  formatCurrency(v: number | null | undefined): string {
    if (v == null) return '—';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v);
  }

  formatDate(d: string | null | undefined): string {
    if (!d) return '—';
    try {
      return new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(new Date(d));
    } catch {
      return '—';
    }
  }
}
