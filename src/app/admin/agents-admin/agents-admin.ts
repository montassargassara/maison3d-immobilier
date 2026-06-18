// agents-admin.component.ts
import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

import { CreateUserRequest, User, UserService, UserTree, UpdateUserRequest } from '../../services/user.service';
import { AdminAuthService } from '../services/admin-auth';
import { UserTreeNodeComponent } from './user-tree-node/user-tree-node';

declare var bootstrap: any;

// ✅ Rôles INTERNES uniquement (pas de CLIENTS)
const INTERNAL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'RESPONSABLE_COMMERCIAL', 'COMMERCIAL'];

@Component({
  selector: 'app-agents-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, UserTreeNodeComponent],
  templateUrl: './agents-admin.html',
  styleUrls: ['./agents-admin.scss']
})
export class AgentsAdmin implements OnInit, OnDestroy, AfterViewInit {
  
  public Math = Math;
  
  // Data - UNIQUEMENT LES AGENTS (pas de clients)
  hierarchyTree: UserTree | null = null;
  users: User[] = [];
  filteredUsers: User[] = [];
  selectedUser: User | null = null;
  currentUser: any = null;
  
  // UI States
  loading = false;
  errorMessage = '';
  successMessage = '';
  
  // Filters
  searchTerm = '';
  roleFilter = '';
  statusFilter = '';
  
  // View mode
  viewMode: 'tree' | 'table' = 'tree';
  
  // Expanded nodes in tree
  expandedNodes: Set<number> = new Set();
  
  // Pagination
  page = 0;
  pageSize = 10;
  
  // Modals
  @ViewChild('createUserModal') createModalElement!: ElementRef;
  @ViewChild('editUserModal') editModalElement!: ElementRef;
  @ViewChild('viewUserModal') viewModalElement!: ElementRef;
  
  private createModal: any;
  private editModal: any;
  private viewModal: any;
  
  // Forms
  userForm: FormGroup;
  editForm: FormGroup;
  
  // Options - UNIQUEMENT LES RÔLES INTERNES
  creatableRoles: string[] = [];
  
  // Password visibility
  showPassword = false;
  generatedPassword = '';
  
  private subscriptions: Subscription[] = [];
  
