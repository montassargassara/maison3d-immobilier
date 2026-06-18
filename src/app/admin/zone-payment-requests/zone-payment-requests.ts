import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { AffiliateService } from '../services/affiliate.service';
import { ZonePaymentRequestDTO } from '../../models/affiliate.model';

@Component({
  selector: 'app-zone-payment-requests',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './zone-payment-requests.html',
  styleUrl: './zone-payment-requests.scss',
})
export class ZonePaymentRequestsComponent implements OnInit, OnDestroy {

  requests: ZonePaymentRequestDTO[] = [];
  loading = false;
  errorMessage = '';
  successMessage = '';

  filterStatus: 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' = 'ALL';

  // Blob-based proof URLs (keyed by request ID) — avoids JWT-less <img src> 403
  proofUrls = new Map<number, SafeUrl>();
  private objectUrls: string[] = [];

  // Reject modal
  rejectModalOpen = false;
  selectedRequest: ZonePaymentRequestDTO | null = null;
  rejectionReason = '';
  actionLoading = false;

  // Image preview (uses the already-loaded SafeUrl)
  previewSafeUrl: SafeUrl | null = null;

  constructor(
    private affiliateService: AffiliateService,
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    // Release blob object URLs to avoid memory leaks
    this.objectUrls.forEach(u => URL.revokeObjectURL(u));
  }

  load(): void {
    this.loading = true;
    this.affiliateService.getAllZonePayments().subscribe({
      next: list => {
        this.requests = list;
        this.loading = false;
        this.fetchProofUrls(list);
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Erreur lors du chargement des demandes.';
        this.cdr.detectChanges();
      }
    });
  }

  // Fetch each proof image via HttpClient so the JWT interceptor adds the Authorization header
  private fetchProofUrls(list: ZonePaymentRequestDTO[]): void {
    list.forEach(req => {
      if (!req.proofImageUrl || this.proofUrls.has(req.id)) return;
      this.http.get(req.proofImageUrl, { responseType: 'blob' }).subscribe({
        next: blob => {
          const objectUrl = URL.createObjectURL(blob);
          this.objectUrls.push(objectUrl);
          this.proofUrls.set(req.id, this.sanitizer.bypassSecurityTrustUrl(objectUrl));
          this.cdr.detectChanges();
        },
        error: () => { /* proof unavailable — thumbnail simply stays hidden */ }
      });
    });
  }

  get filtered(): ZonePaymentRequestDTO[] {
    if (this.filterStatus === 'ALL') return this.requests;
    return this.requests.filter(r => r.status === this.filterStatus);
  }

  get pendingCount(): number {
    return this.requests.filter(r => r.status === 'PENDING').length;
  }

  countByStatus(status: string): number {
    return this.requests.filter(r => r.status === status).length;
  }

  // ── Approve ────────────────────────────────────────────────────────────────

  approve(req: ZonePaymentRequestDTO): void {
    if (this.actionLoading) return;
    this.actionLoading = true;
    this.affiliateService.approveZonePayment(req.id).subscribe({
      next: updated => {
        const idx = this.requests.findIndex(r => r.id === req.id);
        if (idx !== -1) this.requests[idx] = updated;
        this.successMessage = `Zone "${req.zoneName}" approuvée — zone activée pour ${req.affiliateName}.`;
        this.actionLoading = false;
        this.cdr.detectChanges();
      },
      error: err => {
        this.errorMessage = err?.error?.message ?? 'Erreur lors de l\'approbation.';
        this.actionLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ── Reject modal ───────────────────────────────────────────────────────────

  openRejectModal(req: ZonePaymentRequestDTO): void {
    this.selectedRequest = req;
    this.rejectionReason = '';
    this.rejectModalOpen = true;
    this.cdr.detectChanges();
  }

  closeRejectModal(): void {
    this.rejectModalOpen = false;
    this.selectedRequest = null;
    this.rejectionReason = '';
    this.cdr.detectChanges();
  }

  confirmReject(): void {
    if (!this.selectedRequest || !this.rejectionReason.trim()) return;
    this.actionLoading = true;
    this.affiliateService.rejectZonePayment(this.selectedRequest.id, this.rejectionReason.trim()).subscribe({
      next: updated => {
        const idx = this.requests.findIndex(r => r.id === this.selectedRequest!.id);
        if (idx !== -1) this.requests[idx] = updated;
        this.successMessage = `Demande rejetée pour ${this.selectedRequest!.affiliateName}.`;
        this.actionLoading = false;
        this.closeRejectModal();
        this.cdr.detectChanges();
      },
      error: err => {
        this.errorMessage = err?.error?.message ?? 'Erreur lors du rejet.';
        this.actionLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ── Image preview (reuses the already-fetched blob URL) ───────────────────

  openImagePreview(reqId: number): void {
    this.previewSafeUrl = this.proofUrls.get(reqId) ?? null;
    this.cdr.detectChanges();
  }

  closeImagePreview(): void {
    this.previewSafeUrl = null;
    this.cdr.detectChanges();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = { PENDING: 'En attente', APPROVED: 'Approuvée', REJECTED: 'Rejetée' };
    return map[status] ?? status;
  }

  statusClass(status: string): string {
    const map: Record<string, string> = { PENDING: 'status-pending', APPROVED: 'status-active', REJECTED: 'status-rejected' };
    return map[status] ?? 'status-default';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  fmt(val: number): string {
    if (!val && val !== 0) return '—';
    return val.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' TND';
  }
}
