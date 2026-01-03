import { Routes } from '@angular/router';
import { PostList } from './components/blog/post-list/post-list';
import { authGuard } from './guards/auth';

export const routes: Routes = [
    { path: '', loadComponent: () => import('./components/public/home/home').then(m => m.Home) },
    { path: 'blog', loadComponent: () => import('./components/public/blog/blog').then(m => m.Blog) },
    { path: 'blog/:id', loadComponent: () => import('./components/public/blog/post-detail/post-detail').then(m => m.PostDetail) },
    { path: 'services', loadComponent: () => import('./components/public/services/services').then(m => m.Services) },
    { path: 'contact', loadComponent: () => import('./components/public/contact/contact').then(m => m.Contact) },
    {
        path: 'admin',
        canActivate: [authGuard],
        loadComponent: () => import('./components/admin/admin-layout/admin-layout').then(m => m.AdminLayout),
        children: [
            { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
            { path: 'dashboard', loadComponent: () => import('./components/admin/dashboard/dashboard').then(m => m.Dashboard) },
            { path: 'blog', loadComponent: () => import('./components/admin/blog/blog-manager').then(m => m.BlogManager) },
            { path: 'services', loadComponent: () => import('./components/admin/service-manager/service-manager').then(m => m.ServiceManager) },
            { path: 'testimonials', loadComponent: () => import('./components/admin/testimonial-manager/testimonial-manager').then(m => m.TestimonialManager) },
            { path: 'users', loadComponent: () => import('./components/admin/user-manager/user-manager').then(m => m.UserManager) }
        ]
    },
    {
        path: 'login',
        loadComponent: () => import('./components/auth/login/login').then(m => m.Login)
    },
    {
        path: 'register',
        loadComponent: () => import('./components/auth/register/register').then(m => m.Register)
    },
    {
        path: 'dashboard',
        loadComponent: () => import('./components/user/dashboard/dashboard').then(m => m.Dashboard)
    }
];
