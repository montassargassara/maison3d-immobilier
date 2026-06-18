import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, catchError, interval, of, switchMap, takeWhile } from 'rxjs';
import { VirtualTourDTO, VirtualTourService } from '../services/virtual-tour.service';

type ModalState = 'idle' | 'uploading' | 'processing' | 'success' | 'error';

@Component({
  selector: 'app-virtual-tour-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './virtual-tour-modal.component.html',
  styleUrl: './virtual-tour-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VirtualTourModalComponent implements OnInit, OnDestroy {
  /** When null the modal operates in standalone mode (no property required). */
  @Input() propertyId: number | null = null;
  @Input() existingTour: VirtualTourDTO | null = null;

  /** Set after generation begins so polling can track the tour by its own ID. */
  private standaloneTourId: number | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() tourGenerated = new EventEmitter<VirtualTourDTO>();

  state: ModalState = 'idle';
  isDragOver = false;
  selectedFile: File | null = null;
  is360 = false;
  uploadPercent = 0;
  processingPercent = 0;
  errorMessage = '';
  generatedTour: VirtualTourDTO | null = null;

  private subs = new Subscription();
  private pollSub: Subscription | null = null;

  constructor(
    private tourService: VirtualTourService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    // If there is an existing completed tour, pre-load it; treat NOT_CREATED as no tour
    if (this.existingTour && this.existingTour.status === 'COMPLETED') {
      this.generatedTour = this.existingTour;
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.pollSub?.unsubscribe();
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
    const validTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm'];
    const validExts = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
    const name = file.name.toLowerCase();
    const validExt = validExts.some(ext => name.endsWith(ext));

    if (!file.type.startsWith('video/') && !validExt) {
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

  // ── Generation ───────────────────────────────────────────────────────────

  startGeneration(): void {
    if (!this.selectedFile) return;

    this.state = 'uploading';
    this.uploadPercent = 0;
    this.processingPercent = 5;
    this.errorMessage = '';
    this.cdr.markForCheck();

    const upload$ = this.propertyId
      ? this.tourService.generateTour(this.propertyId, this.selectedFile, this.is360)
      : this.tourService.generateStandaloneTour(this.selectedFile, this.is360);

    const sub = upload$.subscribe({
      next: event => {
        if (event.type === 'progress') {
          this.uploadPercent = event.percent ?? 0;
        } else if (event.type === 'done') {
          const tour = event.tour!;
          this.state = 'processing';
          this.uploadPercent = 100;
          // In standalone mode track by tourId; in property mode track by propertyId
          if (this.propertyId) {
            this.startPolling({ propertyId: tour.propertyId });
          } else {
            this.standaloneTourId = tour.id;
            this.startPolling({ tourId: tour.id });
          }
        }
        this.cdr.markForCheck();
      },
      error: err => {
        this.state = 'error';
        this.errorMessage = err.error?.error || err.message || 'Erreur lors de l\'envoi de la vidéo.';
        this.cdr.markForCheck();
      },
    });
    this.subs.add(sub);
  }

  private startPolling(key: { propertyId?: number; tourId?: number }): void {
    this.pollSub?.unsubscribe();

    const status$ = key.tourId != null
      ? this.tourService.getStatusById(key.tourId)
      : this.tourService.getStatus(key.propertyId!);

    this.pollSub = interval(3000)
      .pipe(
        switchMap(() =>
          status$.pipe(
            catchError(() =>
              of({ status: 'PROCESSING' as const, processingProgress: this.processingPercent } as VirtualTourDTO)
            ),
          )
        ),
        takeWhile(
          tour => tour.status === 'NOT_CREATED' || tour.status === 'PENDING' || tour.status === 'PROCESSING',
          true,
        ),
      )
      .subscribe({
        next: tour => {
          if ((tour.processingProgress ?? 0) > 0) {
            this.processingPercent = tour.processingProgress!;
          }
          if (tour.status === 'COMPLETED') {
            this.loadCompletedTour(key);
          } else if (tour.status === 'FAILED') {
            this.state = 'error';
            this.errorMessage = tour.errorMessage || 'La génération a échoué.';
          }
          this.cdr.markForCheck();
        },
        error: () => {},
      });
  }

  private loadCompletedTour(key: { propertyId?: number; tourId?: number }): void {
    const tour$ = key.tourId != null
      ? this.tourService.getTourById(key.tourId)
      : this.tourService.getTour(key.propertyId!);

    const sub = tour$.subscribe({
      next: tour => {
        this.generatedTour = tour;
        this.state = 'success';
        this.tourGenerated.emit(tour);
        this.cdr.markForCheck();
      },
      error: () => {
        this.state = 'error';
        this.errorMessage = 'Tour généré mais impossible de le charger.';
        this.cdr.markForCheck();
      },
    });
    this.subs.add(sub);
  }

  // ── Delete ───────────────────────────────────────────────────────────────

  deleteTour(): void {
    if (!this.propertyId) return; // standalone tours cannot be deleted via property endpoint
    if (!confirm('Supprimer la visite virtuelle ? Cette action est irréversible.')) return;
    const sub = this.tourService.deleteTour(this.propertyId).subscribe({
      next: () => {
        this.generatedTour = null;
        this.state = 'idle';
        this.selectedFile = null;
        this.cdr.markForCheck();
      },
    });
    this.subs.add(sub);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  get fileSizeLabel(): string {
    if (!this.selectedFile) return '';
    const mb = this.selectedFile.size / (1024 * 1024);
    return mb > 1000 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
  }

  close(): void {
    this.closed.emit();
  }
}
