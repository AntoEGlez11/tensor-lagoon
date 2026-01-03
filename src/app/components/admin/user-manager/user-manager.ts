import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { CrmService, UserProfile } from '../../../services/crm';
import { ToastService } from '../../../services/toast';
import { Unsubscribe } from '@angular/fire/firestore';
import { AuthService } from '../../../services/auth';

@Component({
    selector: 'app-user-manager',
    imports: [CommonModule, DatePipe],
    templateUrl: './user-manager.html',
})
export class UserManager implements OnInit, OnDestroy {
    private crm = inject(CrmService);
    private authService = inject(AuthService);
    currentUser = this.authService.user;

    users = signal<UserProfile[]>([]);
    private unsub?: Unsubscribe;

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
