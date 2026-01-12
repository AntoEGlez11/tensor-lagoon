import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Hero } from '../../blog/hero/hero';
import { CrmService, ServiceOffering, Testimonial } from '../../../services/crm';
import { Unsubscribe } from '@angular/fire/firestore';

@Component({
    selector: 'app-home',
    imports: [CommonModule, RouterLink, Hero],
    templateUrl: './home.html'
})
export class Home implements OnInit, OnDestroy {
    private crm = inject(CrmService);
    private unsub?: Unsubscribe;
    private unsubTestimonials?: Unsubscribe;

    featuredServices = signal<ServiceOffering[]>([]);
    testimonials = signal<Testimonial[]>([]);
    activeRaffle = signal<any | null>(null);

    private unsubRaffle?: Unsubscribe;

    ngOnInit() {
        this.unsub = this.crm.getServiceOfferings((data) => {
            // Filter for recommended services, limit to 3
            const featured = data.filter(s => s.recommended).slice(0, 3);
            this.featuredServices.set(featured);
        });

        // Seed if empty, then fetch
        this.crm.seedTestimonials();
        this.unsubTestimonials = this.crm.getTestimonials((data) => {
            this.testimonials.set(data);
        });

        this.unsubRaffle = this.crm.getActiveRaffle((raffle) => {
            this.activeRaffle.set(raffle);
        });

        // Force check for seeding
        this.crm.checkAndSeedRaffle();
    }

    ngOnDestroy() {
        if (this.unsub) this.unsub();
        if (this.unsubTestimonials) this.unsubTestimonials();
        if (this.unsubRaffle) this.unsubRaffle();
    }
}

