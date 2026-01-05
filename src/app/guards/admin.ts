import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take, tap } from 'rxjs/operators';
import { of } from 'rxjs';

export const adminGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    return toObservable(authService.userProfile).pipe(
        filter(profile => profile !== undefined), // Wait for profile to load
        take(1),
        map(profile => profile?.role === 'admin'),
        tap(isAdmin => {
            if (!isAdmin) {
                // Not an admin? Redirect to user dashboard
                router.navigate(['/dashboard']);
            }
        })
    );
};
