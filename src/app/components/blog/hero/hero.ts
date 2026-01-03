import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-hero',
  imports: [RouterLink],
  templateUrl: './hero.html',
  styleUrl: './hero.css',
})
export class Hero implements OnInit, OnDestroy {
  images = [
    'https://placehold.co/1920x1080/1a1a1a/FFF?text=Car+Wash+1',
    'https://placehold.co/1920x1080/2a2a2a/FFF?text=Car+Wash+2',
    'https://placehold.co/1920x1080/3a3a3a/FFF?text=Car+Wash+3'
  ];
  currentIndex = signal(0);
  private intervalId: any;

  ngOnInit() {
    this.intervalId = setInterval(() => {
      this.currentIndex.update(i => (i + 1) % this.images.length);
    }, 5000); // Rotate every 5 seconds
  }

  ngOnDestroy() {
    if (this.intervalId) clearInterval(this.intervalId);
  }
}
