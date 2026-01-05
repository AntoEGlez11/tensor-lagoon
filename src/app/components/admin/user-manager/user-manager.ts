import { Component, inject, signal, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CrmService, UserProfile } from '../../../services/crm';
import { ToastService } from '../../../services/toast';
import { Unsubscribe } from '@angular/fire/firestore';
import { AuthService } from '../../../services/auth';

@Component({
    selector: 'app-user-manager',
    imports: [CommonModule, DatePipe, ReactiveFormsModule],
    templateUrl: './user-manager.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserManager implements OnInit, OnDestroy {
    private crm = inject(CrmService);
    private authService = inject(AuthService);
    private fb = inject(FormBuilder);
    currentUser = this.authService.user;

    users = signal<UserProfile[]>([]);
    private unsub?: Unsubscribe;

    // Edit Modal State
    isEditModalOpen = signal(false);
    selectedUser = signal<UserProfile | null>(null);

    editForm = this.fb.group({
        name: ['', Validators.required],
        phone: ['', Validators.required],
        address: [''],
        vehicleModel: [''],
        vehicleYear: [''],
        vehicleColor: [''],
        role: ['customer', Validators.required]
    });

    ngOnInit() {
        console.log('UserManager initialized');
        this.unsub = this.crm.getAllUsers((data) => {
            console.log('Users received:', data);
            this.users.set(data);
        });
    }

    ngOnDestroy() {
        if (this.unsub) this.unsub();
    }

    private toast = inject(ToastService);

    // Detail Panel State
    isDetailPanelOpen = signal(false);
    viewedUser = signal<UserProfile | null>(null);

    openDetailPanel(user: UserProfile) {
        this.viewedUser.set(user);
        this.isDetailPanelOpen.set(true);
    }

    closeDetailPanel() {
        this.isDetailPanelOpen.set(false);
        this.viewedUser.set(null);
    }

    openEditModal(user: UserProfile) {
        // If opening edit from detail panel, keep detail panel open or close it?
        // Let's close it for cleaner focus, or keep it behind.
        // For now, close detail to avoid z-index wars unless we manage stack.
        this.closeDetailPanel();

        this.selectedUser.set(user);
        this.editForm.patchValue({
            name: user.name || '',
            phone: user.phone || '',
            address: user.address || '',
            vehicleModel: user.vehicleModel || '',
            vehicleYear: user.vehicleYear || '',
            vehicleColor: user.vehicleColor || '',
            role: user.role
        });
        this.isEditModalOpen.set(true);
    }

    closeEditModal() {
        this.isEditModalOpen.set(false);
        this.selectedUser.set(null);
        this.editForm.reset();
    }

    async saveUser() {
        if (this.editForm.invalid) return;

        const user = this.selectedUser();
        if (!user || !user.uid) return;

        const formValues = this.editForm.value;

        try {
            await this.crm.updateUserProfile(user.uid, {
                name: formValues.name || '',
                phone: formValues.phone || '',
                address: formValues.address || null, // Use null for optional fields to clear them
                vehicleModel: formValues.vehicleModel || null,
                vehicleYear: formValues.vehicleYear || null,
                vehicleColor: formValues.vehicleColor || null,
                role: (formValues.role || 'customer') as 'admin' | 'customer'
            });
            this.toast.show('User updated successfully!', 'success');
            this.closeEditModal();
        } catch (err) {
            console.error(err);
            this.toast.show('Failed to update user', 'error');
        }
    }

    async toggleRole(user: UserProfile) {
        if (user.uid === this.currentUser()?.uid) {
            this.toast.show("You cannot change your own role!", 'error');
            return;
        }

        const newRole = user.role === 'admin' ? 'customer' : 'admin';
        const action = newRole === 'admin' ? 'Promote' : 'Demote';

        if (confirm(`Are you sure you want to ${action} ${user.email} to ${newRole}?`)) {
            try {
                await this.crm.updateUserRole(user.uid!, newRole);
                this.toast.show(`User ${action}d to ${newRole} successfully!`, 'success');
            } catch (err) {
                console.error(err);
                this.toast.show('Failed to update user role', 'error');
            }
        }
    }
}
