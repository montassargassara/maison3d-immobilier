import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminAuthService } from '../services/admin-auth';

/**
 * Route guard restricting access to ADMIN and SUPER_ADMIN only.
 *
 * Used for global commercial-management surfaces (commercial commissions,
 * per-commercial performance) that COMMERCIAL / RESPONSABLE_COMMERCIAL must
 * never reach — neither via the sidebar nor by typing the URL manually.
 * Real protection, in addition to AdminAuthGuard on the parent route.
 */
export const adminManagementGuard: CanActivateFn = () => {
  const auth = inject(AdminAuthService);
  const router = inject(Router);

  const role = auth.getCurrentUser()?.role?.toUpperCase();
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
    return true;
  }

  router.navigate(['/admin/dashboard']);
  return false;
};
