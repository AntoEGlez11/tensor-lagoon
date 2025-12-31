import { Component, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BlogService, BlogPost } from '../../../services/blog';

@Component({
    selector: 'app-blog-manager',
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './blog-manager.html'
})
export class BlogManager {
    private blogService = inject(BlogService);
    private fb = inject(FormBuilder);

    posts = this.blogService.posts;
    showCreateForm = signal(false);

    createForm = this.fb.nonNullable.group({
        title: ['', Validators.required],
        excerpt: ['', Validators.required],
        category: ['Detailing', Validators.required],
        image: ['https://placehold.co/600x400/1a1a1a/FFF?text=Blog+Image', Validators.required]
    });

    async createPost() {
        if (this.createForm.invalid) return;

        const formVal = this.createForm.getRawValue();

        // Auto-generate a readable date string for now
        const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        try {
            await this.blogService.createPost({
                ...formVal,
                date: dateStr,
                content: ''
            });

            this.showCreateForm.set(false);
            this.createForm.reset({
                category: 'Detailing',
                image: 'https://placehold.co/600x400/1a1a1a/FFF?text=Blog+Image'
            });
        } catch (err) {
            console.error(err);
            alert('Failed to create post');
        }
    }

    async deletePost(id: string) {
        if (confirm('Are you sure you want to delete this post?')) {
            await this.blogService.deletePost(id);
        }
    }
}
