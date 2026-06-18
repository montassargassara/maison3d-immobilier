import { Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.html',
  styleUrls: ['./footer.scss']
})
export class FooterComponent {
  currentYear = new Date().getFullYear();
  
  socialLinks = [
    { icon: 'fa-facebook', url: '#' },
    { icon: 'fa-twitter', url: '#' },
    { icon: 'fa-instagram', url: '#' },
    { icon: 'fa-linkedin', url: '#' },
    { icon: 'fa-youtube', url: '#' }
  ];

  quickLinks = [
    { label: 'Accueil', url: '/' },
    { label: 'À propos', url: '/about' },
    { label: 'Contact', url: '/contact' },
    { label: 'Mentions légales', url: '/legal' },
    { label: 'Confidentialité', url: '/privacy' }
  ];
}