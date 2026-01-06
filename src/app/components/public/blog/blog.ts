import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BlogService } from '../../../services/blog';
import { Hero } from '../../blog/hero/hero';
import { PostCard } from '../../blog/post-card/post-card';

@Component({
    selector: 'app-blog',
    imports: [CommonModule, PostCard],
    templateUrl: './blog.html',
})
export class Blog {
    private blogService = inject(BlogService);
    posts = this.blogService.posts;
}
