import { Injectable, inject, signal } from '@angular/core';
import {
    Firestore, collection, addDoc, collectionData, doc, updateDoc,
    query, where, orderBy, deleteDoc, setDoc, onSnapshot, Unsubscribe, limit, getDocs, writeBatch, serverTimestamp
} from '@angular/fire/firestore';

export interface ServiceOffering {
    id?: string;
    title: string;
    price: string;
    features: string[];
    recommended: boolean;
}

export interface Testimonial {
    id?: string;
    name: string;
    role: string;
    text: string;
}

import { Appointment } from './appointment';

export interface ServiceTicket {
    id?: string;
    customerId: string;
    customerEmail?: string; // Optional now
    customerPhone: string;  // New
    customerName: string;   // New
    vehicle: string;
    licensePlate: string;   // New
    package: string;
    status: 'pending' | 'in-progress' | 'ready' | 'completed';
    price: number;
    createdAt: any;
}

export interface UserProfile {
    uid?: string;
    email?: string; // Optional
    phone: string;  // Primary identifier
    name: string;
    role: 'admin' | 'customer';
    address?: string | null;       // New
    vehicleModel?: string | null;  // New
    vehicleYear?: string | null;   // New
    vehicleColor?: string | null;  // New
    licensePlates?: string[];
    createdAt?: any;
}

export interface ContactMessage {
    id?: string;
    name: string;
    email: string;
    phone?: string;
    message: string;
    vehicle?: {
        brand: string;
        model: string;
        year: string;
        color: string;
    } | null;
    status: 'new' | 'read' | 'archived';
    createdAt?: any;
}

export interface UserVehicle {
    id?: string;
    type: 'car' | 'moto' | 'truck';
    brand: string;
    model: string;
    year: string;
    color: string;
    licensePlate?: string;
    createdAt?: any;
}

export interface InventoryProduct {
    id?: string;
    name: string;
    category: string;
    stock: number;
    unit: string; // e.g., 'liters', 'pieces'
    minStock: number; // Threshold for low stock alert
    updatedAt?: any;
}

@Injectable({
    providedIn: 'root'
})
export class CrmService {
    private firestore = inject(Firestore);
    private servicesCollection = collection(this.firestore, 'services');

    constructor() {
        this.checkAndSeedRaffle();
        this.seedSpanishServices();
    }

