import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AffiliateService } from '../services/affiliate.service';
import { AffiliateStatsDTO } from '../../models/affiliate.model';

@Component({
  selector: 'app-affiliate-ranking',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './affiliate-ranking.html',
  styleUrl: './affiliate-ranking.scss',
})
export class AffiliateRankingComponent implements OnInit {

  ranking: AffiliateStatsDTO[] = [];
  loading = false;
  errorMessage = '';

  constructor(
    private affiliateService: AffiliateService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.affiliateService.getPublicRanking().subscribe({
      next: data => {
        this.ranking = data;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Erreur lors du chargement du classement.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  getRankClass(rank: number): string {
    if (rank === 1) return 'rank-1';
    if (rank === 2) return 'rank-2';
    if (rank === 3) return 'rank-3';
    return 'rank-other';
  }

  getRankIcon(rank: number): string {
    if (rank === 1) return 'fa-trophy text-warning';
    if (rank === 2) return 'fa-medal';
    if (rank === 3) return 'fa-award';
    return 'fa-hashtag';
  }

  getRewardForRank(rank: number): string {
    if (rank === 1) return '2 000 TND';
    if (rank === 2) return '1 500 TND';
    if (rank === 3) return '1 000 TND';
    return '—';
  }

  formatCommission(val: number): string {
    if (!val && val !== 0) return '—';
    return val.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' TND';
  }
}
