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
    effect((onCleanup) => {
      const u = this.user();

      // If u is undefined, Auth is still initializing. Do nothing.
      if (u === undefined) return;

      if (u) {
        const docRef = doc(this.firestore, 'users', u.uid);
        // Real-time listener for profile changes (role updates, etc)
        const unsub = onSnapshot(docRef, (snap) => {
          if (snap.exists()) {
            this.userProfile.set(snap.data());
          } else {
            this.userProfile.set(null);
          }
        }, (error) => {
          // Handle permission errors gracefully (e.g. on logout)
          console.warn('Profile sync error (likely logout):', error);
          this.userProfile.set(null);
        });

        // Cleanup listener when user changes or effect re-runs
        onCleanup(() => unsub());
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

  async register(email: string, pass: string, phone: string) {
    try {
      const credential = await createUserWithEmailAndPassword(this.auth, email, pass);
      const uid = credential.user.uid;

      // Adoption Logic: Check if Admin already created a 'ghost' profile for this email
      // NOTE: This logic requires "List Users" permission which is insecure for public clients.
      // Ideally this should be a Cloud Function triggered on auth.user.onCreate.
      // For MVP, we skip this to prevent "Permission Denied" errors.
      /*
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
        // ... (Ghost logic omitted for security)
      }
      */

      const initialData = {
        email: email,
        role: 'customer',
        createdAt: new Date(),
        phone: phone,
        name: '',
        licensePlates: [] as string[]
      };

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
