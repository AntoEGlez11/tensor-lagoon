import { Component, inject, ChangeDetectionStrategy, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../services/auth';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.html',
  styleUrl: './header.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Header {
  auth = inject(AuthService);
  user = this.auth.user;
  profile = this.auth.userProfile;
  isAdmin = this.auth.isAdmin;

  isOpen = signal(false);

  toggleMenu() {
    this.isOpen.update(v => !v);
  }

  closeMenu() {
    this.isOpen.set(false);
  }

  logout() {
    this.auth.logout();
    this.closeMenu();
  }
}
