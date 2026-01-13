
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
        content: [''], // Full content (optional for now, or required)
        category: ['Detailing', Validators.required],
        image: ['https://placehold.co/600x400/1a1a1a/FFF?text=Blog+Image', Validators.required]
    });

    editPost(post: BlogPost) {
        this.editingId.set(post.id!);
        this.createForm.patchValue({
            title: post.title,
            excerpt: post.excerpt,
            content: post.content || '',
            category: post.category,
            image: post.image
        });
        this.showCreateForm.set(true);
    }

    cancelEdit() {
        this.showCreateForm.set(false);
        this.editingId.set(null);
        this.createForm.reset({ category: 'Noticias' }); // Default cat in Spanish?
        // Let's keep internal values English for IDs if we want unique IDs logic, 
        // but UI shows Spanish. The options in HTML are: Detailing, Mantenimiento, Noticias, Tips
        // So default should match one of those.
        this.createForm.patchValue({ category: 'Noticias' });
    }

    async savePost() {
        if (this.createForm.invalid) return;

        const postData = this.createForm.getRawValue();

        // Use Spanish Date Format? Or standard ISO?
        // Let's use a nice readable format
        const dateStr = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });

        try {
            if (this.editingId()) {
                await this.blogService.updatePost(this.editingId()!, {
                    ...postData,
                    date: dateStr // Update date on edit? Maybe optional. Let's update it to show "Last Updated" effectively.
                });
                this.toast.show('¡Artículo actualizado correctamente!', 'success');
            } else {
                await this.blogService.createPost({
                    ...postData,
                    date: dateStr
                });
                this.toast.show('¡Artículo publicado correctamente!', 'success');
            }

            this.cancelEdit();
        } catch (err) {
            console.error(err);
            this.toast.show('Error al guardar el artículo', 'error');
        }
    }

    async deletePost(id: string) {
        if (confirm('¿Estás seguro que deseas eliminar esta publicación?')) {
            try {
                await this.blogService.deletePost(id);
                this.toast.show('Artículo eliminado', 'success');
            } catch (err) {
                console.error(err);
                this.toast.show('Error al eliminar', 'error');
            }
        }
    }
}
