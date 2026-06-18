import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SafeUrl } from '@angular/platform-browser';
import { ProfileService, UserProfileDTO } from '../services/profile.service';
import { AdminAuthService } from '../services/admin-auth';

type Tab = 'profil' | 'securite' | 'avatar';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  activeTab: Tab = 'profil';
  profile: UserProfileDTO | null = null;
  loading = true;

  profileForm = { prenom: '', nom: '', email: '', telephone: '' };
  profileSaving = false;
  profileSuccess = '';
  profileError = '';

  passwordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };
  passwordSaving = false;
  passwordSuccess = '';
  passwordError = '';
  showCurrent = false;
  showNew = false;
  showConfirm = false;

  avatarBlobUrl: SafeUrl | null = null;
  private _blobObjectUrl: string | null = null;

  previewUrl: string | null = null;
  selectedFile: File | null = null;
  avatarUploading = false;
  avatarSuccess = '';
  avatarError = '';
  avatarDeleting = false;

  constructor(
    private profileService: ProfileService,
    private authService: AdminAuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.profileService.getProfile().subscribe({
      next: (p) => {
        this.profile = p;
        this.profileForm = {
          prenom: p.prenom,
          nom: p.nom,
          email: p.email,
          telephone: p.telephone || '',
        };
        this.loading = false;
        if (p.avatarUrl) this.loadAvatarBlob(p.avatarUrl);
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  ngOnDestroy(): void {
    if (this._blobObjectUrl) URL.revokeObjectURL(this._blobObjectUrl);
  }

  private loadAvatarBlob(avatarUrl: string): void {
    this.profileService.fetchAvatarBlob(avatarUrl).subscribe({
      next: (safeUrl) => {
        this.avatarBlobUrl = safeUrl;
        this.cdr.markForCheck();
      },
      error: () => { this.avatarBlobUrl = null; }
    });
  }

  setTab(tab: Tab): void {
    this.activeTab = tab;
    this.profileSuccess = '';
    this.profileError = '';
    this.passwordSuccess = '';
    this.passwordError = '';
    this.avatarSuccess = '';
    this.avatarError = '';
  }

  // ── Profile ───────────────────────────────────────────────────────────────

  saveProfile(): void {
    if (this.profileSaving) return;
    this.profileSuccess = '';
    this.profileError = '';
    this.profileSaving = true;

    this.profileService.updateProfile({
      prenom: this.profileForm.prenom.trim(),
      nom: this.profileForm.nom.trim(),
      email: this.profileForm.email.trim(),
      telephone: this.profileForm.telephone?.trim() || undefined,
    }).subscribe({
      next: (updated) => {
        this.profile = updated;
        this.profileSuccess = 'Profil mis à jour avec succès.';
        this.profileSaving = false;
        this.authService.updateCurrentUser({
          prenom: updated.prenom,
          nom: updated.nom,
          email: updated.email,
          telephone: updated.telephone,
        });
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.profileError = err?.error?.error || 'Erreur lors de la mise à jour.';
        this.profileSaving = false;
        this.cdr.markForCheck();
      },
    });
  }

  // ── Password ──────────────────────────────────────────────────────────────

  get passwordStrength(): number {
    const pw = this.passwordForm.newPassword;
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
  }

  get passwordStrengthLabel(): string {
    const s = this.passwordStrength;
    if (s === 0) return '';
    if (s === 1) return 'Faible';
    if (s === 2) return 'Moyen';
    if (s === 3) return 'Fort';
    return 'Très fort';
  }

  get passwordStrengthClass(): string {
    const s = this.passwordStrength;
    if (s === 1) return 'weak';
    if (s === 2) return 'medium';
    if (s === 3) return 'strong';
    if (s === 4) return 'very-strong';
    return '';
  }

  get passwordsMatch(): boolean {
    return (
      !!this.passwordForm.newPassword &&
      this.passwordForm.newPassword === this.passwordForm.confirmPassword
    );
  }

  savePassword(): void {
    if (this.passwordSaving) return;
    this.passwordSuccess = '';
    this.passwordError = '';

    if (!this.passwordsMatch) {
      this.passwordError = 'Les mots de passe ne correspondent pas.';
      return;
    }
    if (this.passwordStrength < 2) {
      this.passwordError = 'Le mot de passe est trop faible.';
      return;
    }

    this.passwordSaving = true;
    this.profileService.changePassword(this.passwordForm).subscribe({
      next: () => {
        this.passwordSuccess = 'Mot de passe modifié avec succès.';
        this.passwordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };
        this.passwordSaving = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.passwordError = err?.error?.error || 'Erreur lors du changement de mot de passe.';
        this.passwordSaving = false;
        this.cdr.markForCheck();
      },
    });
  }

  // ── Avatar ────────────────────────────────────────────────────────────────

  get currentAvatarUrl(): SafeUrl | null {
    return this.avatarBlobUrl;
  }

  get userInitials(): string {
    const u = this.authService.getCurrentUser();
    const p = this.profile?.prenom || u?.prenom || '';
    const n = this.profile?.nom || u?.nom || '';
    return ((p.charAt(0) || '') + (n.charAt(0) || '')).toUpperCase() || '?';
  }

  triggerFileInput(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.avatarError = '';
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      this.avatarError = 'Format non autorisé. Utilisez JPG, PNG ou WEBP.';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.avatarError = "L'image ne doit pas dépasser 5 MB.";
      return;
    }

    this.selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.previewUrl = e.target?.result as string;
      this.cdr.markForCheck();
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  cancelPreview(): void {
    this.previewUrl = null;
    this.selectedFile = null;
    this.avatarError = '';
  }

  uploadAvatar(): void {
    if (!this.selectedFile || this.avatarUploading) return;
    this.avatarUploading = true;
    this.avatarSuccess = '';
    this.avatarError = '';

    this.profileService.uploadAvatar(this.selectedFile).subscribe({
      next: (updated) => {
        this.profile = updated;
        this.previewUrl = null;
        this.selectedFile = null;
        this.avatarSuccess = 'Avatar mis à jour avec succès.';
        this.avatarUploading = false;
        this.authService.updateCurrentUser({ avatarUrl: updated.avatarUrl });
        if (updated.avatarUrl) this.loadAvatarBlob(updated.avatarUrl);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.avatarError = err?.error?.error || "Erreur lors de l'upload.";
        this.avatarUploading = false;
        this.cdr.markForCheck();
      },
    });
  }

  deleteAvatar(): void {
    if (this.avatarDeleting) return;
    this.avatarDeleting = true;
    this.avatarSuccess = '';
    this.avatarError = '';

    this.profileService.deleteAvatar().subscribe({
      next: () => {
        if (this.profile) this.profile.avatarUrl = undefined;
        this.avatarBlobUrl = null;
        this.avatarSuccess = 'Avatar supprimé.';
        this.avatarDeleting = false;
        this.authService.updateCurrentUser({ avatarUrl: undefined });
        this.cdr.markForCheck();
      },
      error: () => {
        this.avatarError = 'Erreur lors de la suppression.';
        this.avatarDeleting = false;
        this.cdr.markForCheck();
      },
    });
  }

  formatRole(role: string): string {
    const map: Record<string, string> = {
      SUPER_ADMIN: 'Super Administrateur',
      ADMIN: 'Administrateur',
      RESPONSABLE_COMMERCIAL: 'Responsable Commercial',
      COMMERCIAL: 'Commercial',
      AFFILIATE: 'Affilié',
    };
    return map[role] || role;
  }
}
