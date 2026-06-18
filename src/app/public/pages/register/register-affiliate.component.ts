import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs/operators';
import { AffiliateService } from '../../../admin/services/affiliate.service';
import { CreateAffiliateRequest } from '../../../models/affiliate.model';
import { apiBaseUrl } from '../../../services/api-config';

@Component({
  selector: 'app-register-affiliate',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register-affiliate.component.html',
  styleUrl: './register-affiliate.component.scss',
})
export class RegisterAffiliateComponent implements OnInit {

  form = {
    email: '',
    password: '',
    nom: '',
    prenom: '',
    telephone: '',
    experienceLevel: '',
    notes: '',
  };

  confirmPassword = '';

  selectedCountry = '';
  selectedCity = '';
  countries: string[] = [];
  cities: string[] = [];

  loading = false;
  submitted = false;
  errorMessage = '';

  constructor(
    private affiliateService: AffiliateService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.http.get<string[]>(`${apiBaseUrl}/api/properties/public/countries`).subscribe({
      next: c => this.countries = c,
      error: () => {},
    });
  }

  onCountryChange(): void {
    this.selectedCity = '';
    this.cities = [];
    if (!this.selectedCountry) return;
    this.http
      .get<string[]>(`${apiBaseUrl}/api/properties/public/cities`, {
        params: { country: this.selectedCountry },
      })
      .subscribe({ next: c => this.cities = c, error: () => {} });
  }

  get passwordMismatch(): boolean {
    return this.confirmPassword.length > 0 && this.form.password !== this.confirmPassword;
  }

  get zoneLabel(): string {
    if (this.selectedCountry && this.selectedCity) return `${this.selectedCity}, ${this.selectedCountry}`;
    if (this.selectedCountry) return this.selectedCountry;
    return '';
  }

  submit(): void {
    this.errorMessage = '';
    if (this.passwordMismatch) return;

    const regionName = this.selectedCity
      ? `${this.selectedCountry}, ${this.selectedCity}`
      : this.selectedCountry;

    const payload: CreateAffiliateRequest = {
      email: this.form.email,
      password: this.form.password,
      nom: this.form.nom,
      prenom: this.form.prenom,
      telephone: this.form.telephone || undefined,
      experienceLevel: this.form.experienceLevel || undefined,
      notes: this.form.notes || undefined,
      selectedRegions: [{
        regionName,
        country: this.selectedCountry,
        city: this.selectedCity || undefined,
      }],
    };

    this.loading = true;
    this.cdr.markForCheck();

    this.affiliateService.registerAffiliate(payload)
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