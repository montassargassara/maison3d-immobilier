import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, catchError, finalize, interval, of, switchMap, takeWhile } from 'rxjs';
import { GaussianSplatDTO, GaussianSplatService } from '../services/gaussian-splat.service';
import { GaussianViewerComponent } from '../gaussian-viewer/gaussian-viewer.component';
import { SplatViewerComponent } from '../../public/components/splat-viewer/splat-viewer.component';

type ModalState = 'idle' | 'uploading' | 'processing' | 'preview' | 'success' | 'error';

@Component({
  selector: 'app-gaussian-splat-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, GaussianViewerComponent, SplatViewerComponent],
  templateUrl: './gaussian-splat-modal.component.html',
  styleUrl: './gaussian-splat-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GaussianSplatModalComponent implements OnDestroy {
  @Input() propertyId: number | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() splatGenerated = new EventEmitter<GaussianSplatDTO>();
  /** Emitted when the admin accepts the model; payload is the Model3DDTO from the backend. */
  @Output() modelAccepted = new EventEmitter<any>();

  state: ModalState = 'idle';
  isDragOver = false;
  selectedFile: File | null = null;
  iterations = 30000;
  uploadPercent = 0;
  processingPercent = 0;
  currentStep = '';
  errorMessage = '';
  generatedSplat: GaussianSplatDTO | null = null;

  /** Blob URL for the preview — created with URL.createObjectURL(). */
  previewUrl: string | null = null;
  previewFormat = 'ply';
  previewLoading = false;

  /** Prevents double-click on Accept / Reject buttons. */
  actionLoading = false;

  private subs = new Subscription();
  private pollSub: Subscription | null = null;
  private activeSplatId: number | null = null;

  constructor(
    private gsService: GaussianSplatService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.pollSub?.unsubscribe();
    this._revokePreviewUrl();
  }

  // ── Drag & drop ──────────────────────────────────────────────────────────

  onDragOver(e: DragEvent): void { e.preventDefault(); this.isDragOver = true; }
  onDragLeave(e: DragEvent): void { e.preventDefault(); this.isDragOver = false; }

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

  clearFile(): void { this.selectedFile = null; this.cdr.markForCheck(); }

  get fileSizeLabel(): string {
    if (!this.selectedFile) return '';
    const mb = this.selectedFile.size / (1024 * 1024);
    return mb > 1000 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
  }

  // ── Generation ───────────────────────────────────────────────────────────

  startGeneration(): void {
    if (!this.selectedFile) return;
    this.state = 'uploading';
    this.uploadPercent = 0;
    this.processingPercent = 5;
    this.errorMessage = '';
    this.cdr.markForCheck();

    const upload$ = this.propertyId
      ? this.gsService.generateForProperty(this.propertyId, this.selectedFile, this.iterations)
      : this.gsService.generateStandalone(this.selectedFile, this.iterations);

    const sub = upload$.subscribe({
      next: event => {
        if (event.type === 'progress') {
          this.uploadPercent = event.percent ?? 0;
        } else if (event.type === 'done') {
          const splat = event.splat!;
          this.activeSplatId = splat.id;
          this.state = 'processing';
          this.uploadPercent = 100;
          this.startPolling(splat.id);
        }
        this.cdr.markForCheck();
      },
      error: err => {
        console.error('[GS] Upload error raw response:', err);
        this.state = 'error';
        this.errorMessage =
          err.error?.error ||
          err.error?.message ||
          err.message ||
          'Erreur lors de l\'envoi de la vidéo.';
        this.cdr.markForCheck();
      },
    });
    this.subs.add(sub);
  }

  private startPolling(splatId: number): void {
    this.pollSub?.unsubscribe();
    this.pollSub = interval(4000).pipe(
      switchMap(() =>
        this.gsService.getStatus(splatId).pipe(
          catchError(() => of({ status: 'PROCESSING', processingProgress: this.processingPercent } as GaussianSplatDTO))
        )
      ),
      // Stop polling once the status leaves the in-progress set (inclusive = emit the final value)
      takeWhile(
        s => s.status === 'NOT_CREATED' || s.status === 'PENDING' || s.status === 'PROCESSING',
        true,
      ),
    ).subscribe({
      next: splat => {
        if ((splat.processingProgress ?? 0) > 0) {
          this.processingPercent = splat.processingProgress;
        }
        if (splat.currentStep) this.currentStep = splat.currentStep;

        if (splat.status === 'AWAITING_VALIDATION' || splat.previewAvailable) {
          // Pipeline finished — switch to preview mode
          this.generatedSplat = splat;
          this.previewFormat = splat.previewFormat || 'ply';
          this.state = 'preview';
          this.loadPreview(splat.id);
        } else if (splat.status === 'COMPLETED') {
          // Legacy path: pipeline ended at COMPLETED (old behaviour)
          this.generatedSplat = splat;
          this.state = 'success';
          this.splatGenerated.emit(splat);
        } else if (splat.status === 'FAILED') {
          this.state = 'error';
          this.errorMessage = splat.errorMessage || 'La génération 3D a échoué.';
        }
        this.cdr.markForCheck();
      },
      error: () => {},
    });
  }

  // ── Preview loading ──────────────────────────────────────────────────────

  private loadPreview(splatId: number): void {
    if (!splatId) return;
    this.previewLoading = true;
    this._revokePreviewUrl();
    this.cdr.markForCheck();

    const sub = this.gsService.getPreviewBlob(splatId).pipe(
      finalize(() => {
        this.previewLoading = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: blob => {
        this.previewUrl = URL.createObjectURL(blob);
        this.cdr.markForCheck();
      },
      error: err => {
        console.error('[GS] Preview load error:', err);
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
    if (this.actionLoading || !this.activeSplatId) return;
    this.actionLoading = true;
    this.cdr.markForCheck();

    const sub = this.gsService.accept(this.activeSplatId).pipe(
      finalize(() => {
        this.actionLoading = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: model3d => {
        this.modelAccepted.emit(model3d);
        this.close();
      },
      error: err => {
        this.errorMessage =
          err.error?.error || err.error?.message || err.message || 'Erreur lors de l\'acceptation.';
        this.cdr.markForCheck();
      },
    });
    this.subs.add(sub);
  }

  rejectModel(): void {
    if (this.actionLoading || !this.activeSplatId) return;
    this.actionLoading = true;
    this.cdr.markForCheck();

    const sub = this.gsService.reject(this.activeSplatId).pipe(
      finalize(() => {
        this.actionLoading = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: () => {
        this.close();
      },
      error: err => {
        this.errorMessage =
          err.error?.error || err.error?.message || err.message || 'Erreur lors du refus.';
        this.cdr.markForCheck();
      },
    });
    this.subs.add(sub);
  }

  close(): void { this.closed.emit(); }
}
