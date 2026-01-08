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
import { CAR_BRANDS, MOTO_BRANDS, TRUCK_BRANDS, VEHICLE_YEARS, VEHICLE_COLORS } from '../../../data/vehicles';

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
    vehicleType: ['car', Validators.required],
    vehicleBrand: [''],
    vehicleModel: [''],
    vehicleYear: [''],
    vehicleColor: ['']
  });

  // Constants
  vehicleBrands = signal<string[]>([]);
  vehicleModels = signal<string[]>([]);
  vehicleYears = VEHICLE_YEARS;
  vehicleColors = VEHICLE_COLORS;

  constructor() {
    // Initial Load
    this.updateBrandList('car');

    // Watch for type changes
    this.profileForm.get('vehicleType')?.valueChanges.subscribe(type => {
      this.updateBrandList(type as 'car' | 'moto' | 'truck');
      this.profileForm.patchValue({ vehicleBrand: '', vehicleModel: '' });
    });

    // Dynamic Options Logic
    this.profileForm.get('vehicleBrand')?.valueChanges.subscribe(brand => {
      const type = this.profileForm.get('vehicleType')?.value as 'car' | 'moto' | 'truck';
      let source = CAR_BRANDS;
      if (type === 'moto') source = MOTO_BRANDS;
      if (type === 'truck') source = TRUCK_BRANDS;

      if (brand && source[brand]) {
        this.vehicleModels.set(source[brand]);
        // If current model is not in the new list, reset it
        const currentModel = this.profileForm.get('vehicleModel')?.value || '';
        if (!source[brand].includes(currentModel)) {
          // Only reset if it's truly invalid (avoid aggressive resets during patchValue)
          this.profileForm.patchValue({ vehicleModel: '' }, { emitEvent: false });
        }
      } else {
        this.vehicleModels.set([]);
      }
    });

    // ... (rest of constructor)
  }

  updateBrandList(type: 'car' | 'moto' | 'truck') {
    let brands: string[] = [];
    if (type === 'moto') brands = Object.keys(MOTO_BRANDS);
    else if (type === 'truck') brands = Object.keys(TRUCK_BRANDS);
    else brands = Object.keys(CAR_BRANDS);

    this.vehicleBrands.set(brands.sort());
  }

  ngOnDestroy() {
    if (this.unsubServices) this.unsubServices();
    if (this.unsubProfile) this.unsubProfile();
  }

  enterEditMode() {
    const p = this.userProfile();
    const u = this.user();
    if (!p) return;

    let brand = '';
    let model = p.vehicleModel || '';
    let type: 'car' | 'moto' | 'truck' = 'car';

    // Heuristic: Check Trucks first, then Motos, then Cars
    let found = false;

    // Check Trucks
    for (const b of Object.keys(TRUCK_BRANDS)) {
      if (model.startsWith(b)) {
        brand = b;
        model = model.replace(b, '').trim();
        type = 'truck';
        found = true;
        break;
      }
    }

    // Check Motos
    if (!found) {
      for (const b of Object.keys(MOTO_BRANDS)) {
        if (model.startsWith(b)) {
          brand = b;
          model = model.replace(b, '').trim();
          type = 'moto';
          found = true;
          break;
        }
      }
    }

    // Check Cars
    if (!found) {
      for (const b of Object.keys(CAR_BRANDS)) {
        if (model.startsWith(b)) {
          brand = b;
          model = model.replace(b, '').trim();
          type = 'car';
          break;
        }
      }
    }

    // Update available brands FIRST based on detected type
    this.updateBrandList(type);

    this.profileForm.patchValue({
      name: p.name,
      email: u?.email || p.email || '',
      address: p.address || '',
      vehicleType: type,
      vehicleBrand: brand,
      vehicleModel: model,
      vehicleYear: p.vehicleYear || '',
      vehicleColor: p.vehicleColor || ''
    });

    // Force models update just in case
    let source = CAR_BRANDS;
    if (type === 'moto') source = MOTO_BRANDS;
    if (type === 'truck') source = TRUCK_BRANDS;

    if (brand && source[brand]) {
      this.vehicleModels.set(source[brand]);
    }

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
