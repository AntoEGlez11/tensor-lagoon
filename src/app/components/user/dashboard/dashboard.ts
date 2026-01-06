import { Component, inject, signal, computed, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth';
import { DatePipe } from '@angular/common';
import { CrmService, ServiceTicket } from '../../../services/crm';
import { AppointmentService, Appointment } from '../../../services/appointment';
import { Unsubscribe, Firestore, updateDoc, doc } from '@angular/fire/firestore';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BookingModalComponent } from '../../shared/booking-modal/booking-modal';
import { VEHICLE_BRANDS, VEHICLE_YEARS, VEHICLE_COLORS } from '../../../data/vehicles';

@Component({
  selector: 'app-user-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, BookingModalComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnDestroy {
  authService = inject(AuthService);
  crm = inject(CrmService);
  appointmentService = inject(AppointmentService);
  private fb = inject(FormBuilder);

  user = this.authService.user;
  userProfile = signal<any>(null); // Extended profile from Firestore

  services = signal<ServiceTicket[]>([]); // All services (Work in Progress)
  bookings = signal<Appointment[]>([]); // Future/Pending appointments

  // Constants for Template
  vehicleBrands = Object.keys(VEHICLE_BRANDS);
  vehicleModels = signal<string[]>([]);
  vehicleYears = VEHICLE_YEARS;
  vehicleColors = VEHICLE_COLORS;

  // Computed data
  activeServices = computed(() =>
    this.services().filter(s => ['pending', 'in-progress', 'ready'].includes(s.status))
  );

  historyServices = computed(() =>
    this.services().filter(s => s.status === 'completed')
  );

  // Pending Bookings (Not yet started services)
  pendingBookings = computed(() =>
    this.bookings().filter(b => ['pending', 'confirmed', 'rejected'].includes(b.status))
  );

  stats = computed(() => {
    const history = this.historyServices();
    const totalSpent = history.reduce((acc, curr) => acc + (curr.price || 0), 0);
    return {
      totalServices: this.services().length + this.bookings().length,
      completedCount: history.length,
      totalSpent
    };
  });

  private unsubServices?: Unsubscribe;
  private unsubProfile?: Unsubscribe;

  // Profile Edit State
  editMode = signal(false);
  profileForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    address: [''],
    vehicleBrand: [''],
    vehicleModel: [''],
    vehicleYear: [''],
    vehicleColor: ['']
  });

  constructor() {
    // Dynamic Options Logic
    this.profileForm.get('vehicleBrand')?.valueChanges.subscribe(brand => {
      if (brand && VEHICLE_BRANDS[brand]) {
        this.vehicleModels.set(VEHICLE_BRANDS[brand]);
        // If current model is not in the new list, reset it
        const currentModel = this.profileForm.get('vehicleModel')?.value || '';
        if (!VEHICLE_BRANDS[brand].includes(currentModel)) {
          this.profileForm.patchValue({ vehicleModel: '' });
        }
      } else {
        this.vehicleModels.set([]);
      }
    });

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

        // Fetch Appointments
        this.appointmentService.getUserAppointments(u.uid).subscribe(data => {
          this.bookings.set(data);
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

  enterEditMode() {
    const p = this.userProfile();
    const u = this.user();
    if (!p) return;

    // Try to parse existing "Brand Model" string if we have legacy data
    let brand = '';
    let model = p.vehicleModel || '';

    // Simple heuristic: Check if the string starts with a known brand
    for (const b of this.vehicleBrands) {
      if (model.startsWith(b)) {
        brand = b;
        model = model.replace(b, '').trim();
        break;
      }
    }

    this.profileForm.patchValue({
      name: p.name,
      email: u?.email || p.email || '',
      address: p.address || '',
      vehicleBrand: brand,
      vehicleModel: model,
      vehicleYear: p.vehicleYear || '',
      vehicleColor: p.vehicleColor || ''
    });
    this.editMode.set(true);
  }

  cancelEdit() {
    this.editMode.set(false);
    this.profileForm.reset();
  }

  async saveProfile() {
    if (this.profileForm.invalid) return;
    const uid = this.user()?.uid;
    if (!uid) return;

    try {
      const formVal = this.profileForm.getRawValue();

      // Concatenate for storage to maintain schema compatibility
      const fullModelString = formVal.vehicleBrand + ' ' + formVal.vehicleModel;

      await this.crm.updateUserProfile(uid, {
        name: formVal.name,
        email: formVal.email,
        address: formVal.address,
        vehicleModel: fullModelString.trim(), // Save "Toyota Corolla"
        vehicleYear: formVal.vehicleYear,
        vehicleColor: formVal.vehicleColor
      });
      this.editMode.set(false);
    } catch (err) {
      console.error(err);
      alert('Error al actualizar perfil');
    }
  }

  // --- Rescheduling ---
  rescheduleModalOpen = signal(false);
  rescheduleAppt = signal<Appointment | null>(null);

  openRescheduleModal(appt: Appointment) {
    this.rescheduleAppt.set(appt);
    this.rescheduleModalOpen.set(true);
  }

  closeRescheduleModal() {
    this.rescheduleModalOpen.set(false);
    this.rescheduleAppt.set(null);
  }

  onRescheduleComplete() {
    this.closeRescheduleModal();
    if (this.user()) {
      const u = this.user()!;
      this.appointmentService.getUserAppointments(u.uid).subscribe(data => {
        this.bookings.set(data);
      });
    }
  }

  logout() {
    this.authService.logout();
  }
}
