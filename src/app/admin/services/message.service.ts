import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBaseUrl } from '../../services/api-config';

export interface MessageDTO {
  id: number;
  senderId: number;
  senderName: string;
  senderRole: string;
  receiverId: number;
  receiverName: string;
  receiverRole: string;
  content: string;
  read: boolean;
  createdAt: string;
}

export interface AllowedUser {
  id: number;
  fullName: string;
  role: string;
  email: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  hasConversation: boolean;
}

export interface SendMessageRequest {
  receiverId: number;
  content: string;
}

@Injectable({ providedIn: 'root' })
export class MessageService {
  private readonly base = `${apiBaseUrl}/api/messages`;

  constructor(private http: HttpClient) {}

  getInbox(): Observable<MessageDTO[]> {
    return this.http.get<MessageDTO[]>(`${this.base}/inbox`);
  }

  getUnreadCount(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.base}/unread-count`);
  }

  getConversations(): Observable<MessageDTO[]> {
    return this.http.get<MessageDTO[]>(`${this.base}/conversations`);
  }

  getAllowedUsers(): Observable<AllowedUser[]> {
    return this.http.get<AllowedUser[]>(`${this.base}/allowed-users`);
  }

  getConversationWith(partnerId: number): Observable<MessageDTO[]> {
    return this.http.get<MessageDTO[]>(`${this.base}/conversation/${partnerId}`);
  }

  sendMessage(request: SendMessageRequest): Observable<MessageDTO> {
    return this.http.post<MessageDTO>(`${this.base}/send`, request);
  }

  markAsRead(id: number): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}/read`, {});
  }

  markAllAsRead(): Observable<void> {
    return this.http.put<void>(`${this.base}/read-all`, {});
  }
}
