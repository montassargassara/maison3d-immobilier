import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AffiliateService } from '../services/affiliate.service';
import { AffiliateProfileDTO, AffiliateApprovalRequest } from '../../models/affiliate.model';

@Component({
  selector: 'app-affiliate-applications',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './affiliate-applications.html',
  styleUrl: './affiliate-applications.scss',
})
export class AffiliateApplicationsComponent implements OnInit {

  applications: AffiliateProfileDTO[] = [];
  loading = false;
  errorMessage = '';
  successMessage = '';

  // Reject modal
  rejectModalOpen = false;
  rejectTarget: AffiliateProfileDTO | null = null;
  rejectReason = '';
  actionLoading = false;

  // Detail modal
  detailModalOpen = false;
  selectedAffiliate: AffiliateProfileDTO | null = null;

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
    this.affiliateService.getPendingAffiliates().subscribe({
      next: data => {
        this.applications = data;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: err => {
        this.errorMessage = 'Erreur lors du chargement des candidatures.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  openDetail(app: AffiliateProfileDTO): void {
    this.selectedAffiliate = app;
    this.detailModalOpen = true;
  }

  closeDetail(): void {
    this.detailModalOpen = false;
    this.selectedAffiliate = null;
  }

  getFullName(a: AffiliateProfileDTO): string {
    return `${a.prenom} ${a.nom}`;
  }

  approve(app: AffiliateProfileDTO): void {
    this.actionLoading = true;
    this.affiliateService.approveAffiliate(app.userId).subscribe({
      next: () => {
        this.successMessage = `Affilié ${this.getFullName(app)} approuvé avec succès.`;
        this.actionLoading = false;
        this.closeDetail();
        this.load();
      },
      error: () => {
        this.errorMessage = 'Erreur lors de l\'approbation.';
        this.actionLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  openRejectModal(app: AffiliateProfileDTO): void {
    this.rejectTarget = app;
    this.rejectReason = '';
    this.rejectModalOpen = true;
  }

  closeRejectModal(): void {
    this.rejectModalOpen = false;
    this.rejectTarget = null;
    this.rejectReason = '';
  }

  confirmReject(): void {
    if (!this.rejectTarget || !this.rejectReason.trim()) return;
    this.actionLoading = true;
    const req: AffiliateApprovalRequest = { reason: this.rejectReason };
    this.affiliateService.rejectAffiliate(this.rejectTarget.userId, req).subscribe({
      next: () => {
        this.successMessage = `Candidature de ${this.getFullName(this.rejectTarget!)} rejetée.`;
        this.actionLoading = false;
        this.closeRejectModal();
        this.load();
      },
      error: () => {
        this.errorMessage = 'Erreur lors du rejet.';
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
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }
}
