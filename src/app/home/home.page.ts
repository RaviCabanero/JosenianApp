import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { Firestore, collection, query, where, onSnapshot } from '@angular/fire/firestore';
import { AuthService } from '../services/auth.service';
import { ChatService } from '../services/chat.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit, OnDestroy {
  user = {
    name: 'User',
    initials: 'U',
    firstName: '',
    lastName: '',
    bio: '',
    department: '',
  };

  notifications = 0;
  unreadChats = 0;
  private notifUnsubscribe: (() => void) | null = null;
  private chatUnsubscribe: (() => void) | null = null;

  dashboardCards = [
    { id: 1, title: 'My Department', icon: 'business',  value: '—', description: 'Members',     color: 'primary'   },
    { id: 2, title: 'My Network',    icon: 'people',    value: '—', description: 'Members',     color: 'secondary' },
    { id: 3, title: 'History',       icon: 'time',      value: '—', description: 'Events',      color: 'tertiary'  },
    { id: 4, title: 'Feeds',         icon: 'newspaper', value: '—', description: 'Your Posts',  color: 'success'   },
  ];

  constructor(
    private authService: AuthService,
    private router: Router,
    private auth: Auth,
    private firestore: Firestore,
    private chatService: ChatService
  ) {}

  async ngOnInit() {
    await this.loadUserProfile();
    await this.loadDashboardStats();
    this.subscribeToUnreadCounts();
  }

  ngOnDestroy() {
    this.notifUnsubscribe?.();
    this.chatUnsubscribe?.();
  }

  private subscribeToUnreadCounts() {
    authState(this.auth).subscribe(user => {
      if (!user) return;

      // Notification badge
      const notifQ = query(
        collection(this.firestore, 'users', user.uid, 'notifications'),
        where('read', '==', false)
      );
      this.notifUnsubscribe = onSnapshot(notifQ, snapshot => {
        this.notifications = snapshot.size;
      });

      // Chat badge
      this.chatUnsubscribe = this.chatService.subscribeToUnreadChatCount(
        user.uid,
        count => { this.unreadChats = count; }
      );
    });
  }

  async loadUserProfile() {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) return;

      const profile = await this.authService.getUserProfile(currentUser.uid);
      if (profile) {
        this.user.firstName = profile.firstName || '';
        this.user.lastName = profile.lastName || '';
        this.user.name = `${this.user.firstName} ${this.user.lastName}`.trim() || 'User';
        this.user.bio = profile.bio || '';
        this.user.department = profile.department || '';
        this.user.initials =
          (this.user.firstName.charAt(0) + this.user.lastName.charAt(0)).toUpperCase() || 'U';
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  }

  async loadDashboardStats() {
    try {
      const currentUser = this.authService.getCurrentUser();
      const allUsers = await this.authService.getAllUsers();
      const approved = allUsers.filter((u: any) => u.status === 'approved' && u.role !== 'admin');

      // Card 2 — Network: approved members excluding self
      const networkCount = currentUser
        ? approved.filter((u: any) => u.id !== currentUser.uid).length
        : approved.length;
      this.updateCard(2, String(networkCount));

      // Card 1 — Department: members in user's department
      if (this.user.department) {
        const depts = await this.authService.getDepartments();
        const myDept = depts.find(
          (d: any) => d.id === this.user.department || d.name === this.user.department
        );
        this.updateCard(1, String(myDept?.members?.length ?? 0));
      }

      // Card 3 — History: total events
      const events = await this.authService.getEvents();
      this.updateCard(3, String(events.length));

      // Card 4 — Feeds: current user's post count
      if (currentUser) {
        const postCount = await this.authService.getUserPostCount(currentUser.uid);
        this.updateCard(4, String(postCount));
      }

    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }
  }

  private updateCard(id: number, value: string) {
    const card = this.dashboardCards.find(c => c.id === id);
    if (card) card.value = value;
  }

  goToProfile() {
    this.router.navigate(['/profile']);
  }

  goToCard(cardId: number) {
    const routes: { [key: number]: string } = {
      1: '/department',
      2: '/network',
      3: '/history',
      4: '/feeds'
    };
    const route = routes[cardId];
    if (route) this.router.navigate([route]);
  }

  goToMessages() {
    this.router.navigate(['/messages']);
  }

  goToNotifications() {
    this.router.navigate(['/notifications']);
  }

  goToScanner() {
    this.router.navigate(['/qr-scanner']);
  }
}
