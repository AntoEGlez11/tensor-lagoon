import { Component, EventEmitter, Input, Output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppointmentService, CustomerDetails } from '../../../services/appointment';
import { AuthService } from '../../../services/auth';
import { CalendarComponent } from '../calendar/calendar';
import { Timestamp } from '@angular/fire/firestore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type BookingStep = 'service' | 'date' | 'details' | 'confirmation';

@Component({
    selector: 'app-booking-modal',
    standalone: true,
    imports: [CommonModule, FormsModule, CalendarComponent],
    templateUrl: './booking-modal.html'
})
export class BookingModalComponent {
    @Input() serviceName: string = 'Servicio General';
    @Input() serviceId: string = 'general'; // Default or passed from parent
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
        // Auto-fill if user logged in
        const user = this.authService.user();
        if (user) {
            this.customerName = user.displayName || '';
            this.customerEmail = user.email || '';
        }
    }

    closeModal() {
        this.close.emit();
    }

    async onDateSelected(date: Date) {
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

            const details: CustomerDetails = {
                name: this.customerName,
                email: this.customerEmail,
                phone: this.customerPhone,
                vehicleInfo: this.vehicleInfo
            };

            await this.appointmentService.createAppointment({
                userId: this.authService.user()?.uid || null,
                customerDetails: details,
                serviceId: this.serviceId,
                serviceName: this.serviceName,
                start: start,
                end: end,
                status: 'pending',
                notes: 'Booking via Web'
            });

            this.step.set('confirmation');
        } catch (err) {
            alert('Error al crear la reserva. Por favor intenta de nuevo.');
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
}
