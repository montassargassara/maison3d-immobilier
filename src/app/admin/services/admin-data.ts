// services/admin-data.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { delay, map } from 'rxjs/operators';

export interface AdminStats {
  totalProperties: number;
  availableProperties: number;
  soldProperties: number;
  reservedProperties: number;
  totalUsers: number;
  activeUsers: number;
  totalAgents: number;
  monthlyRevenue: number;
  yearlyRevenue: number;
  popularAreas: Array<{ area: string; count: number }>;
  propertyTypes: Array<{ type: string; count: number }>;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'client' | 'agent' | 'admin';
  status: 'active' | 'inactive' | 'suspended';
  registrationDate: Date;
  lastLogin?: Date;
  favorites: string[];
  viewedProperties: string[];
}

export interface SystemLog {
  id: string;
  timestamp: Date;
  user: string;
  action: string;
  details: string;
  ipAddress?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminDataService {
  private statsSubject = new BehaviorSubject<AdminStats>(this.generateStats());
  private usersSubject = new BehaviorSubject<AdminUser[]>(this.generateUsers());
  private logsSubject = new BehaviorSubject<SystemLog[]>(this.generateLogs());

  constructor() {}

  // Statistiques
  getStats(): Observable<AdminStats> {
    return this.statsSubject.asObservable().pipe(delay(300));
  }

  updateStats(): void {
    this.statsSubject.next(this.generateStats());
  }

  // Utilisateurs
  getUsers(): Observable<AdminUser[]> {
    return this.usersSubject.asObservable().pipe(delay(300));
  }

  getUserById(id: string): Observable<AdminUser | undefined> {
    return this.usersSubject.pipe(
      map(users => users.find(user => user.id === id))
    );
  }

  updateUser(id: string, updates: Partial<AdminUser>): Observable<boolean> {
    const users = this.usersSubject.value;
    const index = users.findIndex(user => user.id === id);
    
    if (index !== -1) {
      users[index] = { ...users[index], ...updates };
      this.usersSubject.next([...users]);
      this.logAction('UPDATE_USER', `Utilisateur ${id} mis à jour`);
      return of(true).pipe(delay(300));
    }
    
    return of(false).pipe(delay(300));
  }

  deleteUser(id: string): Observable<boolean> {
    const users = this.usersSubject.value;
    const filteredUsers = users.filter(user => user.id !== id);
    
    if (filteredUsers.length !== users.length) {
      this.usersSubject.next(filteredUsers);
      this.logAction('DELETE_USER', `Utilisateur ${id} supprimé`);
      return of(true).pipe(delay(300));
    }
    
    return of(false).pipe(delay(300));
  }

  // Logs système
  getLogs(limit: number = 50): Observable<SystemLog[]> {
    return this.logsSubject.pipe(
      map(logs => logs.slice(0, limit)),
      delay(300)
    );
  }

  logAction(action: string, details: string): void {
    const logs = this.logsSubject.value;
    const newLog: SystemLog = {
      id: Date.now().toString(),
      timestamp: new Date(),
      user: 'admin',
      action,
      details,
      ipAddress: '127.0.0.1'
    };
    
    this.logsSubject.next([newLog, ...logs.slice(0, 99)]);
  }

  // Données générées pour la démo
  private generateStats(): AdminStats {
    return {
      totalProperties: 156,
      availableProperties: 89,
      soldProperties: 45,
      reservedProperties: 22,
      totalUsers: 2345,
      activeUsers: 1890,
      totalAgents: 24,
      monthlyRevenue: 1250000,
      yearlyRevenue: 15600000,
      popularAreas: [
        { area: 'Paris 16e', count: 32 },
        { area: 'Lyon', count: 28 },
        { area: 'Bordeaux', count: 24 },
        { area: 'Marseille', count: 21 },
        { area: 'Toulouse', count: 18 }
      ],
      propertyTypes: [
        { type: 'house', count: 78 },
        { type: 'apartment', count: 54 },
        { type: 'villa', count: 15 },
        { type: 'commercial', count: 7 },
        { type: 'loft', count: 2 }
      ]
    };
  }

  private generateUsers(): AdminUser[] {
    const users: AdminUser[] = [];
    const names = ['Jean Dupont', 'Marie Martin', 'Pierre Bernard', 'Sophie Petit', 
                   'Luc Durand', 'Julie Moreau', 'Paul Simon', 'Claire Laurent'];
    
    for (let i = 1; i <= 50; i++) {
      const name = names[Math.floor(Math.random() * names.length)];
      users.push({
        id: `user-${i}`,
        name: `${name} ${i}`,
        email: `user${i}@example.com`,
        phone: `06${Math.floor(Math.random() * 100000000)}`.padEnd(10, '0'),
        role: Math.random() > 0.1 ? 'client' : 'agent',
        status: Math.random() > 0.2 ? 'active' : (Math.random() > 0.5 ? 'inactive' : 'suspended'),
        registrationDate: new Date(Date.now() - Math.random() * 31536000000), // Dernière année
        lastLogin: new Date(Date.now() - Math.random() * 86400000), // Dernières 24h
        favorites: Array.from({ length: Math.floor(Math.random() * 10) }, 
          () => `property-${Math.floor(Math.random() * 156)}`),
        viewedProperties: Array.from({ length: Math.floor(Math.random() * 20) }, 
          () => `property-${Math.floor(Math.random() * 156)}`)
      });
    }
    
    return users;
  }

  private generateLogs(): SystemLog[] {
    const logs: SystemLog[] = [];
    const actions = ['LOGIN', 'LOGOUT', 'CREATE_PROPERTY', 'UPDATE_PROPERTY', 
                     'DELETE_PROPERTY', 'UPDATE_USER', 'DELETE_USER', 'VIEW_STATS'];
    const users = ['admin', 'editor', 'moderator'];
    
    for (let i = 0; i < 100; i++) {
      logs.push({
        id: `log-${i}`,
        timestamp: new Date(Date.now() - Math.random() * 86400000 * 7), // Dernière semaine
        user: users[Math.floor(Math.random() * users.length)],
        action: actions[Math.floor(Math.random() * actions.length)],
        details: `Action effectuée sur le système ${i}`,
        ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`
      });
    }
    
    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
}