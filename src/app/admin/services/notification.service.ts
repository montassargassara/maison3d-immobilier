import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, interval } from 'rxjs';
import { switchMap, startWith, tap } from 'rxjs/operators';
import { apiBaseUrl } from '../../services/api-config';

export type NotificationType =
  | 'SHARE_REQUEST_RECEIVED'
  | 'SHARE_REQUEST_ACCEPTED'
  | 'SHARE_REQUEST_REJECTED'
  | 'SHARE_REQUEST_CANCELLED'
  | 'AGENCY_REGISTRATION'
  | 'AGENCY_APPROVED'
  | 'AGENCY_REJECTED'
  | 'AFFILIATE_REGISTRATION'
  | 'AFFILIATE_APPROVED'
  | 'AFFILIATE_REJECTED'
  | 'AFFILIATE_SUSPENDED'
  | 'SALE_OFFER_RECEIVED'
  | 'SALE_OFFER_ACCEPTED'
  | 'SALE_OFFER_REJECTED'
  | 'SALE_OFFER_COMPLETED'
  | 'MONTHLY_BONUS_AWARDED'
  | 'PROPERTY_INTEREST_RECEIVED'
  | 'PROPERTY_PENDING_VALIDATION'
  | 'PROPERTY_VALIDATED'
  | 'PROPERTY_REJECTED'
  | 'PROPERTY_MODIFIED'
  | 'COMMISSION_REQUIRED'
  | 'PROPERTY_SOLD_BY_AGENCY'
  | 'SALE_APPROVAL_REQUESTED'
  | 'SALE_APPROVAL_GRANTED'
  | 'SALE_APPROVAL_REJECTED';

export interface NotificationDTO {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  relatedEntityType?: string;
  relatedEntityId?: number;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {

  private readonly base = `${apiBaseUrl}/api/notifications`;

  private _unreadCount = new BehaviorSubject<number>(0);
  readonly unreadCount$ = this._unreadCount.asObservable();

  constructor(private http: HttpClient) {}

  // ─── Polling ──────────────────────────────────────────────────────────────

  /** Call once after login to keep the badge up to date (polls every 30 s). */
  startPolling(): void {
    interval(30_000)
      .pipe(
        startWith(0),
        switchMap(() => this.http.get<{ count: number }>(`${this.base}/unread-count`))
      )
      .subscribe({ next: res => this._unreadCount.next(res.count), error: () => {} });
  }

  refreshCount(): void {
    this.http.get<{ count: number }>(`${this.base}/unread-count`).subscribe({
      next: res => this._unreadCount.next(res.count),
      error: () => {},
    });
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  getAll(): Observable<NotificationDTO[]> {
    return this.http.get<NotificationDTO[]>(this.base).pipe(
      tap(() => this.refreshCount())
    );
  }

  markRead(id: number): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}/read`, {}).pipe(
      tap(() => this.refreshCount())
    );
  }

  markAllRead(): Observable<void> {
    return this.http.put<void>(`${this.base}/read-all`, {}).pipe(
      tap(() => this._unreadCount.next(0))
    );
  }

  // ─── Icon helpers ─────────────────────────────────────────────────────────

  iconForType(type: NotificationType): string {
    switch (type) {
      case 'SHARE_REQUEST_RECEIVED':  return 'fa-share-nodes';
      case 'SHARE_REQUEST_ACCEPTED':  return 'fa-circle-check';
      case 'SHARE_REQUEST_REJECTED':  return 'fa-circle-xmark';
      case 'SHARE_REQUEST_CANCELLED': return 'fa-ban';
      default: return 'fa-bell';
    }
  }

  colorForType(type: NotificationType): string {
    switch (type) {
      case 'SHARE_REQUEST_RECEIVED':  return 'blue';
      case 'SHARE_REQUEST_ACCEPTED':  return 'green';
      case 'SHARE_REQUEST_REJECTED':  return 'red';
      case 'SHARE_REQUEST_CANCELLED': return 'gray';
      default: return 'blue';
    }
  }
}
