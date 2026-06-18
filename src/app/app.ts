import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AdminAuthService } from './admin/services/admin-auth';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
 title = 'Maison3D Immobilier';
   isAdminLoggedIn = false;

  constructor(private adminAuth: AdminAuthService) {
    this.isAdminLoggedIn = this.adminAuth.isLoggedIn();
  }
}
