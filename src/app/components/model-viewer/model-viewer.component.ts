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
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ThreeModelLoaderService } from '../../services/three-model-loader.service';

type ViewerState = 'idle' | 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-model-viewer',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mv-host" #hostRef [style.height]="height">

      <!-- ─ Loading overlay ─ -->
      <div class="mv-overlay" *ngIf="state === 'loading'">
        <div class="mv-loader-card">
          <div class="mv-loader-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
                 stroke="white" stroke-width="1.5" stroke-linecap="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
              <line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
            <div class="mv-ring"></div>
          </div>
          <p class="mv-loader-label">Chargement du modèle 3D…</p>
          <div class="mv-prog-track">
            <div class="mv-prog-fill" [style.width.%]="progress"></div>
          </div>
          <span class="mv-prog-pct">{{ progress }}%</span>
        </div>
      </div>

      <!-- ─ Error overlay ─ -->
      <div class="mv-overlay mv-error-overlay" *ngIf="state === 'error'">
        <div class="mv-error-card">
          <div class="mv-error-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <p class="mv-error-label">Impossible de charger le modèle 3D</p>
          <p class="mv-error-sub">Vérifiez le format du fichier (GLB, GLTF, OBJ, FBX, PLY)</p>
          <button class="mv-retry-btn" type="button" (click)="retry()">Réessayer</button>
        </div>
      </div>

      <!-- ─ Idle (no src) ─ -->
      <div class="mv-overlay mv-idle-overlay" *ngIf="state === 'idle'">
        <div class="mv-idle-card">
          <div class="mv-idle-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
          </div>
          <p class="mv-idle-label">Aucun modèle 3D disponible</p>
        </div>
      </div>

      <!-- ─ Toolbar (ready only) ─ -->
      <div class="mv-toolbar" *ngIf="state === 'ready'">
        <button class="mv-btn mv-btn-primary" type="button"
                title="Plein écran" (click)="toggleFullscreen()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3
                     m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
          </svg>
          Plein écran
        </button>
        <button class="mv-btn mv-btn-outline" type="button"
                title="Réinitialiser caméra" (click)="resetCamera()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5">
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 1 0 .49-4.56"/>
          </svg>
          Réinitialiser
        </button>
        <button class="mv-btn mv-btn-toggle" type="button"
                [class.mv-active]="autoRotateEnabled"
                title="Auto-rotation" (click)="toggleAutoRotate()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.07 4.93A10 10 0 0 0 12 2v0a10 10 0 1 0 6.63 17.31"/>
          </svg>
          {{ autoRotateEnabled ? 'Stop' : 'Rotation' }}
        </button>
      </div>

      <!-- ─ Format + point-cloud badges ─ -->
      <div class="mv-badges" *ngIf="state === 'ready' && currentFormat">
        <span class="mv-fmt-badge">{{ currentFormat.toUpperCase() }}</span>
        <span class="mv-pc-badge" *ngIf="isPointCloud">Point Cloud</span>
      </div>

      <!-- ─ Hint footer ─ -->
      <div class="mv-hints" *ngIf="state === 'ready'">
        <span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>
          Glisser pour pivoter
        </span>
        <span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
          Molette pour zoomer
        </span>
        <span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2">
            <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3"/>
          </svg>
          Clic droit pour déplacer
        </span>
      </div>

    </div>
  `,
  styles: [`
    :host { display: block; }

    .mv-host {
      position: relative;
      width: 100%;
      background: linear-gradient(160deg, #0f172a 0%, #1e293b 100%);
      border-radius: 14px;
      overflow: hidden;
      min-height: 200px;
    }

    /* canvas injected by Three.js sits at z-index 0 */
    .mv-host canvas {
      display: block;
      width: 100% !important;
      height: 100% !important;
    }

    /* ─── Overlays ─── */
    .mv-overlay {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      z-index: 10;
      background: linear-gradient(160deg, rgba(15,23,42,0.96) 0%, rgba(30,41,59,0.96) 100%);
    }

    /* Loading card */
    .mv-loader-card {
      display: flex; flex-direction: column; align-items: center; gap: 16px;
      padding: 40px 32px;
      text-align: center;
    }
    .mv-loader-icon {
      position: relative;
      width: 80px; height: 80px;
      display: flex; align-items: center; justify-content: center;
    }
    .mv-ring {
      position: absolute; inset: 0;
      border-radius: 50%;
      border: 3px solid transparent;
      border-top-color: #6366f1;
      border-right-color: #818cf8;
      animation: mv-spin 1s linear infinite;
    }
    @keyframes mv-spin { to { transform: rotate(360deg); } }
    .mv-loader-label {
      color: rgba(255,255,255,0.8);
      font-size: 14px; font-weight: 500;
      margin: 0;
    }
    .mv-prog-track {
      width: 180px; height: 4px;
      background: rgba(99,102,241,0.2);
      border-radius: 2px; overflow: hidden;
    }
    .mv-prog-fill {
      height: 100%;
      background: linear-gradient(90deg, #6366f1, #818cf8);
      border-radius: 2px;
      transition: width 0.3s ease;
    }
    .mv-prog-pct {
      color: #818cf8; font-size: 12px; font-weight: 700;
    }

    /* Error card */
    .mv-error-overlay { background: rgba(15,23,42,0.95); }
    .mv-error-card {
      display: flex; flex-direction: column; align-items: center; gap: 12px;
      padding: 40px 32px; text-align: center;
    }
    .mv-error-icon {
      width: 64px; height: 64px; border-radius: 16px;
      background: rgba(239,68,68,0.15);
      display: flex; align-items: center; justify-content: center;
      color: #f87171;
    }
    .mv-error-label {
      color: #f8fafc; font-size: 16px; font-weight: 600; margin: 0;
    }
    .mv-error-sub {
      color: #94a3b8; font-size: 13px; margin: 0;
    }
    .mv-retry-btn {
      margin-top: 4px;
      padding: 8px 20px; border-radius: 8px;
      background: linear-gradient(135deg, #6366f1, #4338ca);
      color: #fff; border: none; cursor: pointer;
      font-size: 13px; font-weight: 600;
    }
    .mv-retry-btn:hover { opacity: 0.88; }

    /* Idle card */
    .mv-idle-overlay { background: rgba(15,23,42,0.9); }
    .mv-idle-card {
      display: flex; flex-direction: column; align-items: center; gap: 14px;
      padding: 40px 32px; text-align: center;
    }
    .mv-idle-icon {
      width: 72px; height: 72px; border-radius: 20px;
      background: rgba(99,102,241,0.15);
      display: flex; align-items: center; justify-content: center;
      color: #6366f1;
    }
    .mv-idle-label { color: #94a3b8; font-size: 15px; margin: 0; }

    /* ─── Toolbar ─── */
    .mv-toolbar {
      position: absolute; top: 12px; right: 12px;
      display: flex; gap: 8px; align-items: center;
      z-index: 20;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .mv-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 7px 12px; border-radius: 8px;
      font-size: 12px; font-weight: 600; cursor: pointer;
      border: none; white-space: nowrap;
      transition: opacity 0.15s, transform 0.15s;
      backdrop-filter: blur(8px);
    }
    .mv-btn:hover { opacity: 0.85; transform: translateY(-1px); }
    .mv-btn.mv-btn-primary {
      background: linear-gradient(135deg, #6366f1, #4338ca);
      color: #fff;
    }
    .mv-btn.mv-btn-outline {
      background: rgba(15,23,42,0.7);
      border: 1.5px solid rgba(99,102,241,0.4);
      color: #c7d2fe;
    }
    .mv-btn.mv-btn-toggle {
      background: rgba(15,23,42,0.7);
      border: 1.5px solid rgba(148,163,184,0.3);
      color: #94a3b8;
    }
    .mv-btn.mv-btn-toggle.mv-active {
      background: linear-gradient(135deg, #6366f1, #4338ca);
      border-color: transparent;
      color: #fff;
    }

    /* ─── Format badges ─── */
    .mv-badges {
      position: absolute; top: 12px; left: 12px;
      display: flex; gap: 6px; align-items: center;
      z-index: 20;
    }
    .mv-fmt-badge {
      padding: 4px 10px;
      background: rgba(99,102,241,0.85);
      color: #fff;
      border-radius: 6px;
      font-size: 11px; font-weight: 700;
      letter-spacing: 0.06em;
      backdrop-filter: blur(8px);
    }
    .mv-pc-badge {
      padding: 4px 10px;
      background: rgba(16,185,129,0.8);
      color: #fff;
      border-radius: 6px;
      font-size: 11px; font-weight: 600;
      backdrop-filter: blur(8px);
    }

    /* ─── Hint footer ─── */
    .mv-hints {
      position: absolute; bottom: 10px; left: 50%;
      transform: translateX(-50%);
      display: flex; gap: 16px; align-items: center;
      z-index: 20;
      pointer-events: none;
    }
    .mv-hints span {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 11px; color: rgba(148,163,184,0.7);
      white-space: nowrap;
    }

    /* ─── Fullscreen tweaks ─── */
    :host-context(:fullscreen) .mv-host,
    :host-context(:-webkit-full-screen) .mv-host {
      border-radius: 0;
      height: 100vh !important;
    }
  `],
})
export class ModelViewerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() src: string | null = null;
  @Input() format: string | undefined;
  @Input() autoRotate = true;
  @Input() height = '480px';

  @ViewChild('hostRef') hostRef!: ElementRef<HTMLDivElement>;

  state: ViewerState = 'idle';
  progress = 0;
  currentFormat: string | null = null;
  isPointCloud = false;
  autoRotateEnabled = true;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private grid!: THREE.GridHelper;

  private currentObject: THREE.Object3D | null = null;
  private animId = 0;
  private loadVersion = 0;
  private resizeObserver: ResizeObserver | null = null;

  private initialCamPos = new THREE.Vector3();
  private initialTarget = new THREE.Vector3();

  private loader = inject(ThreeModelLoaderService);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  ngAfterViewInit(): void {
    this.autoRotateEnabled = this.autoRotate;
    this.initThree();
    if (this.src) {
      this.loadModel(this.src);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['src'] && !changes['src'].isFirstChange() && this.renderer) {
      const newSrc = changes['src'].currentValue as string | null;
      if (newSrc) {
        this.loadModel(newSrc);
      } else {
        this.clearModel();
        this.state = 'idle';
        this.cdr.markForCheck();
      }
    }
    if (changes['autoRotate'] && !changes['autoRotate'].isFirstChange() && this.controls) {
      this.autoRotateEnabled = this.autoRotate;
      this.controls.autoRotate = this.autoRotate;
    }
  }

  ngOnDestroy(): void {
    this.loadVersion++;
    cancelAnimationFrame(this.animId);
    this.resizeObserver?.disconnect();
    this.clearModel();
    this.controls?.dispose();
    this.renderer?.dispose();
    const canvas = this.renderer?.domElement;
    canvas?.parentNode?.removeChild(canvas);
  }

  // ─── Three.js init ──────────────────────────────────────────────────────────

  private initThree(): void {
    const host = this.hostRef.nativeElement;
    const w = host.clientWidth || 800;
    const h = host.clientHeight || 480;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f172a);

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 2000);
    this.camera.position.set(0, 2, 6);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(this.renderer.domElement);

    // HDR RoomEnvironment — no external file needed
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = envTexture;
    pmrem.dispose();

    // Lighting
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));

    const key = new THREE.DirectionalLight(0xfff5e6, 1.8);
    key.position.set(6, 10, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 60;
    key.shadow.camera.left = -12;
    key.shadow.camera.right = 12;
    key.shadow.camera.top = 12;
    key.shadow.camera.bottom = -12;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xe0ecff, 0.7);
    fill.position.set(-6, 4, -6);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.4);
    rim.position.set(0, -4, -8);
    this.scene.add(rim);

    // Subtle grid floor
    this.grid = new THREE.GridHelper(30, 30, 0x334155, 0x1e293b);
    (this.grid.material as THREE.Material).opacity = 0.45;
    (this.grid.material as THREE.Material).transparent = true;
    this.scene.add(this.grid);

    // Orbit controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 0.1;
    this.controls.maxDistance = 500;
    this.controls.autoRotate = this.autoRotateEnabled;
    this.controls.autoRotateSpeed = 1.8;
    this.controls.addEventListener('start', () => {
      // Pause auto-rotate on user interaction
      if (this.autoRotateEnabled) {
        this.controls.autoRotate = false;
        this.autoRotateEnabled = false;
        this.cdr.markForCheck();
      }
    });

    // Responsive resize
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(host);

    // Render loop outside Angular zone
    this.ngZone.runOutsideAngular(() => this.renderLoop());
  }

  private renderLoop(): void {
    this.animId = requestAnimationFrame(() => this.renderLoop());
    this.controls?.update();
    this.renderer?.render(this.scene, this.camera);
  }

  // ─── Model loading ──────────────────────────────────────────────────────────

  private async loadModel(url: string): Promise<void> {
    const version = ++this.loadVersion;
    this.clearModel();

    this.state = 'loading';
    this.progress = 0;
    this.cdr.markForCheck();

    try {
      const result = await this.loader.load(
        url,
        (pct) => {
          if (version !== this.loadVersion) return;
          this.ngZone.run(() => {
            this.progress = pct;
            this.cdr.markForCheck();
          });
        },
        this.format,
      );

      if (version !== this.loadVersion) return;

      this.loader.centerAndScale(result.object, 4);
      this.scene.add(result.object);
      this.currentObject = result.object;
      this.currentFormat = result.format;
      this.isPointCloud = result.isPointCloud;

      // Hide grid for point clouds (they float at their own y)
      this.grid.visible = !result.isPointCloud;

      this.fitCamera();

      this.state = 'ready';
      this.cdr.markForCheck();
    } catch (err) {
      if (version !== this.loadVersion) return;
      console.error('[ModelViewer] Load error:', err);
      this.state = 'error';
      this.cdr.markForCheck();
    }
  }

  private clearModel(): void {
    if (this.currentObject) {
      this.scene?.remove(this.currentObject);
      this.loader.dispose(this.currentObject);
      this.currentObject = null;
    }
    this.currentFormat = null;
    this.isPointCloud = false;
  }

  /** Position camera so the loaded model fills ~70% of the viewport. */
  private fitCamera(): void {
    if (!this.currentObject) return;
    const box = new THREE.Box3().setFromObject(this.currentObject);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 4;

    const fov = this.camera.fov * (Math.PI / 180);
    const dist = (maxDim / 2) / Math.tan(fov / 2) * 1.9;

    this.camera.position.set(
      center.x + maxDim * 0.4,
      center.y + maxDim * 0.35,
      center.z + dist,
    );
    this.camera.near = dist / 200;
    this.camera.far = dist * 200;
    this.camera.updateProjectionMatrix();

    this.controls.target.copy(center);
    this.controls.update();

    this.initialCamPos.copy(this.camera.position);
    this.initialTarget.copy(this.controls.target);
  }

  private onResize(): void {
    const host = this.hostRef?.nativeElement;
    if (!host) return;
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // ─── Public controls ────────────────────────────────────────────────────────

  resetCamera(): void {
    this.camera.position.copy(this.initialCamPos);
    this.controls.target.copy(this.initialTarget);
    this.controls.update();
  }

  toggleAutoRotate(): void {
    this.autoRotateEnabled = !this.autoRotateEnabled;
    this.controls.autoRotate = this.autoRotateEnabled;
    this.cdr.markForCheck();
  }

  toggleFullscreen(): void {
    const host = this.hostRef.nativeElement;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      host.requestFullscreen().catch(() => {});
    }
  }

  retry(): void {
    if (this.src) {
      this.loadModel(this.src);
    }
  }
}
