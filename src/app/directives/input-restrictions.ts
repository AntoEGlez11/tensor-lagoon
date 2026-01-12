import { Directive, HostListener, ElementRef, inject } from '@angular/core';
import { NgControl } from '@angular/forms';

@Directive({
    selector: '[appOnlyNumbers]',
    standalone: true
})
export class OnlyNumbersDirective {
    private control = inject(NgControl, { optional: true });

    constructor(private el: ElementRef) { }

    @HostListener('input', ['$event']) onInputChange(event: InputEvent) {
        const input = this.el.nativeElement;
        let value = input.value.replace(/[^0-9]*/g, '');

        if (input.maxLength && input.maxLength > 0 && value.length > input.maxLength) {
            value = value.slice(0, input.maxLength);
        }

        if (input.value !== value) {
            input.value = value;
            if (this.control && this.control.control) {
                this.control.control.setValue(value, { emitEvent: false });
            }
            event.stopPropagation();
        }
    }
}

@Directive({
    selector: '[appOnlyLetters]',
    standalone: true
})
export class OnlyLettersDirective {
    constructor(private el: ElementRef) { }

    @HostListener('input', ['$event']) onInputChange(event: InputEvent) {
        const initialValue = this.el.nativeElement.value;
        // Allow letters, spaces, and common accents
        this.el.nativeElement.value = initialValue.replace(/[^a-zA-ZÀ-ÿ\u00f1\u00d1\s]*/g, '');
        if (initialValue !== this.el.nativeElement.value) {
            event.stopPropagation();
        }
    }
}

@Directive({
    selector: '[appUppercase]',
    standalone: true
})
export class UppercaseDirective {
    private control = inject(NgControl, { optional: true });

    constructor(private el: ElementRef) { }

    @HostListener('input', ['$event']) onInput(event: InputEvent) {
        const input = event.target as HTMLInputElement;
        const start = input.selectionStart;
        const end = input.selectionEnd;

        const upper = input.value.toUpperCase();
        input.value = upper;

        // Update form control if bound
        if (this.control && this.control.control) {
            this.control.control.setValue(upper, { emitEvent: false });
        }

        input.setSelectionRange(start, end);
    }
}
