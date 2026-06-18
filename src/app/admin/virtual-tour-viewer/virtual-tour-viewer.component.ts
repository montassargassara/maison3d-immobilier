import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { VirtualTourDTO, VirtualTourSceneDTO } from '../services/virtual-tour.service';

@Component({
  selector: 'app-virtual-tour-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './virtual-tour-viewer.component.html',
  styleUrl: './virtual-tour-viewer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VirtualTourViewerComponent implements OnInit, OnChanges, OnDestroy {
  @Input() tour!: VirtualTourDTO;
  @Input() autoplay = false;

  @ViewChild('viewerEl') viewerEl?: ElementRef<HTMLDivElement>;

  currentIndex = 0;
  isFullscreen = false;
  isAutoplay = false;
  isTransitioning = false;
  isDragging = false;
  showControls = true;
  imageLoaded = false;

  private autoplayTimer: ReturnType<typeof setInterval> | null = null;
  private controlsTimer: ReturnType<typeof setTimeout> | null = null;
  private touchStartX = 0;
  private touchStartY = 0;
  private mouseDragStartX = 0;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    const defaultScene = this.tour?.scenes?.findIndex(s => s.isDefault);
    this.currentIndex = defaultScene !== undefined && defaultScene >= 0 ? defaultScene : 0;
    if (this.autoplay) this.startAutoplay();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tour'] && this.tour) {
      this.currentIndex = 0;
      this.imageLoaded = false;
    }
  }

  ngOnDestroy(): void {
    this.stopAutoplay();
    this.clearControlsTimer();
    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
  }

  // ── Scene navigation ─────────────────────────────────────────────────────

  get scenes(): VirtualTourSceneDTO[] {
    return this.tour?.scenes ?? [];
  }

  get currentScene(): VirtualTourSceneDTO | null {
    return this.scenes[this.currentIndex] ?? null;
  }

  goToScene(index: number): void {
    if (index === this.currentIndex || this.isTransitioning) return;
    this.isTransitioning = true;
    this.imageLoaded = false;
    this.currentIndex = index;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.isTransitioning = false;
      this.cdr.markForCheck();
    }, 400);
  }

  prev(): void {
    const next = (this.currentIndex - 1 + this.scenes.length) % this.scenes.length;
    this.goToScene(next);
  }

  next(): void {
    const next = (this.currentIndex + 1) % this.scenes.length;
    this.goToScene(next);
  }

  onImageLoad(): void {
    this.imageLoaded = true;
    this.cdr.markForCheck();
  }

  // ── Keyboard ─────────────────────────────────────────────────────────────

  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    if (!this.isFullscreen && !this.viewerEl?.nativeElement.matches(':focus-within')) return;
    switch (e.key) {
      case 'ArrowLeft':  e.preventDefault(); this.prev(); break;
      case 'ArrowRight': e.preventDefault(); this.next(); break;
      case 'Escape':     if (this.isFullscreen) this.exitFullscreen(); break;
      case 'f':          this.toggleFullscreen(); break;
      case ' ':          e.preventDefault(); this.toggleAutoplay(); break;
    }
  }

  // ── Touch swipe ──────────────────────────────────────────────────────────

  onTouchStart(e: TouchEvent): void {
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
  }

  onTouchEnd(e: TouchEvent): void {
    const dx = e.changedTouches[0].clientX - this.touchStartX;
    const dy = e.changedTouches[0].clientY - this.touchStartY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      dx < 0 ? this.next() : this.prev();
    }
  }

  // ── Mouse drag ───────────────────────────────────────────────────────────

  onMouseDown(e: MouseEvent): void {
    this.isDragging = false;
    this.mouseDragStartX = e.clientX;
  }

  onMouseUp(e: MouseEvent): void {
    const dx = e.clientX - this.mouseDragStartX;
    if (Math.abs(dx) > 40) {
      dx < 0 ? this.next() : this.prev();
    }
  }

  // ── Autoplay ─────────────────────────────────────────────────────────────

  toggleAutoplay(): void {
    this.isAutoplay ? this.stopAutoplay() : this.startAutoplay();
  }

  private startAutoplay(): void {
    this.isAutoplay = true;
    this.autoplayTimer = setInterval(() => {
      this.next();
    }, 4000);
    this.cdr.markForCheck();
  }

  private stopAutoplay(): void {
    this.isAutoplay = false;
    if (this.autoplayTimer) {
      clearInterval(this.autoplayTimer);
      this.autoplayTimer = null;
    }
    this.cdr.markForCheck();
  }

  // ── Fullscreen ───────────────────────────────────────────────────────────

  toggleFullscreen(): void {
    this.isFullscreen ? this.exitFullscreen() : this.enterFullscreen();
  }

  private enterFullscreen(): void {
    const el = this.viewerEl?.nativeElement;
    if (!el) return;
    if (el.requestFullscreen) {
      el.requestFullscreen();
      this.isFullscreen = true;
    }
    document.addEventListener('fullscreenchange', this.onFullscreenChange);
    this.cdr.markForCheck();
  }

  private exitFullscreen(): void {
    if (document.fullscreenElement) document.exitFullscreen();
    this.isFullscreen = false;
    this.cdr.markForCheck();
  }

  private onFullscreenChange = (): void => {
    if (!document.fullscreenElement) {
      this.isFullscreen = false;
      this.cdr.markForCheck();
    }
  };

  // ── Controls auto-hide ───────────────────────────────────────────────────

  onMouseMove(): void {
    this.showControls = true;
    this.resetControlsTimer();
  }

  private resetControlsTimer(): void {
    this.clearControlsTimer();
    this.controlsTimer = setTimeout(() => {
      if (this.isFullscreen) {
        this.showControls = false;
        this.cdr.markForCheck();
      }
    }, 3000);
  }

  private clearControlsTimer(): void {
    if (this.controlsTimer) {
      clearTimeout(this.controlsTimer);
      this.controlsTimer = null;
    }
  }

  sceneLabel(index: number): string {
    return this.scenes[index]?.sceneName ?? `Scène ${index + 1}`;
  }
}
