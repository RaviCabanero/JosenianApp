import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Firestore, collection, query, where, getDocs, getDoc, addDoc, updateDoc, doc, deleteDoc, writeBatch } from '@angular/fire/firestore';
import { Timestamp } from '@angular/fire/firestore';
import { Auth, authState } from '@angular/fire/auth';
import { AuthService } from '../services/auth.service';

interface Post {
  id?: string;
  userId: number;
  content: string;
  image?: string; // Base64 or image URL
  timestamp: Timestamp | Date;
  likes: number;
  comments: number;
  shares: number;
  liked: boolean;
  likedBy?: string[]; // Array of user IDs who liked this post
}

interface User {
  id: number;
  uid: string;
  name: string;
  avatar: string;
  mutualFriends?: number;
  posts: Post[];
}

@Component({
  selector: 'app-feeds',
  templateUrl: './feeds.page.html',
  styleUrls: ['./feeds.page.scss'],
  standalone: false
})
export class FeedsPage implements OnInit {

  currentUser: User | null = null;
  currentUserUid: string | null = null; // Store Firebase UID
  friends: User[] = [];
  suggestedUsers: User[] = [];
  newPostContent: string = '';
  newPostImage: string | null = null;
  showPostForm: boolean = false;

  feedStats = {
    totalPosts: 42,
    newToday: 7,
  };

  globalEvents: any[] = [];
  joiningEventId: string | null = null;

  constructor(private router: Router, private firestore: Firestore, private auth: Auth, private authService: AuthService) {}

  ngOnInit() {
    authState(this.auth).subscribe(async user => {
      if (!user) {
        this.router.navigate(['/login']);
        return;
      }
      this.currentUserUid = user.uid;
      await this.initializeCurrentUser();
      this.loadPostsFromFirestore();
      await this.loadSuggestedFriends();
      await this.loadGlobalEvents();
    });
  }

