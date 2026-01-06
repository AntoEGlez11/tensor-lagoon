import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CrmService, ServiceOffering } from '../../../services/crm';
import { Unsubscribe } from '@angular/fire/firestore';
import { BookingModalComponent } from '../../shared/booking-modal/booking-modal';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth';
import { Router } from '@angular/router';

@Component({
  selector: 'app-services',
  standalone: true,
  imports: [CommonModule, BookingModalComponent],
  templateUrl: './services.html',
  styleUrl: './services.css'
})
export class Services implements OnInit, OnDestroy {
  private crm = inject(CrmService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private unsub?: Unsubscribe;

  packages = signal<ServiceOffering[]>([]);

  // Modal State
  selectedPackage = signal<ServiceOffering | null>(null);
  showLoginPrompt = signal(false);

  ngOnInit() {
    this.unsub = this.crm.getServiceOfferings((data) => {
      this.packages.set(data);
    });
  }

  ngOnDestroy() {
    if (this.unsub) this.unsub();
  }

  openBooking(pkg: ServiceOffering) {
    if (!this.auth.user()) {
      this.showLoginPrompt.set(true);
      return;
    }
    this.selectedPackage.set(pkg);
  }

  closeBooking() {
    this.selectedPackage.set(null);
  }

  goToLogin() {
    this.router.navigate(['/login'], { queryParams: { returnUrl: '/services' } });
  }

  goToRegister() {
    this.router.navigate(['/register'], { queryParams: { returnUrl: '/services' } });
  }
}
