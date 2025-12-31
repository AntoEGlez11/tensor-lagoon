import { Injectable, signal } from '@angular/core';

export interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  image: string;
  date: string;
  category: string;
}

@Injectable({
  providedIn: 'root'
})
export class BlogService {
  // Mock data for initial development
  readonly posts = signal<BlogPost[]>([
    {
      id: '1',
      title: 'The Ultimate Guide to Ceramic Coating',
      excerpt: 'Discover why ceramic coating is the best investment for your vehicle\'s longevity and shine.',
      image: 'https://placehold.co/600x400/1a1a1a/FFF?text=Ceramic+Coating',
      date: 'Oct 12, 2024',
      category: 'Protection'
    },
    {
      id: '2',
      title: 'Interior Detailing: More Than Just a Vacuum',
      excerpt: 'Learn the secrets of deep cleaning your car\'s interior to remove allergens and odors.',
      image: 'https://placehold.co/600x400/1a1a1a/FFF?text=Interior+Detail',
      date: 'Oct 15, 2024',
      category: 'Detailing'
    },
    {
      id: '3',
      title: 'Paint Correction vs. Polishing',
      excerpt: 'Understanding the difference between simple polishing and full paint correction.',
      image: 'https://placehold.co/600x400/1a1a1a/FFF?text=Paint+Correction',
      date: 'Oct 20, 2024',
      category: 'Restoration'
    }
  ]);
}
