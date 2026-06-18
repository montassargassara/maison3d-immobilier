import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
} from '@angular/core';
import { Subscription, catchError, finalize, interval, of, switchMap, takeWhile } from 'rxjs';
import {
  MapAnythingJobDTO,
  MapAnythingService,
} from '../services/mapanything.service';
import { ModelViewerComponent } from '../../components/model-viewer/model-viewer.component';

type ModalState = 'idle' | 'uploading' | 'processing' | 'preview' | 'done' | 'error';

@Component({
  selector: 'app-mapanything-modal',
  standalone: true,
  imports: [ModelViewerComponent],
  templateUrl: './mapanything-modal.component.html',
  styleUrl: './mapanything-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapAnythingModalComponent implements OnDestroy {
  @Input() propertyId: number | null = null;

  @Output() closed = new EventEmitter<void>();

  /** Emitted once the GLB is accepted and published (status = ACCEPTED). */
  @Output() modelReady = new EventEmitter<{ id: number; glbUrl: string }>();

  state: ModalState = 'idle';
  isDragOver = false;
  selectedFile: File | null = null;
  uploadPercent = 0;
  processingPercent = 5;
  currentStep = '';
  errorMessage = '';
  job: MapAnythingJobDTO | null = null;

  // ── Validation preview state ─────────────────────────────────────────────
  /** Blob object URL for the admin-side 3D preview (revoked on destroy / reject). */
  previewUrl: string | null = null;
  previewLoading = false;
  /** ID of the current job being validated. */
  activeJobId: number | null = null;
  /** Prevents double-click on Accept / Reject buttons. */
  actionLoading = false;

  private subs = new Subscription();
  private pollSub: Subscription | null = null;

  constructor(
    private maService: MapAnythingService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.pollSub?.unsubscribe();
    this._revokePreviewUrl();
  }

  // ── Drag & drop ──────────────────────────────────────────────────────────

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.isDragOver = true;
  }
  onDragLeave(e: DragEvent): void {
    e.preventDefault();
    this.isDragOver = false;
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.isDragOver = false;
    const file = e.dataTransfer?.files[0];
    if (file) this.setFile(file);
  }

  onFileSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.setFile(file);
    input.value = '';
  }

  private setFile(file: File): void {
    const validExts = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
    const name = file.name.toLowerCase();
    if (!file.type.startsWith('video/') && !validExts.some(ext => name.endsWith(ext))) {
      this.errorMessage = 'Format non supporté. Utilisez MP4, MOV, AVI, MKV ou WebM.';
      this.state = 'error';
      this.cdr.markForCheck();
      return;
    }
    this.selectedFile = file;
    this.errorMessage = '';
    if (this.state === 'error') this.state = 'idle';
    this.cdr.markForCheck();
  }

  clearFile(): void {
    this.selectedFile = null;
    this.cdr.markForCheck();
  }

  get fileSizeLabel(): string {
    if (!this.selectedFile) return '';
    const mb = this.selectedFile.size / (1024 * 1024);
    return mb > 1000 ? `${(mb / 1024).toFixed(1)} Go` : `${mb.toFixed(1)} Mo`;
  }

  // ── Stats formatting helpers ─────────────────────────────────────────────

  get glbSizeLabel(): string {
    const b = this.job?.glbFileSize ?? 0;
    if (!b) return '—';
    const kb = b / 1024;
    return kb >= 1024 ? `${(kb / 1024).toFixed(1)} Mo` : `${kb.toFixed(0)} Ko`;
  }

  get vertexLabel(): string {
    const v = this.job?.vertexCount ?? 0;
    if (!v) return '—';
    return v >= 1_000_000
      ? `${(v / 1_000_000).toFixed(2)} M`
      : v.toLocaleString('fr-FR');
  }

  get meshLabel(): string {
    const m = this.job?.meshCount ?? 0;
    return m ? m.toLocaleString('fr-FR') : '—';
  }

  get generationTimeLabel(): string {
    const ms = this.job?.generationTimeMs ?? 0;
    if (!ms) return '—';
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s} s`;
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m} min ${r} s`;
  }

  // ── Generation ───────────────────────────────────────────────────────────

  startGeneration(): void {
    if (!this.selectedFile) {
      const msg = 'Veuillez sélectionner une vidéo avant de lancer la génération.';
      console.error('[MapAnything] startGeneration() — aucun fichier sélectionné');
      this.errorMessage = msg;
      this.state = 'error';
      this.cdr.markForCheck();
      return;
    }
    if (!this.propertyId) {
      const msg =
        "Le bien n'a pas encore été enregistré. Sauvegardez le formulaire, puis relancez la reconstruction.";
      console.error('[MapAnything] startGeneration() — propertyId est null, impossible d\'appeler l\'API');
      this.errorMessage = msg;
      this.state = 'error';
      this.cdr.markForCheck();
      return;
    }

    this.state = 'uploading';
    this.uploadPercent = 0;
    this.processingPercent = 5;
    this.errorMessage = '';
    this.cdr.markForCheck();

    console.log('[MapAnything] Démarrage de la génération — propertyId=%d fichier=%s',
      this.propertyId, this.selectedFile.name);

    const sub = this.maService
      .start(this.propertyId, this.selectedFile)
      .pipe(
        finalize(() => {
          if (this.state === 'uploading') {
            console.warn('[MapAnything] Flux terminé de façon inattendue en état uploading — reset idle');
            this.state = 'idle';
            this.cdr.markForCheck();
          }
        }),
      )
      .subscribe({
        next: event => {
          if (event.type === 'progress') {
            this.uploadPercent = event.percent;
          } else if (event.type === 'done') {
            this.job = event.job;
            this.state = 'processing';
            this.uploadPercent = 100;
            console.log('[MapAnything] Vidéo reçue par le serveur — jobId=%d, début du polling', this.job?.id);
            this.startPolling(this.propertyId!);
          }
          this.cdr.markForCheck();
        },
        error: err => {
          const msg =
            err.error?.error ||
            err.error?.message ||
            err.message ||
            "Erreur lors de l'envoi de la vidéo.";
          console.error('[MapAnything] Erreur HTTP upload:', err, '→', msg);
          this.state = 'error';
          this.errorMessage = msg;
          this.cdr.markForCheck();
        },
      });
    this.subs.add(sub);
  }

  private startPolling(propertyId: number): void {
    this.pollSub?.unsubscribe();
    this.pollSub = interval(4000)
      .pipe(
        switchMap(() =>
          this.maService.getStatus(propertyId).pipe(
            catchError(() =>
              of({
                status: 'PROCESSING',
                processingProgress: this.processingPercent,
              } as MapAnythingJobDTO),
            ),
          ),
        ),
        takeWhile(
          j =>
            j.status === 'NOT_CREATED' ||
            j.status === 'PENDING' ||
            j.status === 'PROCESSING',
          true, // inclusive — emit the terminal value so we can react to AWAITING_VALIDATION / FAILED
        ),
      )
      .subscribe({
        next: j => {
          if ((j.processingProgress ?? 0) > this.processingPercent) {
            this.processingPercent = j.processingProgress;
          }
          if (j.currentStep) this.currentStep = j.currentStep;

          if (j.status === 'AWAITING_VALIDATION') {
            // Pipeline finished — switch to admin validation mode automatically
            this.job = j;
            this.activeJobId = j.id ?? null;
            this.state = 'preview';
            if (j.id) this.loadPreview(j.id);
          } else if (j.status === 'ACCEPTED') {
            // Fallback: job was already accepted before the modal polled (shouldn't happen normally)
            this.job = j;
            this.state = 'done';
            if (j.model3dId && j.glbUrl) {
              this.modelReady.emit({ id: j.model3dId, glbUrl: j.glbUrl });
            }
          } else if (j.status === 'FAILED') {
            this.state = 'error';
            this.errorMessage = j.errorMessage || 'La reconstruction 3D a échoué.';
          }
          this.cdr.markForCheck();
        },
        error: () => {},
      });
  }

  // ── Preview loading ──────────────────────────────────────────────────────

  private loadPreview(jobId: number): void {
    this.previewLoading = true;
    this._revokePreviewUrl();
    this.cdr.markForCheck();

    const sub = this.maService.getPreviewBlob(jobId).pipe(
      finalize(() => {
        this.previewLoading = false;
        this.cdr.markForCheck();
      }),
    ).subscribe({
      next: blob => {
        this.previewUrl = URL.createObjectURL(blob);
        this.cdr.markForCheck();
      },
      error: err => {
        console.error('[MapAnything] Preview blob load error:', err);
        this.errorMessage = 'Impossible de charger l\'aperçu 3D.';
        this.cdr.markForCheck();
      },
    });
    this.subs.add(sub);
  }

  private _revokePreviewUrl(): void {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }
  }

  // ── Accept / Reject ──────────────────────────────────────────────────────

  acceptModel(): void {
    if (this.actionLoading || !this.activeJobId) return;
    this.actionLoading = true;
    this.cdr.markForCheck();

    const sub = this.maService.accept(this.activeJobId).pipe(
      finalize(() => {
        this.actionLoading = false;
        this.cdr.markForCheck();
      }),
    ).subscribe({
      next: updatedDto => {
        this.job = updatedDto;
        this.state = 'done';
        if (updatedDto.model3dId && updatedDto.glbUrl) {
          this.modelReady.emit({ id: updatedDto.model3dId, glbUrl: updatedDto.glbUrl });
        }
        this.cdr.markForCheck();
      },
      error: err => {
        const msg = err.error?.error || err.error?.message || err.message || 'Erreur lors de l\'acceptation.';
        console.error('[MapAnything] accept error:', err);
        this.errorMessage = msg;
        this.cdr.markForCheck();
      },
    });
    this.subs.add(sub);
  }

  rejectModel(): void {
    if (this.actionLoading || !this.activeJobId) return;
    this.actionLoading = true;
    this.cdr.markForCheck();

    const sub = this.maService.reject(this.activeJobId).pipe(
      finalize(() => {
        this.actionLoading = false;
        this.cdr.markForCheck();
      }),
    ).subscribe({
      next: () => {
        this._revokePreviewUrl();
        // Reset to idle — ready for a new generation
        this.state = 'idle';
        this.selectedFile = null;
        this.job = null;
        this.activeJobId = null;
        this.uploadPercent = 0;
        this.processingPercent = 5;
        this.currentStep = '';
        this.errorMessage = '';
        this.cdr.markForCheck();
      },
      error: err => {
        const msg = err.error?.error || err.error?.message || err.message || 'Erreur lors du refus.';
        console.error('[MapAnything] reject error:', err);
        this.errorMessage = msg;
        this.cdr.markForCheck();
      },
    });
    this.subs.add(sub);
  }

  close(): void {
    this.closed.emit();
  }
}
