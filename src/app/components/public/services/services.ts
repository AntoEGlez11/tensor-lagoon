import { Component, signal } from '@angular/core';

interface ServicePackage {
  title: string;
  price: string;
  features: string[];
  recommended?: boolean;
}

@Component({
  selector: 'app-services',
  imports: [],
  templateUrl: './services.html',
  styleUrl: './services.css'
})
export class Services {
  packages = signal<ServicePackage[]>([
    {
      title: 'Basic Wash',
      price: '$25',
      features: ['Exterior Hand Wash', 'Wheel Cleaning', 'Tire Shine', 'Window Cleaning'],
      recommended: false
    },
    {
      title: 'Premium Detail',
      price: '$85',
      features: ['Basic Wash Included', 'Interior Vacuum', 'Dashboard Wipe Down', 'Leather Conditioning', 'Wax Application'],
      recommended: true
    },
    {
      title: 'Ceramic Coating',
      price: '$250',
      features: ['Paint Correction', 'Clay Bar Treatment', '3-Year Ceramic Protection', 'Water Repellent', 'Enhanced Gloss'],
      recommended: false
    }
  ]);
}
