import { Component, inject, signal, computed, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../services/auth';
import { DatePipe } from '@angular/common';
import { CrmService, ServiceTicket, UserVehicle } from '../../../services/crm';
import { AppointmentService, Appointment } from '../../../services/appointment';
import { ToastService } from '../../../services/toast';
import { Unsubscribe, Firestore, updateDoc, doc } from '@angular/fire/firestore';
import { User } from '@angular/fire/auth';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BookingModalComponent } from '../../shared/booking-modal/booking-modal';
import { CAR_BRANDS, MOTO_BRANDS, TRUCK_BRANDS, VEHICLE_YEARS, VEHICLE_COLORS } from '../../../data/vehicles';

import { OnlyNumbersDirective, OnlyLettersDirective, UppercaseDirective } from '../../../directives/input-restrictions';

@Component({
  selector: 'app-user-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, BookingModalComponent, OnlyNumbersDirective, OnlyLettersDirective, UppercaseDirective],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnDestroy {
  authService = inject(AuthService);
  crm = inject(CrmService);
  appointmentService = inject(AppointmentService);
  toast = inject(ToastService);
  private fb = inject(FormBuilder);

  user = this.authService.user;
  userProfile = this.authService.userProfile; // Linked to AuthService

  services = signal<ServiceTicket[]>([]); // All services (Work in Progress)
  bookings = signal<Appointment[]>([]); // Future/Pending appointments (Reservas)

  // Multi-Vehicle
  // import { UserVehicle } from '../../../services/crm'; // Already imported at top
  userVehicles = signal<UserVehicle[]>([]);
  showAddVehicle = signal(false);

  // Raffle System
  activeRaffle = signal<any>(null); // The Active Raffle Config
  userRaffleEntry = signal<any>(null); // The User's Entry for the Active Raffle
  // raffleStatus alias for template compatibility
  raffleStatus = computed(() => this.userRaffleEntry());

  showRaffleModal = signal(false);

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
  private unsubRaffle?: Unsubscribe;
  private unsubUserEntry?: Unsubscribe;

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

  route = inject(ActivatedRoute); // Inject ActivatedRoute

  constructor() {
    // Initial Load
    this.updateBrandList('car');
    console.log('Current User:', this.user());
    console.log('User Profile:', this.userProfile());


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

    // Check for raffle params from URL
    this.route.queryParams.subscribe(params => {
      if (params['raffle_brand'] || params['raffle_model']) {
        // Open modal in 'new' mode
        this.showRaffleModal.set(true);
        this.raffleVehicleMode.set('new');

        // Pre-fill
        this.vehicleForm.patchValue({
          vehicleType: params['raffle_type'] || 'car',
          vehicleBrand: params['raffle_brand'] || '',
          // We need to wait for brand list update/model update? 
          // updateBrandList is called in constructor, so logic runs.
          // But signals in constructor might be tricky.
          // We'll set values, let the valueChanges handlers do the rest if possible, 
          // but might need to manually trigger lists if timing is off.
        });

        // Force update lists
        const type = params['raffle_type'] || 'car';
        this.updateBrandList(type);

        setTimeout(() => {
          this.vehicleForm.patchValue({
            vehicleModel: params['raffle_model'] || '',
            vehicleYear: params['raffle_year'] || '',
            vehicleColor: params['raffle_color'] || ''
          });
        }, 100); // Small delay to allow brand list to populate models
      }
    });

    // Effect to load user data
    effect((onCleanup) => {
      const u = this.user();
      if (u) {
        // Load data
        const uid = (u as User).uid;
        this.unsubServices = this.crm.getCustomerServices(uid, (data) => this.services.set(data));
        this.unsubVehicles = this.crm.getUserVehicles(uid, (data) => this.userVehicles.set(data));

        // Dynamic Raffle Loading
        this.unsubRaffle = this.crm.getActiveRaffle((raffle) => {
          this.activeRaffle.set(raffle);

          // If raffle exists, check if user entered
          if (raffle) {
            this.unsubUserEntry = this.crm.getUserEntryForRaffle(uid, raffle.id, (entry) => {
              this.userRaffleEntry.set(entry);
            });
          } else {
            this.userRaffleEntry.set(null);
          }
        });

        onCleanup(() => {
          if (this.unsubServices) this.unsubServices();
          if (this.unsubVehicles) this.unsubVehicles();
          if (this.unsubRaffle) this.unsubRaffle();
          if (this.unsubUserEntry) this.unsubUserEntry();
        });

        // Also load bookings
        this.appointmentService.getUserAppointments(uid).subscribe(data => {
          this.bookings.set(data);
        });
      } else {
        this.services.set([]);
        this.userVehicles.set([]);
        this.bookings.set([]);
        this.activeRaffle.set(null);
        this.userRaffleEntry.set(null);
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
      this.toast.show('Perfil actualizado correctamente', 'success');
    } catch (err) {
      console.error(err);
      this.toast.show('Error al actualizar perfil', 'error');
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
      this.toast.show('Vehículo guardado correctamente', 'success');
    } catch (err) {
      console.error(err);
      this.toast.show('Error al guardar vehículo', 'error');
    }
  }

  async deleteVehicle(vId: string | undefined) {
    if (!vId) return;
    if (!confirm('¿Eliminar vehículo?')) return;
    const uid = this.user()?.uid;
    if (!uid) return;
    await this.crm.deleteUserVehicle(uid, vId);
  }

  // --- Raffle System ---
  raffleVehicleMode = signal<'existing' | 'new'>('existing');
  selectedRaffleVehicleId = signal<string>('');
  raffleNewVehicleText = signal<string>('');

  openRaffleModal() {
    this.showRaffleModal.set(true);

    // Reset form for potential new entry
    this.vehicleForm.reset({ vehicleType: 'car', vehicleYear: '', vehicleColor: '' });
    this.updateBrandList('car');

    // Default to first vehicle if available
    if (this.userVehicles().length > 0) {
      this.raffleVehicleMode.set('existing');
      this.selectedRaffleVehicleId.set(this.userVehicles()[0].id || '');
    } else {
      this.raffleVehicleMode.set('new');
    }
  }

  closeRaffleModal() {
    this.showRaffleModal.set(false);
    this.raffleNewVehicleText.set('');
    this.selectedRaffleVehicleId.set('');
    this.vehicleForm.reset();
  }

  async joinRaffle() {
    const uid = this.user()?.uid;
    const name = this.userProfile()?.name || this.user()?.email || 'Usuario';

    if (!uid) return;

    // Validate Vehicle Info
    let vehicleInfo = '';
    if (this.raffleVehicleMode() === 'existing') {
      const vId = this.selectedRaffleVehicleId();
      const v = this.userVehicles().find(v => v.id === vId);
      if (!v) {
        this.toast.show('Por favor selecciona un vehículo', 'error');
        return;
      }
      vehicleInfo = `${v.brand} ${v.model} ${v.year}`;
    } else {
      // Validate Form for New Vehicle
      if (this.vehicleForm.invalid) {
        this.vehicleForm.markAllAsTouched();
        this.toast.show('Por favor completa los datos del vehículo', 'error');
        return;
      }

      const val = this.vehicleForm.getRawValue();
      vehicleInfo = `${val.vehicleBrand} ${val.vehicleModel} ${val.vehicleYear} (${val.vehicleColor})`;

      // Also add the plate if provided
      if (val.licensePlate) {
        vehicleInfo += ` - ${val.licensePlate}`;
      }
    }

    try {
      // Check if already in (should be handled by signal but just in case)
      if (this.raffleStatus()) return;

      const raffle = this.activeRaffle();
      if (!raffle || !raffle.id) {
        this.toast.show('No hay sorteo activo en este momento.', 'error');
        return;
      }

      await this.crm.joinRaffle(uid, name, vehicleInfo, raffle.id);
      this.toast.show('¡Felicidades! Tu folio ha sido generado. Procede al pago.', 'success');
      // UI will update automatically via effect
    } catch (err: any) {
      console.error(err);
      this.toast.show('No pudimos procesar tu solicitud. Intenta de nuevo más tarde.', 'error');
      // Log System Error
      this.crm.logSystemError('joinRaffle', err, uid);
    }
  }

  // --- Terms Modal ---
  showTermsModal = signal(false);

  openTermsModal() {
    this.showTermsModal.set(true);
  }

  closeTermsModal() {
    this.showTermsModal.set(false);
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
    this.refreshBookings();
  }

  async cancelAppointment(appt: Appointment) {
    if (!confirm('¿Estás seguro que deseas cancelar tu cita? Esta acción no se puede deshacer.')) return;

    try {
      await this.appointmentService.updateStatus(appt.id!, 'cancelled');
      this.toast.show('Cita cancelada correctamente', 'success');
      this.refreshBookings();
    } catch (err) {
      console.error(err);
      this.toast.show('Error al cancelar la cita', 'error');
    }
  }

  private refreshBookings() {
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
