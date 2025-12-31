import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CrmService, ServiceTicket } from '../../../services/crm';
import { Unsubscribe } from '@angular/fire/firestore';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit, OnDestroy {
  private crm = inject(CrmService);
  private fb = inject(FormBuilder);

  services = signal<ServiceTicket[]>([]);
  showCreateForm = signal(false);

  // Lookup state
  loadingLookup = signal(false);
  lookupAttempted = signal(false);
  foundUser = signal<any>(null);

  // Real-time listener unsubscribe function
  private unsub?: Unsubscribe;

  createForm = this.fb.nonNullable.group({
    customerEmail: ['', [Validators.required, Validators.email]],
    // customerId removed from manual input
    vehicle: ['', Validators.required],
    package: ['Basic Wash', Validators.required],
    price: [25, [Validators.required, Validators.min(0)]]
  });

  ngOnInit() {
    // Subscribe to all services
    this.unsub = this.crm.getAllServices((data) => {
      this.services.set(data);
    });
  }

  ngOnDestroy() {
    if (this.unsub) this.unsub();
  }

  async lookupUser() {
    const email = this.createForm.get('customerEmail')?.value;
    if (!email) return;

    this.loadingLookup.set(true);
    this.lookupAttempted.set(false);
    this.foundUser.set(null);

    try {
      // Query users by email
      const user = await this.crm.getUserByEmail(email);
      this.loadingLookup.set(false);
      this.lookupAttempted.set(true);

      if (user) {
        this.foundUser.set(user);
      }
    } catch (err) {
      console.error(err);
      this.loadingLookup.set(false);
    }
  }

  async createService() {
    if (this.createForm.invalid || !this.foundUser()) {
      if (!this.foundUser()) alert('Please search and select a valid user first');
      return;
    }

    try {
      const ticket = {
        vehicle: this.createForm.get('vehicle')?.value!,
        package: this.createForm.get('package')?.value!,
        price: this.createForm.get('price')?.value!,
        customerEmail: this.foundUser().email,
        customerId: this.foundUser().uid,
        status: 'pending' as const
      };

      await this.crm.createService(ticket);
      this.showCreateForm.set(false);
      this.createForm.reset({ package: 'Basic Wash', price: 25 });
      this.foundUser.set(null);
      this.lookupAttempted.set(false);
    } catch (err) {
      console.error(err);
    }
  }

  async updateStatus(id: string, status: ServiceTicket['status']) {
    await this.crm.updateStatus(id, status);
  }
}
