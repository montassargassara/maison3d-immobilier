import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PropertiesAdminService, PropertyListItem } from '../services/properties-admin.service';
import { AdminAuthService } from '../services/admin-auth';
import { apiBaseUrl } from '../../services/api-config';

@Component({
  selector: 'app-statistics',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './statistics.html',
  styleUrl: './statistics.scss',
})
export class Statistics implements OnInit {

  properties: PropertyListItem[] = [];
  loading = false;
  errorMessage = '';

  searchTerm = '';
  typeFilter = '';
  cityFilter = '';
  agencyFilter = '';

  selectedTxnProperty: PropertyListItem | null = null;

  currentUserRole = '';

  constructor(
    private propertiesService: PropertiesAdminService,
    private authService: AdminAuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.authService.currentUser.subscribe(u => {
      this.currentUserRole = u?.role ?? '';
    });
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';
    this.propertiesService.getAllTransactions().subscribe({
      next: list => {
        this.properties = list;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.errorMessage = 'Impossible de charger les transactions.';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  get isSuperAdmin(): boolean {
    return this.currentUserRole === 'SUPER_ADMIN';
  }

  // ── Sectioning (SUPER_ADMIN only) ─────────────────────────────────────────

  get ownProperties(): PropertyListItem[] {
    return this.properties.filter(p => p.ownerType === 'SUPER_ADMIN_OWNED');
  }

  get agencyProperties(): PropertyListItem[] {
    return this.properties.filter(p => p.ownerType === 'AGENCY_OWNED' || !p.ownerType);
  }

  get availableAgencies(): string[] {
    const names = this.agencyProperties
      .map(p => p.agencyAdminName)
      .filter((n): n is string => !!n);
    return [...new Set(names)].sort();
  }

  // ── Global KPIs ───────────────────────────────────────────────────────────

  get totalRevenue(): number {
    if (this.isSuperAdmin) {
      // Only own-property revenue counts for super admin
      return this.ownProperties.reduce((s, p) => s + (p.prixVente ?? 0), 0);
    }
    return this.properties.reduce((s, p) => s + (p.prixVente ?? 0), 0);
  }

  get avgPrice(): number {
    const base = this.isSuperAdmin ? this.ownProperties : this.properties;
    if (!base.length) return 0;
    return base.reduce((s, p) => s + (p.prixVente ?? 0), 0) / base.length;
  }

  // ── Per-section KPIs ──────────────────────────────────────────────────────

  get ownRevenue(): number {
    return this.ownProperties.reduce((s, p) => s + (p.prixVente ?? 0), 0);
  }

  get agencyRevenue(): number {
    return this.agencyProperties.reduce((s, p) => s + (p.prixVente ?? 0), 0);
  }

  get agencyCount(): number {
    return new Set(this.agencyProperties.map(p => p.agencyAdminName).filter(Boolean)).size;
  }

  // ── City / type breakdowns ────────────────────────────────────────────────

  get cityBreakdown(): { city: string; count: number }[] {
    const src = this.isSuperAdmin ? this.ownProperties : this.properties;
    const map = new Map<string, number>();
    src.forEach(p => map.set(p.city || 'Inconnue', (map.get(p.city || 'Inconnue') ?? 0) + 1));
    return Array.from(map.entries())
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  get typeBreakdown(): { type: string; count: number }[] {
    const src = this.isSuperAdmin ? this.ownProperties : this.properties;
    const map = new Map<string, number>();
    src.forEach(p => map.set(p.type, (map.get(p.type) ?? 0) + 1));
    return Array.from(map.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }

  // ── Filtered lists ────────────────────────────────────────────────────────

  private applyFilters(list: PropertyListItem[]): PropertyListItem[] {
    const term = this.searchTerm.trim().toLowerCase();
    return list.filter(p => {
      const matchSearch = !term
        || p.titre.toLowerCase().includes(term)
        || (p.adresse ?? '').toLowerCase().includes(term)
        || (p.city ?? '').toLowerCase().includes(term);
      const matchType = !this.typeFilter || p.type === this.typeFilter;
      const matchCity = !this.cityFilter || (p.city ?? '') === this.cityFilter;
      return matchSearch && matchType && matchCity;
    });
  }

  get filteredOwn(): PropertyListItem[] {
    return this.applyFilters(this.ownProperties);
  }

  get filteredAgency(): PropertyListItem[] {
    let list = this.agencyProperties;
    if (this.agencyFilter) {
      list = list.filter(p => p.agencyAdminName === this.agencyFilter);
    }
    return this.applyFilters(list);
  }

  /** Single-section filtered list for non-SUPER_ADMIN roles */
  get filtered(): PropertyListItem[] {
    return this.applyFilters(this.properties);
  }

  get availableTypes(): string[] {
    return [...new Set(this.properties.map(p => p.type))].sort();
  }

  get availableCities(): string[] {
    return [...new Set(this.properties.map(p => p.city ?? '').filter(Boolean))].sort();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  imageUrl(p: PropertyListItem): string | null {
    if (!p.mainImageUrl) return null;
    if (p.mainImageUrl.startsWith('http')) return p.mainImageUrl;
    return `${apiBaseUrl}${p.mainImageUrl}`;
  }

  fmt(val: number | undefined): string {
    if (!val && val !== 0) return '—';
    return val.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' TND';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.typeFilter = '';
    this.cityFilter = '';
    this.agencyFilter = '';
  }

  openTxnDetail(p: PropertyListItem): void {
    this.selectedTxnProperty = p;
  }

  closeTxnDetail(): void {
    this.selectedTxnProperty = null;
  }
}
