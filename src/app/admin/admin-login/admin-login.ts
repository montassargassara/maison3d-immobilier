import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { AdminAuthService } from '../services/admin-auth';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-login.html',
  styleUrls: ['./admin-login.scss'] // Changé de styleUrl à styleUrls et .css à .scss
})
export class AdminLoginComponent {
  email = '';
  password = '';
  rememberMe = false;
  isLoading = false;
  errorMessage = '';
  
  private returnUrl = '';

  constructor(
    private authService: AdminAuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    if (this.authService.isLoggedIn()) {
      this.router.navigate([this.authService.getDefaultRoute()]);
    }

    this.route.queryParams.subscribe(params => {
      this.returnUrl = params['returnUrl'] || '';
    });
    
    // Charger l'email sauvegardé
    const savedRemember = localStorage.getItem('adminRemember');
    if (savedRemember) {
      try {
        const data = JSON.parse(savedRemember);
        if (data && data.email) {
          this.email = data.email;
          this.rememberMe = true;
        }
      } catch (e) {
        console.error('Error loading saved credentials:', e);
      }
    }
  }

  onSubmit(): void {
    if (!this.email || !this.password) {
      this.errorMessage = 'Veuillez remplir tous les champs';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    // Correction: Vérifier que login retourne un Observable
    const loginObservable = this.authService.login(this.email, this.password);
    
    if (loginObservable && typeof loginObservable.subscribe === 'function') {
      loginObservable.subscribe({
        next: (response: any) => {
          if (this.rememberMe) {
            localStorage.setItem('adminRemember', JSON.stringify({ email: this.email }));
          } else {
            localStorage.removeItem('adminRemember');
          }
          const destination = this.returnUrl || this.authService.getDefaultRoute();
          this.router.navigate([destination]);
        },
        error: (error: any) => { // Typage explicite
          console.error('Login error:', error);
          this.errorMessage = error.error?.message || 'Email ou mot de passe incorrect';
          this.isLoading = false;
        },
        complete: () => {
          this.isLoading = false;
        }
      });
    } else {
      // Si le service retourne une promesse ou autre
      this.errorMessage = 'Erreur de configuration du service d\'authentification';
      this.isLoading = false;
    }
  }

  resetPassword(): void {
    this.router.navigate(['/admin/forgot-password']);
  }
}