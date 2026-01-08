import { Component, inject, ChangeDetectionStrategy, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { DatePipe } from '@angular/common'; // Import DatePipe
import { AuthService } from '../../../services/auth';

@Component({
    selector: 'app-user-layout',
    imports: [RouterOutlet, RouterLink, RouterLinkActive, DatePipe], // Add DatePipe
    templateUrl: './user-layout.html',
    styles: [], // We can reuse global styles or add specific ones if needed
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserLayout {
    private authService = inject(AuthService);
    today = new Date(); // Add today property

    // Sidebar State
    // Sidebar State
    user = this.authService.user;
    profile = this.authService.userProfile;
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
