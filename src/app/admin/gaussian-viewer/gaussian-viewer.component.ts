/**
 * GaussianViewerComponent — Minimal Official Pipeline
 *
 * Stripped to the exact minimal GaussianSplats3D example.
 * No custom renderer, camera, scene, controls, ResizeObserver, or render loop.
 * All viewer internals are managed exclusively by the library.
 *
 * Debug logging is intentionally verbose to diagnose why splats are invisible
 * even when the WebGL pipeline and debug geometry work correctly.
 * The most likely cause: splatRenderReady never becomes true because the
 * sort Web Worker fails to send its first "sortDone" message.
 */
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
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import * as GS    from '@mkkellogg/gaussian-splats-3d';
import * as THREE from 'three';

@Component({
  selector: 'app-gaussian-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gaussian-viewer.component.html',
  styleUrl:    './gaussian-viewer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GaussianViewerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() plyUrl: string | null = null;

  @ViewChild('viewerContainer', { static: true })
  container!: ElementRef<HTMLDivElement>;

  isLoading    = false;
  hasError     = false;
  errorMessage = '';

  showDebug   = false;
  debugFocal  = 1.0;
  debugKernel = 0.3;

  onFocalChange():  void { if (this.viewer) this.viewer.focalAdjustment = this.debugFocal; }
  onKernelChange(): void { if (this.viewer) this.viewer.kernel2DSize    = this.debugKernel; }

  private viewer:       any = null;
  private viewerInited      = false;
  private statsInterval:    ReturnType<typeof setInterval> | null = null;

  constructor(
    private cdr:  ChangeDetectorRef,
    private zone: NgZone,
  ) {}

  ngAfterViewInit(): void {
    if (this.plyUrl) this.initViewer(this.plyUrl);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['plyUrl'] && !changes['plyUrl'].firstChange) {
      this.destroyViewer();
      if (this.plyUrl && this.container) this.initViewer(this.plyUrl);
    }
  }

  ngOnDestroy(): void { this.destroyViewer(); }

  // ── Minimal Official Pipeline ─────────────────────────────────────────────

  private async initViewer(url: string): Promise<void> {
    if (this.viewerInited) return;
    this.viewerInited = true;

    this.isLoading = true;
    this.hasError  = false;
    this.cdr.markForCheck();

    const el = this.container.nativeElement;

    if (el.offsetWidth === 0 || el.offsetHeight === 0) {
      this.fail('Conteneur 3D sans dimensions — vérifiez le CSS height.');
      return;
    }

    console.log('[GS] ── initViewer (minimal pipeline) ──────────────────────');
    console.log('[GS] url      :', url);
    console.log('[GS] container:', el.offsetWidth, '×', el.offsetHeight);

    try {
      await this.zone.runOutsideAngular(async () => {

        // ── STEP 1 : Create Viewer — EXACT official minimal example ──────
        //
        // No renderer config. No camera config. No scene config. No controls.
        // No selfDrivenMode override. No webXRMode. No renderMode.
        // No sceneRevealMode. No logLevel.
        // Only the performance options known to be safe.
        //
        this.viewer = new GS.Viewer({
          rootElement:                   el,
          gpuAcceleratedSort:            true,
          sharedMemoryForWorkers:        false,
          integerBasedSort:              true,
          halfPrecisionCovariancesOnGPU: true,
          dynamicScene:                  false,
          antialiased:                   true,
        } as any);

        console.log('[GS] Viewer constructed');
        console.log('[GS] viewer.renderer   :', this.viewer.renderer   ?? 'MISSING');
        console.log('[GS] viewer.camera     :', this.viewer.camera     ?? 'MISSING');
        console.log('[GS] viewer.threeScene :', this.viewer.threeScene ?? 'MISSING');
        console.log('[GS] viewer.controls   :', this.viewer.controls   ?? 'MISSING');
        console.log('[GS] viewer.initialized:', this.viewer.initialized);
        console.log('[GS] viewer.splatRenderReady:', this.viewer.splatRenderReady);

        // ── STEP 2 : Load PLY — splatAlphaRemovalThreshold=0 (no alpha cut) ─
        console.log('[GS] Loading PLY …');

        await this.viewer.addSplatScene(url, {
          format:                     (GS as any).SceneFormat?.Ply ?? 2,
          splatAlphaRemovalThreshold: 0,
          showLoadingUI:              false,
          progressiveLoad:            false,
        });

        const count = this.viewer.splatMesh?.getSplatCount?.() ?? 0;
        console.log('[GS] Scene loaded ✓  splat count:', count);

        // ── STEP 3 : Deep-inspect splatMesh ──────────────────────────────
        this.inspectSplatMesh();

        // ── STEP 4 : Add minimal helpers to viewer.threeScene ─────────────
        this.addHelpers();

        // ── STEP 5 : Start the viewer's self-driven render loop ───────────
        this.viewer.start();
        console.log('[GS] Render loop started');

        // ── STEP 6 : Post-start diagnostics ──────────────────────────────
        // Give the sort worker one tick to process, then poll.
        setTimeout(() => this.postStartDiagnostics(), 100);

        // Log renderer.info every 2 seconds for 20 seconds.
        this.startStatsPoller();
      });

      this.zone.run(() => {
        this.isLoading = false;
        this.cdr.markForCheck();
      });

    } catch (err: any) {
      console.error('[GS] initViewer failed:', err);
      this.zone.run(() => this.fail(err?.message ?? 'Impossible de charger la scène 3D.'));
    }
  }

  // ── Deep splatMesh inspection ─────────────────────────────────────────────

  private inspectSplatMesh(): void {
    const sm = this.viewer?.splatMesh;
    if (!sm) { console.error('[GS Splat] splatMesh is MISSING on viewer'); return; }

    console.log('[GS Splat] ── splatMesh inspection ─────────────────────────');
    console.log('[GS Splat] type          :', sm.type ?? sm.constructor?.name ?? typeof sm);
    console.log('[GS Splat] visible       :', sm.visible);
    console.log('[GS Splat] frustumCulled :', sm.frustumCulled);
    console.log('[GS Splat] getSplatCount :', sm.getSplatCount?.());
    console.log('[GS Splat] boundingBox   :', sm.boundingBox ?? 'none');
    console.log('[GS Splat] material      :', sm.material ?? 'none');
    console.log('[GS Splat] geometry      :', sm.geometry ?? 'none');

    // Force visibility — prevent any culling from hiding the splats.
    sm.visible       = true;
    sm.frustumCulled = false;
    console.log('[GS Splat] Force-set visible=true, frustumCulled=false');

    // Walk threeScene children for completeness.
    const scene = this.viewer?.threeScene as THREE.Scene | undefined;
    if (scene) {
      console.log('[GS Splat] viewer.threeScene children:',
        scene.children.map((c: THREE.Object3D) => `${c.type}(${c.name || '—'})`));
    }

    // Note: splatMesh is NOT in threeScene.children — it is rendered in a
    // separate render pass by the viewer's render loop:
    //   renderer.render(threeScene, camera)   → helpers, etc.
    //   renderer.render(splatMesh, camera)    → gaussian splats
    console.log('[GS Splat] Note: splatMesh is rendered in a separate pass — not in threeScene.children');
  }

  // ── Post-start readiness check ────────────────────────────────────────────

  private postStartDiagnostics(): void {
    console.log('[GS Post] ── post-start diagnostics ──────────────────────────');
    console.log('[GS Post] viewer.initialized    :', this.viewer?.initialized);
    console.log('[GS Post] viewer.splatRenderReady:', this.viewer?.splatRenderReady);
    console.log('[GS Post] sortWorker exists      :', !!(this.viewer as any)?.sortWorker);

    const sm = this.viewer?.splatMesh;
    if (sm) {
      console.log('[GS Post] splatMesh.visible      :', sm.visible);
      console.log('[GS Post] splatMesh.frustumCulled:', sm.frustumCulled);
    }

    // If splatRenderReady is still false, re-inspect every 500ms for 10 s.
    if (!this.viewer?.splatRenderReady) {
      console.warn('[GS Post] splatRenderReady=false — will poll for 10 s …');
      let ticks = 0;
      const poll = setInterval(() => {
        ticks++;
        const ready = this.viewer?.splatRenderReady;
        console.log(`[GS Poll] t=${ticks * 500}ms  splatRenderReady=${ready}  initialized=${this.viewer?.initialized}`);
        if (ready || ticks >= 20) {
          clearInterval(poll);
          if (ready) console.log('[GS Poll] splatRenderReady became TRUE ✓');
          else       console.error('[GS Poll] splatRenderReady NEVER became true after 10 s — sort worker likely failed');
        }
      }, 500);
    } else {
      console.log('[GS Post] splatRenderReady=true ✓');
    }
  }

  // ── Renderer stats poller ─────────────────────────────────────────────────

  private startStatsPoller(): void {
    if (this.statsInterval) return;
    let ticks = 0;
    this.statsInterval = setInterval(() => {
      ticks++;
      const r = this.viewer?.renderer as THREE.WebGLRenderer | undefined;
      if (!r) return;
      const info = r.info.render;
      console.log(`[GS Stats] t=${ticks * 2}s  calls=${info.calls}  triangles=${info.triangles}  points=${info.points}  lines=${info.lines}  frame=${info.frame}`);
      if (ticks >= 10) {
        clearInterval(this.statsInterval!);
        this.statsInterval = null;
        console.log('[GS Stats] poller stopped after 20 s');
      }
    }, 2000);
  }

  // ── Minimal helpers (no camera framing — let viewer handle it) ────────────

  private addHelpers(): void {
    const scene = this.viewer?.threeScene as THREE.Scene | undefined;
    if (!scene) { console.error('[GS Helpers] viewer.threeScene missing'); return; }

    scene.add(new THREE.AxesHelper(5));

    const sm = this.viewer?.splatMesh;
    if (sm) {
      try {
        const bbox    = new THREE.Box3().setFromObject(sm);
        const boxHelper = new THREE.Box3Helper(bbox, new THREE.Color(0x00ff00));
        boxHelper.name = '__gs_bbox_helper';
        scene.add(boxHelper);
        console.log('[GS Helpers] BoxHelper added — bbox:', bbox.min.toArray(), '→', bbox.max.toArray());
      } catch (e) {
        console.warn('[GS Helpers] Box3.setFromObject(splatMesh) failed:', e);
      }
    }

    console.log('[GS Helpers] helpers added to viewer.threeScene');
  }

  // ── Teardown ──────────────────────────────────────────────────────────────

  private destroyViewer(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
    if (this.viewer) {
      try { this.viewer.stop();    } catch {}
      try { this.viewer.dispose(); } catch {}
      this.viewer = null;
    }
    this.viewerInited = false;
    this.isLoading    = false;
  }

  private fail(msg: string): void {
    console.error('[GS]', msg);
    this.hasError     = true;
    this.isLoading    = false;
    this.errorMessage = msg;
    this.viewerInited = false;
    this.cdr.markForCheck();
  }

  retry(): void {
    this.destroyViewer();
    this.hasError = false;
    if (this.plyUrl) this.initViewer(this.plyUrl);
  }
}
