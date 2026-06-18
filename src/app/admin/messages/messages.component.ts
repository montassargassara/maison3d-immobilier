import {
  AfterViewChecked,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { startWith, switchMap } from 'rxjs/operators';
import { MessageService, AllowedUser, MessageDTO } from '../services/message.service';
import { AdminAuthService } from '../services/admin-auth';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './messages.component.html',
  styleUrl: './messages.component.scss',
})
export class MessagesComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('chatScroll') chatScrollRef!: ElementRef<HTMLElement>;

  contacts: AllowedUser[] = [];
  filteredContacts: AllowedUser[] = [];
  selectedContact: AllowedUser | null = null;
  messages: MessageDTO[] = [];

  searchQuery = '';
  newMessageContent = '';
  sendingMessage = false;
  sendError = '';

  loadingContacts = true;
  loadingMessages = false;

  private pollSub?: Subscription;
  private shouldScrollToBottom = false;

  get currentUserId(): number | null {
    return this.authService.getCurrentUser()?.id ?? null;
  }

  constructor(
    private messageService: MessageService,
    private authService: AdminAuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadContacts();
    // Poll every 10 s to refresh unread counts and active conversation
    this.pollSub = interval(10_000).pipe(startWith(0)).subscribe(() => {
      this.refreshContacts();
      if (this.selectedContact) {
        this.refreshConversation(this.selectedContact.id, false);
      }
    });
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  // ── Contacts ────────────────────────────────────────────────────────────

  loadContacts(): void {
    this.loadingContacts = true;
    this.messageService.getAllowedUsers().subscribe({
      next: users => {
        this.contacts = users;
        this.applySearch();
        this.loadingContacts = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingContacts = false;
        this.cdr.detectChanges();
      },
    });
  }

  refreshContacts(): void {
    this.messageService.getAllowedUsers().subscribe({
      next: users => {
        this.contacts = users;
        this.applySearch();
        // Update selectedContact unread badge too
        if (this.selectedContact) {
          const updated = users.find(u => u.id === this.selectedContact!.id);
          if (updated) this.selectedContact = { ...updated, unreadCount: 0 };
        }
        this.cdr.detectChanges();
      },
      error: () => {},
    });
  }

  applySearch(): void {
    const q = this.searchQuery.toLowerCase().trim();
    this.filteredContacts = q
      ? this.contacts.filter(
          c =>
            c.fullName.toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q) ||
            c.role.toLowerCase().includes(q)
        )
      : [...this.contacts];
  }

  onSearch(): void {
    this.applySearch();
  }

  // ── Conversation ─────────────────────────────────────────────────────────

  selectContact(contact: AllowedUser): void {
    this.selectedContact = { ...contact, unreadCount: 0 };
    this.sendError = '';
    this.newMessageContent = '';
    this.loadingMessages = true;
    this.loadConversation(contact.id);
    // Clear unread badge on this contact in the list
    const idx = this.contacts.findIndex(c => c.id === contact.id);
    if (idx !== -1) this.contacts[idx] = { ...this.contacts[idx], unreadCount: 0 };
    this.applySearch();
  }

  loadConversation(partnerId: number): void {
    this.messageService.getConversationWith(partnerId).subscribe({
      next: msgs => {
        this.messages = msgs;
        this.loadingMessages = false;
        this.shouldScrollToBottom = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingMessages = false;
        this.cdr.detectChanges();
      },
    });
  }

  refreshConversation(partnerId: number, scrollDown = true): void {
    this.messageService.getConversationWith(partnerId).subscribe({
      next: msgs => {
        const prevCount = this.messages.length;
        this.messages = msgs;
        if (scrollDown && msgs.length > prevCount) {
          this.shouldScrollToBottom = true;
        }
        this.cdr.detectChanges();
      },
      error: () => {},
    });
  }

  // ── Send ─────────────────────────────────────────────────────────────────

  sendMessage(): void {
    if (!this.newMessageContent.trim() || !this.selectedContact || this.sendingMessage) return;

    this.sendingMessage = true;
    this.sendError = '';

    this.messageService
      .sendMessage({ receiverId: this.selectedContact.id, content: this.newMessageContent.trim() })
      .subscribe({
        next: sent => {
          this.messages = [...this.messages, sent];
          this.newMessageContent = '';
          this.sendingMessage = false;
          this.shouldScrollToBottom = true;
          this.refreshContacts();
          this.cdr.detectChanges();
        },
        error: err => {
          this.sendError = err?.error?.error ?? 'Erreur lors de l\'envoi.';
          this.sendingMessage = false;
          this.cdr.detectChanges();
        },
      });
  }

  onEnterKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private scrollToBottom(): void {
    try {
      const el = this.chatScrollRef?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }

  formatRoleName(role: string): string {
    switch ((role ?? '').toUpperCase()) {
      case 'SUPER_ADMIN': return 'Super Admin';
      case 'ADMIN': return 'Admin Agence';
      case 'RESPONSABLE_COMMERCIAL': return 'Resp. Commercial';
      case 'COMMERCIAL': return 'Commercial';
      default: return role ?? '—';
    }
  }

  getRoleClass(role: string): string {
    switch ((role ?? '').toUpperCase()) {
      case 'SUPER_ADMIN': return 'role-super';
      case 'ADMIN': return 'role-admin';
      case 'RESPONSABLE_COMMERCIAL': return 'role-resp';
      case 'COMMERCIAL': return 'role-commercial';
      default: return 'role-default';
    }
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : name[0].toUpperCase();
  }

  formatTime(dateStr?: string): string {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffDays = Math.floor(diffMs / 86_400_000);
      if (diffDays === 0) {
        return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      } else if (diffDays === 1) {
        return 'Hier';
      } else if (diffDays < 7) {
        return d.toLocaleDateString('fr-FR', { weekday: 'short' });
      } else {
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
      }
    } catch {
      return '';
    }
  }

  formatFullTime(dateStr?: string): string {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleString('fr-FR', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return '';
    }
  }

  totalUnread(): number {
    return this.contacts.reduce((sum, c) => sum + c.unreadCount, 0);
  }
}
