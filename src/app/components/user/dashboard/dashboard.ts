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
  userProfile = this.authService.userProfile; // Linked to AuthService

  services = signal<ServiceTicket[]>([]); // All services (Work in Progress)
  bookings = signal<Appointment[]>([]); // Future/Pending appointments (Reservas)

  // Multi-Vehicle
  // import { UserVehicle } from '../../../services/crm'; // Ensure import
  userVehicles = signal<any[]>([]); // Should be UserVehicle[]
  showAddVehicle = signal(false);

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
  private unsubVehicles?: Unsubscribe;

  // Profile Edit State
  editMode = signal(false);

  // Profile Form (Only Personal Info)
  profileForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    phone: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
    email: ['', [Validators.required, Validators.email]],
    address: ['']
  });

  // Vehicle Form
  vehicleForm = this.fb.nonNullable.group({
    vehicleType: ['car', Validators.required],
    vehicleBrand: ['', Validators.required],
    vehicleModel: ['', Validators.required],
    vehicleYear: ['', Validators.required],
    vehicleColor: ['', Validators.required],
    licensePlate: [''] // Optional
  });

  // Constants
  vehicleBrands = signal<string[]>([]);
  vehicleModels = signal<string[]>([]);
  vehicleYears = VEHICLE_YEARS;
  vehicleColors = VEHICLE_COLORS;

  constructor() {
    // Initial Load
    this.updateBrandList('car');

    // Watch for vehicle form changes
    this.vehicleForm.get('vehicleType')?.valueChanges.subscribe(type => {
      this.updateBrandList(type as 'car' | 'moto' | 'truck');
      this.vehicleForm.patchValue({ vehicleBrand: '', vehicleModel: '' });
    });

    this.vehicleForm.get('vehicleBrand')?.valueChanges.subscribe(brand => {
      const type = this.vehicleForm.get('vehicleType')?.value as 'car' | 'moto' | 'truck';
      let source = CAR_BRANDS;
      if (type === 'moto') source = MOTO_BRANDS;
      if (type === 'truck') source = TRUCK_BRANDS;

      if (brand && source[brand]) {
        this.vehicleModels.set(source[brand]);
      } else {
        this.vehicleModels.set([]);
      }
    });

    // Effect to load user data
    effect((onCleanup) => {
      const u = this.user();
      if (u) {
        // Load data
        this.unsubServices = this.crm.getCustomerServices(u.uid, (data) => this.services.set(data));
        this.unsubVehicles = this.crm.getUserVehicles(u.uid, (data) => this.userVehicles.set(data));

        onCleanup(() => {
          if (this.unsubServices) this.unsubServices();
          if (this.unsubVehicles) this.unsubVehicles();
        });

        // Also load bookings
        this.appointmentService.getUserAppointments(u.uid).subscribe(data => {
          this.bookings.set(data);
        });
      } else {
        this.services.set([]);
        this.userVehicles.set([]);
        this.bookings.set([]);
      }
    });
  }

  updateBrandList(type: 'car' | 'moto' | 'truck') {
    let brands: string[] = [];
    if (type === 'moto') brands = Object.keys(MOTO_BRANDS);
    else if (type === 'truck') brands = Object.keys(TRUCK_BRANDS);
    else brands = Object.keys(CAR_BRANDS);

    this.vehicleBrands.set(brands.sort());
  }

  ngOnDestroy() {
    // handled by effect cleanup
  }

  enterEditMode() {
    const p = this.userProfile() || {};
    const u = this.user();

    this.profileForm.patchValue({
      name: p.name || '',
      phone: p.phone || '',
      email: u?.email || p.email || '',
      address: p.address || ''
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
      await this.crm.updateUserProfile(uid, {
        name: formVal.name,
        phone: formVal.phone,
        email: formVal.email,
        address: formVal.address
      });
      this.editMode.set(false);
    } catch (err) {
      console.error(err);
      alert('Error al actualizar perfil');
    }
  }

  // --- Vehicle Management ---
  openAddVehicle() {
    this.vehicleForm.reset({ vehicleType: 'car', vehicleYear: '', vehicleColor: '' });
    this.updateBrandList('car');
    this.showAddVehicle.set(true);
  }

  cancelAddVehicle() {
    this.showAddVehicle.set(false);
  }

  async saveVehicle() {
    if (this.vehicleForm.invalid) return;
    const uid = this.user()?.uid;
    if (!uid) return;

    try {
      const val = this.vehicleForm.getRawValue();
      await this.crm.addUserVehicle(uid, {
        type: val.vehicleType as any,
        brand: val.vehicleBrand,
        model: val.vehicleModel,
        year: val.vehicleYear,
        color: val.vehicleColor,
        licensePlate: val.licensePlate
      });
      this.showAddVehicle.set(false);
    } catch (err) {
      console.error(err);
      alert('Error al guardar vehículo');
    }
  }

  async deleteVehicle(vId: string) {
    if (!confirm('¿Eliminar vehículo?')) return;
    const uid = this.user()?.uid;
    if (!uid) return;
    await this.crm.deleteUserVehicle(uid, vId);
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
