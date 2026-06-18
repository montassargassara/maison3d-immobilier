import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AffiliateService } from '../services/affiliate.service';
import { AffiliateProfileDTO, AffiliateStatsDTO, AffiliateApprovalRequest, AffiliateCustomerDTO } from '../../models/affiliate.model';

@Component({
  selector: 'app-affiliate-accounts',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './affiliate-accounts.html',
  styleUrl: './affiliate-accounts.scss',
})
export class AffiliateAccountsComponent implements OnInit {

  affiliates: AffiliateProfileDTO[] = [];
  filtered: AffiliateProfileDTO[] = [];
  loading = false;
  errorMessage = '';
  successMessage = '';
  searchTerm = '';
  statusFilter = '';

  // Stats modal
  statsModalOpen = false;
  selectedStats: AffiliateStatsDTO | null = null;
  statsLoading = false;
  selectedCustomers: AffiliateCustomerDTO[] = [];
  customersLoading = false;

  // Suspend modal
  suspendModalOpen = false;
  suspendTarget: AffiliateProfileDTO | null = null;
  suspendReason = '';
  actionLoading = false;

  constructor(
    private affiliateService: AffiliateService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';
    this.affiliateService.getAllAffiliates().subscribe({
      next: data => {
        this.affiliates = data;
        this.applyFilters();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Erreur lors du chargement des affiliés.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  getFullName(a: AffiliateProfileDTO): string {
    return `${a.prenom} ${a.nom}`;
  }

  applyFilters(): void {
    const term = this.searchTerm.toLowerCase();
    this.filtered = this.affiliates.filter(a => {
      const matchSearch = !term ||
        a.nom.toLowerCase().includes(term) ||
        a.prenom.toLowerCase().includes(term) ||
        a.email.toLowerCase().includes(term);
      const matchStatus = !this.statusFilter || a.status === this.statusFilter;
      return matchSearch && matchStatus;
    });
  }

  openStats(affiliate: AffiliateProfileDTO): void {
    this.statsModalOpen = true;
    this.selectedStats = null;
    this.statsLoading = true;
    this.selectedCustomers = [];
    this.customersLoading = true;
    this.affiliateService.getAffiliateStats(affiliate.userId).subscribe({
      next: stats => {
        this.selectedStats = stats;
        this.statsLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.statsLoading = false;
        this.cdr.detectChanges();
      }
    });
    this.affiliateService.getCustomersForAffiliate(affiliate.userId).subscribe({
      next: rows => {
        this.selectedCustomers = rows;
        this.customersLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.customersLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  closeStats(): void {
    this.statsModalOpen = false;
    this.selectedStats = null;
    this.selectedCustomers = [];
  }

  activate(affiliate: AffiliateProfileDTO): void {
    this.actionLoading = true;
    this.affiliateService.activateAffiliate(affiliate.userId).subscribe({
      next: () => {
        this.successMessage = `${this.getFullName(affiliate)} réactivé avec succès.`;
        this.actionLoading = false;
        this.load();
      },
      error: () => {
        this.errorMessage = 'Erreur lors de la réactivation.';
        this.actionLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  openSuspendModal(affiliate: AffiliateProfileDTO): void {
    this.suspendTarget = affiliate;
    this.suspendReason = '';
    this.suspendModalOpen = true;
  }

  closeSuspendModal(): void {
    this.suspendModalOpen = false;
    this.suspendTarget = null;
    this.suspendReason = '';
  }

  confirmSuspend(): void {
    if (!this.suspendTarget || !this.suspendReason.trim()) return;
    this.actionLoading = true;
    const req: AffiliateApprovalRequest = { reason: this.suspendReason };
    this.affiliateService.suspendAffiliate(this.suspendTarget.userId, req).subscribe({
      next: () => {
        this.successMessage = `${this.getFullName(this.suspendTarget!)} suspendu.`;
        this.actionLoading = false;
        this.closeSuspendModal();
        this.load();
      },
      error: () => {
        this.errorMessage = 'Erreur lors de la suspension.';
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

  formatStatus(status: string): string {
    return this.affiliateService.formatStatus(status);
  }

  getStatusClass(status: string): string {
    return this.affiliateService.getStatusClass(status);
  }
}
