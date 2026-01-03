import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CrmService, ServiceOffering } from '../../../services/crm';
import { Unsubscribe } from '@angular/fire/firestore';

@Component({
  selector: 'app-services',
  imports: [],
  templateUrl: './services.html',
  styleUrl: './services.css'
})
export class Services implements OnInit, OnDestroy {
  private crm = inject(CrmService);
  private unsub?: Unsubscribe;

  packages = signal<ServiceOffering[]>([]);

  ngOnInit() {
    this.unsub = this.crm.getServiceOfferings((data) => {
      // If no data (first load), fallback to initial data or keep empty
      // For now we just show what's in DB.
      this.packages.set(data);
    });
  }

  ngOnDestroy() {
    if (this.unsub) this.unsub();
  }
}
