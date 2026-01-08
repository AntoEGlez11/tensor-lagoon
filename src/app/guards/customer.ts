
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';
import { toObservable } from '@angular/core/rxjs-interop';
import { map, filter, take } from 'rxjs/operators';

export const customerGuard: CanActivateFn = (route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    // We need to wait for userProfile to be populated (it might be null initially)
    // But for a simple guard, we can check a few things. 
    // Ideally, we wait for 'user' to be settled. 
    // Since 'userProfile' is a signal that updates slightly after auth, 
    // we might want to observe it.

    return toObservable(auth.userProfile).pipe(
        filter(profile => profile !== undefined), // Wait if needed, though signal starts at null
        // Actually, if we are logged in, we expect a profile eventually.
        // Let's rely on auth.user to be sure we are logged in first (handled by authGuard typically)
        // If we want to be robust:
        take(1),
        map(profile => {
            if (!profile) {
                // Should be caught by authGuard, but just in case:
                return router.createUrlTree(['/login']);
            }

            // If profile is admin, BLOCK access to customer routes -> go to admin
            if (profile.role === 'admin') {
                return router.createUrlTree(['/admin']);
            }
            return true;
        })
    );
};
