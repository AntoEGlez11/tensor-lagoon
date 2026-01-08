import { Component, inject, signal, computed, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { CrmService, ServiceTicket, UserProfile } from '../../../services/crm';
import { ToastService } from '../../../services/toast';
import { Unsubscribe } from '@angular/fire/firestore';
import { AppointmentService, Appointment } from '../../../services/appointment';
import { AuthService } from '../../../services/auth';
import { CAR_BRANDS, MOTO_BRANDS, TRUCK_BRANDS, VEHICLE_YEARS, VEHICLE_COLORS } from '../../../data/vehicles';

// Custom Validator
function nonRepetitiveValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (!value) return null;
  if (/^(\d)\1+$/.test(value)) {
    return { repetitive: true };
  }
  return null;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
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
  private auth = inject(AuthService);

  profile = this.auth.userProfile;

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
    phone: ['', [Validators.required, Validators.pattern('^[0-9]{10}$'), nonRepetitiveValidator]],
    name: ['', Validators.required],
    email: ['', Validators.email]
  });

  private unsub?: Unsubscribe;

  // Updated Service Form
  createForm = this.fb.nonNullable.group({
    customerSearch: ['', Validators.required],
    // Structured Vehicle Fields
    vehicleType: ['car', Validators.required], // New Control
    vehicleBrand: ['', Validators.required],
    vehicleModel: ['', Validators.required],
    vehicleYear: ['', Validators.required],
    vehicleColor: ['', Validators.required],

    licensePlate: ['', Validators.required],
    package: ['Basic Wash', Validators.required],
    price: [25, [Validators.required, Validators.min(0)]]
  });

  // Vehicle Constants
  vehicleBrands = signal<string[]>([]);
  vehicleModels = signal<string[]>([]);
  vehicleYears = VEHICLE_YEARS;
  vehicleColors = VEHICLE_COLORS;

  constructor() {
    // Initial Load
    this.updateBrandList('car');

    // Watch for type changes
    this.createForm.get('vehicleType')?.valueChanges.subscribe(type => {
      this.updateBrandList(type as 'car' | 'moto' | 'truck');
      this.createForm.patchValue({ vehicleBrand: '', vehicleModel: '' });
    });

    // Watch for brand changes
    this.createForm.get('vehicleBrand')?.valueChanges.subscribe(brand => {
      const type = this.createForm.get('vehicleType')?.value as 'car' | 'moto' | 'truck';
      let source = CAR_BRANDS;
      if (type === 'moto') source = MOTO_BRANDS;
      if (type === 'truck') source = TRUCK_BRANDS;

      if (brand && source[brand]) {
        this.vehicleModels.set(source[brand]);
        // Reset model
        this.createForm.patchValue({ vehicleModel: '' });
      } else {
        this.vehicleModels.set([]);
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

  // Rejection State
  rejectionModalOpen = signal(false);
  rejectionAppt = signal<Appointment | null>(null);
  rejectionReasonControl = this.fb.control('', Validators.required);
  rejectionOptions = ['Horario no disponible', 'Problema con vehículo', 'Falta de personal', 'Otro'];

  statusLabels: Record<string, string> = {
    'pending': 'Pendiente',
    'in-progress': 'En Proceso',
    'ready': 'Listo',
    'completed': 'Completado',
    'confirmed': 'Confirmado',
    'rejected': 'Rechazado'
  };

  async confirmAppointment(appt: Appointment) {
    if (!appt.id) return;
    try {
      // 1. Convert to Service Ticket (so it appears in Active Services)
      if (appt.userId) { // Only if linked to a user
        await this.crm.createServiceFromAppointment(appt);
      }

      // 2. Update Status
      await this.appointmentService.updateStatus(appt.id, 'confirmed');
      this.toast.show('Cita confirmada y servicio creado', 'success');
      this.loadPendingAppointments();
    } catch (err) {
      console.error(err);
      this.toast.show('Error al confirmar', 'error');
    }
  }

  openRejectModal(appt: Appointment) {
    this.rejectionAppt.set(appt);
    this.rejectionReasonControl.setValue('Horario no disponible');
    this.rejectionModalOpen.set(true);
  }

  closeRejectModal() {
    this.rejectionModalOpen.set(false);
    this.rejectionAppt.set(null);
    this.rejectionReasonControl.reset();
  }

  async confirmRejection() {
    const appt = this.rejectionAppt();
    if (!appt || !appt.id || this.rejectionReasonControl.invalid) return;

    try {
      const reason = this.rejectionReasonControl.value;
      await this.appointmentService.updateStatus(appt.id, 'rejected', reason || 'Sin motivo');

      this.toast.show('Cita rechazada', 'info');
      this.loadPendingAppointments();
      this.closeRejectModal();
    } catch (err) {
      console.error(err);
      this.toast.show('Error al rechazar', 'error');
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
      this.toast.show('Error en búsqueda', 'error');
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
      this.toast.show('Cliente creado con éxito', 'success');
    } catch (err) {
      console.error(err);
      this.toast.show('Error al crear cliente', 'error');
    }
  }

  async createService() {
    if (this.createForm.invalid || !this.selectedUser()) {
      if (!this.selectedUser()) this.toast.show('Selecciona un cliente primero', 'error');
      return;
    }

    try {
      const user = this.selectedUser();

      if (!user || !user.uid) {
        this.toast.show('Cliente inválido', 'error');
        return;
      }

      const form = this.createForm.getRawValue();

      // Construct vehicle string
      const vehicleString = `${form.vehicleBrand} ${form.vehicleModel} ${form.vehicleYear} ${form.vehicleColor}`.trim();

      const ticket: Omit<ServiceTicket, 'id' | 'createdAt'> = {
        vehicle: vehicleString,
        licensePlate: form.licensePlate.trim().toUpperCase(),
        package: form.package,
        price: form.price,
        customerEmail: user.email || '',
        customerPhone: user.phone || 'N/A',
        customerName: user.name || 'Desconocido',
        customerId: user.uid,
        status: 'pending'
      };

      await this.crm.createService(ticket);
      this.showCreateForm.set(false);

      this.createForm.reset({ package: 'Basic Wash', price: 25 });
      this.selectedUser.set(null);
      this.foundUsers.set([]);
      this.lookupAttempted.set(false);
      this.toast.show('Servicio creado', 'success');
    } catch (err) {
      console.error(err);
    }
  }

  async updateStatus(id: string, status: ServiceTicket['status']) {
    await this.crm.updateStatus(id, status);
  }

  // --- Migration Tool ---
  async fixUserData() {
    if (!confirm('¿Generar teléfonos aleatorios para usuarios sin número? (Solo correr una vez)')) return;
    try {
      this.toast.show('Procesando...', 'info');
      const count = await this.crm.migrateUserPhoneNumbers();
      this.toast.show(`Se actualizaron ${count} usuarios`, 'success');
    } catch (err) {
      console.error(err);
      this.toast.show('Error en migración', 'error');
    }
  }
}
