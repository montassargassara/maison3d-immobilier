import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  animate,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { ClientAuthService } from '../../services/client-auth.service';
import { InterestRequestService } from '../../services/interest-request.service';

type ModalState = 'form' | 'success';

@Component({
  selector: 'app-interest-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './interest-modal.component.html',
  styleUrls: ['./interest-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('panelContent', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(8px)' }),
        animate('200ms 80ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
  ],
})
export class InterestModalComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input({ required: true }) propertyId!: number;
  @Input() propertyTitle = '';
  /** Pre-fills the proposed budget field with the property price. Client can override. */
  @Input() propertyPrice: number | null = null;
  @Output() closed = new EventEmitter<boolean>();

  private fb = inject(FormBuilder);
  private auth = inject(ClientAuthService);
  private service = inject(InterestRequestService);
  private cdr = inject(ChangeDetectorRef);

  /** Drives the CSS entrance animation — set true after first paint. */
  visible = false;

  state: ModalState = 'form';
  loading = false;
  apiError = '';

  /** Accessible IDs tied to the propertyId to avoid collisions if ever multiple. */
  dialogTitleId = `im-title-${this.propertyId}`;
  dialogDescId  = `im-desc-${this.propertyId}`;

  form!: FormGroup;

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.dialogTitleId = `im-title-${this.propertyId}`;
    this.dialogDescId  = `im-desc-${this.propertyId}`;

    const user = this.auth.getCurrentUser();
    this.form = this.fb.group({
      fullName:      [user ? `${user.prenom ?? ''} ${user.nom ?? ''}`.trim() : '', [Validators.required, Validators.minLength(2)]],
      telephone:     [user?.telephone ?? '', [Validators.required, Validators.minLength(6)]],
      proposedBudget:[this.propertyPrice ?? null],
      message:       [''],
    });

    // Lock body scroll while modal is open
    document.body.style.overflow = 'hidden';
  }

  ngAfterViewInit(): void {
    // Defer by one animation frame so CSS starts from the initial hidden state
    requestAnimationFrame(() => {
      this.visible = true;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }

  // ─── Keyboard ──────────────────────────────────────────────────────────────

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.close();
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /** Returns true when a field is invalid AND the user has touched it (or form was submitted). */
  showError(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched));
  }

  // ─── Actions ───────────────────────────────────────────────────────────────

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.loading) return;

    this.apiError = '';
    this.loading = true;
    this.cdr.markForCheck();

    const v = this.form.value;
    this.service
      .submit({
        propertyId:     this.propertyId,
        fullName:       v.fullName.trim(),
        telephone:      v.telephone.trim(),
        message:        v.message?.trim() || undefined,
        proposedBudget: v.proposedBudget || undefined,
      })
      .subscribe({
        next: () => {
          this.loading = false;
          this.state = 'success';
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.loading = false;
          this.apiError = err?.error?.error || "Une erreur est survenue. Veuillez réessayer.";
          this.cdr.markForCheck();
        },
      });
  }

  close(): void {
    this.closed.emit(this.state === 'success');
  }
}
