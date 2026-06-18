import { Component } from '@angular/core';

@Component({
  selector: 'app-header',
  templateUrl: './header.html',
  styleUrls: ['./header.scss']
})
export class HeaderComponent {
  menuItems = [
    { label: 'Accueil', icon: 'fa-home', link: '/' },
    { label: 'Explorer', icon: 'fa-compass', link: '/explore' },
    { label: 'Favoris', icon: 'fa-heart', link: '/favorites' },
    { label: 'Visites VR', icon: 'fa-vr-cardboard', link: '/vr' },
    { label: 'À propos', icon: 'fa-info-circle', link: '/about' }
  ];

  isMenuOpen = false;

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }
}