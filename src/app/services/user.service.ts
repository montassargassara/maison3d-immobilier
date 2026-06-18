// services/user.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { AdminAuthService } from '../admin/services/admin-auth';
import { apiBaseUrl } from './api-config';

export interface User {
  id: number;
  email: string;
  nom: string;
  prenom: string;
  telephone?: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  parentId?: number;
  parentName?: string;
  childrenCount?: number;
  commissionRate?: number;
  avatarUrl?: string;
}

export interface UserTree {
  user: User;
  children: UserTree[];
  descendantCount: number;
  roleCounts: { role: string; count: number }[];
}

export interface CreateUserRequest {
  email: string;
  password: string;
  nom: string;
  prenom: string;
  telephone?: string;
  role: string;
  commissionRate?: number;
}

export interface UpdateUserRequest {
  nom?: string;
  prenom?: string;
  telephone?: string;
  isActive?: boolean;
  commissionRate?: number;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = `${apiBaseUrl}/api/users`;

  constructor(
    private http: HttpClient,
    private authService: AdminAuthService
  ) {}

  // ==================== CRUD UTILISATEURS ====================

  // Récupérer tous les utilisateurs
  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}`).pipe(
      catchError(error => {
        console.error('Erreur lors de la récupération des utilisateurs:', error);
        return of([]);
      })
    );
  }

  // Récupérer un utilisateur par ID
  getUserById(id: number): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`).pipe(
      catchError(error => {
        console.error(`Erreur lors de la récupération de l'utilisateur ${id}:`, error);
        throw error;
      })
    );
  }

  // Récupérer les utilisateurs par rôle
  getUsersByRole(role: string): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/role/${role}`).pipe(
      catchError(error => {
        console.error(`Erreur lors de la récupération des utilisateurs par rôle ${role}:`, error);
        return of([]);
      })
    );
  }

  // Récupérer les utilisateurs actifs
  getActiveUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/active`).pipe(
      catchError(error => {
        console.error('Erreur lors de la récupération des utilisateurs actifs:', error);
        return of([]);
      })
    );
  }

  // Créer un nouvel utilisateur
  createUser(userData: CreateUserRequest): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}`, userData).pipe(
      catchError(error => {
        console.error('Erreur lors de la création de l\'utilisateur:', error);
        throw error;
      })
    );
  }

  // Créer un utilisateur avec hiérarchie
  createUserWithHierarchy(userData: CreateUserRequest): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/with-hierarchy`, userData).pipe(
      catchError(error => {
        console.error('Erreur lors de la création de l\'utilisateur avec hiérarchie:', error);
        throw error;
      })
    );
  }

  // Créer un administrateur
  createAdmin(userData: CreateUserRequest): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/admin`, userData).pipe(
      catchError(error => {
        console.error('Erreur lors de la création de l\'admin:', error);
        throw error;
      })
    );
  }

  // Créer un responsable commercial
  createResponsable(userData: CreateUserRequest): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/responsable`, userData).pipe(
      catchError(error => {
        console.error('Erreur lors de la création du responsable:', error);
        throw error;
      })
    );
  }

  // Mettre à jour un utilisateur
  updateUser(id: number, userData: UpdateUserRequest): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/${id}`, userData).pipe(
      catchError(error => {
        console.error(`Erreur lors de la mise à jour de l'utilisateur ${id}:`, error);
        throw error;
      })
    );
  }

  // Changer le mot de passe
  changePassword(id: number, passwordData: ChangePasswordRequest): Observable<string> {
    return this.http.put(`${this.apiUrl}/${id}/password`, passwordData, {
      responseType: 'text'
    }).pipe(
      catchError(error => {
        console.error(`Erreur lors du changement de mot de passe pour l'utilisateur ${id}:`, error);
        throw error;
      })
    );
  }

  // Activer un utilisateur
  activateUser(id: number): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/${id}/activate`, {}).pipe(
      catchError(error => {
        console.error(`Erreur lors de l'activation de l'utilisateur ${id}:`, error);
        throw error;
      })
    );
  }

  // Désactiver un utilisateur
  deactivateUser(id: number): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/${id}/deactivate`, {}).pipe(
      catchError(error => {
        console.error(`Erreur lors de la désactivation de l'utilisateur ${id}:`, error);
        throw error;
      })
    );
  }

  // Supprimer (désactiver) un utilisateur
  deleteUser(id: number): Observable<string> {
    return this.http.delete(`${this.apiUrl}/${id}`, {
      responseType: 'text'
    }).pipe(
      catchError(error => {
        console.error(`Erreur lors de la suppression de l'utilisateur ${id}:`, error);
        throw error;
      })
    );
  }

  // ==================== MÉTHODES HIÉRARCHIQUES ====================

  // Récupérer l'arbre hiérarchique complet (SUPER_ADMIN)
  getFullHierarchy(): Observable<UserTree[]> {
    return this.http.get<UserTree[]>(`${this.apiUrl}/full-tree`).pipe(
      catchError(error => {
        console.error('Erreur lors de la récupération de la hiérarchie complète:', error);
        return of([]);
      })
    );
  }

  // Récupérer l'arbre de l'utilisateur connecté
  getMyHierarchy(): Observable<UserTree> {
    return this.http.get<UserTree>(`${this.apiUrl}/my-tree`).pipe(
      catchError(error => {
        console.error('Erreur lors de la récupération de ma hiérarchie:', error);
        throw error;
      })
    );
  }

  // Récupérer l'arbre d'un utilisateur spécifique
  getUserHierarchy(userId: number): Observable<UserTree> {
    return this.http.get<UserTree>(`${this.apiUrl}/tree/${userId}`).pipe(
      catchError(error => {
        console.error(`Erreur lors de la récupération de la hiérarchie de l'utilisateur ${userId}:`, error);
        throw error;
      })
    );
  }

  // Récupérer les enfants directs de l'utilisateur connecté
  getMyChildren(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/my-children`).pipe(
      catchError(error => {
        console.error('Erreur lors de la récupération de mes enfants:', error);
        return of([]);
      })
    );
  }

  // Récupérer les enfants d'un utilisateur
  getUserChildren(userId: number): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/children/${userId}`).pipe(
      catchError(error => {
        console.error(`Erreur lors de la récupération des enfants de l'utilisateur ${userId}:`, error);
        return of([]);
      })
    );
  }

  // Récupérer les utilisateurs visibles
  getViewableUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/viewable`).pipe(
      catchError(error => {
        console.error('Erreur lors de la récupération des utilisateurs visibles:', error);
        return of([]);
      })
    );
  }

  // Récupérer les utilisateurs disponibles pour le partage
  getAvailableForSharing(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/available-for-sharing`).pipe(
      catchError(error => {
        console.error('Erreur lors de la récupération des utilisateurs pour partage:', error);
        return of([]);
      })
    );
  }

  // Vérifier si un rôle peut être créé
  canCreateRole(role: string): Observable<{ canCreate: boolean }> {
    return this.http.get<{ canCreate: boolean }>(`${this.apiUrl}/can-create/${role}`).pipe(
      catchError(error => {
        console.error(`Erreur lors de la vérification du rôle ${role}:`, error);
        return of({ canCreate: false });
      })
    );
  }

  // Récupérer les rôles créables
  getCreatableRoles(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/creatable-roles`).pipe(
      catchError(error => {
        console.error('Erreur lors de la récupération des rôles créables:', error);
        return of([]);
      })
    );
  }

  // Récupérer les utilisateurs par plusieurs rôles
  getUsersByRoles(roles: string[]): Observable<User[]> {
    const params = new HttpParams().set('roles', roles.join(','));
    return this.http.get<User[]>(`${this.apiUrl}/by-roles`, { params }).pipe(
      catchError(error => {
        console.error('Erreur lors de la récupération des utilisateurs par rôles:', error);
        return of([]);
      })
    );
  }

  // ==================== MÉTHODES UTILITAIRES ====================

  // Formater la date
  formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (e) {
      return dateString;
    }
  }

  // Obtenir le texte du rôle
  getRoleText(role: string): string {
    const labels: { [key: string]: string } = {
      'SUPER_ADMIN': 'Super Admin',
      'ADMIN': 'Administrateur',
      'RESPONSABLE_COMMERCIAL': 'Resp. Commercial',
      'COMMERCIAL': 'Commercial',
      'CLIENT': 'Client',
      'AFFILIATE': 'Affilié'
    };
    return labels[role?.toUpperCase()] || role || 'Utilisateur';
  }

  // Obtenir la couleur du rôle
  getRoleColor(role: string): string {
    const colors: { [key: string]: string } = {
      'SUPER_ADMIN': '#dc3545',
      'ADMIN': '#007bff',
      'RESPONSABLE_COMMERCIAL': '#fd7e14',
      'COMMERCIAL': '#28a745',
      'CLIENT': '#17a2b8',
      'AFFILIATE': '#6f42c1'
    };
    return colors[role?.toUpperCase()] || '#6c757d';
  }

  // Obtenir l'icône du rôle
  getRoleIcon(role: string): string {
    const icons: { [key: string]: string } = {
      'SUPER_ADMIN': 'fa-crown',
      'ADMIN': 'fa-user-shield',
      'RESPONSABLE_COMMERCIAL': 'fa-chart-line',
      'COMMERCIAL': 'fa-user-tie',
      'CLIENT': 'fa-user',
      'AFFILIATE': 'fa-handshake'
    };
    return icons[role?.toUpperCase()] || 'fa-user';
  }

  // Obtenir le niveau du rôle
  getRoleLevel(role: string): number {
    const levels: { [key: string]: number } = {
      'SUPER_ADMIN': 5,
      'ADMIN': 4,
      'RESPONSABLE_COMMERCIAL': 3,
      'COMMERCIAL': 2,
      'AFFILIATE': 1,
      'CLIENT': 1
    };
    return levels[role?.toUpperCase()] || 0;
  }

  // Obtenir les initiales
  getInitials(prenom: string, nom: string): string {
    return (prenom?.charAt(0) || '') + (nom?.charAt(0) || '');
  }

  // Vérifier si l'utilisateur a des permissions
  canManageUsers(): boolean {
    const currentUser = this.authService.getCurrentUser();
    return currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN';
  }

  // Valider l'email
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Valider le téléphone (format tunisien/français)
  validatePhone(phone: string): boolean {
    const phoneRegex = /^(?:(?:\+|00)216|0)?[2-9][0-9]{7}$/;
    return phoneRegex.test(phone);
  }

  // Générer un mot de passe aléatoire
  generateRandomPassword(length: number = 12): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}