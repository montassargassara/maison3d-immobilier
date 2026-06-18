// agency-applications.component.ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AgencyRegistrationService, AgencyApplicationDTO } from '../services/agency-registration.service';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

@Component({
  selector: 'app-agency-applications',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './agency-applications.component.html',
  styleUrls: ['./agency-applications.component.scss']
})
export class AgencyApplicationsComponent implements OnInit, OnDestroy {
  // Data
  applications: AgencyApplicationDTO[] = [];
  filteredApplications: AgencyApplicationDTO[] = [];
  
  // UI State
  loading = true;
  errorMessage = '';
  successMessage = '';
  actionLoading = false;
  
  // Search & Filter
  searchQuery = '';
  statusFilter: 'all' | 'pending' | 'approved' | 'rejected' = 'all';
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();
  
  // Pagination
  currentPage = 1;
  itemsPerPage = 6;
  totalPages = 1;
  
  // Modals
  detailModalOpen = false;
  selectedApp: AgencyApplicationDTO | null = null;
  rejectModalOpen = false;
  rejectTarget: AgencyApplicationDTO | null = null;
  rejectReason = '';

  // Statistics
  stats = {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0
  };

  constructor(
    private agencyService: AgencyRegistrationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.setupSearchListener();
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSearchListener(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.currentPage = 1;
      this.applyFilters();
    });
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';
    this.agencyService.getPendingApplications().subscribe({
      next: data => {
        this.applications = data;
        this.calculateStats();
        this.applyFilters();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Erreur lors du chargement des candidatures.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private calculateStats(): void {
    this.stats.total = this.applications.length;
    this.stats.pending = this.applications.filter(a => a.status === 'PENDING').length;
    this.stats.approved = this.applications.filter(a => a.status === 'APPROVED').length;
    this.stats.rejected = this.applications.filter(a => a.status === 'REJECTED').length;
  }

  onSearchChange(query: string): void {
    this.searchSubject.next(query);
  }

  onStatusChange(status: 'all' | 'pending' | 'approved' | 'rejected'): void {
    this.statusFilter = status;
    this.currentPage = 1;
    this.applyFilters();
  }

  private applyFilters(): void {
    let filtered = [...this.applications];
    
    // Apply status filter
    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(app => app.status === this.statusFilter.toUpperCase());
    }
    
    // Apply search filter
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(app => 
        app.agencyName.toLowerCase().includes(query) ||
        app.prenom.toLowerCase().includes(query) ||
        app.nom.toLowerCase().includes(query) ||
        app.email.toLowerCase().includes(query)
      );
    }
    
    // Update pagination
    this.totalPages = Math.ceil(filtered.length / this.itemsPerPage);
    this.filteredApplications = filtered;
  }

  get paginatedApplications(): AgencyApplicationDTO[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.filteredApplications.slice(start, end);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(this.totalPages, start + maxVisible - 1);
    
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  openDetail(app: AgencyApplicationDTO): void {
    this.selectedApp = app;
    this.detailModalOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeDetail(): void {
    this.detailModalOpen = false;
    this.selectedApp = null;
    document.body.style.overflow = '';
  }

  getFullName(app: AgencyApplicationDTO): string {
    return `${app.prenom} ${app.nom}`;
  }

  getInitials(app: AgencyApplicationDTO): string {
    return `${app.prenom.charAt(0)}${app.nom.charAt(0)}`.toUpperCase();
  }

  approve(app: AgencyApplicationDTO): void {
    this.actionLoading = true;
    this.agencyService.approve(app.id).subscribe({
      next: () => {
        this.successMessage = `Agence "${app.agencyName}" approuvée avec succès.`;
        this.actionLoading = false;
        this.closeDetail();
        this.load();
        setTimeout(() => this.clearMessages(), 3000);
      },
      error: () => {
        this.errorMessage = "Erreur lors de l'approbation.";
        this.actionLoading = false;
        this.cdr.detectChanges();
        setTimeout(() => this.clearMessages(), 3000);
      }
    });
  }

  openRejectModal(app: AgencyApplicationDTO): void {
    this.rejectTarget = app;
    this.rejectReason = '';
    this.rejectModalOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeRejectModal(): void {
    this.rejectModalOpen = false;
    this.rejectTarget = null;
    this.rejectReason = '';
    document.body.style.overflow = '';
  }

  confirmReject(): void {
    if (!this.rejectTarget || !this.rejectReason.trim()) return;
    this.actionLoading = true;
    this.agencyService.reject(this.rejectTarget.id, this.rejectReason).subscribe({
      next: () => {
        this.successMessage = `Candidature de "${this.rejectTarget!.agencyName}" rejetée.`;
        this.actionLoading = false;
        this.closeRejectModal();
        this.load();
        setTimeout(() => this.clearMessages(), 3000);
      },
      error: () => {
        this.errorMessage = 'Erreur lors du rejet.';
        this.actionLoading = false;
        this.cdr.detectChanges();
        setTimeout(() => this.clearMessages(), 3000);
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
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  getStatusBadgeClass(status: string): string {
    switch (status?.toUpperCase()) {
      case 'APPROVED': return 'status-approved';
      case 'REJECTED': return 'status-rejected';
      default: return 'status-pending';
    }
  }

  getStatusLabel(status: string): string {
    switch (status?.toUpperCase()) {
      case 'APPROVED': return 'Acceptée';
      case 'REJECTED': return 'Refusée';
      default: return 'En attente';
    }
  }

  getStatusIcon(status: string): string {
    switch (status?.toUpperCase()) {
      case 'APPROVED': return 'fas fa-check-circle';
      case 'REJECTED': return 'fas fa-times-circle';
      default: return 'fas fa-clock';
    }
  }
}