  constructor(
    private userService: UserService,
    private authService: AdminAuthService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    // Formulaire de création - UNIQUEMENT POUR LES AGENTS
    this.userForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      nom: ['', [Validators.required]],
      prenom: ['', [Validators.required]],
      telephone: ['', [Validators.pattern(/^(?:(?:\+|00)216|0)?[2-9][0-9]{7}$/)]],
      role: ['', [Validators.required]],
      commissionRate: [0, [Validators.min(0), Validators.max(100)]]
    }, { validators: this.passwordMatchValidator.bind(this) });

    // Formulaire d'édition
    this.editForm = this.fb.group({
      nom: ['', [Validators.required]],
      prenom: ['', [Validators.required]],
      telephone: ['', [Validators.pattern(/^(?:(?:\+|00)216|0)?[2-9][0-9]{7}$/)]],
      isActive: [true],
      commissionRate: [0, [Validators.min(0), Validators.max(100)]]
    });
  }
  
  ngOnInit(): void {
    console.log('🟢 AgentsAdmin - Initialisation (gestion agents uniquement)');
    this.currentUser = this.authService.getCurrentUser();
    this.loadHierarchy();
    this.loadCreatableRoles();
    this.cdr.detectChanges();
  }
  
  ngAfterViewInit(): void {
    console.log('🔵 AgentsAdmin - AfterViewInit');
    this.initModals();
    this.cdr.detectChanges();
  }
  
  private initModals(): void {
    if (this.createModalElement) {
      this.createModal = new bootstrap.Modal(this.createModalElement.nativeElement);
    }
    if (this.editModalElement) {
      this.editModal = new bootstrap.Modal(this.editModalElement.nativeElement);
    }
    if (this.viewModalElement) {
      this.viewModal = new bootstrap.Modal(this.viewModalElement.nativeElement);
    }
  }
  
  /**
   * Charge la hiérarchie et FILTRE LES CLIENTS
   */
  loadHierarchy(): void {
    this.loading = true;
    this.cdr.detectChanges();
    
    const sub = this.userService.getMyHierarchy().subscribe({
      next: (tree) => {
        console.log('✅ Hiérarchie brute reçue');
        // ✅ FILTRER L'ARBRE POUR EXCLURE LES CLIENTS
        this.hierarchyTree = this.filterTreeInternalOnly(tree);
        this.loadUsersFromTree(this.hierarchyTree);
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('❌ Erreur chargement hiérarchie:', error);
        this.errorMessage = 'Erreur lors du chargement de la hiérarchie des agents';
        this.loading = false;
        this.cdr.detectChanges();
        this.hideMessageAfterDelay('error');
      }
    });
    
    this.subscriptions.push(sub);
  }
  
  /**
   * ✅ FILTRE RÉCURSIF - Supprime tous les nœuds ayant le rôle CLIENT ou AFFILIATE
   */
  private filterTreeInternalOnly(tree: UserTree): UserTree | null {
    // Si le nœud courant n'est pas un rôle interne (client/affilié), on le supprime
    if (this.isNonStaffRole(tree.user.role)) {
      return null;
    }
    
    // Créer un nouvel arbre avec l'utilisateur courant
    const filteredTree: UserTree = {
      ...tree,
      children: []
    };
    
    // Filtrer récursivement les enfants
    if (tree.children && tree.children.length > 0) {
      for (const child of tree.children) {
        const filteredChild = this.filterTreeInternalOnly(child);
        if (filteredChild !== null) {
          filteredTree.children.push(filteredChild);
        }
      }
    }
    
    return filteredTree;
  }
  
  /**
   * ✅ Allowlist: un nœud est exclu de l'arbre s'il n'est PAS un rôle interne.
   * Exclut donc CLIENT, CLIENT_PUBLIC, AFFILIATE et tout futur rôle non-staff.
   */
  private isNonStaffRole(role: string): boolean {
    const upperRole = role?.toUpperCase() || '';
    return !INTERNAL_ROLES.includes(upperRole);
  }
  
  /**
   * Charge les utilisateurs depuis l'arbre filtré
   */
  loadUsersFromTree(tree: UserTree | null): void {
    this.users = [];
    if (tree) {
      this.flattenTreeFiltered(tree, this.users);
    }
    this.applyFilters();
    this.cdr.detectChanges();
    console.log(`✅ ${this.users.length} agents internes chargés (clients exclus)`);
  }
  
  /**
   * ✅ Aplatit l'arbre en excluant les clients
   */
  flattenTreeFiltered(tree: UserTree, result: User[]): void {
    // Ajouter l'utilisateur seulement s'il s'agit d'un rôle interne (staff)
    if (!this.isNonStaffRole(tree.user.role)) {
      result.push(tree.user);
    }
    
    if (tree.children && tree.children.length > 0) {
      tree.children.forEach(child => this.flattenTreeFiltered(child, result));
    }
  }
  
  /**
   * ✅ Charge les rôles créables - EXCLUT LES CLIENTS
   */
  loadCreatableRoles(): void {
    const sub = this.userService.getCreatableRoles().subscribe({
      next: (roles) => {
        // ✅ Filtrer pour ne garder que les rôles internes (pas CLIENT ou AFFILIATE)
        this.creatableRoles = roles.filter(role => 
          role !== 'CLIENT' && role !== 'AFFILIATE'
        );
        console.log('✅ Rôles agents créables:', this.creatableRoles);
        
        // Si le formulaire a un rôle par défaut, le définir
        if (this.creatableRoles.length > 0 && !this.userForm.get('role')?.value) {
          this.userForm.patchValue({ role: this.creatableRoles[0] });
        }
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('❌ Erreur chargement rôles créables:', error);
      }
    });
    
    this.subscriptions.push(sub);
  }
  
  applyFilters(): void {
    let filtered = [...this.users];
    
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(user =>
        user.email.toLowerCase().includes(term) ||
        user.nom.toLowerCase().includes(term) ||
        user.prenom.toLowerCase().includes(term) ||
        (user.telephone && user.telephone.toLowerCase().includes(term))
      );
    }
    
    if (this.roleFilter) {
      filtered = filtered.filter(user => user.role === this.roleFilter);
    }
    
    if (this.statusFilter) {
      const isActive = this.statusFilter === 'active';
      filtered = filtered.filter(user => user.isActive === isActive);
    }
    
    this.filteredUsers = filtered;
    this.cdr.detectChanges();
  }
  
  resetFilters(): void {
    this.searchTerm = '';
    this.roleFilter = '';
    this.statusFilter = '';
    this.applyFilters();
  }
  
  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'tree' ? 'table' : 'tree';
    this.cdr.detectChanges();
  }
  
  toggleNode(nodeId: number): void {
    if (this.expandedNodes.has(nodeId)) {
      this.expandedNodes.delete(nodeId);
    } else {
      this.expandedNodes.add(nodeId);
    }
    this.cdr.detectChanges();
  }
  
  // Modal methods
  openCreateModal(): void {
    this.resetUserForm();
    this.createModal?.show();
    this.cdr.detectChanges();
  }
  
  closeCreateModal(): void {
    this.createModal?.hide();
    this.cdr.detectChanges();
  }
  
  openEditModal(user: User): void {
    this.selectedUser = user;
    this.editForm.patchValue({
      nom: user.nom,
      prenom: user.prenom,
      telephone: user.telephone || '',
      isActive: user.isActive,
      commissionRate: user.commissionRate ?? 0
    });
    this.editModal?.show();
    this.cdr.detectChanges();
  }
  
  closeEditModal(): void {
    this.editModal?.hide();
    this.selectedUser = null;
    this.cdr.detectChanges();
  }
  
  openViewModal(user: User): void {
    this.selectedUser = user;
    this.viewModal?.show();
    this.cdr.detectChanges();
  }
  
  closeViewModal(): void {
    this.viewModal?.hide();
    this.selectedUser = null;
    this.cdr.detectChanges();
  }
  
  // CRUD operations - UNIQUEMENT POUR LES AGENTS
  createUser(): void {
    if (this.userForm.invalid) {
      this.markFormGroupTouched(this.userForm);
      this.cdr.detectChanges();
      return;
    }
    
    this.loading = true;
    this.cdr.detectChanges();
    
    const request: CreateUserRequest = {
      email: this.userForm.get('email')?.value,
      password: this.userForm.get('password')?.value,
      nom: this.userForm.get('nom')?.value,
      prenom: this.userForm.get('prenom')?.value,
      telephone: this.userForm.get('telephone')?.value || undefined,
      role: this.userForm.get('role')?.value,
      commissionRate: this.isStaffRole(this.userForm.get('role')?.value)
        ? Number(this.userForm.get('commissionRate')?.value) || 0
        : undefined
    };
    
    const sub = this.userService.createUserWithHierarchy(request).subscribe({
      next: (newUser) => {
        this.successMessage = `Agent ${newUser.prenom} ${newUser.nom} créé avec succès`;
        this.loadHierarchy();
        this.closeCreateModal();
        this.loading = false;
        this.cdr.detectChanges();
        this.hideMessageAfterDelay('success');
      },
      error: (error) => {
        console.error('Erreur création agent:', error);
        this.errorMessage = error.error?.message || 'Erreur lors de la création de l\'agent';
        this.loading = false;
        this.cdr.detectChanges();
        this.hideMessageAfterDelay('error');
      }
    });
    
    this.subscriptions.push(sub);
  }
  
  updateUser(): void {
    if (!this.selectedUser || this.editForm.invalid) {
      this.markFormGroupTouched(this.editForm);
      this.cdr.detectChanges();
      return;
    }
    
    this.loading = true;
    this.cdr.detectChanges();
    
    const request: UpdateUserRequest = {
      nom: this.editForm.get('nom')?.value,
      prenom: this.editForm.get('prenom')?.value,
      telephone: this.editForm.get('telephone')?.value || undefined,
      isActive: this.editForm.get('isActive')?.value,
      commissionRate: this.isStaffRole(this.selectedUser.role)
        ? Number(this.editForm.get('commissionRate')?.value) || 0
        : undefined
    };
    
    const sub = this.userService.updateUser(this.selectedUser.id, request).subscribe({
      next: (updatedUser) => {
        this.successMessage = `Agent ${updatedUser.prenom} ${updatedUser.nom} mis à jour avec succès`;
        this.loadHierarchy();
        this.closeEditModal();
        this.loading = false;
        this.cdr.detectChanges();
        this.hideMessageAfterDelay('success');
      },
      error: (error) => {
        console.error('Erreur mise à jour agent:', error);
        this.errorMessage = error.error?.message || 'Erreur lors de la mise à jour';
        this.loading = false;
        this.cdr.detectChanges();
        this.hideMessageAfterDelay('error');
      }
    });
    
    this.subscriptions.push(sub);
  }
  
  // Utility methods
  generatePassword(): void {
    this.generatedPassword = this.userService.generateRandomPassword();
    this.userForm.patchValue({
      password: this.generatedPassword,
      confirmPassword: this.generatedPassword
    });
    this.showPassword = true;
    this.cdr.detectChanges();
  }
  
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
    this.cdr.detectChanges();
  }
  
  resetUserForm(): void {
    this.userForm.reset({
      role: this.creatableRoles[0] || ''
    });
    this.generatedPassword = '';
    this.showPassword = false;
    this.cdr.detectChanges();
  }
  
  passwordMatchValidator(form: FormGroup): { [key: string]: boolean } | null {
    const password = form.get('password')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
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
      this.cdr.detectChanges();
    }, 5000);
  }
  
  // Display helpers
  formatDate(dateString: string): string {
    return this.userService.formatDate(dateString);
  }
  
  getRoleColor(role: string): string {
    return this.userService.getRoleColor(role);
  }
  
  getRoleIcon(role: string): string {
    return this.userService.getRoleIcon(role);
  }
  
  getRoleLabel(role: string): string {
    return this.userService.getRoleText(role);
  }

  isStaffRole(role: string | undefined | null): boolean {
    return role === 'COMMERCIAL' || role === 'RESPONSABLE_COMMERCIAL';
  }
  
  getInitials(prenom: string, nom: string): string {
    return this.userService.getInitials(prenom, nom);
  }
  
  /**
   * ✅ STATISTIQUES - Uniquement sur les agents internes (pas de clients)
   */
  getStats(): any {
    const stats: any = {
      totalUsers: 0,
      byRole: {}
    };
    
    // Initialiser les compteurs pour chaque rôle interne
    INTERNAL_ROLES.forEach(role => {
      stats.byRole[role] = 0;
    });
    
    this.users.forEach(user => {
      // Ne compter que les rôles internes
      if (INTERNAL_ROLES.includes(user.role)) {
        stats.totalUsers++;
        stats.byRole[user.role] = (stats.byRole[user.role] || 0) + 1;
      }
    });
    
    return stats;
  }
  
  changePage(newPage: number): void {
    this.page = newPage;
    this.cdr.detectChanges();
  }
  
  changePageSize(newSize: number): void {
    this.pageSize = newSize;
    this.page = 0;
    this.cdr.detectChanges();
  }
  
  ngOnDestroy(): void {
    console.log('🔴 AgentsAdmin - Destruction');
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}