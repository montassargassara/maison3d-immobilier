// admin/admin-component/admin-component.ts
import { Component, HostListener, OnDestroy, OnInit, Renderer2, Inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { SafeUrl } from '@angular/platform-browser';
import { AdminAuthService } from '../services/admin-auth';
import { ProfileService } from '../services/profile.service';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { UserService } from '../../services/user.service';
import { AdminDashboardService } from '../services/admin-dashboard.service';
import { NotificationService, NotificationDTO } from '../services/notification.service';
import { MessageService } from '../services/message.service';
import { SaleValidationService } from '../services/sale-validation.service';
import { interval } from 'rxjs';

@Component({
  selector: 'app-admin-component',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-component.html',
  styleUrl: './admin-component.scss',
})
export class AdminComponent implements OnInit, OnDestroy {
  isSidebarCollapsed = false;
  isMobileMenuOpen = false;
  isMobileView = false;
  isDarkTheme = false;
  currentRoute = '';
  currentUser: any = null;
  customersCount = 0;
  propertiesCount = 0;
  agentsCount = 0;
  unreadNotifications = 0;
  unreadMessageCount = 0;
  pendingValidationsCount = 0;
  notifPanelOpen = false;
  recentNotifications: NotificationDTO[] = [];
  currentAvatarBlobUrl: SafeUrl | null = null;
  private _lastAvatarUrl: string | null = null;

  private subscriptions: Subscription[] = [];
  private readonly mobileBreakpoint = 992;
  private isBrowser: boolean;

  constructor(
    private router: Router,
    private authService: AdminAuthService,
    private profileService: ProfileService,
    private userService: UserService,
    private dashboardService: AdminDashboardService,
    public notificationService: NotificationService,
    private messageService: MessageService,
    private saleValidationService: SaleValidationService,
    private renderer: Renderer2,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    this.updateViewportState();
    this.restorePreferences();
    this.applyTheme();
    this.currentRoute = this.normalizeRoute(this.router.url);

    this.subscriptions.push(
      this.router.events.pipe(
        filter(event => event instanceof NavigationEnd)
      ).subscribe((event: NavigationEnd) => {
        this.currentRoute = this.normalizeRoute(event.urlAfterRedirects);
        this.closeMobileSidebar();
      })
    );

    this.subscriptions.push(
      this.authService.currentUser.subscribe(user => {
        this.currentUser = user;
        if (user) {
          this.loadCounts();
          this.notificationService.startPolling();
          // Fetch avatar blob when URL changes (avoids 403 from plain <img src>)
          const avatarUrl = user.avatarUrl || null;
          if (avatarUrl && avatarUrl !== this._lastAvatarUrl) {
            this._lastAvatarUrl = avatarUrl;
            this.profileService.fetchAvatarBlob(avatarUrl).subscribe({
              next: (safe) => { this.currentAvatarBlobUrl = safe; this.cdr.detectChanges(); },
              error: () => { this.currentAvatarBlobUrl = null; }
            });
          } else if (!avatarUrl) {
            this._lastAvatarUrl = null;
            this.currentAvatarBlobUrl = null;
          }
          // redirect /admin root to the role-appropriate default page
          if (this.router.url === '/admin' || this.router.url === '/admin/') {
            this.router.navigate([this.authService.getDefaultRoute()], { replaceUrl: true });
          }
        }
      })
    );

    this.subscriptions.push(
      this.notificationService.unreadCount$.subscribe(count => {
        this.unreadNotifications = count;
        this.cdr.detectChanges();
      })
    );
  }

  /**
   * ✅ NOUVELLE MÉTHODE - Chargement sécurisé des compteurs
   * Utilise l'API backend filtrée au lieu de compter tous les clients
   */
  loadCounts(): void {
    if (this.currentUser?.role === 'AFFILIATE') return;

    const msgPoll = interval(30000).subscribe(() => {
      this.messageService.getUnreadCount().subscribe({
        next: r => { this.unreadMessageCount = r.count; this.cdr.detectChanges(); },
        error: () => {}
      });
    });
    this.subscriptions.push(msgPoll);
    this.messageService.getUnreadCount().subscribe({
      next: r => { this.unreadMessageCount = r.count; this.cdr.detectChanges(); },
      error: () => {}
    });

    // ✅ Utiliser l'API sécurisée pour le comptage des clients
    const clientCountSub = this.dashboardService.getClientCount().subscribe({
      next: (response) => {
        this.customersCount = response.count;
        console.log(`✅ Nombre de clients visibles chargé: ${this.customersCount} (rôle: ${response.role})`);
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('❌ Erreur lors du chargement du nombre de clients:', error);
        this.customersCount = 0;
        this.cdr.detectChanges();
      }
    });
    this.subscriptions.push(clientCountSub);

    // Charger les propriétés (à adapter si nécessaire)
    const propertiesSub = this.dashboardService.getDashboardSnapshot().subscribe({
      next: snapshot => {
        this.propertiesCount = snapshot.stats.totalProperties;
        this.cdr.detectChanges();
      },
      error: error => {
        console.error('Erreur lors du chargement du nombre de propriétés:', error);
        this.propertiesCount = 0;
        this.cdr.detectChanges();
      }
    });
    this.subscriptions.push(propertiesSub);

    // Charger les agents (SUPER_ADMIN seulement)
    if (this.currentUser?.role === 'SUPER_ADMIN') {
      const agentsSub = this.userService.getUsersByRole('COMMERCIAL').subscribe({
        next: (agents: any[]) => {
          this.agentsCount = agents.length;
          this.cdr.detectChanges();
        },
        error: (error: any) => {
          console.error('Erreur lors du chargement du nombre d\'agents:', error);
          this.agentsCount = 0;
          this.cdr.detectChanges();
        }
      });
      this.subscriptions.push(agentsSub);
    } else {
      this.agentsCount = 0;
    }

    // Pending sale validations badge
    const validationPoll = interval(60000).subscribe(() => this.loadValidationCount());
    this.subscriptions.push(validationPoll);
    this.loadValidationCount();
  }

  private loadValidationCount(): void {
    this.saleValidationService.getPendingCount().subscribe({
      next: r => { this.pendingValidationsCount = r.count; this.cdr.detectChanges(); },
      error: () => {}
    });
  }


  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
    this.savePreferences();
  }

  openMobileSidebar(): void {
    this.isMobileMenuOpen = true;
  }

  closeMobileSidebar(): void {
    this.isMobileMenuOpen = false;
  }

  handleNavClick(): void {
    if (this.isMobileMenuOpen) {
      this.closeMobileSidebar();
    }
  }

  toggleTheme(): void {
    this.isDarkTheme = !this.isDarkTheme;
    this.applyTheme();
    this.savePreferences();
  }

  logout(): void {
    this.authService.logout();
  }

  getPageTitle(): string {
    const routes: Array<{ path: string; title: string; exact?: boolean }> = [
      { path: '/admin/dashboard', title: 'Tableau de bord', exact: true },
      { path: '/admin/properties/new', title: 'Nouveau bien' },
      { path: '/admin/properties/edit', title: 'Modifier un bien' },
      { path: '/admin/properties', title: 'Biens immobiliers' },
      { path: '/admin/customers', title: 'Gestion des clients' },
      { path: '/admin/agents', title: 'Agents commerciaux' },
      { path: '/admin/statistics', title: 'Transactions & Ventes' },
      { path: '/admin/settings', title: 'Paramètres' },
      { path: '/admin/share-requests', title: 'Demandes de partage' },
      { path: '/admin/incoming-share-requests', title: 'Propositions reçues' },
      // Affiliate routes
      { path: '/admin/affiliate-applications', title: 'Candidatures Affiliés' },
      { path: '/admin/agency-affiliates', title: 'Clients affiliés' },
      { path: '/admin/affiliate-accounts', title: 'Clients affiliés' },
      { path: '/admin/affiliate-ranking', title: 'Classement Mensuel' },
      { path: '/admin/affiliate-commissions', title: 'Commissions & Paiements' },
      { path: '/admin/affiliate-dashboard', title: 'Mon Tableau de Bord' },
      { path: '/admin/affiliate-properties', title: 'Biens Disponibles' },
      { path: '/admin/affiliate-offers', title: 'Mes Offres' },
      { path: '/admin/affiliate-earnings', title: 'Mes Gains' },
      { path: '/admin/affiliate-incoming-offers', title: 'Offres Affiliés Reçues' },
      { path: '/admin/sale-validations', title: 'Validations de vente/location' },
    ];

    const match = routes.find(route => {
      if (route.exact) {
        return this.currentRoute === route.path;
      }
      return this.currentRoute.startsWith(route.path);
    });

    return match?.title || 'Administration';
  }

  getAvatarUrl(): SafeUrl | null {
    return this.currentAvatarBlobUrl;
  }

  getUserInitials(): string {
    if (!this.currentUser) return 'U';
    
    const nom = this.currentUser.nom || '';
    const prenom = this.currentUser.prenom || '';
    const name = this.currentUser.name || '';
    
    if (nom && prenom) {
      return (prenom.charAt(0) + nom.charAt(0)).toUpperCase();
    }
    
    if (name) {
      const parts = name.split(' ');
      if (parts.length >= 2) {
        return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
      }
      return name.charAt(0).toUpperCase();
    }
    
    if (this.currentUser.email) {
      return this.currentUser.email.charAt(0).toUpperCase();
    }
    
    return 'U';
  }

  getAvatarColor(): string {
    if (!this.currentUser) return '#3b82f6';
    
    const name = this.currentUser.name || this.currentUser.email || 'User';
    const colors = [
      '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#f59e0b',
      '#06b6d4', '#ec4899', '#6366f1', '#14b8a6', '#f97316'
    ];
    
    const charSum = name.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
    const colorIndex = charSum % colors.length;
    
    return colors[colorIndex];
  }

  getFormattedRole(): string {
    if (!this.currentUser || !this.currentUser.role) return '';
    
    const role = this.currentUser.role.toUpperCase();
    
    switch (role) {
      case 'SUPER_ADMIN':
      case 'SUPERADMIN':
        return 'Super Admin';
      case 'ADMIN':
        return 'Administrateur';
      case 'RESPONSABLE_COMMERCIAL':
        return 'Resp. Commercial';
      case 'COMMERCIAL':
        return 'Commercial';
      case 'EDITOR':
        return 'Éditeur';
      case 'AFFILIATE':
      case 'AFFILIATE_CLIENT':
        return 'Affilié';
      case 'CLIENT':
        return 'Client';
      default:
        return role.toLowerCase();
    }
  }

  getBadgeClass(): string {
    if (!this.currentUser || !this.currentUser.role) return 'badge-default';
    
    const role = this.currentUser.role.toUpperCase();
    
    if (role === 'SUPER_ADMIN' || role === 'SUPERADMIN') {
      return 'badge-superadmin';
    } else if (role === 'ADMIN') {
      return 'badge-admin';
    } else if (role === 'COMMERCIAL' || role === 'RESPONSABLE_COMMERCIAL') {
      return 'badge-commercial';
    } else if (role === 'CLIENT') {
      return 'badge-client';
    } else if (role === 'AFFILIATE' || role === 'AFFILIATE_CLIENT') {
      return 'badge-affiliate';
    }
    
    return 'badge-default';
  }

  toggleNotifPanel(): void {
    this.notifPanelOpen = !this.notifPanelOpen;
    if (this.notifPanelOpen) {
      this.notificationService.getAll().subscribe({
        next: notifs => {
          this.recentNotifications = notifs.slice(0, 6);
          this.cdr.detectChanges();
        }
      });
    }
  }

  markAllNotificationsRead(): void {
    this.notificationService.markAllRead().subscribe({
      next: () => {
        this.recentNotifications.forEach(n => n.read = true);
        this.notificationService.refreshCount();
        this.cdr.detectChanges();
      }
    });
  }

  handleNotifClick(notif: NotificationDTO): void {
    if (!notif.read) {
      this.notificationService.markRead(notif.id).subscribe({
        next: () => {
          notif.read = true;
          this.notificationService.refreshCount();
          this.cdr.detectChanges();
        }
      });
    }
    this.notifPanelOpen = false;

    const type = notif.type ?? '';
    const role = this.currentUser?.role;

    if (type.includes('SHARE_REQUEST')) {
      this.router.navigate([role === 'ADMIN' ? '/admin/incoming-share-requests' : '/admin/share-requests']);
    } else if (type === 'AGENCY_REGISTRATION' && role === 'SUPER_ADMIN') {
      this.router.navigate(['/admin/agency-applications']);
    } else if (type === 'AFFILIATE_REGISTRATION' && role === 'SUPER_ADMIN') {
      this.router.navigate(['/admin/affiliate-applications']);
    } else if ((type === 'AFFILIATE_APPROVED' || type === 'AFFILIATE_REJECTED' || type === 'AFFILIATE_SUSPENDED') && role === 'AFFILIATE') {
      this.router.navigate(['/admin/affiliate-dashboard']);
    } else if (type === 'SALE_OFFER_RECEIVED' && (role === 'ADMIN' || role === 'SUPER_ADMIN')) {
      this.router.navigate(['/admin/affiliate-incoming-offers']);
    } else if ((type === 'SALE_OFFER_ACCEPTED' || type === 'SALE_OFFER_REJECTED' || type === 'SALE_OFFER_COMPLETED') && role === 'AFFILIATE') {
      this.router.navigate(['/admin/affiliate-offers']);
    } else if (type === 'MONTHLY_BONUS_AWARDED' && role === 'AFFILIATE') {
      this.router.navigate(['/admin/affiliate-dashboard']);
    } else if (type === 'PROPERTY_PENDING_VALIDATION' && notif.relatedEntityId) {
      this.router.navigate(['/admin/properties/edit', notif.relatedEntityId]);
    } else if ((type === 'PROPERTY_VALIDATED' || type === 'PROPERTY_REJECTED'
                || type === 'PROPERTY_MODIFIED') && notif.relatedEntityId) {
      this.router.navigate(['/admin/properties/edit', notif.relatedEntityId]);
    } else if (type === 'COMMISSION_REQUIRED' && notif.relatedEntityId) {
      this.router.navigate(['/admin/properties/edit', notif.relatedEntityId]);
    } else if (type === 'PROPERTY_SOLD_BY_AGENCY' && notif.relatedEntityId) {
      this.router.navigate(['/admin/properties/edit', notif.relatedEntityId]);
    } else if (type === 'SALE_APPROVAL_REQUESTED') {
      this.router.navigate(['/admin/sale-validations']);
    } else if (type === 'SALE_APPROVAL_GRANTED' || type === 'SALE_APPROVAL_REJECTED') {
      this.router.navigate(['/admin/sale-validations']);
    }
  }

  getNotifIcon(type: string): string {
    switch (type) {
      case 'SHARE_REQUEST_RECEIVED':  return 'fa-share-nodes text-primary';
      case 'SHARE_REQUEST_ACCEPTED':  return 'fa-check-circle text-success';
      case 'SHARE_REQUEST_REJECTED':  return 'fa-times-circle text-danger';
      case 'SHARE_REQUEST_CANCELLED': return 'fa-ban text-warning';
      case 'AGENCY_REGISTRATION':      return 'fa-building text-primary';
      case 'AGENCY_APPROVED':          return 'fa-building-circle-check text-success';
      case 'AGENCY_REJECTED':          return 'fa-building-circle-xmark text-danger';
      case 'AFFILIATE_REGISTRATION':   return 'fa-user-clock text-primary';
      case 'AFFILIATE_APPROVED':      return 'fa-user-check text-success';
      case 'AFFILIATE_REJECTED':      return 'fa-user-times text-danger';
      case 'AFFILIATE_SUSPENDED':     return 'fa-user-slash text-warning';
      case 'SALE_OFFER_RECEIVED':     return 'fa-file-contract text-primary';
      case 'SALE_OFFER_ACCEPTED':     return 'fa-handshake text-success';
      case 'SALE_OFFER_REJECTED':     return 'fa-times-circle text-danger';
      case 'SALE_OFFER_COMPLETED':    return 'fa-flag-checkered text-success';
      case 'MONTHLY_BONUS_AWARDED':   return 'fa-star text-warning';
      case 'PROPERTY_PENDING_VALIDATION': return 'fa-clock text-warning';
      case 'PROPERTY_VALIDATED':      return 'fa-check-double text-success';
      case 'PROPERTY_REJECTED':       return 'fa-ban text-danger';
      case 'PROPERTY_MODIFIED':       return 'fa-pen-to-square text-secondary';
      case 'COMMISSION_REQUIRED':     return 'fa-coins text-warning';
      case 'PROPERTY_SOLD_BY_AGENCY': return 'fa-money-bill-trend-up text-success';
      case 'SALE_APPROVAL_REQUESTED': return 'fa-gavel text-warning';
      case 'SALE_APPROVAL_GRANTED':   return 'fa-circle-check text-success';
      case 'SALE_APPROVAL_REJECTED':  return 'fa-circle-xmark text-danger';
      default: return 'fa-bell text-secondary';
    }
  }

  formatNotifDate(dateStr: string): string {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'À l\'instant';
    if (mins < 60) return `Il y a ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Il y a ${hours} h`;
    return `Il y a ${Math.floor(hours / 24)} j`;
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateViewportState();
  }

  private updateViewportState(): void {
    if (!this.isBrowser) return;

    this.isMobileView = window.innerWidth < this.mobileBreakpoint;

    if (!this.isMobileView) {
      this.closeMobileSidebar();
    }
  }

  private normalizeRoute(url: string): string {
    return url.split('?')[0].split('#')[0];
  }

  private restorePreferences(): void {
    if (!this.isBrowser) return;
    
    const collapsed = localStorage.getItem('adminSidebarCollapsed');
    if (collapsed !== null) {
      this.isSidebarCollapsed = collapsed === 'true';
    }
    
    const theme = localStorage.getItem('adminTheme');
    if (theme === 'dark') {
      this.isDarkTheme = true;
    } else if (theme === 'light') {
      this.isDarkTheme = false;
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.isDarkTheme = prefersDark;
    }
  }

  private savePreferences(): void {
    if (!this.isBrowser) return;
    localStorage.setItem('adminSidebarCollapsed', String(this.isSidebarCollapsed));
    localStorage.setItem('adminTheme', this.isDarkTheme ? 'dark' : 'light');
  }

  private applyTheme(): void {
    if (!this.isBrowser) return;
    
    if (this.isDarkTheme) {
      document.body.classList.add('dark-mode');
      document.documentElement.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
      document.documentElement.classList.remove('dark-mode');
    }
    
    document.body.setAttribute('data-theme', this.isDarkTheme ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', this.isDarkTheme ? 'dark' : 'light');
    
    this.forceStyleRecalculation();
  }
  
  private forceStyleRecalculation(): void {
    document.body.style.display = 'none';
    void document.body.offsetHeight;
    document.body.style.display = '';
  }
}