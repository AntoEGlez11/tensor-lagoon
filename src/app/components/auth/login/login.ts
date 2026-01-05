import { Component, inject, signal, effect } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../services/auth';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  error = signal<string>('');
  loading = signal<boolean>(false);

  constructor() {
    effect(() => {
      const profile = this.authService.userProfile();
      if (profile) {
        if (profile.role === 'admin') {
          this.router.navigate(['/admin']);
        } else {
          this.router.navigate(['/dashboard']);
        }
      }
    });
  }

  loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  async onSubmit() {
    if (this.loginForm.invalid) return;

    this.loading.set(true);
    this.error.set('');

    const { email, password } = this.loginForm.getRawValue();

    try {
      await this.authService.login(email, password);
      // Navigation is handled by the effect above once profile is loaded
    } catch (err: any) {
      this.error.set('Invalid credentials. Please try again.');
      this.loading.set(false);
    }
  }
}
