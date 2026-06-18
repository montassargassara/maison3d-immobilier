import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  CommercialCommissionService,
  CommercialPerformanceDTO,
} from '../services/commercial-commission.service';

/**
 * Gestion commerciale — suivi intelligent des performances commerciales.
 *
 * 100 % dérivé du domaine unifié Commission (beneficiaryType="STAFF") +
 * l'utilisateur bénéficiaire. Aucune donnée fictive, aucun calcul frontend :
 * tous les agrégats viennent du backend (CommissionService.commercialPerformance).
 * Scope serveur : SUPER_ADMIN (toutes agences) · ADMIN (son agence) · commercial (soi).
 */
@Component({
  selector: 'app-commercial-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './commercial-management.html',
  styleUrl: './commercial-management.scss',
})
export class CommercialManagementComponent implements OnInit {

  rows: CommercialPerformanceDTO[] = [];
  filtered: CommercialPerformanceDTO[] = [];

  loading = false;
  errorMessage = '';
  searchTerm = '';
  roleFilter = '';
  statusFilter = '';

  // Agrégats d'en-tête (somme des lignes — pas de recalcul métier, simple cumul d'affichage)
  totalCommercials = 0;
  totalRevenue = 0;
  totalEarned = 0;
  totalPending = 0;

  constructor(
    private service: CommercialCommissionService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.service.performance().subscribe({
      next: data => {
        this.rows = data;
        this.computeHeader();
        this.applyFilters();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Erreur lors du chargement des performances commerciales.';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  private computeHeader(): void {
    this.totalCommercials = this.rows.length;
    this.totalRevenue = this.rows.reduce((s, r) => s + r.revenueGenerated, 0);
    this.totalEarned = this.rows.reduce((s, r) => s + r.commissionsEarned, 0);
    this.totalPending = this.rows.reduce((s, r) => s + r.commissionsPending, 0);
  }

  applyFilters(): void {
    const term = this.searchTerm.toLowerCase();
    this.filtered = this.rows.filter(r => {
      const matchSearch = !term ||
        r.name.toLowerCase().includes(term) ||
        r.agencyName.toLowerCase().includes(term);
      const matchRole = !this.roleFilter || r.role === this.roleFilter;
      const matchStatus = !this.statusFilter ||
        (this.statusFilter === 'active' ? r.active : !r.active);
      return matchSearch && matchRole && matchStatus;
    });
  }

  trackById(_: number, r: CommercialPerformanceDTO): number {
    return r.commercialId;
  }

  roleLabel(role: string): string {
    if (role === 'RESPONSABLE_COMMERCIAL') return 'Responsable';
    if (role === 'COMMERCIAL') return 'Commercial';
    return role || '—';
  }

  fmt(val: number): string {
    return (val || 0).toLocaleString('fr-FR', {
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }) + ' TND';
  }
}
