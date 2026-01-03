
import { Component, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Firestore, collection, addDoc, collectionData, doc, deleteDoc, updateDoc } from '@angular/fire/firestore';
import { ToastService } from '../../../services/toast';
import { BlogService, BlogPost } from '../../../services/blog';

@Component({
    selector: 'app-blog-manager',
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './blog-manager.html'
})
export class BlogManager {
    private blogService = inject(BlogService);
    private fb = inject(FormBuilder);
    private toast = inject(ToastService);

    posts = this.blogService.posts;
    showCreateForm = signal(false);
    editingId = signal<string | null>(null);

    createForm = this.fb.nonNullable.group({
        title: ['', Validators.required],
        excerpt: ['', Validators.required],
        category: ['Detailing', Validators.required],
        image: ['https://placehold.co/600x400/1a1a1a/FFF?text=Blog+Image', Validators.required]
    });

    editPost(post: BlogPost) {
        this.editingId.set(post.id!);
        this.createForm.patchValue({
            title: post.title,
            excerpt: post.excerpt,
            category: post.category,
            image: post.image
        });
        this.showCreateForm.set(true);
    }

    cancelEdit() {
        this.showCreateForm.set(false);
        this.editingId.set(null);
        this.createForm.reset({ category: 'News' });
        this.showCreateForm.set(false);
    }

    async savePost() {
        if (this.createForm.invalid) return;

        const postData = this.createForm.getRawValue();
        const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        try {
            if (this.editingId()) {
                await this.blogService.updatePost(this.editingId()!, {
                    ...postData,
                    date: new Date().toLocaleDateString()
                });
                this.toast.show('Post updated successfully!', 'success');
            } else {
                await this.blogService.createPost({
                    ...postData,
                    date: new Date().toLocaleDateString(),
                    content: ''
                });
                this.toast.show('Post published successfully!', 'success');
            }

            this.cancelEdit();
        } catch (err) {
            console.error(err);
            this.toast.show('Failed to save post', 'error');
        }
    }

    async deletePost(id: string) {
        if (confirm('Are you sure you want to delete this post?')) {
            try {
                await this.blogService.deletePost(id);
                this.toast.show('Post deleted successfully', 'info');
            } catch (err) {
                console.error(err);
                this.toast.show('Failed to delete post', 'error');
            }
        }
    }
}
