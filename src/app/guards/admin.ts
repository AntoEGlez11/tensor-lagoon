import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { map, switchMap, take, tap } from 'rxjs/operators';
import { from, of } from 'rxjs';

export const adminGuard: CanActivateFn = (route, state) => {
    const auth = inject(Auth);
    const firestore = inject(Firestore);
    const router = inject(Router);

    return authState(auth).pipe(
        take(1),
        switchMap(user => {
            if (!user) return of(false);

            // Check Firestore for role
            const userDoc = doc(firestore, 'users', user.uid);
            return from(getDoc(userDoc)).pipe(
                map(snapshot => {
                    const data = snapshot.data();
                    return data?.['role'] === 'admin';
                })
            );
        }),
        tap(isAdmin => {
            if (!isAdmin) {
                // Redirect non-admins to user dashboard
                // If not logged in at all, authGuard usually catches it first, 
                // but if we use this standalone, we should redirect to login.
                // Since this runs after auth check typically:
                const currentUser = auth.currentUser;
                if (!currentUser) {
                    router.navigate(['/login']);
                } else {
                    router.navigate(['/dashboard']);
                }
            }
        })
    );
};
