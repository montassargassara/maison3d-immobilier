import { Injectable } from '@angular/core';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AdminAuthService } from '../services/admin-auth';

@Injectable({
  providedIn: 'root'
})
export class AdminAuthGuard {

  private readonly affiliateAllowedRoutes = [
    '/admin/affiliate-dashboard',
    '/admin/affiliate-properties',
    '/admin/affiliate-offers',
    '/admin/affiliate-earnings',
    '/admin/affiliate-ranking',
  ];

  constructor(
    private authService: AdminAuthService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    if (this.authService.isTokenExpired()) {
      this.authService.logout();
      this.router.navigate(['/admin/login'], { queryParams: { returnUrl: state.url } });
      return false;
    }

    if (!this.authService.isLoggedIn() || !this.authService.isAdmin()) {
      this.router.navigate(['/admin/login'], { queryParams: { returnUrl: state.url } });
      return false;
    }

    const role = this.authService.getCurrentUser()?.role?.toUpperCase();

    if (role === 'AFFILIATE') {
      const isAffiliateRoute = this.affiliateAllowedRoutes.some(r => state.url.startsWith(r));
      if (!isAffiliateRoute) {
        this.router.navigate(['/admin/affiliate-dashboard']);
        return false;
      }
    }

    return true;
  }
}
