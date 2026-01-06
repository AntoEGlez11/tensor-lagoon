import { Component, inject, ChangeDetectionStrategy, signal } from '@angular/core';
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

    // Sidebar State
    isDesktopExpanded = signal(false);

    // Desktop Hover Handlers
    onMouseEnter() {
        this.isDesktopExpanded.set(true);
    }

    onMouseLeave() {
        this.isDesktopExpanded.set(false);
    }

    logout() {
        this.authService.logout();
    }
}
