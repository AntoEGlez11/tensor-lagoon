import { Injectable, inject, signal } from '@angular/core';
import { Auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, user, User } from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc, collection, query, where, getDocs, writeBatch } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);

  // Expose user state as a signal
  user = toSignal(user(this.auth), { initialValue: null });

  constructor() { }

  async login(email: string, pass: string) {
    try {
      const credential = await signInWithEmailAndPassword(this.auth, email, pass);
      const uid = credential.user.uid;

      // Fetch user role
      const docRef = doc(this.firestore, 'users', uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const userData = docSnap.data();
        const role = userData['role'];

        if (role === 'admin') {
          this.router.navigate(['/admin']);
        } else {
          this.router.navigate(['/dashboard']);
        }
      } else {
        // Fallback if no profile exists (shouldn't happen for registered users)
        this.router.navigate(['/dashboard']);
      }
    } catch (err: any) {
      console.error('Login Error:', err);
      throw err;
    }
  }

  async register(email: string, pass: string) {
    try {
      const credential = await createUserWithEmailAndPassword(this.auth, email, pass);
      const uid = credential.user.uid;

      // Adoption Logic: Check if Admin already created a 'ghost' profile for this email
      const usersRef = collection(this.firestore, 'users');
      const q = query(usersRef, where('email', '==', email));
      const snapshot = await getDocs(q);

      let initialData = {
        email: email,
        role: 'customer',
        createdAt: new Date(),
        phone: '',
        name: '',
        licensePlates: [] as string[]
      };

      if (!snapshot.empty) {
        // Ghost profile exists!
        const ghostDoc = snapshot.docs[0];
        const ghostData = ghostDoc.data();

        // Adopt data
        initialData = {
          ...initialData,
          ...ghostData, // Merge fields like name, phone, licensePlates
          role: 'customer' // Ensure they stay customer even if ghost had weird data
        };

        // Transfer Services from Ghost ID to New Auth UID
        const ghostId = ghostDoc.id;
        const servicesRef = collection(this.firestore, 'services');
        const qServices = query(servicesRef, where('customerId', '==', ghostId));
        const serviceSnap = await getDocs(qServices);

        const batch = writeBatch(this.firestore);

        // 1. Update all services to point to new UID
        serviceSnap.docs.forEach(svc => {
          batch.update(svc.ref, { customerId: uid });
        });

        // 2. Delete the old ghost user doc (optional, but cleaner)
        batch.delete(ghostDoc.ref);

        await batch.commit();
        console.log(`Adopted ${serviceSnap.size} services from ghost user ${ghostId}`);
      }

      // Create new official profile
      await setDoc(doc(this.firestore, 'users', uid), initialData);

      this.router.navigate(['/dashboard']); // Redirect to Customer Dashboard
    } catch (err: any) {
      console.error('Registration Error:', err);
      throw err;
    }
  }

  async logout() {
    await signOut(this.auth);
    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean {
    return !!this.auth.currentUser;
  }
}
