import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CrmService, Testimonial } from '../../../services/crm';
import { ToastService } from '../../../services/toast';
import { Unsubscribe } from '@angular/fire/firestore';

@Component({
  selector: 'app-testimonial-manager',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './testimonial-manager.html'
})
export class TestimonialManager implements OnInit, OnDestroy {
  private crm = inject(CrmService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  private unsub?: Unsubscribe;

  testimonials = signal<Testimonial[]>([]);
  showCreateForm = signal(false);
  editingId = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    role: ['', Validators.required],
    text: ['', Validators.required]
  });

  ngOnInit() {
    this.unsub = this.crm.getTestimonials((data) => {
      this.testimonials.set(data);
    });
  }

  ngOnDestroy() {
    if (this.unsub) this.unsub();
  }

  startEdit(item?: Testimonial) {
    if (item) {
      this.editingId.set(item.id!);
      this.form.patchValue(item);
    } else {
      this.editingId.set(null);
      this.form.reset();
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
    try {
      if (this.editingId()) {
        await this.crm.updateTestimonial(this.editingId()!, data);
        this.toast.show('Testimonio actualizado', 'success');
      } else {
        await this.crm.addTestimonial(data);
        this.toast.show('Testimonio creado', 'success');
      }
      this.cancelEdit();
    } catch (err) {
      console.error(err);
      this.toast.show('Error al guardar', 'error');
    }
  }

  async delete(id: string) {
    if (confirm('¿Estás seguro de eliminar este testimonio?')) {
      try {
        await this.crm.deleteTestimonial(id);
        this.toast.show('Testimonio eliminado', 'info');
      } catch (err) {
        console.error(err);
        this.toast.show('Error al eliminar', 'error');
      }
    }
  }
}
