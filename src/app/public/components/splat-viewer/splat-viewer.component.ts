import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';

type SplatState = 'loading' | 'ready' | 'error';

// SceneFormat numeric values from @mkkellogg/gaussian-splats-3d v0.4.x
const SCENE_FORMAT = { KSplat: 0, Splat: 1, Ply: 2 } as const;

function sceneFormatFor(fmt: string): number {
  const f = fmt.toLowerCase();
  if (f === 'splat') return SCENE_FORMAT.Splat;
  // 'ply' = mesh PLY loaded as GS splat; 'splat-ply' = accepted GS PLY from the pipeline
  if (f === 'ply' || f === 'splat-ply') return SCENE_FORMAT.Ply;
  return SCENE_FORMAT.KSplat; // 'ksplat' and unknown
}

@Component({
  selector: 'app-splat-viewer',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sv-host" #containerRef [style.height]="height">

      <!-- Loading overlay -->
      <div class="sv-overlay" *ngIf="state === 'loading'">
        <div class="sv-loader-card">
          <div class="sv-loader-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
                 stroke="white" stroke-width="1.5" stroke-linecap="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
              <line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
            <div class="sv-ring"></div>
          </div>
          <p class="sv-loader-label">Chargement de la visite 3D…</p>
          <p class="sv-loader-sub">Rendu Gaussian Splatting photoréaliste</p>
        </div>
      </div>

      <!-- Error overlay -->
      <div class="sv-overlay sv-error-overlay" *ngIf="state === 'error'">
        <div class="sv-error-card">
          <div class="sv-error-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <p class="sv-error-label">Impossible de charger la visite 3D</p>
          <p class="sv-error-sub">Vérifiez le fichier splat (ksplat, splat, ply)</p>
          <button class="sv-retry-btn" type="button" (click)="retry()">Réessayer</button>
        </div>
      </div>

      <!-- Toolbar (visible when ready) -->
      <div class="sv-toolbar" *ngIf="state === 'ready'">
        <button class="sv-btn sv-btn-primary" type="button" (click)="toggleFullscreen()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3
                     m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
          </svg>
          Plein écran
        </button>
      </div>

      <!-- Format badge -->
      <div class="sv-badges" *ngIf="state === 'ready' && format">
        <span class="sv-fmt-badge">{{ format.toUpperCase() }}</span>
        <span class="sv-gs-badge">Gaussian Splat</span>
      </div>

      <!-- Controls hint -->
      <div class="sv-hints" *ngIf="state === 'ready'">
        <span>Glisser pour orbiter</span>
        <span>·</span>
        <span>Molette pour zoomer</span>
        <span>·</span>
        <span>Clic droit pour déplacer</span>
      </div>

    </div>
  `,
  styles: [`
    :host { display: block; }

    .sv-host {
      position: relative;
      width: 100%;
      background: linear-gradient(160deg, #0a0f1e 0%, #111827 100%);
      border-radius: 14px;
      overflow: hidden;
      min-height: 200px;
    }

    /* The GS3D library injects a canvas that must fill the container */
    .sv-host canvas {
      display: block;
      width: 100% !important;
      height: 100% !important;
      position: absolute;
      inset: 0;
    }

    /* Overlays */
    .sv-overlay {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      z-index: 10;
      background: linear-gradient(160deg, rgba(10,15,30,0.97) 0%, rgba(17,24,39,0.97) 100%);
    }

    .sv-loader-card {
      display: flex; flex-direction: column; align-items: center; gap: 14px;
      padding: 40px 32px; text-align: center;
    }
    .sv-loader-icon {
      position: relative; width: 80px; height: 80px;
      display: flex; align-items: center; justify-content: center;
    }
    .sv-ring {
      position: absolute; inset: 0; border-radius: 50%;
      border: 3px solid transparent;
      border-top-color: #a78bfa;
      border-right-color: #7c3aed;
      animation: sv-spin 1s linear infinite;
    }
    @keyframes sv-spin { to { transform: rotate(360deg); } }
    .sv-loader-label {
      color: rgba(255,255,255,0.85); font-size: 15px; font-weight: 600; margin: 0;
    }
    .sv-loader-sub {
      color: rgba(167,139,250,0.7); font-size: 12px; margin: 0;
    }

    .sv-error-overlay { background: rgba(10,15,30,0.96); }
    .sv-error-card {
      display: flex; flex-direction: column; align-items: center; gap: 12px;
      padding: 40px 32px; text-align: center;
    }
    .sv-error-icon {
      width: 64px; height: 64px; border-radius: 16px;
      background: rgba(239,68,68,0.15);
      display: flex; align-items: center; justify-content: center;
      color: #f87171;
    }
    .sv-error-label { color: #f8fafc; font-size: 16px; font-weight: 600; margin: 0; }
    .sv-error-sub { color: #94a3b8; font-size: 13px; margin: 0; }
    .sv-retry-btn {
      margin-top: 4px; padding: 8px 20px; border-radius: 8px;
      background: linear-gradient(135deg, #7c3aed, #5b21b6);
      color: #fff; border: none; cursor: pointer;
      font-size: 13px; font-weight: 600;
    }
    .sv-retry-btn:hover { opacity: 0.88; }

    /* Toolbar */
    .sv-toolbar {
      position: absolute; top: 12px; right: 12px;
      display: flex; gap: 8px; z-index: 20;
    }
    .sv-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 7px 12px; border-radius: 8px;
      font-size: 12px; font-weight: 600; cursor: pointer; border: none;
      backdrop-filter: blur(8px); transition: opacity 0.15s;
    }
    .sv-btn:hover { opacity: 0.85; }
    .sv-btn-primary {
      background: linear-gradient(135deg, #7c3aed, #5b21b6); color: #fff;
    }

    /* Badges */
    .sv-badges {
      position: absolute; top: 12px; left: 12px;
      display: flex; gap: 6px; z-index: 20;
    }
    .sv-fmt-badge {
      padding: 4px 10px; border-radius: 6px;
      background: rgba(124,58,237,0.85); color: #fff;
      font-size: 11px; font-weight: 700; letter-spacing: 0.06em;
      backdrop-filter: blur(8px);
    }
    .sv-gs-badge {
      padding: 4px 10px; border-radius: 6px;
      background: rgba(16,185,129,0.8); color: #fff;
      font-size: 11px; font-weight: 600;
      backdrop-filter: blur(8px);
    }

    /* Hints footer */
    .sv-hints {
      position: absolute; bottom: 10px; left: 50%;
      transform: translateX(-50%);
      display: flex; gap: 8px; align-items: center;
      z-index: 20; pointer-events: none;
      font-size: 11px; color: rgba(148,163,184,0.65);
      white-space: nowrap;
    }

    /* Fullscreen tweaks */
    :host-context(:fullscreen) .sv-host,
    :host-context(:-webkit-full-screen) .sv-host {
      border-radius: 0;
      height: 100vh !important;
    }
  `],
})
export class SplatViewerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() modelUrl!: string;
  /** Splat format: 'ksplat' | 'splat' | 'ply'. Defaults to 'ksplat'. */
  @Input() format = 'ksplat';
  @Input() height = '480px';

  @ViewChild('containerRef') containerRef!: ElementRef<HTMLDivElement>;

  state: SplatState = 'loading';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private viewer: any = null;
  private loadToken = 0;
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  ngAfterViewInit(): void {
    if (this.modelUrl) {
      this.initViewer(this.modelUrl, this.format);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    const urlChanged = changes['modelUrl'] && !changes['modelUrl'].isFirstChange();
    const fmtChanged = changes['format'] && !changes['format'].isFirstChange();
    if ((urlChanged || fmtChanged) && this.containerRef) {
      this.destroyViewer();
      if (this.modelUrl) {
        this.initViewer(this.modelUrl, this.format);
      }
    }
  }

  ngOnDestroy(): void {
    this.loadToken++;
    this.destroyViewer();
  }

  retry(): void {
    this.destroyViewer();
    if (this.modelUrl) {
      this.initViewer(this.modelUrl, this.format);
    }
  }

  toggleFullscreen(): void {
    const host = this.containerRef?.nativeElement;
    if (!host) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      host.requestFullscreen().catch(() => {});
    }
  }

  private async initViewer(url: string, fmt: string): Promise<void> {
    const token = ++this.loadToken;
    this.state = 'loading';
    this.cdr.markForCheck();

    try {
      // Lazy-load the library — avoids SSR issues and keeps the main bundle lean
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const GS3D: any = await import('@mkkellogg/gaussian-splats-3d');

      if (token !== this.loadToken) return;

      const container = this.containerRef.nativeElement;
      const sceneFormat = sceneFormatFor(fmt);

      await this.ngZone.runOutsideAngular(async () => {
        this.viewer = new GS3D.Viewer({
          rootElement: container,
          selfDrivenMode: true,
          useBuiltInControls: true,
          initialCameraPosition: [0, -1, 5],
          initialCameraLookAt: [0, 0, 0],
          // Required when the app is NOT cross-origin isolated (no COOP/COEP headers).
          // Without these, the library tries to use SharedArrayBuffer in its sort worker,
          // which throws DataCloneError and leaves the viewer stuck on the loading spinner.
          sharedMemoryForWorkers: false,
          gpuAcceleratedSort: false,
          // Prevent the viewer from hijacking the browser's scroll
          ignoreDevicePixelRatio: false,
        });

        await this.viewer.addSplatScene(url, {
          format: sceneFormat,
          splatAlphaRemovalThreshold: 5,
        });

        if (token !== this.loadToken) {
          this.destroyViewer();
          return;
        }

        this.viewer.start();
      });

      if (token !== this.loadToken) return;

      this.state = 'ready';
      this.cdr.markForCheck();
    } catch (err) {
      if (token !== this.loadToken) return;
      console.error('[SplatViewer] Failed to load splat scene:', err);
      this.state = 'error';
      this.cdr.markForCheck();
    }
  }

  private destroyViewer(): void {
    if (!this.viewer) return;
    try {
      this.viewer.stop?.();
      this.viewer.stopRendering?.();
      this.viewer.dispose?.();
    } catch {
      // ignore cleanup errors
    }
    this.viewer = null;

    // Remove any canvas the library appended
    const container = this.containerRef?.nativeElement;
    if (container) {
      container.querySelectorAll('canvas').forEach((c) => c.remove());
    }
  }
}
