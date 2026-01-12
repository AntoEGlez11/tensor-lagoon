import { Component, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { CrmService, InventoryProduct } from '../../../services/crm';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastService } from '../../../services/toast';

@Component({
    selector: 'app-inventory-manager',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './inventory-manager.html',
    styleUrl: './inventory-manager.css'
})
export class InventoryManager {
    crm = inject(CrmService);
    toast = inject(ToastService);
    fb = inject(FormBuilder);

    products = signal<InventoryProduct[]>([]);
    viewMode = signal<'list' | 'form'>('list');
    selectedProductId = signal<string | null>(null);

    productForm = this.fb.nonNullable.group({
        name: ['', Validators.required],
        category: ['', Validators.required],
        stock: [0, [Validators.required, Validators.min(0)]],
        unit: ['piezas', Validators.required],
        minStock: [5, [Validators.required, Validators.min(0)]]
    });

    constructor() {
        this.loadInventory();
    }

    loadInventory() {
        console.log('INIT: Loading Inventory...');
        this.crm.getInventory((data) => {
            console.log('DATA: Inventory received:', data);
            this.products.set(data);
        });
    }

    // --- Navigation ---
    goToList() {
        this.viewMode.set('list');
        this.selectedProductId.set(null);
        this.productForm.reset({ stock: 0, unit: 'piezas', minStock: 5 });
    }

    goToCreate() {
        this.productForm.reset({ stock: 0, unit: 'piezas', minStock: 5 });
        this.selectedProductId.set(null);
        this.viewMode.set('form');
    }

    editProduct(product: InventoryProduct) {
        this.selectedProductId.set(product.id!);
        this.productForm.patchValue({
            name: product.name,
            category: product.category,
            stock: product.stock,
            unit: product.unit,
            minStock: product.minStock
        });
        this.viewMode.set('form');
    }

    // --- Actions ---
    async saveProduct() {
        if (this.productForm.invalid) return;

        try {
            const val = this.productForm.getRawValue();
            if (this.selectedProductId()) {
                await this.crm.updateProduct(this.selectedProductId()!, val);
                this.toast.show('Producto actualizado', 'success');
            } else {
                await this.crm.addProduct(val);
                this.toast.show('Producto agregado', 'success');
            }
            this.goToList();
        } catch (err: any) {
            this.toast.show('Error al guardar', 'error');
            console.error(err);
        }
    }

    async deleteProduct(id: string) {
        if (!confirm('¿Eliminar producto del inventario?')) return;
        try {
            await this.crm.deleteProduct(id);
            this.toast.show('Producto eliminado', 'success');
        } catch (err: any) {
            this.toast.show('Error al eliminar', 'error');
        }
    }

    async adjustStock(product: InventoryProduct, amount: number, event: Event) {
        event.stopPropagation();
        try {
            await this.crm.adjustStock(product.id!, product.stock, amount);
            // Toast might be annoying for quick clicks, maybe skip or generic 'Saved'
        } catch (err) {
            this.toast.show('Error al ajustar stock', 'error');
        }
    }
}
