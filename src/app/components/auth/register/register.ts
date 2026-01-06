import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../services/auth';

/** Custom validator to check for repetitive numbers like '1111111111' */
function nonRepetitiveValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (!value) return null;

  // Check if all characters are the same
  if (/^(\d)\1+$/.test(value)) {
    return { repetitive: true };
  }
  return null;
}

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  error = signal<string>('');
  loading = signal<boolean>(false);

  registerForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern('^[0-9]{10}$'), nonRepetitiveValidator]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]]
  });

  async onSubmit() {
    if (this.registerForm.invalid) return;

    const { email, phone, password, confirmPassword } = this.registerForm.getRawValue();

    if (password !== confirmPassword) {
      this.error.set('Las contraseñas no coinciden');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    try {
      await this.authService.register(email, password, phone);
      // Navigation logic
      const returnUrl = this.route.snapshot.queryParams['returnUrl'];
      if (returnUrl) {
        this.router.navigateByUrl(returnUrl);
      } else {
        this.router.navigate(['/dashboard']);
      }
    } catch (err: any) {
      console.error(err);
      let msg = 'Error en registro';
      if (err.code === 'auth/email-already-in-use') msg = 'El correo ya está registrado';
      this.error.set(msg);
      this.loading.set(false);
    }
  }
}
