import { Injectable, inject, signal } from '@angular/core';
import { Auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, user, User } from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc } from '@angular/fire/firestore';
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

      // Create user profile in Firestore
      await setDoc(doc(this.firestore, 'users', uid), {
        email: email,
        role: 'customer',
        createdAt: new Date()
      });

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
