import { Injectable, inject, signal } from '@angular/core';
import { Firestore, collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc, getDoc } from '@angular/fire/firestore';

export interface BlogPost {
  id?: string;
  title: string;
  excerpt: string;
  content?: string; // Added for full content support later
  image: string;
  date: string;
  category: string;
  createdAt?: any;
}

@Injectable({
  providedIn: 'root'
})
export class BlogService {
  private firestore = inject(Firestore);
  private postsCollection = collection(this.firestore, 'posts');

  // Signal that holds the current list of posts (synced with Firestore)
  readonly posts = signal<BlogPost[]>([]);

  constructor() {
    this.initRealtimeSync();
  }

  private initRealtimeSync() {
    const q = query(this.postsCollection, orderBy('createdAt', 'desc'));

    onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as BlogPost));
      this.posts.set(data);
    });
  }

  async createPost(post: Omit<BlogPost, 'id' | 'createdAt'>) {
    return addDoc(this.postsCollection, {
      ...post,
      createdAt: new Date()
    });
  }

  async deletePost(id: string) {
    const docRef = doc(this.firestore, 'posts', id);
    await deleteDoc(docRef);
  }

  async updatePost(id: string, data: Partial<BlogPost>) {
    const docRef = doc(this.firestore, 'posts', id);
    await updateDoc(docRef, data);
  }

  async getPost(id: string) {
    return this.getPostDoc(id);
  }

  private async getPostDoc(id: string) {
    const docRef = doc(this.firestore, 'posts', id);
    // Explicitly import getDoc to be safe, though it should be in top imports
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      return { id: snapshot.id, ...snapshot.data() } as BlogPost;
    }
    return null;
  }
}
