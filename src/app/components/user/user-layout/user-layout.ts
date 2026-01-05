import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../services/auth';

@Component({
    selector: 'app-user-layout',
    imports: [RouterOutlet, RouterLink, RouterLinkActive],
    templateUrl: './user-layout.html',
    styles: [], // We can reuse global styles or add specific ones if needed
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserLayout {
    private authService = inject(AuthService);

    logout() {
        this.authService.logout();
    }
}
