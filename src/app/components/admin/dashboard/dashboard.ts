import { Component, inject, signal, computed, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CrmService, ServiceTicket, UserProfile } from '../../../services/crm';
import { ToastService } from '../../../services/toast';
import { Unsubscribe } from '@angular/fire/firestore';
import { AppointmentService, Appointment } from '../../../services/appointment';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Dashboard implements OnInit, OnDestroy {
  private crm = inject(CrmService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  private appointmentService = inject(AppointmentService);

  services = signal<ServiceTicket[]>([]);
  pendingAppointments = signal<Appointment[]>([]);

  // Computed Stats
  totalRevenue = computed(() =>
    this.services()
      .filter(s => s.status === 'completed')
      .reduce((acc, curr) => acc + (curr.price || 0), 0)
  );

  stats = computed(() => {
    const s = this.services();
    return {
      active: s.filter(t => t.status !== 'completed').length,
      completed: s.filter(t => t.status === 'completed').length,
      pending: s.filter(t => t.status === 'pending').length
    };
  });

  recentServices = computed(() =>
    this.services().slice(0, 5)
  );

  showCreateForm = signal(false);
  showCustomerModal = signal(false);

  // Lookup state
  loadingLookup = signal(false);
  lookupAttempted = signal(false);
  foundUsers = signal<UserProfile[]>([]);
  selectedUser = signal<UserProfile | null>(null);

  // Customer Form (Modal)
  customerForm = this.fb.nonNullable.group({
    phone: ['', Validators.required],
    name: ['', Validators.required],
    email: ['', Validators.email]
  });

  private unsub?: Unsubscribe;

  // Updated Service Form
  createForm = this.fb.nonNullable.group({
    customerSearch: ['', Validators.required],
    vehicle: ['', Validators.required],
    licensePlate: ['', Validators.required],
    package: ['Basic Wash', Validators.required],
    price: [25, [Validators.required, Validators.min(0)]]
  });

  ngOnInit() {
    this.unsub = this.crm.getAllServices((data) => {
      this.services.set(data);
    });
    this.loadPendingAppointments();
  }

  ngOnDestroy() {
    if (this.unsub) this.unsub();
  }

  // --- Booking System ---
  loadPendingAppointments() {
    this.appointmentService.getPendingAppointments().subscribe(data => {
      this.pendingAppointments.set(data);
    });
  }

  async confirmAppointment(appt: Appointment) {
    if (!appt.id) return;
    try {
      await this.appointmentService.updateStatus(appt.id, 'confirmed');
      this.toast.show('Appointment confirmed', 'success');
      this.loadPendingAppointments();
    } catch (err) {
      console.error(err);
      this.toast.show('Error confirming', 'error');
    }
  }

  async rejectAppointment(appt: Appointment) {
    if (!appt.id) return;
    if (!confirm('Are you sure you want to reject this booking?')) return;

    try {
      await this.appointmentService.updateStatus(appt.id, 'rejected');
      this.toast.show('Appointment rejected', 'info');
      this.loadPendingAppointments();
    } catch (err) {
      console.error(err);
      this.toast.show('Error rejecting', 'error');
    }
  }

  // New Search Logic
  async searchCustomer() {
    const term = this.createForm.get('customerSearch')?.value;
    if (!term || term.length < 3) return;

    this.loadingLookup.set(true);
    this.lookupAttempted.set(false);
    this.foundUsers.set([]);
    this.selectedUser.set(null);

    try {
      const users = await this.crm.searchCustomers(term);
      this.loadingLookup.set(false);
      this.lookupAttempted.set(true);
      this.foundUsers.set(users);
    } catch (err) {
      console.error(err);
      this.loadingLookup.set(false);
      this.toast.show('Search failed', 'error');
    }
  }

  selectUser(user: UserProfile) {
    this.selectedUser.set(user);
    this.foundUsers.set([]);
    this.lookupAttempted.set(false);
    this.createForm.patchValue({ customerSearch: user.phone || user.name });
  }

  openCustomerModal() {
    const term = this.createForm.get('customerSearch')?.value || '';
    if (!isNaN(Number(term))) {
      this.customerForm.patchValue({ phone: term });
    }
    this.showCustomerModal.set(true);
  }

  async createNewCustomer() {
    if (this.customerForm.invalid) return;

    const { name, phone, email } = this.customerForm.getRawValue();

    try {
      const docRef = await this.crm.createCustomer({ name, phone, email });
      const newUser: UserProfile = {
        uid: docRef.id,
        name,
        phone,
        email,
        role: 'customer'
      };

      this.selectedUser.set(newUser);
      this.showCustomerModal.set(false);
      this.customerForm.reset();
      this.createForm.patchValue({ customerSearch: newUser.phone || newUser.name });
      this.toast.show('Customer created successfully', 'success');
    } catch (err) {
      console.error(err);
      this.toast.show('Error creating customer', 'error');
    }
  }

  async createService() {
    if (this.createForm.invalid || !this.selectedUser()) {
      if (!this.selectedUser()) this.toast.show('Please select a customer first', 'error');
      return;
    }

    try {
      const user = this.selectedUser();

      if (!user || !user.uid) {
        this.toast.show('Please select a valid customer', 'error');
        return;
      }

      const form = this.createForm.getRawValue();

      const ticket: Omit<ServiceTicket, 'id' | 'createdAt'> = {
        vehicle: form.vehicle,
        licensePlate: form.licensePlate,
        package: form.package,
        price: form.price,
        customerEmail: user.email || '',
        customerPhone: user.phone || 'N/A',
        customerName: user.name || 'Unknown',
        customerId: user.uid,
        status: 'pending'
      };

      await this.crm.createService(ticket);
      this.showCreateForm.set(false);

      this.createForm.reset({ package: 'Basic Wash', price: 25 });
      this.selectedUser.set(null);
      this.foundUsers.set([]);
      this.lookupAttempted.set(false);
    } catch (err) {
      console.error(err);
    }
  }

  async updateStatus(id: string, status: ServiceTicket['status']) {
    await this.crm.updateStatus(id, status);
  }
}
