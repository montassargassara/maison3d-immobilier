import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminAuthService } from '../services/admin-auth';

/**
 * Route guard restricting access to SUPER_ADMIN only.
 *
 * Used for surfaces that must never be reachable by an agency ADMIN
 * (e.g. /admin/agency-commissions — agency commissions are the money
 * agencies earn on the Super Admin's shared properties; only the
 * Super Admin may see them). Real protection — not just a hidden menu.
 * Runs in addition to AdminAuthGuard on the parent route.
 */
export const superAdminGuard: CanActivateFn = () => {
  const auth = inject(AdminAuthService);
  const router = inject(Router);

  const role = auth.getCurrentUser()?.role?.toUpperCase();
  if (role === 'SUPER_ADMIN') {
    return true;
  }

  router.navigate(['/admin/dashboard']);
  return false;
};
