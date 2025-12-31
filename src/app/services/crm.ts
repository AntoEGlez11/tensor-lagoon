import { Injectable, inject, signal } from '@angular/core';
import { Firestore, collection, addDoc, query, where, getDocs, updateDoc, doc, orderBy, onSnapshot } from '@angular/fire/firestore';

export interface ServiceTicket {
    id?: string;
    customerId: string;
    customerEmail: string;
    vehicle: string;
    package: string;
    status: 'pending' | 'in-progress' | 'ready' | 'completed';
    price: number;
    createdAt: any;
}

@Injectable({
    providedIn: 'root'
})
export class CrmService {
    private firestore = inject(Firestore);
    private servicesCollection = collection(this.firestore, 'services');

    // Create a new service ticket
    async createService(ticket: Omit<ServiceTicket, 'id' | 'createdAt'>) {
        return addDoc(this.servicesCollection, {
            ...ticket,
            createdAt: new Date()
        });
    }

    // Get services for a specific customer (Real-time)
    getCustomerServices(customerId: string, callback: (services: ServiceTicket[]) => void) {
        const q = query(
            this.servicesCollection,
            where('customerId', '==', customerId),
            orderBy('createdAt', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
            const services = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceTicket));
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

    // Lookup user by email for Admin
    async getUserByEmail(email: string) {
        const usersRef = collection(this.firestore, 'users');
        const q = query(usersRef, where('email', '==', email));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null;
        return { uid: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    }
}
