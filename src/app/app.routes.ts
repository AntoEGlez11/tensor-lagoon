import { Routes } from '@angular/router';
import { PostList } from './components/blog/post-list/post-list';

export const routes: Routes = [
    { path: '', component: PostList },
    {
        path: 'admin',
        loadComponent: () => import('./components/admin/admin-layout/admin-layout').then(m => m.AdminLayout),
        children: [
            { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
            { path: 'dashboard', loadComponent: () => import('./components/admin/dashboard/dashboard').then(m => m.Dashboard) }
        ]
    },
];
