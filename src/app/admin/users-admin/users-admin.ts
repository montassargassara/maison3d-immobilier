// admin/users-admin/users-admin.ts
import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';  // ← Ajoute ChangeDetectorRef
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

import { UserService, User, CreateUserRequest, UpdateUserRequest, ChangePasswordRequest } from '../../services/user.service';
import { AdminAuthService } from '../services/admin-auth';

declare var bootstrap: any;

@Component({
  selector: 'app-users-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './users-admin.html',
  styleUrls: ['./users-admin.scss']
})
export class UsersAdmin implements OnInit, OnDestroy, AfterViewInit {
  public Math = Math;
  // Données
  users: User[] = [];
  filteredUsers: User[] = [];
  selectedUser: User | null = null;
  currentUser: any = null;
  
  // États
  loading = false;
  errorMessage = '';
  successMessage = '';
  
  // Filtres
  searchTerm = '';
  roleFilter = '';
  statusFilter = '';
  sortField = 'createdAt';
  sortDirection: 'asc' | 'desc' = 'desc';
  
  // Pagination
  page = 1;
  pageSize = 10;
  collectionSize = 0;
  
  // Modales
  @ViewChild('createModal') createModalElement!: ElementRef;
  @ViewChild('editModal') editModalElement!: ElementRef;
  @ViewChild('passwordModal') passwordModalElement!: ElementRef;
  
  private createModal: any;
  private editModal: any;
  private passwordModal: any;
  
  // Dropdown (géré manuellement)
  activeDropdown: HTMLElement | null = null;
  
  // Formulaires
  userForm: FormGroup;
  editForm: FormGroup;
  passwordForm: FormGroup;
  showPassword = false;
  generatedPassword = '';
  
  // Abonnements
  private subscriptions: Subscription[] = [];

