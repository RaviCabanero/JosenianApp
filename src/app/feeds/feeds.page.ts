import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Firestore, collection, collectionGroup, query, where, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, setDoc } from '@angular/fire/firestore';
import { Timestamp } from '@angular/fire/firestore';
import { Auth, authState } from '@angular/fire/auth';
import { AlertController } from '@ionic/angular';
import { AuthService } from '../services/auth.service';

interface Post {
  id?: string;
  userId: number;
  content: string;
  image?: string;
  timestamp: Timestamp | Date;
  likes: number;
  comments: number;
  shares: number;
  liked: boolean;
  likedBy?: string[];
  privacy?: 'public' | 'private';
}

interface Comment {
  id?: string;
  userUid: string;
  authorName: string;
  authorAvatar: string;
  authorPhotoUrl?: string;
  content: string;
  timestamp: Timestamp | Date;
}

interface User {
  id: number;
  uid: string;
  name: string;
  avatar: string;
  photoUrl?: string;
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
  currentUserUid: string | null = null;
  friends: User[] = [];
  allPosts: Array<{post: Post; user: User}> = [];
  suggestedUsers: User[] = [];
  newPostContent: string = '';
  newPostImage: string | null = null;
  private newPostImageFile: File | null = null;
  showPostForm: boolean = false;

  feedStats = {
    totalPosts: 42,
    newToday: 7,
  };

  globalEvents: any[] = [];
  joiningEventId: string | null = null;

  expandedPostId: string | null = null;
  commentInputs: { [postId: string]: string } = {};
  postComments: { [postId: string]: Comment[] } = {};
  loadingComments: string | null = null;
  submittingComment: string | null = null;

  editingPostId: string | null = null;
  editingContent: string = '';
  editingPrivacy: 'public' | 'private' = 'public';

  newPostPrivacy: 'public' | 'private' = 'public';

  showSearch = false;
  searchQuery = '';

  get filteredPosts() {
    if (!this.searchQuery.trim()) return this.allPosts;
    const q = this.searchQuery.toLowerCase();
    return this.allPosts.filter(item =>
      item.post.content?.toLowerCase().includes(q) ||
      item.user.name?.toLowerCase().includes(q)
    );
  }

  toggleSearch() {
    this.showSearch = !this.showSearch;
    if (!this.showSearch) this.searchQuery = '';
  }

  constructor(
    private router: Router,
    private firestore: Firestore,
    private auth: Auth,
    private authService: AuthService,
    private alertCtrl: AlertController
  ) {}

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

