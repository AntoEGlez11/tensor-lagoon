import { Component, EventEmitter, Input, Output, Signal, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    format,
    isSameMonth,
    isSameDay,
    addMonths,
    subMonths,
    isToday
} from 'date-fns';
import { es } from 'date-fns/locale';

@Component({
    selector: 'app-calendar',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './calendar.html'
})
export class CalendarComponent {
    // Current view date (to track month)
    viewDate = signal(new Date());

    // Selected date (for interaction)
    @Input() selectedDate: Date | null = null;
    @Output() dateSelected = new EventEmitter<Date>();

    // Computed days for the grid
    days = computed(() => {
        const start = startOfWeek(startOfMonth(this.viewDate()));
        const end = endOfWeek(endOfMonth(this.viewDate()));
        return eachDayOfInterval({ start, end });
    });

    // Header string e.g. "Enero 2024"
    monthLabel = computed(() => {
        return format(this.viewDate(), 'MMMM yyyy', { locale: es });
    });

    weekDayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    // Actions
    prevMonth() {
        this.viewDate.update(d => subMonths(d, 1));
    }

    nextMonth() {
        this.viewDate.update(d => addMonths(d, 1));
    }

    selectDate(day: Date) {
        this.dateSelected.emit(day);
    }

    // Helpers for template
    isCurrentMonth(day: Date): boolean {
        return isSameMonth(day, this.viewDate());
    }

    isSelected(day: Date): boolean {
        return this.selectedDate ? isSameDay(day, this.selectedDate) : false;
    }

    isDayToday(day: Date): boolean {
        return isToday(day);
    }
}
