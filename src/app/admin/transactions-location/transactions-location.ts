import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PropertiesAdminService, PropertyListItem } from '../services/properties-admin.service';
import { AdminAuthService } from '../services/admin-auth';
import { apiBaseUrl } from '../../services/api-config';

@Component({
  selector: 'app-transactions-location',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './transactions-location.html',
  styleUrl: './transactions-location.scss',
})
export class TransactionsLocation implements OnInit {

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
    this.propertiesService.getRentedProperties().subscribe({
      next: list => {
        this.properties = list;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.errorMessage = 'Impossible de charger les locations.';
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

  get agencyCount(): number {
    return new Set(this.agencyProperties.map(p => p.agencyAdminName).filter(Boolean)).size;
  }

  // ── Global / per-section stats ────────────────────────────────────────────

  get totalRevenue(): number {
    return this.properties.reduce((s, p) => s + (p.prixLocation ?? 0), 0);
  }

  get avgPrice(): number {
    if (!this.properties.length) return 0;
    return this.totalRevenue / this.properties.length;
  }

  get ownRevenue(): number {
    return this.ownProperties.reduce((s, p) => s + (p.prixLocation ?? 0), 0);
  }

  get agencyRevenue(): number {
    return this.agencyProperties.reduce((s, p) => s + (p.prixLocation ?? 0), 0);
  }

  get activeRentals(): number {
    const now = new Date();
    return this.properties.filter(p => {
      if (!p.rentalEndDate) return true;
      return new Date(p.rentalEndDate) > now;
    }).length;
  }

  get ownActiveRentals(): number {
    const now = new Date();
    return this.ownProperties.filter(p => {
      if (!p.rentalEndDate) return true;
      return new Date(p.rentalEndDate) > now;
    }).length;
  }

  get agencyActiveRentals(): number {
    const now = new Date();
    return this.agencyProperties.filter(p => {
      if (!p.rentalEndDate) return true;
      return new Date(p.rentalEndDate) > now;
    }).length;
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

  rentalStatus(p: PropertyListItem): { label: string; cls: string } {
    if (!p.rentalEndDate) return { label: 'Durée indéfinie', cls: 'badge-neutral' };
    const end = new Date(p.rentalEndDate);
    const now = new Date();
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return { label: 'Expiré', cls: 'badge-expired' };
    if (daysLeft <= 30) return { label: `Expire dans ${daysLeft}j`, cls: 'badge-expiring' };
    return { label: `Actif — fin ${this.formatDate(p.rentalEndDate)}`, cls: 'badge-active' };
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
