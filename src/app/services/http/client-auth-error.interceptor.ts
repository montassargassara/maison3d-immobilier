import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ClientAuthService } from '../../public/services/client-auth.service';

/**
 * If a request to the public-client API comes back 401/403, the client JWT
 * is either missing, expired, or for a role the backend rejected. Clear it
 * and bounce the user to the login page so they can recover cleanly instead
 * of seeing a half-rendered dashboard with red errors in the console.
 *
 * Login/register endpoints are excluded — those legitimately return 401 on
 * bad credentials and we want the form to display its own error message.
 */
export const clientAuthErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(ClientAuthService);
  const router = inject(Router);

  const isClientApi = req.url.includes('/api/client/');
  const isClientAuthForm = req.url.includes('/api/client/auth/login')
                        || req.url.includes('/api/client/auth/register');

  return next(req).pipe(
    catchError((err) => {
      if (
        isClientApi &&
        !isClientAuthForm &&
        err instanceof HttpErrorResponse &&
        (err.status === 401 || err.status === 403)
      ) {
        auth.logout();
        if (typeof window !== 'undefined') {
          const current = router.url || '/';
          // Avoid loop: don't redirect if we're already on the login page.
          if (!current.startsWith('/compte/login')) {
            router.navigate(['/compte/login'], {
              queryParams: { redirect: current },
            });
          }
        }
      }
      return throwError(() => err);
    })
  );
};
