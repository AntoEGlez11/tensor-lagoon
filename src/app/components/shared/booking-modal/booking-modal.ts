import { Component, EventEmitter, Input, Output, signal, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppointmentService, CustomerDetails, Appointment } from '../../../services/appointment';
import { AuthService } from '../../../services/auth';
import { CalendarComponent } from '../calendar/calendar';
import { Timestamp, deleteField } from '@angular/fire/firestore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CAR_BRANDS, MOTO_BRANDS, TRUCK_BRANDS, VEHICLE_YEARS, VEHICLE_COLORS } from '../../../data/vehicles';
import { ToastService } from '../../../services/toast';

// Helper to merge brands for the simple dropdown
const ALL_BRANDS: Record<string, string[]> = { ...CAR_BRANDS, ...MOTO_BRANDS, ...TRUCK_BRANDS };

type BookingStep = 'service' | 'date' | 'details' | 'confirmation';

@Component({
    selector: 'app-booking-modal',
    standalone: true,
    imports: [CommonModule, FormsModule, CalendarComponent],
    templateUrl: './booking-modal.html'
})
export class BookingModalComponent {
    // ... Inputs/Outputs ...
    @Input() serviceName: string = 'Servicio General';
    @Input() serviceId: string = 'general';
    @Input() servicePrice: string = ''; // e.g. "$250 MXN"

    // Rescheduling Inputs
    @Input() existingAppointment?: Appointment;
    @Input() isRescheduling: boolean = false;

    @Output() close = new EventEmitter<void>();

    appointmentService = inject(AppointmentService);
    authService = inject(AuthService);
    toast = inject(ToastService);

    step = signal<BookingStep>('date');
    selectedDate = signal<Date | null>(null);
    availableSlots = signal<Date[]>([]);
    selectedSlot = signal<Date | null>(null);
    loading = signal(false);

    // Form Data
    customerName = '';
    customerEmail = '';
    customerPhone = '';
    vehicleInfo = '';

    constructor() {
        // Auto-fill if user logged in OR rescheduling
        effect(() => {
            if (this.existingAppointment) {
                // Pre-fill from existing appointment for rescheduling
                const details = this.existingAppointment.customerDetails;
                this.customerName = details.name;
                this.customerEmail = details.email;
                this.customerPhone = details.phone;
                this.vehicleInfo = details.vehicleInfo || '';

                // Note: We don't pre-select the date because the whole point is to change it.
                return;
            }

            const user = this.authService.user();
            const profile = this.authService.userProfile();

            if (user && profile) {
                // Prioritize Profile data
                if (!this.customerName) this.customerName = profile.name || user.displayName || '';
                if (!this.customerEmail) this.customerEmail = profile.email || user.email || '';
                if (!this.customerPhone) this.customerPhone = profile.phone || '';

                // Construct Vehicle Info if available
                if (!this.vehicleInfo && profile.vehicleModel) {
                    // Try to parse "Brand Model"
                    // Best effort parsing for legacy strings "Toyota Corolla"
                    for (const brand of this.vehicleBrands) {
                        if (profile.vehicleModel.startsWith(brand)) {
                            this.vehicleBrand = brand;
                            this.vehicleModel = profile.vehicleModel.replace(brand, '').trim();
                            this.onBrandChange();
                            if (!this.vehicleModels().includes(this.vehicleModel)) {
                                this.vehicleModel = '';
                            }
                            break;
                        }
                    }
                    this.vehicleYear = profile.vehicleYear || '';
                    this.vehicleColor = profile.vehicleColor || '';
                }
            } else if (user) {
                // Fallback to basic Auth data
                if (!this.customerName) this.customerName = user.displayName || '';
                if (!this.customerEmail) this.customerEmail = user.email || '';
            }
        });
    }

    closeModal() {
        this.close.emit();
    }

    async onDateSelected(date: Date) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (date < today) {
            this.toast.show('Por favor selecciona una fecha futura.', 'info');
            return;
        }

        this.selectedDate.set(date);
        this.selectedSlot.set(null);
        this.loading.set(true);

        try {
            const slots = await this.appointmentService.getAvailableSlots(date);
            this.availableSlots.set(slots);
        } catch (err) {
            console.error('Error fetching slots', err);
        } finally {
            this.loading.set(false);
        }
    }

    selectSlot(slot: Date) {
        this.selectedSlot.set(slot);
        this.step.set('details');
    }

    async confirmBooking() {
        if (!this.selectedSlot()) return;

        this.loading.set(true);
        try {
            // ... (Logic remains same) ...

            const slot = this.selectedSlot()!;
            const start = Timestamp.fromDate(slot);
            const endDate = new Date(slot);
            endDate.setHours(endDate.getHours() + 1);
            const end = Timestamp.fromDate(endDate);
            const vehicleString = `${this.vehicleBrand} ${this.vehicleModel} ${this.vehicleYear} ${this.vehicleColor}`.trim();

            const details: CustomerDetails = {
                name: this.customerName,
                email: this.customerEmail,
                phone: this.customerPhone,
                vehicleInfo: vehicleString
            };

            const numericPrice = Number(this.servicePrice.replace(/[^0-9.]/g, '')) || 0;

            if (this.isRescheduling && this.existingAppointment?.id) {
                await this.appointmentService.updateAppointment(this.existingAppointment.id, {
                    start: start,
                    end: end,
                    status: 'pending',
                    rejectionReason: deleteField() as any,
                    customerDetails: details
                });
            } else {
                await this.appointmentService.createAppointment({
                    userId: this.authService.user()?.uid || null,
                    customerDetails: details,
                    serviceId: this.serviceId,
                    serviceName: this.serviceName,
                    start: start,
                    end: end,
                    status: 'pending',
                    notes: 'Booking via Web',
                    price: numericPrice,
                    rejectionReason: ''
                });
            }

            this.step.set('confirmation');
        } catch (err) {
            this.toast.show('Error al procesar la reserva. Por favor intenta de nuevo.', 'error');
            console.error(err);
        } finally {
            this.loading.set(false);
        }
    }

    formatTime(date: Date): string {
        return format(date, 'h:mm a', { locale: es });
    }

    formatDate(date: Date): string {
        return format(date, 'EEEE d MMMM', { locale: es });
    }

    // Vehicle Data
    vehicleBrands = Object.keys(ALL_BRANDS).sort();
    vehicleModels = signal<string[]>([]);
    vehicleYears = VEHICLE_YEARS;
    vehicleColors = VEHICLE_COLORS;

    vehicleBrand = '';
    vehicleModel = '';
    vehicleYear = '';
    vehicleColor = '';

    onBrandChange() {
        if (this.vehicleBrand && ALL_BRANDS[this.vehicleBrand]) {
            this.vehicleModels.set(ALL_BRANDS[this.vehicleBrand]);
            this.vehicleModel = ''; // Reset model on brand change
        } else {
            this.vehicleModels.set([]);
        }
    }
}
