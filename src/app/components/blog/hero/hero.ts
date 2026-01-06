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
    'assets/images/slide-1.jpg',
    'assets/images/slide-2.jpg',
    'assets/images/slide-3.jpg',
    'assets/images/slide-4.jpg',
    'assets/images/slide-5.jpg'
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
