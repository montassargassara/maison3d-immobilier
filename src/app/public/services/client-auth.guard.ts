import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { ClientAuthService } from './client-auth.service';

export const clientAuthGuard: CanActivateFn = (_route, state): boolean | UrlTree => {
  const auth = inject(ClientAuthService);
  const router = inject(Router);
  if (auth.isLoggedIn()) return true;
  return router.createUrlTree(['/compte/login'], {
    queryParams: { redirect: state.url },
  });
};
