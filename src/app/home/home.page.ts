import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {
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

  dashboardCards = [
    { id: 1, title: 'My Department', icon: 'business',  value: '—', description: 'Members',     color: 'primary'   },
    { id: 2, title: 'My Network',    icon: 'people',    value: '—', description: 'Members',     color: 'secondary' },
    { id: 3, title: 'History',       icon: 'time',      value: '—', description: 'Events',      color: 'tertiary'  },
    { id: 4, title: 'Feeds',         icon: 'newspaper', value: '—', description: 'Your Posts',  color: 'success'   },
    { id: 5, title: 'Statistics',    icon: 'bar-chart', value: '—', description: 'Approved',    color: 'warning'   },
  ];

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  async ngOnInit() {
    await this.loadUserProfile();
    await this.loadDashboardStats();
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

      const notifs = await this.authService.getNotifications(currentUser.uid);
      this.notifications = notifs.filter((n: any) => !n.read).length;
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

      // Card 5 — Statistics: % of users approved
      const totalNonAdmin = allUsers.filter((u: any) => u.role !== 'admin').length;
      const pct = totalNonAdmin > 0 ? Math.round((approved.length / totalNonAdmin) * 100) : 0;
      this.updateCard(5, `${pct}%`);
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
      4: '/feeds',
      5: '/statistics'
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