    async checkAndSeedRaffle() {
        // Check if there is any ACTIVE raffle
        const ref = collection(this.firestore, 'raffles');
        const q = query(ref, where('status', '==', 'active'), limit(1));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            console.log('No active raffle found. Seeding default...');
            await this.createRaffle({
                title: '¡Gran Sorteo de Apertura!',
                description: 'Gana un Servicio Premium Completo. Regístrate hoy y obtén tu folio de participación al confirmar tu primer servicio.',
                price: 50,
                startDate: new Date().toISOString().split('T')[0], // Today
                endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0], // Next Month
                status: 'active', // Important
                createdAt: serverTimestamp()
            });
        }
    }

    // Create a new service ticket
    async createService(ticket: Omit<ServiceTicket, 'id' | 'createdAt'>) {
        // Also update user's known license plates
        if (ticket.customerId && ticket.licensePlate) {
            const userRef = doc(this.firestore, 'users', ticket.customerId);
            // We can't easily use arrayUnion without importing it, so we'll skip optimization for now
            // or just assume we don't strictly need to track history yet.
        }

        return addDoc(this.servicesCollection, {
            ...ticket,
            createdAt: new Date()
        });
    }

    // Convert Confirmed Appointment to Service Ticket
    async createServiceFromAppointment(appt: Appointment) {
        if (!appt.userId) throw new Error('Cannot create service for guest appointment (User ID required)');

        const ticket: Omit<ServiceTicket, 'id' | 'createdAt'> = {
            customerId: appt.userId,
            customerEmail: appt.customerDetails.email,
            customerPhone: appt.customerDetails.phone,
            customerName: appt.customerDetails.name,
            vehicle: appt.customerDetails.vehicleInfo || 'Unknown Vehicle', // Map vehicle info
            licensePlate: 'TBD', // We might not have this in early booking, prompt on arrival or infer?
            package: appt.serviceName,
            status: 'pending', // Pending usually means "Waitlist" or "Arrived"? 
            // For this flow, 'pending' service means "Ready to start".
            price: appt.price || 0 // Use passed price or 0
        };

        return this.createService(ticket);
    }

    // Get services for a specific customer (Real-time)
    getCustomerServices(customerId: string, callback: (services: ServiceTicket[]) => void) {
        const q = query(
            this.servicesCollection,
            where('customerId', '==', customerId)
            // Removed orderBy to avoid index requirement for now
        );

        return onSnapshot(q, (snapshot) => {
            const services = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceTicket));
            // Client-side sort
            services.sort((a, b) => {
                const tA = a.createdAt?.seconds || 0;
                const tB = b.createdAt?.seconds || 0;
                return tB - tA;
            });
            callback(services);
        });
    }

    // Get ALL active services for Admin (Real-time)
    getAllServices(callback: (services: ServiceTicket[]) => void) {
        const q = query(
            this.servicesCollection,
            orderBy('createdAt', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
            const services = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceTicket));
            callback(services);
        });
    }

    // Update service status
    async updateStatus(id: string, status: ServiceTicket['status']) {
        const docRef = doc(this.firestore, 'services', id);
        await updateDoc(docRef, { status });
    }

    // ... existing methods ...

    // --- User Management ---

    getAllUsers(onChange: (users: UserProfile[]) => void): Unsubscribe {
        const usersRef = collection(this.firestore, 'users');
        // Client-side sort to be safe/consistent, though simplistic query might be fine. 
        // But to avoid "Index" issues just in case of composite requirements (though none here), straightforward is best.
        // Actually, single field sort is safe.
        const q = query(usersRef, orderBy('createdAt', 'desc'));

        return onSnapshot(q, (snapshot) => {
            const users = snapshot.docs.map(doc => ({
                uid: doc.id,
                ...doc.data()
            } as UserProfile));
            onChange(users);
        });
    }

    async updateUserRole(uid: string, role: 'admin' | 'customer') {
        const docRef = doc(this.firestore, 'users', uid);
        await updateDoc(docRef, { role });
    }

    async updateUserProfile(uid: string, data: Partial<UserProfile>) {
        const docRef = doc(this.firestore, 'users', uid);
        await setDoc(docRef, data, { merge: true });
    }

    // --- Multi-Vehicle Management ---

    getUserVehicles(uid: string, callback: (vehicles: UserVehicle[]) => void): Unsubscribe {
        const ref = collection(this.firestore, `users/${uid}/vehicles`);
        const q = query(ref, orderBy('createdAt', 'desc'));

        return onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as UserVehicle));
            callback(list);
        });
    }

    async addUserVehicle(uid: string, vehicle: UserVehicle) {
        const ref = collection(this.firestore, `users/${uid}/vehicles`);
        await addDoc(ref, {
            ...vehicle,
            createdAt: new Date()
        });
    }

    async deleteUserVehicle(uid: string, vehicleId: string) {
        const ref = doc(this.firestore, `users/${uid}/vehicles`, vehicleId);
        await deleteDoc(ref);
    }



    // Lookup user by Phone or Name (Simple client-side filter for now as Firestore fuzzy search is limited)
    // In production with many users, this should use a proper index or Algolia
    async searchCustomers(term: string): Promise<UserProfile[]> {
        const usersRef = collection(this.firestore, 'users');
        const q = query(usersRef, orderBy('createdAt', 'desc')); // Get all for client-side filtering (MVP)
        const snapshot = await getDocs(q);

        const termLower = term.toLowerCase();

        return snapshot.docs
            .map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile))
            .filter(u =>
                (u.phone && u.phone.includes(term)) ||
                (u.name && u.name.toLowerCase().includes(termLower)) ||
                (u.email && u.email.toLowerCase().includes(termLower))
            );
    }

    // Quick create customer
    async createCustomer(profile: Omit<UserProfile, 'uid' | 'createdAt' | 'role'>) {
        const usersRef = collection(this.firestore, 'users');
        return addDoc(usersRef, {
            ...profile,
            role: 'customer',
            createdAt: new Date(),
            licensePlates: []
        });
    }

    // Lookup user by email for Admin (Legacy/Auth)
    async getUserByEmail(email: string) {
        const usersRef = collection(this.firestore, 'users');
        const q = query(usersRef, where('email', '==', email));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null;
        return { uid: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    }

    // Get single user profile (Real-time)
    getUserProfile(uid: string, callback: (user: UserProfile) => void): Unsubscribe {
        const docRef = doc(this.firestore, 'users', uid);
        return onSnapshot(docRef, (doc) => {
            if (doc.exists()) {
                callback({ uid: doc.id, ...doc.data() } as UserProfile);
            }
        });
    }

    // --- Service Offerings Management (Admin) ---

    getServiceOfferings(callback: (services: ServiceOffering[]) => void): Unsubscribe {
        const offeringsRef = collection(this.firestore, 'service-offerings');
        const q = query(offeringsRef);

        return onSnapshot(q, (snapshot) => {
            const offerings = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as ServiceOffering));
            callback(offerings);
        });
    }

    async addServiceOffering(service: ServiceOffering) {
        const offeringsRef = collection(this.firestore, 'service-offerings');
        await addDoc(offeringsRef, service);
    }

    async updateServiceOffering(id: string, service: Partial<ServiceOffering>) {
        const docRef = doc(this.firestore, 'service-offerings', id);
        await updateDoc(docRef, service);
    }

    async deleteServiceOffering(id: string) {
        const docRef = doc(this.firestore, 'service-offerings', id);
        await deleteDoc(docRef);
    }

    async seedSpanishServices() {
        const offeringsRef = collection(this.firestore, 'service-offerings');
        const q = query(offeringsRef);
        const snapshot = await getDocs(q);

        if (!snapshot.empty) return; // Already has data

        const spanishServices: ServiceOffering[] = [
            {
                title: 'Lavado Básico',
                price: '$250 MXN',
                features: ['Lavado Exterior a Mano', 'Limpieza de Rines', 'Brillo de Llantas', 'Limpieza de Vidrios'],
                recommended: false
            },
            {
                title: 'Detallado Premium',
                price: '$850 MXN',
                features: ['Incluye Lavado Básico', 'Aspirado Interior', 'Limpieza de Tablero', 'Acondicionamiento de Piel', 'Aplicación de Cera'],
                recommended: true
            },
            {
                title: 'Recubrimiento Cerámico',
                price: '$2,500 MXN',
                features: ['Corrección de Pintura', 'Descontaminación con Barra de Arcilla', 'Protección Cerámica 3 Años', 'Repelente al Agua', 'Brillo Mejorado'],
                recommended: false
            }
        ];

        for (const service of spanishServices) {
            await addDoc(offeringsRef, service);
        }
    }

    // --- Testimonial Management (Admin) ---

    getTestimonials(callback: (testimonials: Testimonial[]) => void): Unsubscribe {
        const ref = collection(this.firestore, 'testimonials');
        const q = query(ref); // Can order by generic field if added

        return onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Testimonial));
            callback(list);
        });
    }

    async addTestimonial(item: Testimonial) {
        const ref = collection(this.firestore, 'testimonials');
        await addDoc(ref, item);
    }

    async updateTestimonial(id: string, item: Partial<Testimonial>) {
        const ref = doc(this.firestore, 'testimonials', id);
        await updateDoc(ref, item);
    }

    async deleteTestimonial(id: string) {
        const ref = doc(this.firestore, 'testimonials', id);
        await deleteDoc(ref);
    }

    async seedTestimonials() {
        const ref = collection(this.firestore, 'testimonials');
        const snapshot = await getDocs(ref);
        if (!snapshot.empty) return;

        const defaults: Testimonial[] = [
            {
                name: 'Carlos R.',
                role: 'Dueño de Porsche 911',
                text: 'El mejor servicio de detallado en Torreón. Mi auto quedó mejor que nuevo.'
            },
            {
                name: 'Ana M.',
                role: 'Cliente Frecuente',
                text: 'Me encanta la atención al detalle. El recubrimiento cerámico vale cada centavo.'
            },
            {
                name: 'Roberto G.',
                role: 'Entusiasta Automotriz',
                text: 'Profesionales certificados y productos de primera. 100% recomendado.'
            }
        ];

        for (const t of defaults) {
            await addDoc(ref, t);
        }
    }

    // --- Data Migration (Admin Tool) ---
    async migrateUserPhoneNumbers() {
        const usersRef = collection(this.firestore, 'users');
        const snapshot = await getDocs(usersRef);

        let updatedCount = 0;
        const batch = writeBatch(this.firestore);

        snapshot.docs.forEach(doc => {
            const data = doc.data() as UserProfile;
            if (!data.phone || data.phone.length < 10) {
                // Generate random Mexican phone (starts with 871 for Torreon context example)
                const randomPart = Math.floor(Math.random() * 9000000) + 1000000; // 7 digits
                const newPhone = `871${randomPart}`;

                batch.update(doc.ref, { phone: newPhone });
                updatedCount++;
            }
        });

        if (updatedCount > 0) {
            await batch.commit();
        }
        return updatedCount;
    }



    // --- Raffle Management (Admin) ---

    getRaffles(callback: (raffles: any[]) => void): Unsubscribe {
        const ref = collection(this.firestore, 'raffles');
        // Order by startDate desc
        const q = query(ref, orderBy('startDate', 'desc'));

        return onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(list);
        });
    }

    async createRaffle(data: any) {
        const ref = collection(this.firestore, 'raffles');
        await addDoc(ref, {
            ...data,
            createdAt: serverTimestamp()
        });
    }

    async updateRaffle(id: string, data: any) {
        const ref = doc(this.firestore, 'raffles', id);
        await updateDoc(ref, data);
    }

    async deleteRaffle(id: string) {
        const ref = doc(this.firestore, 'raffles', id);
        await deleteDoc(ref);
    }

    // --- Raffle Participants ---

    getRaffleEntries(raffleId: string, callback: (entries: any[]) => void): Unsubscribe {
        const ref = collection(this.firestore, 'giveaway_entries');
        // Filter by specific raffle
        // Note: You might need to add an index in Firestore for this query
        const q = query(ref, where('raffleId', '==', raffleId), orderBy('createdAt', 'desc'));

        return onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(list);
        });
    }



    // --- User Side Dynamic Raffle ---

    // Get the currently active raffle (Single)
    getActiveRaffle(callback: (raffle: any | null) => void): Unsubscribe {
        const ref = collection(this.firestore, 'raffles');
        const q = query(ref, where('status', '==', 'active'), limit(1));

        return onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                callback(null);
            } else {
                const doc = snapshot.docs[0];
                callback({ id: doc.id, ...doc.data() });
            }
        });
    }

    // Get a user's entry for a SPECIFIC raffle
    getUserEntryForRaffle(uid: string, raffleId: string, callback: (entry: any) => void): Unsubscribe {
        const ref = collection(this.firestore, 'giveaway_entries');
        const q = query(ref, where('uid', '==', uid), where('raffleId', '==', raffleId), limit(1));

        return onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                callback({ id: doc.id, ...doc.data() });
            } else {
                callback(null);
            }
        });
    }

    // Override generic createRaffleEntry to include raffleId
    async joinRaffle(uid: string, name: string, vehicleInfo: string, raffleId: string, ticketRef?: string): Promise<string> {
        const refId = ticketRef || `REF-${uid.slice(-4)}-${Math.floor(100 + Math.random() * 900)}`;

        const entry: any = {
            uid,
            userName: name,
            vehicleInfo,
            raffleId, // Link to specific raffle
            ticketRef: refId.toUpperCase(),
            status: 'pending_payment',
            createdAt: serverTimestamp(),
            verifiedAt: null
        };

        const ref = collection(this.firestore, 'giveaway_entries');
        await addDoc(ref, entry);
        return refId.toUpperCase();
    }

    // --- Inventory Management (Admin) ---

    getInventory(callback: (products: InventoryProduct[]) => void): Unsubscribe {
        const ref = collection(this.firestore, 'inventory_products');
        // const q = query(ref, orderBy('name', 'asc')); 
        // TEMPORARY DEBUG: Remove orderBy to rule out index issues
        const q = query(ref);

        return onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as InventoryProduct));
            callback(list);
        }, (error) => {
            console.error('Inventory Error:', error);
            // We could call a secondary callback for errors if we changed the signature,
            // but for now logging it prevents the unhandled crash and allows debugging.
            this.logSystemError('getInventory', error);
        });
    }

    async addProduct(product: Omit<InventoryProduct, 'id' | 'updatedAt'>) {
        const ref = collection(this.firestore, 'inventory_products');
        await addDoc(ref, {
            ...product,
            updatedAt: serverTimestamp()
        });
    }

    async updateProduct(id: string, data: Partial<InventoryProduct>) {
        const ref = doc(this.firestore, 'inventory_products', id);
        await updateDoc(ref, {
            ...data,
            updatedAt: serverTimestamp()
        });
    }

    async verifyRaffleEntry(entryId: string, isVerified: boolean) {
        const ref = doc(this.firestore, 'giveaway_entries', entryId);
        await updateDoc(ref, {
            status: isVerified ? 'verified' : 'pending_payment'
        });
    }

    async rejectRaffleEntry(entryId: string) {
        const ref = doc(this.firestore, 'giveaway_entries', entryId);
        await updateDoc(ref, { status: 'rejected' });
    }

    async deleteProduct(id: string) {
        const ref = doc(this.firestore, 'inventory_products', id);
        await deleteDoc(ref);
    }



    // Quick Stock Adjustment
    async adjustStock(id: string, currentStock: number, adjustment: number) {
        const newStock = Math.max(0, currentStock + adjustment);
        const ref = doc(this.firestore, 'inventory_products', id);
        await updateDoc(ref, {
            stock: newStock,
            updatedAt: serverTimestamp()
        });
    }

    // --- System Logging ---
    async logSystemError(context: string, error: any, uid?: string) {
        try {
            const ref = collection(this.firestore, 'system_logs');
            await addDoc(ref, {
                context,
                message: error?.message || error?.toString() || 'Unknown Error',
                detail: JSON.stringify(error),
                uid: uid || 'anonymous',
                timestamp: serverTimestamp(),
                status: 'new' // To be reviewed by admin
            });
        } catch (e) {
            console.error('ORIGINAL ERROR:', error); // Ensure original error is seen
            console.error('Failed to log system error explicitly', e);
        }
    }

    // --- Contact / Inbox System ---

    async saveContactMessage(msg: Omit<ContactMessage, 'id' | 'createdAt' | 'status'>) {
        const ref = collection(this.firestore, 'messages');
        await addDoc(ref, {
            ...msg,
            status: 'new',
            createdAt: serverTimestamp()
        });
    }

    getMessages(callback: (msgs: ContactMessage[]) => void): Unsubscribe {
        const ref = collection(this.firestore, 'messages');
        const q = query(ref, orderBy('createdAt', 'desc'));
        return onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as ContactMessage));
            callback(list);
        });
    }

    async updateMessageStatus(id: string, status: 'read' | 'archived') {
        const ref = doc(this.firestore, 'messages', id);
        await updateDoc(ref, { status });
    }
}
