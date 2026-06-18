import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  ShareRequestService,
  PropertyShareRequestDTO,
  ShareRequestStatus,
} from '../services/share-request.service';
import { NotificationService } from '../services/notification.service';
import { apiBaseUrl } from '../../services/api-config';

@Component({
  selector: 'app-incoming-share-requests',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './incoming-share-requests.html',
  styleUrl: './incoming-share-requests.scss',
})
export class IncomingShareRequestsComponent implements OnInit {

  requests: PropertyShareRequestDTO[] = [];
  filtered: PropertyShareRequestDTO[] = [];
  loading = false;
  errorMessage = '';
  successMessage = '';

  statusFilter: ShareRequestStatus | '' = '';

  // Reject reason modal
  rejectModalOpen = false;
  rejectTarget: PropertyShareRequestDTO | null = null;
  rejectReason = '';
  respondLoading = false;

  constructor(
    private shareRequestService: ShareRequestService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';
    this.shareRequestService.getIncomingRequests().subscribe({
      next: data => {
        this.requests = data;
        this.applyFilter();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Erreur lors du chargement des demandes.';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  applyFilter(): void {
    this.filtered = this.statusFilter
      ? this.requests.filter(r => r.status === this.statusFilter)
      : [...this.requests];
  }

  // ─── Accept ───────────────────────────────────────────────────────────────

  accept(request: PropertyShareRequestDTO): void {
    if (!confirm(`Accepter le bien "${request.propertyTitle}" proposé par ${request.sharedByName} ?`)) return;

    this.respondLoading = true;
    this.shareRequestService.respond(request.id, { response: 'ACCEPTED' }).subscribe({
      next: updated => {
        this.updateRequest(updated);
        this.showSuccess(`Bien "${updated.propertyTitle}" accepté. Il est maintenant dans vos propriétés.`);
        this.notificationService.refreshCount();
        this.respondLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Impossible d\'accepter la demande.';
        this.respondLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  // ─── Reject ───────────────────────────────────────────────────────────────

  openRejectModal(request: PropertyShareRequestDTO): void {
    this.rejectTarget = request;
    this.rejectReason = '';
    this.rejectModalOpen = true;
    this.cdr.detectChanges();
  }

  closeRejectModal(): void {
    this.rejectModalOpen = false;
    this.rejectTarget = null;
    this.rejectReason = '';
    this.cdr.detectChanges();
  }

  confirmReject(): void {
    if (!this.rejectTarget) return;
    this.respondLoading = true;

    this.shareRequestService.respond(this.rejectTarget.id, {
      response: 'REJECTED',
      rejectionReason: this.rejectReason || undefined,
    }).subscribe({
      next: updated => {
        this.updateRequest(updated);
        this.showSuccess(`Demande refusée pour "${updated.propertyTitle}".`);
        this.notificationService.refreshCount();
        this.respondLoading = false;
        this.closeRejectModal();
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Impossible de refuser la demande.';
        this.respondLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private updateRequest(updated: PropertyShareRequestDTO): void {
    const idx = this.requests.findIndex(r => r.id === updated.id);
    if (idx !== -1) this.requests[idx] = updated;
    this.applyFilter();
  }

  private showSuccess(msg: string): void {
    this.successMessage = msg;
    setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 4000);
  }

  getImageUrl(req: PropertyShareRequestDTO): string | null {
    if (!req.propertyMainImageUrl) return null;
    return req.propertyMainImageUrl.startsWith('http')
      ? req.propertyMainImageUrl
      : `${apiBaseUrl}${req.propertyMainImageUrl}`;
  }

  statusLabel(status: ShareRequestStatus): string {
    switch (status) {
      case 'PENDING':   return 'En attente';
      case 'ACCEPTED':  return 'Acceptée';
      case 'REJECTED':  return 'Refusée';
      case 'CANCELLED': return 'Annulée';
    }
  }

  statusClass(status: ShareRequestStatus): string {
    switch (status) {
      case 'PENDING':   return 'badge-pending';
      case 'ACCEPTED':  return 'badge-accepted';
      case 'REJECTED':  return 'badge-rejected';
      case 'CANCELLED': return 'badge-cancelled';
    }
  }

  formatCommission(req: PropertyShareRequestDTO): string {
    return this.shareRequestService.formatCommission(req.commissionPercentage, req.commissionType);
  }

  formatRevenue(req: PropertyShareRequestDTO): string {
    return this.shareRequestService.formatExpectedRevenue(req);
  }

  formatPrice(req: PropertyShareRequestDTO): string {
    const price = req.propertyPrixVente ?? req.propertyPrixLocation ?? 0;
    if (!price) return '—';
    const label = req.propertyPrixVente ? '' : ' / mois';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency', currency: 'TND', maximumFractionDigits: 0,
    }).format(price) + label;
  }

  formatDate(value?: string): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
  }

  get counts() {
    return {
      all:       this.requests.length,
      pending:   this.requests.filter(r => r.status === 'PENDING').length,
      accepted:  this.requests.filter(r => r.status === 'ACCEPTED').length,
      rejected:  this.requests.filter(r => r.status === 'REJECTED').length,
      cancelled: this.requests.filter(r => r.status === 'CANCELLED').length,
    };
  }
}
