import { Component, EventEmitter, Input, Output, signal, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppointmentService, CustomerDetails, Appointment } from '../../../services/appointment';
import { AuthService } from '../../../services/auth';
import { CalendarComponent } from '../calendar/calendar';
import { Timestamp, deleteField } from '@angular/fire/firestore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { VEHICLE_BRANDS, VEHICLE_YEARS, VEHICLE_COLORS } from '../../../data/vehicles';

type BookingStep = 'service' | 'date' | 'details' | 'confirmation';

@Component({
    selector: 'app-booking-modal',
    standalone: true,
    imports: [CommonModule, FormsModule, CalendarComponent],
    templateUrl: './booking-modal.html'
})
export class BookingModalComponent {
    @Input() serviceName: string = 'Servicio General';
    @Input() serviceId: string = 'general';
    @Input() servicePrice: string = ''; // e.g. "$250 MXN"

    // Rescheduling Inputs
    @Input() existingAppointment?: Appointment;
    @Input() isRescheduling: boolean = false;

    @Output() close = new EventEmitter<void>();

    appointmentService = inject(AppointmentService);
    authService = inject(AuthService);

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
                            // If model is valid in list keep it, otherwise it might be custom or mismatch
                            if (!this.vehicleModels().includes(this.vehicleModel)) {
                                // Maybe basic match logic or just leave it blank if strict
                                // For MVP let's assume if it doesn't match effectively, we force re-selection
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
            alert('Por favor selecciona una fecha futura.');
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
            const slot = this.selectedSlot()!;
            const start = Timestamp.fromDate(slot);

            // Calculate end time (1 hour duration fixed for MVP)
            const endDate = new Date(slot);
            endDate.setHours(endDate.getHours() + 1);
            const end = Timestamp.fromDate(endDate);

            // Construct vehicle info string
            const vehicleString = `${this.vehicleBrand} ${this.vehicleModel} ${this.vehicleYear} ${this.vehicleColor}`.trim();

            const details: CustomerDetails = {
                name: this.customerName,
                email: this.customerEmail,
                phone: this.customerPhone,
                vehicleInfo: vehicleString
            };

            const numericPrice = Number(this.servicePrice.replace(/[^0-9.]/g, '')) || 0;

            if (this.isRescheduling && this.existingAppointment?.id) {
                // Update existing appointment
                await this.appointmentService.updateAppointment(this.existingAppointment.id, {
                    start: start,
                    end: end,
                    status: 'pending', // Reset to pending
                    rejectionReason: deleteField() as any, // Clear rejection reason
                    // Optionally update details if user changed them? For now, we update them.
                    customerDetails: details
                });
            } else {
                // Create new appointment
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
            alert('Error al procesar la reserva. Por favor intenta de nuevo.');
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
    vehicleBrands = Object.keys(VEHICLE_BRANDS);
    vehicleModels = signal<string[]>([]);
    vehicleYears = VEHICLE_YEARS;
    vehicleColors = VEHICLE_COLORS;

    vehicleBrand = '';
    vehicleModel = '';
    vehicleYear = '';
    vehicleColor = '';

    onBrandChange() {
        if (this.vehicleBrand && VEHICLE_BRANDS[this.vehicleBrand]) {
            this.vehicleModels.set(VEHICLE_BRANDS[this.vehicleBrand]);
            this.vehicleModel = ''; // Reset model on brand change
        } else {
            this.vehicleModels.set([]);
        }
    }
}
