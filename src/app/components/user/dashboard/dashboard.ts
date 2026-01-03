import { Component, inject, signal, computed, OnDestroy, effect } from '@angular/core';
import { AuthService } from '../../../services/auth';
import { DatePipe } from '@angular/common';
import { CrmService, ServiceTicket } from '../../../services/crm';
import { Unsubscribe } from '@angular/fire/firestore';

@Component({
  selector: 'app-user-dashboard',
  imports: [],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnDestroy {
  authService = inject(AuthService);
  crm = inject(CrmService);

  user = this.authService.user;
  userProfile = signal<any>(null); // Extended profile from Firestore

  services = signal<ServiceTicket[]>([]); // All services

  // Computed data
  activeServices = computed(() =>
    this.services().filter(s => ['pending', 'in-progress', 'ready'].includes(s.status))
  );

  historyServices = computed(() =>
    this.services().filter(s => s.status === 'completed')
  );

  stats = computed(() => {
    const history = this.historyServices();
    const totalSpent = history.reduce((acc, curr) => acc + (curr.price || 0), 0);
    return {
      totalServices: this.services().length,
      completedCount: history.length,
      totalSpent
    };
  });

  private unsubServices?: Unsubscribe;
  private unsubProfile?: Unsubscribe;

  constructor() {
    // React to user changes
    effect(() => {
      const u = this.user();

      // Cleanup previous subs
      if (this.unsubServices) this.unsubServices();
      if (this.unsubProfile) this.unsubProfile();

      if (u) {
        // Fetch Services
        this.unsubServices = this.crm.getCustomerServices(u.uid, (data) => {
          this.services.set(data);
        });

        // Fetch Profile
        this.unsubProfile = this.crm.getUserProfile(u.uid, (data) => {
          this.userProfile.set(data);
        });
      }
    });
  }

  ngOnDestroy() {
    if (this.unsubServices) this.unsubServices();
    if (this.unsubProfile) this.unsubProfile();
  }

  logout() {
    this.authService.logout();
  }
}
