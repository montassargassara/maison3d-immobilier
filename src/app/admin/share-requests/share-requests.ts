import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  ShareRequestService,
  PropertyShareRequestDTO,
  ShareRequestStatus,
} from '../services/share-request.service';

@Component({
  selector: 'app-share-requests',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './share-requests.html',
  styleUrl: './share-requests.scss',
})
export class ShareRequestsComponent implements OnInit {

  requests: PropertyShareRequestDTO[] = [];
  filtered: PropertyShareRequestDTO[] = [];
  loading = false;
  errorMessage = '';

  statusFilter: ShareRequestStatus | '' = '';

  constructor(
    private shareRequestService: ShareRequestService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';
    this.shareRequestService.getSentRequests().subscribe({
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

  cancel(request: PropertyShareRequestDTO): void {
    if (!confirm(`Annuler la demande de partage pour "${request.propertyTitle}" → ${request.agencyAdminName} ?`)) return;

    this.shareRequestService.cancelRequest(request.id).subscribe({
      next: updated => {
        const idx = this.requests.findIndex(r => r.id === updated.id);
        if (idx !== -1) this.requests[idx] = updated;
        this.applyFilter();
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Impossible d\'annuler la demande.';
        this.cdr.detectChanges();
      },
    });
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

  formatDate(value?: string): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
  }

  formatPrice(req: PropertyShareRequestDTO): string {
    const price = req.propertyPrixVente ?? req.propertyPrixLocation ?? 0;
    if (!price) return '—';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'TND', maximumFractionDigits: 0 }).format(price);
  }

  get counts() {
    return {
      all: this.requests.length,
      pending:   this.requests.filter(r => r.status === 'PENDING').length,
      accepted:  this.requests.filter(r => r.status === 'ACCEPTED').length,
      rejected:  this.requests.filter(r => r.status === 'REJECTED').length,
      cancelled: this.requests.filter(r => r.status === 'CANCELLED').length,
    };
  }
}