  ionViewWillEnter() {
    if (this.currentUserUid) {
      this.loadGlobalEvents();
    }
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
          photoUrl: data['photoUrl'] || '',
          posts: []
        };
        this.friends = [this.currentUser];
      }
    } catch (error) {
      console.error('Error loading current user profile:', error);
    }
  }

  async loadPostsFromFirestore() {
    if (!this.currentUserUid) return;

    try {
      const ownPostsSnap = await getDocs(collection(this.firestore, `users/${this.currentUserUid}/posts`));
      if (this.currentUser) {
        this.currentUser.posts = ownPostsSnap.docs.map(d => {
          const data = d.data();
          return { id: d.id, ...data, privacy: data['privacy'] || 'public', timestamp: data['timestamp']?.toDate?.() || new Date(data['timestamp']) } as Post;
        });
      }

      const userDoc = await getDoc(doc(this.firestore, 'users', this.currentUserUid));
      const friendUids: string[] = userDoc.exists() ? userDoc.data()['friends'] || [] : [];

      const friendUsers: User[] = await Promise.all(
        friendUids.map(async (uid, index) => {
          const friendDoc = await getDoc(doc(this.firestore, 'users', uid));
          const fd = friendDoc.exists() ? friendDoc.data() : {};
          const firstName = fd['firstName'] || '';
          const lastName = fd['lastName'] || '';
          const name = `${firstName} ${lastName}`.trim() || fd['email'] || 'User';
          const friendPostsSnap = await getDocs(collection(this.firestore, `users/${uid}/posts`));
          const posts: Post[] = friendPostsSnap.docs.map(d => {
            const data = d.data();
            return { id: d.id, ...data, privacy: data['privacy'] || 'public', timestamp: data['timestamp']?.toDate?.() || new Date(data['timestamp']) } as Post;
          });
          return { id: index + 1, uid, name, avatar: firstName.charAt(0).toUpperCase() || 'U', photoUrl: fd['photoUrl'] || '', posts } as User;
        })
      );

      const knownUids = new Set([this.currentUserUid, ...friendUids]);
      const publicSnap = await getDocs(
        query(collectionGroup(this.firestore, 'posts'), where('privacy', '==', 'public'))
      );

      const nonFriendPostMap = new Map<string, Post[]>();
      for (const d of publicSnap.docs) {
        const authorUid = d.ref.parent.parent?.id;
        if (!authorUid || knownUids.has(authorUid)) continue;
        const data = d.data();
        const post = { id: d.id, ...data, privacy: 'public' as const, timestamp: data['timestamp']?.toDate?.() || new Date(data['timestamp']) } as Post;
        if (!nonFriendPostMap.has(authorUid)) nonFriendPostMap.set(authorUid, []);
        nonFriendPostMap.get(authorUid)!.push(post);
      }

      const nonFriendUsers: User[] = await Promise.all(
        Array.from(nonFriendPostMap.entries()).map(async ([uid, posts], index) => {
          const profileDoc = await getDoc(doc(this.firestore, 'users', uid));
          const pd = profileDoc.exists() ? profileDoc.data() : {};
          const firstName = pd['firstName'] || '';
          const lastName = pd['lastName'] || '';
          const name = `${firstName} ${lastName}`.trim() || pd['email'] || 'User';
          return { id: friendUids.length + index + 2, uid, name, avatar: firstName.charAt(0).toUpperCase() || 'U', photoUrl: pd['photoUrl'] || '', posts } as User;
        })
      );

      this.friends = [this.currentUser!, ...friendUsers, ...nonFriendUsers];
      this.refreshPosts();
    } catch (error) {
      console.error('Error loading posts from Firestore:', error);
    }
  }

  refreshPosts() {
    const all: Array<{post: Post; user: User}> = [];
    for (const friend of this.friends) {
      for (const post of friend.posts) {
        all.push({ post, user: friend });
      }
    }
    this.allPosts = all.sort((a, b) => {
      const ta = a.post.timestamp instanceof Date ? a.post.timestamp.getTime() : (a.post.timestamp as any).toDate().getTime();
      const tb = b.post.timestamp instanceof Date ? b.post.timestamp.getTime() : (b.post.timestamp as any).toDate().getTime();
      return tb - ta;
    });
  }

  trackByPostId(_: number, item: {post: Post; user: User}): string {
    return item.post.id || String(item.post.timestamp);
  }

  async savePostToFirestore(post: Post) {
    try {
      if (!this.currentUserUid) {
        throw new Error('No user UID available');
      }

      const postsRef = collection(this.firestore, `users/${this.currentUserUid}/posts`);
      const docRef = doc(postsRef); // Pre-generate ID so we can use it as the Storage path

      const postData: any = {
        userId: this.currentUser?.id || 1,
        content: post.content,
        timestamp: Timestamp.now(),
        likes: post.likes,
        comments: post.comments,
        shares: post.shares,
        liked: post.liked,
        privacy: post.privacy || 'public'
      };

      if (this.newPostImageFile) {
        const imageUrl = await this.authService.uploadFile(
          `post-images/${this.currentUserUid}/${docRef.id}`,
          this.newPostImageFile
        );
        postData.image = imageUrl;
        post.image = imageUrl; // Update in-memory post with the Storage URL
        this.newPostImageFile = null;
      } else if (post.image) {
        postData.image = post.image;
      }

      await setDoc(docRef, postData);
      post.id = docRef.id;
      return docRef.id;
    } catch (error) {
      console.error('Error saving post to Firestore:', error);
      throw error;
    }
  }

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
      const friends: string[] = currentUserDoc.exists() ? currentUserDoc.data()['friends'] || [] : [];
      const sentRequests: string[] = currentUserDoc.exists() ? currentUserDoc.data()['sentRequests'] || [] : [];
      const excludeSet = new Set([...friends, ...sentRequests, this.currentUserUid]);

      const q = query(
        collection(this.firestore, 'users'),
        where('status', '==', 'approved'),
        where('role', '==', 'user')
      );
      const snapshot = await getDocs(q);

      let counter = 1;
      this.suggestedUsers = snapshot.docs
        .filter(d => !excludeSet.has(d.id))
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
            photoUrl: data['photoUrl'] || '',
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
      const today = new Date().toISOString().split('T')[0];
      this.globalEvents = this.globalEvents.filter(ev => {
        if (ev.date > today) return true;
        if (ev.date < today) return false;
        if (!ev.time) return true;
        const [h, m] = ev.time.split(':').map(Number);
        const end = new Date();
        end.setHours(h + 3, m, 0, 0);
        return new Date() < end;
      });
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

  isEventActive(event: any): boolean {
    if (!event.date) return false;
    const today = new Date().toISOString().split('T')[0];
    if (event.date !== today) return false;
    if (!event.time) return true;
    const [h, m] = event.time.split(':').map(Number);
    const start = new Date();
    start.setHours(h, m, 0, 0);
    const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
    const now = new Date();
    return now >= start && now < end;
  }

  navigateToScanner(event: any) {
    this.router.navigate(['/qr-scanner'], {
      queryParams: { eventId: event.id, eventTitle: event.title }
    });
  }

  getEventCoverUrl(event: any): string {
    if (event.coverImageUrl) return event.coverImageUrl;
    if (event.coverImageBase64) return `data:image/jpeg;base64,${event.coverImageBase64}`;
    return '';
  }

  hasEventCover(event: any): boolean {
    return !!(event.coverImageUrl || event.coverImageBase64);
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

  viewProfile(uid: string) {
    this.router.navigate(['/user-profile', uid]);
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

  async addFriend(userUid: string) {
    try {
      await this.authService.sendFriendRequest(userUid);
      this.suggestedUsers = this.suggestedUsers.filter(u => u.uid !== userUid);
    } catch (error) {
      console.error('Error sending friend request:', error);
    }
  }

  onImageSelected(event: any) {
    const file = event.target.files?.[0];
    if (file) {
      this.newPostImageFile = file;
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.newPostImage = e.target.result; // Keep for local preview only
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage() {
    this.newPostImage = null;
    this.newPostImageFile = null;
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
      liked: false,
      privacy: this.newPostPrivacy
    };
    
    this.currentUser.posts.unshift(newPost);
    this.refreshPosts();

    try {
      await this.savePostToFirestore(newPost);
    } catch (error) {
      console.error('Failed to save post:', error);
      this.currentUser.posts.shift();
      this.refreshPosts();
      return;
    }
    
    this.newPostContent = '';
    this.newPostImage = null;
    this.newPostImageFile = null;
    this.newPostPrivacy = 'public';
    this.showPostForm = false;
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
      this.newPostImageFile = null;
      this.newPostPrivacy = 'public';
    }
  }

  async toggleComments(post: Post, ownerUid: string, event: Event) {
    event.stopPropagation();
    const postId = post.id!;
    if (this.expandedPostId === postId) {
      this.expandedPostId = null;
      return;
    }
    this.expandedPostId = postId;
    if (!this.postComments[postId]) {
      await this.loadComments(postId, ownerUid);
    }
  }

  async loadComments(postId: string, ownerUid: string) {
    this.loadingComments = postId;
    try {
      const ref = collection(this.firestore, `users/${ownerUid}/posts/${postId}/comments`);
      const snap = await getDocs(ref);
      this.postComments[postId] = snap.docs
        .map(d => ({
          id: d.id,
          ...d.data(),
          timestamp: d.data()['timestamp']?.toDate?.() || new Date(d.data()['timestamp'])
        } as Comment))
        .sort((a, b) => {
          const ta = a.timestamp instanceof Date ? a.timestamp.getTime() : (a.timestamp as Timestamp).toDate().getTime();
          const tb = b.timestamp instanceof Date ? b.timestamp.getTime() : (b.timestamp as Timestamp).toDate().getTime();
          return ta - tb;
        });
    } catch {
      this.postComments[postId] = [];
    } finally {
      this.loadingComments = null;
    }
  }

  startEditPost(post: Post, event: Event) {
    event.stopPropagation();
    this.editingPostId = post.id!;
    this.editingContent = post.content;
    this.editingPrivacy = post.privacy || 'public';
  }

  cancelEditPost(event: Event) {
    event.stopPropagation();
    this.editingPostId = null;
    this.editingContent = '';
    this.editingPrivacy = 'public';
  }

  async saveEditPost(post: Post, event: Event) {
    event.stopPropagation();
    const content = this.editingContent.trim();
    if (!content) return;

    const originalContent = post.content;
    const originalPrivacy = post.privacy;
    post.content = content;
    post.privacy = this.editingPrivacy;
    this.editingPostId = null;
    this.editingContent = '';
    this.editingPrivacy = 'public';
    this.refreshPosts();

    try {
      await updateDoc(doc(this.firestore, `users/${this.currentUserUid}/posts/${post.id}`), { content, privacy: post.privacy });
    } catch (error) {
      console.error('Error updating post:', error);
      post.content = originalContent;
      post.privacy = originalPrivacy;
      this.refreshPosts();
    }
  }

  async deletePost(post: Post, event: Event) {
    event.stopPropagation();
    const alert = await this.alertCtrl.create({
      header: 'Delete Post',
      message: 'Are you sure you want to delete this post?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            try {
              await deleteDoc(doc(this.firestore, `users/${this.currentUserUid}/posts/${post.id}`));
              if (this.currentUser) {
                this.currentUser.posts = this.currentUser.posts.filter(p => p.id !== post.id);
                this.refreshPosts();
              }
            } catch (error) {
              console.error('Error deleting post:', error);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async submitComment(post: Post, ownerUid: string, event: Event) {
    event.stopPropagation();
    const postId = post.id!;
    const text = (this.commentInputs[postId] || '').trim();
    if (!text || !this.currentUser || this.submittingComment === postId) return;

    this.submittingComment = postId;
    try {
      const comment: Comment = {
        userUid: this.currentUserUid!,
        authorName: this.currentUser.name,
        authorAvatar: this.currentUser.avatar,
        authorPhotoUrl: this.currentUser.photoUrl || '',
        content: text,
        timestamp: new Date()
      };
      const ref = collection(this.firestore, `users/${ownerUid}/posts/${postId}/comments`);
      const docRef = await addDoc(ref, { ...comment, timestamp: Timestamp.now() });
      comment.id = docRef.id;
      if (!this.postComments[postId]) this.postComments[postId] = [];
      this.postComments[postId].push(comment);
      post.comments++;
      this.commentInputs[postId] = '';
      await updateDoc(doc(this.firestore, `users/${ownerUid}/posts/${postId}`), { comments: post.comments });
    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      this.submittingComment = null;
    }
  }
}
