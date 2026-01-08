import { Component, inject, signal, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormArray } from '@angular/forms';
import { CrmService, ServiceOffering } from '../../../services/crm';
import { ToastService } from '../../../services/toast';
import { Unsubscribe } from '@angular/fire/firestore';

@Component({
    selector: 'app-service-manager',
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './service-manager.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ServiceManager implements OnInit, OnDestroy {
    private crm = inject(CrmService);
    private fb = inject(FormBuilder);
    private toast = inject(ToastService);
    private unsub?: Unsubscribe;

    offerings = signal<ServiceOffering[]>([]);
    showCreateForm = signal(false);
    editingId = signal<string | null>(null);

    form = this.fb.nonNullable.group({
        title: ['', [Validators.required, Validators.maxLength(100), Validators.minLength(3)]],
        price: ['', [Validators.required, Validators.min(0)]],
        features: this.fb.array<string>([]),
        recommended: [false]
    });

    // Helper for FormArray
    get features() {
        return this.form.get('features') as FormArray;
    }

    addFeature(value: string = '') {
        this.features.push(this.fb.control(value, Validators.required));
    }

    removeFeature(index: number) {
        this.features.removeAt(index);
    }

    ngOnInit() {
        this.unsub = this.crm.getServiceOfferings((data) => {
            this.offerings.set(data);
        });
    }

    ngOnDestroy() {
        if (this.unsub) this.unsub();
    }

    startEdit(service?: ServiceOffering) {
        this.features.clear();

        if (service) {
            this.editingId.set(service.id!);
            this.form.patchValue({
                title: service.title,
                price: service.price,
                recommended: service.recommended
            });
            service.features.forEach(f => this.addFeature(f));
        } else {
            this.editingId.set(null);
            this.form.reset();
            this.addFeature(); // Add one empty feature by default
        }

        this.showCreateForm.set(true);
    }

    cancelEdit() {
        this.showCreateForm.set(false);
        this.editingId.set(null);
        this.form.reset();
    }

    async save() {
        if (this.form.invalid) return;

        const data = this.form.getRawValue();
        const serviceData: ServiceOffering = {
            title: data.title,
            price: data.price,
            features: data.features as string[],
            recommended: data.recommended
        };

        try {
            if (this.editingId()) {
                await this.crm.updateServiceOffering(this.editingId()!, serviceData);
                this.toast.show('Service updated successfully!', 'success');
            } else {
                await this.crm.addServiceOffering(serviceData);
                this.toast.show('Service created successfully!', 'success');
            }
            this.cancelEdit();
        } catch (err) {
            console.error(err);
            this.toast.show('Failed to save service', 'error');
        }
    }

    async delete(id: string) {
        if (confirm('Are you sure? This will remove the service from the public website.')) {
            try {
                await this.crm.deleteServiceOffering(id);
                this.toast.show('Service deleted', 'info');
            } catch (err) {
                console.error(err);
                this.toast.show('Failed to delete service', 'error');
            }
        }
    }
}
