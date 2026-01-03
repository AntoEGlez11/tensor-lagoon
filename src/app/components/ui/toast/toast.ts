import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../services/toast';

@Component({
  selector: 'app-toast',
  imports: [CommonModule],
  template: `
    <div class="fixed top-20 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="pointer-events-auto min-w-[300px] p-4 rounded-lg shadow-lg text-white font-medium transform transition-all animate-slide-in flex items-center justify-between"
             [class.bg-green-600]="toast.type === 'success'"
             [class.bg-red-600]="toast.type === 'error'"
             [class.bg-blue-600]="toast.type === 'info'">
          <span>{{ toast.message }}</span>
          <button (click)="toastService.remove(toast.id)" class="ml-4 hover:opacity-75">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    .animate-slide-in {
      animation: slideIn 0.3s ease-out forwards;
    }
  `]
})
export class ToastComponent {
  toastService = inject(ToastService);
}
