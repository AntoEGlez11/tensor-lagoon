import { Component, inject } from '@angular/core';
import { PostCard } from '../post-card/post-card';
import { BlogService } from '../../../services/blog';

@Component({
  selector: 'app-post-list',
  imports: [PostCard],
  templateUrl: './post-list.html',
  styleUrl: './post-list.css',
})
export class PostList {
  private blogService = inject(BlogService);
  protected posts = this.blogService.posts;
}
