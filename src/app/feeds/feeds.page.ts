import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-feeds',
  templateUrl: './feeds.page.html',
  styleUrls: ['./feeds.page.scss'],
  standalone: false
})
export class FeedsPage implements OnInit {

  posts = [
    {
      id: 1,
      author: 'John Doe',
      avatar: 'J',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      content: 'Just completed an amazing project with the team! Excited to share the results soon.',
      likes: 45,
      comments: 12,
      shares: 5,
      liked: false
    },
    {
      id: 2,
      author: 'Jane Smith',
      avatar: 'S',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
      content: 'Attending the annual engineering conference. Great networking opportunities!',
      likes: 89,
      comments: 23,
      shares: 15,
      liked: false
    },
    {
      id: 3,
      author: 'Mike Johnson',
      avatar: 'M',
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
      content: 'New research paper published on advanced algorithms. Feel free to review!',
      likes: 120,
      comments: 34,
      shares: 28,
      liked: false
    },
    {
      id: 4,
      author: 'Sarah Williams',
      avatar: 'W',
      timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      content: 'Congratulations to all the graduates! Wishing you all success in your careers.',
      likes: 156,
      comments: 45,
      shares: 32,
      liked: false
    },
  ];

  feedStats = {
    totalPosts: 42,
    newToday: 7,
  };

  constructor(private router: Router) {}

  ngOnInit() {}

  goBack() {
    this.router.navigate(['/home']);
  }

  toggleLike(postId: number) {
    const post = this.posts.find(p => p.id === postId);
    if (post) {
      post.liked = !post.liked;
      post.likes += post.liked ? 1 : -1;
    }
  }

  viewPost(postId: number) {
    console.log('View post:', postId);
  }

  getTimeAgo(date: Date): string {
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }
}
