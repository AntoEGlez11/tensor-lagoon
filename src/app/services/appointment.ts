import { Injectable, inject } from '@angular/core';
import {
    Firestore,
    collection,
    addDoc,
    query,
    where,
    getDocs,
    doc,
    updateDoc,
    Timestamp,
    orderBy
} from '@angular/fire/firestore';
import { Observable, from, map } from 'rxjs';

export interface CustomerDetails {
    name: string;
    email: string;
    phone: string;
    vehicleInfo?: string;
}

export type AppointmentStatus = 'pending' | 'confirmed' | 'rejected' | 'completed' | 'cancelled';

export interface Appointment {
    id?: string;
    userId?: string | null;
    customerDetails: CustomerDetails;
    serviceId: string;
    serviceName: string;
    start: Timestamp;
    end: Timestamp;
    status: AppointmentStatus;
    notes?: string;
    createdAt: Timestamp;
}

@Injectable({
    providedIn: 'root'
})
export class AppointmentService {
    private firestore = inject(Firestore);
    private collectionName = 'appointments';

    // Create a new appointment
    async createAppointment(appointment: Omit<Appointment, 'id' | 'createdAt'>): Promise<string> {
        const colRef = collection(this.firestore, this.collectionName);

        // Check for double booking (simple check)
        // NOTE: For a production app, this should be a transaction or Cloud Function to avoid race conditions.
        // For MVP client-side check is acceptable but not robust.
        const isAvailable = await this.checkAvailability(appointment.start, appointment.end);
        if (!isAvailable) {
            throw new Error('Slot is no longer available');
        }

        const docRef = await addDoc(colRef, {
            ...appointment,
            createdAt: Timestamp.now()
        });
        return docRef.id;
    }

    // Get appointments for a date range (for Admin Calendar)
    getAppointments(start: Date, end: Date): Observable<Appointment[]> {
        const colRef = collection(this.firestore, this.collectionName);
        const q = query(
            colRef,
            where('start', '>=', Timestamp.fromDate(start)),
            where('start', '<=', Timestamp.fromDate(end)),
            orderBy('start', 'asc')
        );

        return from(getDocs(q)).pipe(
            map(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment)))
        );
    }

    // Get appointments for a specific user (for User Dashboard)
    getUserAppointments(userId: string): Observable<Appointment[]> {
        const colRef = collection(this.firestore, this.collectionName);
        const q = query(
            colRef,
            where('userId', '==', userId),
            orderBy('start', 'desc')
        );

        return from(getDocs(q)).pipe(
            map(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment)))
        );
    }

    // Get all pending appointments (for Admin Dashboard)
    getPendingAppointments(): Observable<Appointment[]> {
        const colRef = collection(this.firestore, this.collectionName);
        const q = query(
            colRef,
            where('status', '==', 'pending'),
            orderBy('createdAt', 'desc')
        );

        return from(getDocs(q)).pipe(
            map(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment)))
        );
    }

    // Update appointment status (Admin Action)
    async updateStatus(id: string, status: AppointmentStatus, notes?: string): Promise<void> {
        const docRef = doc(this.firestore, this.collectionName, id);
        const data: any = { status };
        if (notes) data.notes = notes;
        await updateDoc(docRef, data);
    }

    // Check if a slot is available
    // Returns true if NO confirmed or pending appointments overlap
    private async checkAvailability(start: Timestamp, end: Timestamp): Promise<boolean> {
        const colRef = collection(this.firestore, this.collectionName);

        // We check for any appointment that starts BEFORE our end AND ends AFTER our start.
        // Overlap logic: (StartA < EndB) and (EndA > StartB)

        // Firestore composite query limitation:
        // We can't easily do complex range overlaps in one query without multiple inequality filters on different fields,
        // which requires specific indexes.

        // Simplified MVP Strategy:
        // Fetch all appts for the target DAY and filter in memory.
        // This is performant enough for a small business (dozens of slots/day).

        const dayStart = new Date(start.toDate());
        dayStart.setHours(0, 0, 0, 0);

        const dayEnd = new Date(start.toDate());
        dayEnd.setHours(23, 59, 59, 999);

        const q = query(
            colRef,
            where('start', '>=', Timestamp.fromDate(dayStart)),
            where('start', '<=', Timestamp.fromDate(dayEnd))
        );

        const snapshot = await getDocs(q);
        const existing = snapshot.docs.map(d => d.data() as Appointment);

        const requestedStart = start.toDate().getTime();
        const requestedEnd = end.toDate().getTime();

        const hasOverlap = existing.some(appt => {
            // Ignore rejected or cancelled appointments
            if (appt.status === 'rejected' || appt.status === 'cancelled') return false;

            const apptStart = appt.start.toDate().getTime();
            const apptEnd = appt.end.toDate().getTime();

            return (apptStart < requestedEnd) && (apptEnd > requestedStart);
        });

        return !hasOverlap;
    }

    // Generate available slots for a given date
    // Hardcoded 9:00 - 18:00, 1 hour duration for MVP
    async getAvailableSlots(date: Date): Promise<Date[]> {
        const startOfDay = new Date(date);
        startOfDay.setHours(9, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(18, 0, 0, 0);

        const slots: Date[] = [];
        let currentSlot = new Date(startOfDay);

        // Fetch confirmed/pending appointments for the day to filter
        const colRef = collection(this.firestore, this.collectionName);

        // Query for the specific day
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        const q = query(
            colRef,
            where('start', '>=', Timestamp.fromDate(dayStart)),
            where('start', '<=', Timestamp.fromDate(dayEnd))
        );

        const snapshot = await getDocs(q);
        const dayAppts = snapshot.docs.map(doc => doc.data() as Appointment);

        while (currentSlot < endOfDay) {
            // Skip past slots if the date is today
            if (currentSlot.getTime() < Date.now()) {
                currentSlot.setHours(currentSlot.getHours() + 1);
                continue;
            }

            const slotEnd = new Date(currentSlot);
            slotEnd.setHours(slotEnd.getHours() + 1); // Assuming 1 hour service duration

            // Check collision with existing appointments
            // Overlap if (ApptStart < SlotEnd) and (ApptEnd > SlotStart)
            const isBlocked = dayAppts.some(appt => {
                if (appt.status === 'rejected' || appt.status === 'cancelled') return false;
                const apptStart = appt.start.toDate().getTime();
                const apptEnd = appt.end.toDate().getTime();
                return (apptStart < slotEnd.getTime()) && (apptEnd > currentSlot.getTime());
            });

            if (!isBlocked) {
                slots.push(new Date(currentSlot));
            }

            // Move to next slot (1 hour interval)
            currentSlot.setHours(currentSlot.getHours() + 1);
        }

        return slots;
    }
}
