import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AdminAuthService } from '../../admin/services/admin-auth';
import { ClientAuthService } from '../../public/services/client-auth.service';

/**
 * Two independent token stores live in parallel:
 *  - {@link AdminAuthService}   → SUPER_ADMIN / ADMIN / RESPONSABLE_COMMERCIAL /
 *                                 COMMERCIAL / AFFILIATE
 *  - {@link ClientAuthService}  → public CLIENT_PUBLIC space
 *
 * Routing rule:
 *  - `/api/client/**`  → ALWAYS uses the client token, never the admin token.
 *                       This prevents an admin's JWT from leaking into the
 *                       public-portal endpoints (which would either 403 due
 *                       to a role mismatch or grant unintended access).
 *  - everything else   → prefers the admin token, falls back to the client
 *                       token only if no admin is logged in.
 *
 * If neither token is available for the chosen path, the request goes
 * through without an Authorization header — the backend then enforces its
 * own permitAll vs. authenticated rules.
 */
export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const admin = inject(AdminAuthService);
  const client = inject(ClientAuthService);

  const isClientApi = req.url.includes('/api/client/');
  const adminToken = admin.getToken();
  const clientToken = client.getToken();

  const token = isClientApi
    ? clientToken
    : (adminToken || clientToken);

  if (!token) {
    return next(req);
  }

  const authReq = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });
  return next(authReq);
};
