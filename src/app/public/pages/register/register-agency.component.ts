import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AgencyRegistrationService, CreateAgencyRequest } from '../../../admin/services/agency-registration.service';

@Component({
  selector: 'app-register-agency',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register-agency.component.html',
  styleUrl: './register-agency.component.scss',
})
export class RegisterAgencyComponent {

  form: CreateAgencyRequest = {
    email: '',
    password: '',
    nom: '',
    prenom: '',
    agencyName: '',
    telephone: '',
    description: '',
  };

  confirmPassword = '';
  loading = false;
  submitted = false;
  errorMessage = '';

  constructor(
    private agencyService: AgencyRegistrationService,
    private cdr: ChangeDetectorRef,
  ) {}

  get passwordMismatch(): boolean {
    return this.confirmPassword.length > 0 && this.form.password !== this.confirmPassword;
  }

  submit(): void {
    this.errorMessage = '';
    if (this.passwordMismatch) return;
    this.loading = true;
    this.cdr.markForCheck();

    this.agencyService.registerAgency(this.form)
      .pipe(finalize(() => {
        this.loading = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: () => {
          this.submitted = true;
        },
        error: err => {
          this.errorMessage =
            err?.error?.error ||
            err?.error?.message ||
            'Une erreur est survenue. Veuillez réessayer.';
        },
      });
  }
}