  async initializeCurrentUser() {
    if (!this.currentUserUid) return;
    try {
      const userDoc = await getDoc(doc(this.firestore, 'users', this.currentUserUid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        const firstName = data['firstName'] || '';
        const lastName = data['lastName'] || '';
        const name = `${firstName} ${lastName}`.trim() || data['email'] || 'User';
        this.currentUser = {
          id: 0,
          uid: this.currentUserUid,
          name,
          avatar: firstName.charAt(0).toUpperCase() || 'U',
          posts: []
        };
        this.friends = [this.currentUser];
      }
    } catch (error) {
      console.error('Error loading current user profile:', error);
    }
  }

  // Load posts from Firestore using the user's UID
  async loadPostsFromFirestore() {
    if (!this.currentUserUid) return;

    try {
      // Load posts for the current user from Firestore
      const postsRef = collection(this.firestore, `users/${this.currentUserUid}/posts`);
      const q = query(postsRef);
      const snapshot = await getDocs(q);
      
      if (this.currentUser) {
        this.currentUser.posts = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            timestamp: data['timestamp']?.toDate?.() || new Date(data['timestamp'])
          } as Post;
        });
      }
    } catch (error) {
      console.error('Error loading posts from Firestore:', error);
    }
  }

  // Save post to Firestore using the user's UID
  async savePostToFirestore(post: Post) {
    try {
      if (!this.currentUserUid) {
        throw new Error('No user UID available');
      }
      
      const postsRef = collection(this.firestore, `users/${this.currentUserUid}/posts`);
      // Create a copy of the post without undefined fields
      const postData: any = {
        userId: this.currentUser?.id || 1,
        content: post.content,
        timestamp: Timestamp.now(),
        likes: post.likes,
        comments: post.comments,
        shares: post.shares,
        liked: post.liked
      };
      
      // Only add image if it exists
      if (post.image) {
        postData.image = post.image;
      }
      
      const docRef = await addDoc(postsRef, postData);
      post.id = docRef.id;
      return docRef.id;
    } catch (error) {
      console.error('Error saving post to Firestore:', error);
      throw error;
    }
  }

  // Update post in Firestore using the user's UID
  async updatePostInFirestore(post: Post) {
    try {
      if (!post.id || !this.currentUserUid) return;
      const postRef = doc(this.firestore, `users/${this.currentUserUid}/posts/${post.id}`);
      await updateDoc(postRef, {
        liked: post.liked,
        likes: post.likes
      });
    } catch (error) {
      console.error('Error updating post in Firestore:', error);
      throw error;
    }
  }

  async loadSuggestedFriends() {
    if (!this.currentUserUid) return;
    try {
      const currentUserDoc = await getDoc(doc(this.firestore, 'users', this.currentUserUid));
      const currentDept = currentUserDoc.exists() ? currentUserDoc.data()['department'] : '';

      const q = query(
        collection(this.firestore, 'users'),
        where('status', '==', 'approved'),
        where('role', '==', 'user')
      );
      const snapshot = await getDocs(q);

      const friendUids = new Set(this.friends.map(f => f.uid));
      let counter = 1;
      this.suggestedUsers = snapshot.docs
        .filter(d => d.id !== this.currentUserUid && !friendUids.has(d.id))
        .map(d => {
          const data = d.data();
          const firstName = data['firstName'] || '';
          const lastName = data['lastName'] || '';
          const name = `${firstName} ${lastName}`.trim() || data['email'] || 'Unknown';
          const dept = data['department'] || '';
          const mutualFriends = dept && currentDept && dept === currentDept ? 1 : 0;
          return {
            id: counter++,
            uid: d.id,
            name,
            avatar: firstName.charAt(0).toUpperCase() || '?',
            mutualFriends,
            posts: []
          };
        });
    } catch (error) {
      console.error('Error loading suggested friends:', error);
    }
  }

  async loadGlobalEvents() {
    try {
      this.globalEvents = await this.authService.getGlobalEvents();
    } catch (error) {
      console.error('Error loading global events:', error);
    }
  }

  isAttending(event: any): boolean {
    return (event.attendees || []).includes(this.currentUserUid);
  }

  isFull(event: any): boolean {
    if (!event.maxParticipants) return false;
    return (event.attendees?.length || 0) >= event.maxParticipants;
  }

  async toggleJoinEvent(event: any) {
    if (!this.currentUserUid) return;
    this.joiningEventId = event.id;
    try {
      if (this.isAttending(event)) {
        await this.authService.leaveGlobalEvent(event.id, this.currentUserUid);
        event.attendees = (event.attendees || []).filter((id: string) => id !== this.currentUserUid);
      } else {
        if (this.isFull(event)) return;
        await this.authService.joinGlobalEvent(event.id, this.currentUserUid);
        event.attendees = [...(event.attendees || []), this.currentUserUid];
      }
    } catch (error) {
      console.error('Error toggling event join:', error);
    } finally {
      this.joiningEventId = null;
    }
  }

  isEventToday(event: any): boolean {
    if (!event.date) return false;
    return event.date === new Date().toISOString().split('T')[0];
  }

  navigateToScanner(event: any) {
    this.router.navigate(['/qr-scanner'], {
      queryParams: { eventId: event.id, eventTitle: event.title }
    });
  }

  getEventCoverUrl(event: any): string {
    return event.coverImageBase64 ? `data:image/jpeg;base64,${event.coverImageBase64}` : '';
  }

  formatEventDate(event: any): string {
    if (!event.date) return 'TBD';
    const d = new Date(`${event.date}T${event.time || '00:00'}`);
    return isNaN(d.getTime()) ? event.date : d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  formatEventTime(event: any): string {
    if (!event.time) return '';
    const [h, m] = event.time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  goBack() {
    this.router.navigate(['/home']);
  }

  toggleLike(postId: string) {
    for (let friend of this.friends) {
      const post = friend.posts.find(p => p.id === postId);
      if (post) {
        post.liked = !post.liked;
        post.likes += post.liked ? 1 : -1;
        // Save updated post to Firestore
        this.updatePostInFirestore(post);
        return;
      }
    }
  }

  viewPost(postId: string | undefined) {
    if (postId) {
      console.log('View post:', postId);
    }
  }

  addFriend(userUid: string) {
    const user = this.suggestedUsers.find(u => u.uid === userUid);
    if (user) {
      this.friends.push(user);
      this.suggestedUsers = this.suggestedUsers.filter(u => u.uid !== userUid);
    }
  }

  onImageSelected(event: any) {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.newPostImage = e.target.result; // Base64 string
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage() {
    this.newPostImage = null;
  }

  async createPost() {
    if (!this.newPostContent.trim() && !this.newPostImage) {
      return;
    }
    
    if (!this.currentUser) {
      console.log('No current user');
      return;
    }
    
    const newPost: Post = {
      userId: this.currentUser.id,
      content: this.newPostContent,
      image: this.newPostImage || undefined,
      timestamp: new Date(),
      likes: 0,
      comments: 0,
      shares: 0,
      liked: false
    };
    
    // Add to local state
    this.currentUser.posts.unshift(newPost);
    
    // Save to Firestore
    try {
      await this.savePostToFirestore(newPost);
      console.log('Post saved to Firestore');
    } catch (error) {
      console.error('Failed to save post:', error);
      // Remove from local state if failed
      this.currentUser.posts.shift();
      return;
    }
    
    this.newPostContent = '';
    this.newPostImage = null;
    this.showPostForm = false;
  }

  getAllPosts(): Array<{post: Post; user: User}> {
    const allPosts: Array<{post: Post; user: User}> = [];
    for (let friend of this.friends) {
      for (let post of friend.posts) {
        allPosts.push({post, user: friend});
      }
    }
    return allPosts.sort((a, b) => {
      const timeA = a.post.timestamp instanceof Date ? a.post.timestamp.getTime() : a.post.timestamp.toDate().getTime();
      const timeB = b.post.timestamp instanceof Date ? b.post.timestamp.getTime() : b.post.timestamp.toDate().getTime();
      return timeB - timeA;
    });
  }

  getTimeAgo(date: Date | Timestamp): string {
    const now = new Date();
    const targetDate = date instanceof Date ? date : date.toDate();
    const seconds = Math.floor((now.getTime() - targetDate.getTime()) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  togglePostForm() {
    this.showPostForm = !this.showPostForm;
    if (!this.showPostForm) {
      this.newPostContent = '';
      this.newPostImage = null;
    }
  }
}
