import { Component, inject, signal, OnDestroy, effect } from '@angular/core';
import { AuthService } from '../../../services/auth';
import { DatePipe } from '@angular/common';
import { CrmService, ServiceTicket } from '../../../services/crm';
import { Unsubscribe } from '@angular/fire/firestore';

@Component({
  selector: 'app-user-dashboard',
  imports: [DatePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnDestroy {
  authService = inject(AuthService);
  crm = inject(CrmService);

  user = this.authService.user;
  activeServices = signal<ServiceTicket[]>([]);
  private unsub?: Unsubscribe;

  constructor() {
    // React to user changes
    effect(() => {
      const u = this.user();
      if (this.unsub) this.unsub(); // Clean up prev sub

      if (u) {
        this.unsub = this.crm.getCustomerServices(u.uid, (data) => {
          this.activeServices.set(data);
        });
      }
    });
  }

  ngOnDestroy() {
    if (this.unsub) this.unsub();
  }

  logout() {
    this.authService.logout();
  }
}
