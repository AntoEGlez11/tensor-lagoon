import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { DatePipe } from '@angular/common'; // Import DatePipe
import { AuthService } from '../../../services/auth';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, DatePipe], // Add DatePipe
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css'
})
export class AdminLayout {
  private authService = inject(AuthService);
  user = this.authService.user;
  profile = this.authService.userProfile;
  today = new Date(); // Add today property

  // Sidebar State
  isDesktopExpanded = signal(false);

  constructor() {
    console.log('AdminLayout loaded');
  }

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
