import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BlogService, BlogPost } from '../../../../services/blog';
import { Hero } from '../../hero/hero';

@Component({
    selector: 'app-post-detail',
    imports: [CommonModule, RouterLink, Hero],
    templateUrl: './post-detail.html',
})
export class PostDetail implements OnInit {
    private route = inject(ActivatedRoute);
    private blogService = inject(BlogService);

    post = signal<BlogPost | null>(null);
    loading = signal(true);

    async ngOnInit() {
        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
            const data = await this.blogService.getPost(id);
            this.post.set(data);
        }
        this.loading.set(false);
    }
}
