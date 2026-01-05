import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { Auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, user, User } from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc, collection, query, where, getDocs, writeBatch, onSnapshot } from '@angular/fire/firestore';
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
  // Remove initialValue to let it start as undefined (loading state)
  user = toSignal(user(this.auth));

  // Expose extended profile state
  userProfile = signal<any>(undefined);

  // Computed helper for templates/guards
  isAdmin = computed(() => this.userProfile()?.role === 'admin');

  constructor() {
    // Effect to sync profile whenever user changes
    effect(() => {
      const u = this.user();

      // If u is undefined, Auth is still initializing. Do nothing.
      if (u === undefined) return;

      if (u) {
        const docRef = doc(this.firestore, 'users', u.uid);
        // Real-time listener for profile changes (role updates, etc)
        onSnapshot(docRef, (snap) => {
          if (snap.exists()) {
            this.userProfile.set(snap.data());
          } else {
            this.userProfile.set(null);
          }
        });
      } else {
        // User is definitely logged out (null)
        this.userProfile.set(null);
      }
    });
  }

  async login(email: string, pass: string) {
    try {
      await signInWithEmailAndPassword(this.auth, email, pass);
      // Navigation is now handled by Guards or Component logic based on role
      // But we can do a quick check here if we want immediate feedback
      // Waiting for the effect to fire might be slightly async, so manual routing in Login component is often better.
      // For now, let's leave generic routing to the component calling this.
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
    this.userProfile.set(null); // Clear immediately
    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean {
    return !!this.auth.currentUser;
  }
}
