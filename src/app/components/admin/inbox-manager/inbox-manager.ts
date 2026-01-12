import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { CrmService, ContactMessage } from '../../../services/crm';
import { ToastService } from '../../../services/toast';

@Component({
    selector: 'app-inbox-manager',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './inbox-manager.html',
    styles: [`
    :host { display: block; }
  `]
})
export class InboxManager implements OnInit {
    private crm = inject(CrmService);
    private toast = inject(ToastService);

    messages = signal<ContactMessage[]>([]);
    selectedMessage = signal<ContactMessage | null>(null);

    ngOnInit() {
        this.crm.getMessages((data) => {
            this.messages.set(data);
        });
    }

    selectMessage(msg: ContactMessage) {
        this.selectedMessage.set(msg);
        if (msg.status === 'new' && msg.id) {
            this.markAsRead(msg.id);
        }
    }

    async markAsRead(id: string) {
        try {
            await this.crm.updateMessageStatus(id, 'read');
        } catch (err) {
            console.error('Error marking as read', err);
        }
    }

    async archiveMessage(id: string | undefined, event?: Event) {
        if (event) event.stopPropagation();
        if (!id) return;

        try {
            await this.crm.updateMessageStatus(id, 'archived');
            this.toast.show('Mensaje archivado', 'success');
            if (this.selectedMessage()?.id === id) {
                this.selectedMessage.set(null);
            }
        } catch (err) {
            console.error(err);
            this.toast.show('Error al archivar', 'error');
        }
    }

    // Modal Control
    replyModalOpen = signal(false);
    replyControl = new FormControl('', { validators: [Validators.required] });

    openReaderModal() {
        this.replyModalOpen.set(true);
        this.replyControl.reset();
    }

    closeReplyModal() {
        this.replyModalOpen.set(false);
    }

    // Smart Actions
    saveAndClose() {
        // Mark as replied logic if we had a status for it, currently treating as 'read' or 'archived'
        // For now just close, user will see the external app open
        this.closeReplyModal();
    }

    sendViaWhatsApp() {
        const msg = this.selectedMessage();
        const text = this.replyControl.value || '';
        if (!msg?.phone || !text) return;

        // Clean phone number (remove non-digits)
        const cleanPhone = msg.phone.replace(/\D/g, '');
        // Desktop-first approach as requested
        const url = `https://web.whatsapp.com/send?phone=52${cleanPhone}&text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
        this.saveAndClose();
    }

    sendViaEmail() {
        const msg = this.selectedMessage();
        const text = this.replyControl.value || '';
        if (!msg?.email || !text) return;

        const url = `mailto:${msg.email}?subject=Respuesta de Estrada CD&body=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
        this.saveAndClose();
    }
}
