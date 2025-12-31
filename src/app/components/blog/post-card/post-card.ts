import { Component, Input } from '@angular/core';
import { BlogPost } from '../../../services/blog';

@Component({
  selector: 'app-post-card',
  imports: [],
  templateUrl: './post-card.html',
  styleUrl: './post-card.css',
})
export class PostCard {
  @Input({ required: true }) post!: BlogPost;
}
