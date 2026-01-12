import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { CrmService } from '../../../services/crm';
import { ToastService } from '../../../services/toast';

// Custom Date Validator
function dateRangeValidator(group: AbstractControl): ValidationErrors | null {
  const start = group.get('startDate')?.value;
  const end = group.get('endDate')?.value;
  if (start && end && new Date(start) >= new Date(end)) {
    return { invalidRange: true };
  }
  return null;
}

@Component({
  selector: 'app-raffle-manager',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePipe],
  templateUrl: './raffle-manager.html',
  styleUrl: './raffle-manager.css'
})
export class RaffleManager {
  crm = inject(CrmService);
  toast = inject(ToastService);
  fb = inject(FormBuilder);

  // Data
  raffles = signal<any[]>([]);
  participants = signal<any[]>([]);

  // UI State
  viewMode = signal<'list' | 'form' | 'participants'>('list');
  selectedRaffleId = signal<string | null>(null);

  // Forms
  raffleForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
    description: [''],
    terms: [''], // New field
    price: [50, [Validators.required, Validators.min(1)]],
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
    status: ['inactive', Validators.required]
  }, { validators: dateRangeValidator });

  constructor() {
    this.loadRaffles();
  }

  loadRaffles() {
    this.crm.getRaffles((data) => this.raffles.set(data));
  }

  // --- Navigation ---
  goToList() {
    this.viewMode.set('list');
    this.selectedRaffleId.set(null);
    this.participants.set([]);
  }

  goToCreate() {
    this.raffleForm.reset({ price: 50, status: 'inactive' });
    this.selectedRaffleId.set(null);
    this.viewMode.set('form');
  }

  editRaffle(raffle: any) {
    this.selectedRaffleId.set(raffle.id);
    this.raffleForm.patchValue({
      title: raffle.title,
      description: raffle.description,
      terms: raffle.terms || '', // Load terms
      price: raffle.price,
      startDate: raffle.startDate,
      endDate: raffle.endDate,
      status: raffle.status
    });
    this.viewMode.set('form');
  }

  async viewParticipants(raffleId: string) {
    this.selectedRaffleId.set(raffleId);
    this.viewMode.set('participants');
    this.crm.getRaffleEntries(raffleId, (data) => this.participants.set(data));
  }

  // --- Actions ---
  async saveRaffle() {
    if (this.raffleForm.invalid) return;

    const val = this.raffleForm.getRawValue();
    try {
      if (this.selectedRaffleId()) {
        // Update
        await this.crm.updateRaffle(this.selectedRaffleId()!, val);
        this.toast.show('Sorteo actualizado', 'success');
      } else {
        // Create
        await this.crm.createRaffle(val);
        this.toast.show('Sorteo creado', 'success');
      }
      this.goToList();
    } catch (err: any) {
      this.toast.show('Error al guardar', 'error');
      this.crm.logSystemError('saveRaffle', err);
    }
  }

  async deleteRaffle(id: string) {
    if (!confirm('¿Eliminar sorteo?')) return;
    try {
      await this.crm.deleteRaffle(id);
      this.toast.show('Sorteo eliminado', 'success');
    } catch (err: any) {
      this.toast.show('Error al eliminar', 'error');
    }
  }

  async toggleParticipantStatus(entry: any) {
    const newStatus = entry.status === 'verified' ? 'pending_payment' : 'verified';
    try {
      await this.crm.verifyRaffleEntry(entry.id, newStatus === 'verified');
      this.toast.show('Estatus actualizado', 'success');
    } catch (err: any) {
      this.toast.show('Error al actualizar', 'error');
    }
  }
}
