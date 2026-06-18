import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { GaussianViewerComponent } from '../admin/gaussian-viewer/gaussian-viewer.component';

interface PublicSplatStatus {
  id: number;
  status: string;
  processingProgress: number;
  currentStep: string;
  errorMessage: string;
  iterations: number;
  plyUrl?: string;
}

@Component({
  selector: 'app-gaussian-viewer-page',
  standalone: true,
  imports: [CommonModule, GaussianViewerComponent],
  templateUrl: './gaussian-viewer-page.component.html',
  styleUrl: './gaussian-viewer-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GaussianViewerPageComponent implements OnInit, OnDestroy {
  splatId: number | null = null;
  status: PublicSplatStatus | null = null;

  // viewer state
  plyUrl: string | null = null;
  pageState: 'loading' | 'polling' | 'ready' | 'error' = 'loading';
  errorMessage = '';

  // controls
  autoRotate = false;
  isFullscreen = false;
  showHints = true;

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private readonly API = 'http://localhost:8080';
  private readonly POLL_INTERVAL_MS = 3000;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id || isNaN(Number(id))) {
      this.pageState = 'error';
      this.errorMessage = 'Identifiant de scène invalide.';
      this.cdr.markForCheck();
      return;
    }
    this.splatId = Number(id);
    this.fetchStatus();
  }

  ngOnDestroy(): void {
    this.clearPoll();
  }

  private fetchStatus(): void {
    this.http
      .get<PublicSplatStatus>(`${this.API}/api/gaussian-splat/public/${this.splatId}/status`)
      .subscribe({
        next: s => this.handleStatus(s),
        error: err => {
          this.pageState = 'error';
          this.errorMessage =
            err.status === 404
              ? 'Scène 3D introuvable.'
              : 'Impossible de joindre le serveur.';
          this.cdr.markForCheck();
        },
      });
  }

  private handleStatus(s: PublicSplatStatus): void {
    this.status = s;
    if (s.status === 'COMPLETED' && s.plyUrl) {
      this.clearPoll();
      this.plyUrl = s.plyUrl;
      this.pageState = 'ready';
      this.cdr.markForCheck();
      setTimeout(() => {
        this.showHints = false;
        this.cdr.markForCheck();
      }, 5000);
      return;
    }
    if (s.status === 'FAILED' || s.status === 'ERROR') {
      this.clearPoll();
      this.pageState = 'error';
      this.errorMessage = s.errorMessage || 'Le traitement a échoué.';
      this.cdr.markForCheck();
      return;
    }
    // PENDING / PROCESSING — keep polling
    this.pageState = 'polling';
    this.cdr.markForCheck();
    if (!this.pollTimer) {
      this.pollTimer = setInterval(() => this.fetchStatus(), this.POLL_INTERVAL_MS);
    }
  }

  private clearPoll(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  toggleAutoRotate(): void {
    this.autoRotate = !this.autoRotate;
  }

  toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        this.isFullscreen = true;
        this.cdr.markForCheck();
      });
    } else {
      document.exitFullscreen().then(() => {
        this.isFullscreen = false;
        this.cdr.markForCheck();
      });
    }
  }

  retry(): void {
    this.pageState = 'loading';
    this.plyUrl = null;
    this.errorMessage = '';
    this.cdr.markForCheck();
    this.fetchStatus();
  }

  get progressLabel(): string {
    if (!this.status) return '';
    const pct = this.status.processingProgress ?? 0;
    const step = this.status.currentStep ?? '';
    return step ? `${pct}% — ${step}` : `${pct}%`;
  }
}