  constructor(
    private userService: UserService,
    private authService: AdminAuthService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef  // ← AJOUTE CETTE LIGNE
  ) {
    // Formulaire de création
    this.userForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      nom: ['', [Validators.required]],
      prenom: ['', [Validators.required]],
      telephone: ['', [Validators.pattern(/^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/)]],
      role: ['COMMERCIAL', [Validators.required]]
    }, { validators: this.passwordMatchValidator });

    // Formulaire d'édition
    this.editForm = this.fb.group({
      nom: ['', [Validators.required]],
      prenom: ['', [Validators.required]],
      telephone: ['', [Validators.pattern(/^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/)]],
      isActive: [true]
    });

    // Formulaire de changement de mot de passe
    this.passwordForm = this.fb.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmNewPassword: ['', [Validators.required]]
    }, { validators: this.newPasswordMatchValidator });
  }

  ngOnInit(): void {
    console.log('🟢 UsersAdmin - Initialisation');
    this.currentUser = this.authService.getCurrentUser();
    this.loadUsers();
    this.cdr.detectChanges();  // ← FORCE L'AFFICHAGE INITIAL
  }

  ngAfterViewInit(): void {
    console.log('🔵 UsersAdmin - AfterViewInit');
    // Initialiser les modales Bootstrap
    if (this.createModalElement) {
      this.createModal = new bootstrap.Modal(this.createModalElement.nativeElement);
    }
    if (this.editModalElement) {
      this.editModal = new bootstrap.Modal(this.editModalElement.nativeElement);
    }
    if (this.passwordModalElement) {
      this.passwordModal = new bootstrap.Modal(this.passwordModalElement.nativeElement);
    }
    this.cdr.detectChanges();  // ← FORCE L'AFFICHAGE APRÈS INIT DES MODALES
  }

  loadUsers(): void {
    console.log('🟢 loadUsers - Début du chargement');
    this.loading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();  // ← FORCE L'AFFICHAGE PENDANT LE CHARGEMENT

    const usersSub = this.userService.getAllUsers().subscribe({
      next: (users) => {
        console.log('✅ Utilisateurs reçus:', users.length);
        this.users = users;
        this.applyFilters();
        this.loading = false;
        this.cdr.detectChanges();  // ← FORCE L'AFFICHAGE APRÈS CHARGEMENT
        console.log('✅ Affichage forcé avec detectChanges()');
      },
      error: (error) => {
        console.error('Erreur lors du chargement des utilisateurs:', error);
        this.errorMessage = 'Erreur lors du chargement des utilisateurs';
        this.loading = false;
        this.cdr.detectChanges();  // ← FORCE L'AFFICHAGE EN ERREUR
      }
    });

    this.subscriptions.push(usersSub);
  }

  applyFilters(): void {
    console.log('🟢 applyFilters - Application des filtres');
    let filtered = [...this.users];

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(user =>
        user.email.toLowerCase().includes(term) ||
        user.nom.toLowerCase().includes(term) ||
        user.prenom.toLowerCase().includes(term) ||
        user.telephone?.toLowerCase().includes(term) ||
        this.userService.getRoleText(user.role).toLowerCase().includes(term)
      );
    }

    if (this.roleFilter) {
      filtered = filtered.filter(user => user.role === this.roleFilter);
    }

    if (this.statusFilter === 'active') {
      filtered = filtered.filter(user => user.isActive);
    } else if (this.statusFilter === 'inactive') {
      filtered = filtered.filter(user => !user.isActive);
    }

    filtered.sort((a, b) => {
      let aValue: any = a[this.sortField as keyof User];
      let bValue: any = b[this.sortField as keyof User];

      if (this.sortField === 'createdAt' || this.sortField === 'updatedAt') {
        aValue = new Date(aValue || 0).getTime();
        bValue = new Date(bValue || 0).getTime();
      }

      if (aValue < bValue) return this.sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    this.filteredUsers = filtered;
    this.collectionSize = filtered.length;
    this.page = 1;
    this.cdr.detectChanges();  // ← FORCE L'AFFICHAGE APRÈS FILTRAGE
  }

  get paginatedUsers(): User[] {
    const startIndex = (this.page - 1) * this.pageSize;
    return this.filteredUsers.slice(startIndex, startIndex + this.pageSize);
  }

  sort(field: string): void {
    console.log('🟢 sort - Tri par:', field);
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.applyFilters();
  }

  getSortIcon(field: string): string {
    if (this.sortField !== field) return 'fas fa-sort';
    return this.sortDirection === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
  }

  // Gestion des dropdowns
  toggleDropdown(event: MouseEvent, dropdownId: string): void {
    event.stopPropagation();
    const dropdown = document.getElementById(dropdownId);
    if (dropdown) {
      if (this.activeDropdown && this.activeDropdown !== dropdown) {
        this.activeDropdown.classList.remove('show');
      }
      dropdown.classList.toggle('show');
      this.activeDropdown = dropdown.classList.contains('show') ? dropdown : null;
    }
    this.cdr.detectChanges();  // ← FORCE L'AFFICHAGE APRÈS TOGGLE DROPDOWN
  }

  closeDropdowns(): void {
    if (this.activeDropdown) {
      this.activeDropdown.classList.remove('show');
      this.activeDropdown = null;
    }
    this.cdr.detectChanges();  // ← FORCE L'AFFICHAGE APRÈS FERMETURE DROPDOWN
  }

  // Gestion des modales
  openCreateModal(): void {
    this.resetUserForm();
    this.createModal?.show();
    this.cdr.detectChanges();  // ← FORCE L'AFFICHAGE DE LA MODALE
  }

  closeCreateModal(): void {
    this.createModal?.hide();
    this.cdr.detectChanges();  // ← FORCE L'AFFICHAGE APRÈS FERMETURE
  }

  openEditModal(user: User): void {
    this.selectedUser = user;
    this.editForm.patchValue({
      nom: user.nom,
      prenom: user.prenom,
      telephone: user.telephone || '',
      isActive: user.isActive
    });
    this.editModal?.show();
    this.cdr.detectChanges();  // ← FORCE L'AFFICHAGE DE LA MODALE
  }

  closeEditModal(): void {
    this.editModal?.hide();
    this.selectedUser = null;
    this.cdr.detectChanges();  // ← FORCE L'AFFICHAGE APRÈS FERMETURE
  }

  openPasswordModal(user: User): void {
    this.selectedUser = user;
    this.resetPasswordForm();
    this.passwordModal?.show();
    this.cdr.detectChanges();  // ← FORCE L'AFFICHAGE DE LA MODALE
  }

  closePasswordModal(): void {
    this.passwordModal?.hide();
    this.selectedUser = null;
    this.cdr.detectChanges();  // ← FORCE L'AFFICHAGE APRÈS FERMETURE
  }

  // Méthodes CRUD
  createUser(): void {
    if (this.userForm.invalid) {
      this.markFormGroupTouched(this.userForm);
      this.cdr.detectChanges();  // ← FORCE L'AFFICHAGE DES ERREURS
      return;
    }

    this.loading = true;
    this.cdr.detectChanges();  // ← FORCE L'AFFICHAGE PENDANT LA CRÉATION
    
    const formValue = this.userForm.value;
    
    const userData: CreateUserRequest = {
      email: formValue.email,
      password: formValue.password,
      nom: formValue.nom,
      prenom: formValue.prenom,
      telephone: formValue.telephone || undefined,
      role: formValue.role
    };

    let createObservable;
    
    if (formValue.role === 'ADMIN') {
      createObservable = this.userService.createAdmin(userData);
    } else if (formValue.role === 'RESPONSABLE_COMMERCIAL') {
      createObservable = this.userService.createResponsable(userData);
    } else {
      createObservable = this.userService.createUser(userData);
    }

    const createSub = createObservable.subscribe({
      next: (newUser) => {
        this.successMessage = `Utilisateur ${newUser.email} créé avec succès`;
        this.loadUsers();
        this.resetUserForm();
        this.closeCreateModal();
        this.loading = false;
        this.cdr.detectChanges();  // ← FORCE L'AFFICHAGE APRÈS CRÉATION
        this.hideMessageAfterDelay('success');
      },
      error: (error) => {
        console.error('Erreur lors de la création:', error);
        this.errorMessage = error.error?.message || 'Erreur lors de la création de l\'utilisateur';
        this.loading = false;
        this.cdr.detectChanges();  // ← FORCE L'AFFICHAGE DE L'ERREUR
        this.hideMessageAfterDelay('error');
      }
    });

    this.subscriptions.push(createSub);
  }

  updateUser(): void {
    if (!this.selectedUser || this.editForm.invalid) {
      this.markFormGroupTouched(this.editForm);
      this.cdr.detectChanges();  // ← FORCE L'AFFICHAGE DES ERREURS
      return;
    }

    this.loading = true;
    this.cdr.detectChanges();  // ← FORCE L'AFFICHAGE PENDANT LA MISE À JOUR
    
    const formValue = this.editForm.value;
    
    const userData: UpdateUserRequest = {
      nom: formValue.nom,
      prenom: formValue.prenom,
      telephone: formValue.telephone || undefined,
      isActive: formValue.isActive
    };

    const updateSub = this.userService.updateUser(this.selectedUser.id, userData).subscribe({
      next: (updatedUser) => {
        this.successMessage = `Utilisateur ${updatedUser.email} mis à jour avec succès`;
        this.loadUsers();
        this.closeEditModal();
        this.loading = false;
        this.cdr.detectChanges();  // ← FORCE L'AFFICHAGE APRÈS MISE À JOUR
        this.hideMessageAfterDelay('success');
      },
      error: (error) => {
        console.error('Erreur lors de la mise à jour:', error);
        this.errorMessage = error.error?.message || 'Erreur lors de la mise à jour';
        this.loading = false;
        this.cdr.detectChanges();  // ← FORCE L'AFFICHAGE DE L'ERREUR
        this.hideMessageAfterDelay('error');
      }
    });

    this.subscriptions.push(updateSub);
  }

  changePassword(): void {
    if (!this.selectedUser || this.passwordForm.invalid) {
      this.markFormGroupTouched(this.passwordForm);
      this.cdr.detectChanges();  // ← FORCE L'AFFICHAGE DES ERREURS
      return;
    }

    this.loading = true;
    this.cdr.detectChanges();  // ← FORCE L'AFFICHAGE PENDANT LE CHANGEMENT
    
    const formValue = this.passwordForm.value;
    
    const passwordData: ChangePasswordRequest = {
      currentPassword: formValue.currentPassword,
      newPassword: formValue.newPassword
    };

    const passwordSub = this.userService.changePassword(this.selectedUser.id, passwordData).subscribe({
      next: (message) => {
        this.successMessage = message;
        this.resetPasswordForm();
        this.closePasswordModal();
        this.loading = false;
        this.cdr.detectChanges();  // ← FORCE L'AFFICHAGE APRÈS CHANGEMENT
        this.hideMessageAfterDelay('success');
      },
      error: (error) => {
        console.error('Erreur lors du changement de mot de passe:', error);
        this.errorMessage = error.error?.message || 'Erreur lors du changement de mot de passe';
        this.loading = false;
        this.cdr.detectChanges();  // ← FORCE L'AFFICHAGE DE L'ERREUR
        this.hideMessageAfterDelay('error');
      }
    });

    this.subscriptions.push(passwordSub);
  }

  toggleUserStatus(user: User): void {
    if (!confirm(`Voulez-vous vraiment ${user.isActive ? 'désactiver' : 'activer'} cet utilisateur ?`)) {
      return;
    }

    this.loading = true;
    this.cdr.detectChanges();  // ← FORCE L'AFFICHAGE PENDANT LE CHANGEMENT
    
    const toggleSub = (user.isActive 
      ? this.userService.deactivateUser(user.id)
      : this.userService.activateUser(user.id)
    ).subscribe({
      next: (updatedUser) => {
        this.successMessage = `Utilisateur ${updatedUser.isActive ? 'activé' : 'désactivé'} avec succès`;
        this.loadUsers();
        this.loading = false;
        this.cdr.detectChanges();  // ← FORCE L'AFFICHAGE APRÈS CHANGEMENT
        this.hideMessageAfterDelay('success');
      },
      error: (error) => {
        console.error('Erreur lors du changement de statut:', error);
        this.errorMessage = error.error?.message || 'Erreur lors du changement de statut';
        this.loading = false;
        this.cdr.detectChanges();  // ← FORCE L'AFFICHAGE DE L'ERREUR
        this.hideMessageAfterDelay('error');
      }
    });

    this.subscriptions.push(toggleSub);
  }

  deleteUser(user: User): void {
    if (!confirm(`Voulez-vous vraiment supprimer l'utilisateur ${user.email} ?`)) {
      return;
    }

    this.loading = true;
    this.cdr.detectChanges();  // ← FORCE L'AFFICHAGE PENDANT LA SUPPRESSION
    
    const deleteSub = this.userService.deleteUser(user.id).subscribe({
      next: (message) => {
        this.successMessage = message;
        this.loadUsers();
        this.loading = false;
        this.cdr.detectChanges();  // ← FORCE L'AFFICHAGE APRÈS SUPPRESSION
        this.hideMessageAfterDelay('success');
      },
      error: (error) => {
        console.error('Erreur lors de la suppression:', error);
        this.errorMessage = error.error?.message || 'Erreur lors de la suppression';
        this.loading = false;
        this.cdr.detectChanges();  // ← FORCE L'AFFICHAGE DE L'ERREUR
        this.hideMessageAfterDelay('error');
      }
    });

    this.subscriptions.push(deleteSub);
  }

  // Méthodes utilitaires
  generatePassword(): void {
    this.generatedPassword = this.userService.generateRandomPassword();
    this.userForm.patchValue({
      password: this.generatedPassword,
      confirmPassword: this.generatedPassword
    });
    this.showPassword = true;
    this.cdr.detectChanges();  // ← FORCE L'AFFICHAGE DU MOT DE PASSE GÉNÉRÉ
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
    this.cdr.detectChanges();  // ← FORCE L'AFFICHAGE APRÈS TOGGLE
  }

  resetUserForm(): void {
    this.userForm.reset({
      role: 'COMMERCIAL'
    });
    this.generatedPassword = '';
    this.showPassword = false;
    this.cdr.detectChanges();  // ← FORCE L'AFFICHAGE APRÈS RESET
  }

  resetPasswordForm(): void {
    this.passwordForm.reset();
    this.cdr.detectChanges();  // ← FORCE L'AFFICHAGE APRÈS RESET
  }

  passwordMatchValidator(form: FormGroup): { [key: string]: boolean } | null {
    const password = form.get('password')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  newPasswordMatchValidator(form: FormGroup): { [key: string]: boolean } | null {
    const newPassword = form.get('newPassword')?.value;
    const confirmNewPassword = form.get('confirmNewPassword')?.value;
    return newPassword === confirmNewPassword ? null : { newPasswordMismatch: true };
  }

  markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  hideMessageAfterDelay(type: 'success' | 'error'): void {
    setTimeout(() => {
      if (type === 'success') {
        this.successMessage = '';
      } else {
        this.errorMessage = '';
      }
      this.cdr.detectChanges();  // ← FORCE L'AFFICHAGE APRÈS EFFACEMENT DES MESSAGES
    }, 5000);
  }

  formatDate(dateString: string): string {
    return this.userService.formatDate(dateString);
  }

  getRoleText(role: string): string {
    return this.userService.getRoleText(role);
  }

  getRoleColor(role: string): string {
    return this.userService.getRoleColor(role);
  }

  getInitials(prenom: string, nom: string): string {
    return this.userService.getInitials(prenom, nom);
  }

  get stats() {
    const total = this.users.length;
    const active = this.users.filter(u => u.isActive).length;
    const inactive = total - active;
    
    const rolesCount: { [key: string]: number } = {};
    this.users.forEach(user => {
      rolesCount[user.role] = (rolesCount[user.role] || 0) + 1;
    });

    return { total, active, inactive, rolesCount };
  }

  ngOnDestroy(): void {
    console.log('🔴 UsersAdmin - Destruction');
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.closeDropdowns();
  }
}