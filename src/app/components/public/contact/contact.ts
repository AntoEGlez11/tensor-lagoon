import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastService } from '../../../services/toast';
import { CAR_BRANDS, MOTO_BRANDS, TRUCK_BRANDS, VEHICLE_YEARS, VEHICLE_COLORS } from '../../../data/vehicles';
import { CrmService } from '../../../services/crm';
import { OnlyNumbersDirective, OnlyLettersDirective } from '../../../directives/input-restrictions';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, OnlyNumbersDirective, OnlyLettersDirective], // RouterLink if needed
  templateUrl: './contact.html',
  styleUrl: './contact.css'
})
export class Contact {
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  private crm = inject(CrmService);

  contactForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
    message: ['', [Validators.required, Validators.minLength(4)]],

    // Vehicle Section
    includeVehicle: [false],
    vehicleType: ['car'], // Default to car
    vehicleBrand: [''],
    vehicleModel: [''],
    vehicleYear: [''],
    vehicleColor: ['']
  });

  isSubmitting = signal(false);

  // Data for Dropdowns
  vehicleBrands = signal<string[]>([]);
  vehicleModels = signal<string[]>([]);
  vehicleYears = VEHICLE_YEARS;
  vehicleColors = VEHICLE_COLORS;

  constructor() {
    this.updateBrandList('car'); // Init brands

    // Watchers for cascading dropdowns
    this.contactForm.get('vehicleType')?.valueChanges.subscribe(type => {
      this.updateBrandList(type as 'car' | 'moto' | 'truck');
      this.contactForm.patchValue({ vehicleBrand: '', vehicleModel: '' });
    });

    this.contactForm.get('vehicleBrand')?.valueChanges.subscribe(brand => {
      const type = this.contactForm.get('vehicleType')?.value as 'car' | 'moto' | 'truck';
      let source = CAR_BRANDS;
      if (type === 'moto') source = MOTO_BRANDS;
      if (type === 'truck') source = TRUCK_BRANDS;

      if (brand && source[brand]) {
        this.vehicleModels.set(source[brand]);
        this.contactForm.patchValue({ vehicleModel: '' });
      } else {
        this.vehicleModels.set([]);
      }
    });

    // Conditional Validation for Vehicle Data
    this.contactForm.get('includeVehicle')?.valueChanges.subscribe(checked => {
      const fields = ['vehicleBrand', 'vehicleModel', 'vehicleYear', 'vehicleColor'];
      if (checked) {
        fields.forEach(f => {
          this.contactForm.get(f)?.setValidators([Validators.required]);
          this.contactForm.get(f)?.updateValueAndValidity();
        });
      } else {
        fields.forEach(f => {
          this.contactForm.get(f)?.clearValidators();
          this.contactForm.get(f)?.updateValueAndValidity();
        });
      }
    });
  }

  updateBrandList(type: 'car' | 'moto' | 'truck') {
    let brands: string[] = [];
    if (type === 'moto') brands = Object.keys(MOTO_BRANDS);
    else if (type === 'truck') brands = Object.keys(TRUCK_BRANDS);
    else brands = Object.keys(CAR_BRANDS);
    this.vehicleBrands.set(brands.sort());
  }

  async onSubmit() {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    try {
      const val = this.contactForm.getRawValue();

      let vehicleData = null;
      if (val.includeVehicle) {
        vehicleData = {
          brand: val.vehicleBrand,
          model: val.vehicleModel,
          year: val.vehicleYear,
          color: val.vehicleColor
        };
      }

      await this.crm.saveContactMessage({
        name: val.name,
        email: val.email,
        phone: val.phone,
        message: val.message,
        vehicle: vehicleData
      });

      this.toast.show('¡Mensaje enviado correctamente! Nos pondremos en contacto contigo pronto.', 'success');
      this.contactForm.reset({ includeVehicle: false, vehicleType: 'car' });
      this.isSubmitting.set(false);

    } catch (err) {
      console.error(err);
      this.toast.show('Error al enviar mensaje. Intenta de nuevo.', 'error');
      this.isSubmitting.set(false);
    }
  }
}
