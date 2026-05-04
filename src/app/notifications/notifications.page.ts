import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { Firestore, collection, query, orderBy, onSnapshot } from '@angular/fire/firestore';
import { AuthService } from '../services/auth.service';
import { PushNotificationService } from '../services/push-notification.service';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  avatar: string;
  timestamp: string;
  read: boolean;
  icon: string;
  createdAt?: string;
  redirectLink?: string;
}

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.page.html',
  styleUrls: ['./notifications.page.scss'],
  standalone: false,
})
export class NotificationsPage implements OnInit, OnDestroy {
  selectedFilter = 'all';
  notifications: Notification[] = [];
  filteredNotifications: Notification[] = [];
  isLoading = true;
  private currentUserUid: string | null = null;
  private notifUnsubscribe: (() => void) | null = null;

  constructor(
    private router: Router,
    private auth: Auth,
    private firestore: Firestore,
    private authService: AuthService,
    private pushSvc: PushNotificationService
  ) {}

  ngOnInit() {
    authState(this.auth).subscribe(user => {
      if (!user) {
        this.router.navigate(['/login']);
        return;
      }
      this.currentUserUid = user.uid;
      this.subscribeToNotifications();
    });
  }

  ngOnDestroy() {
    this.notifUnsubscribe?.();
  }

  private subscribeToNotifications() {
    if (!this.currentUserUid) return;

    const ref = collection(this.firestore, 'users', this.currentUserUid, 'notifications');
    const q = query(ref, orderBy('createdAt', 'desc'));

    this.notifUnsubscribe = onSnapshot(q, snapshot => {
      const incoming = snapshot.docs.map(d =>
        this.mapToNotification({ id: d.id, ...d.data() })
      );

      const prevUnreadCount = this.notifications.filter(n => !n.read).length;
      this.notifications = incoming;
      this.filterNotifications();
      this.isLoading = false;

      const newUnreadCount = this.notifications.filter(n => !n.read).length;
      if (newUnreadCount > prevUnreadCount) {
        const newest = this.notifications.find(n => !n.read);
        this.pushSvc.showNotification(
          newest?.title || 'New notification',
          newest?.message || ''
        );
      }
    }, error => {
      console.error('Error listening to notifications:', error);
      this.isLoading = false;
    });
  }

  private mapToNotification(raw: any): Notification {
    return {
      id: raw.id,
      type: raw.type || 'info',
      title: raw.title || 'Notification',
      message: raw.message || '',
      avatar: (raw.title || 'N').charAt(0).toUpperCase(),
      timestamp: this.getTimeAgo(raw.createdAt),
      read: raw.read || false,
      icon: this.getIcon(raw.type),
      createdAt: raw.createdAt,
      redirectLink: raw.redirectLink || null
    };
  }

  private getIcon(type: string): string {
    const icons: { [key: string]: string } = {
      success: 'checkmark-circle',
      error: 'close-circle',
      warning: 'alert-circle',
      info: 'information-circle',
      system: 'megaphone',
      mention: 'at',
      comment: 'chatbox',
      like: 'heart',
      connection: 'person-add',
      event: 'calendar',
      message: 'mail',
      achievement: 'trophy',
      points: 'star',
      update: 'document-text'
    };
    return icons[type] || 'notifications';
  }

  private getTimeAgo(createdAt: string): string {
    if (!createdAt) return 'Recently';
    const now = new Date();
    const date = new Date(createdAt);
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  }

  goBack() {
    this.router.navigate(['/home']);
  }

  filterNotifications() {
    if (this.selectedFilter === 'all') {
      this.filteredNotifications = this.notifications;
    } else if (this.selectedFilter === 'unread') {
      this.filteredNotifications = this.notifications.filter(n => !n.read);
    } else if (this.selectedFilter === 'mentions') {
      this.filteredNotifications = this.notifications.filter(n => n.type === 'mention');
    }
  }

  onFilterChange(filter: string) {
    this.selectedFilter = filter;
    this.filterNotifications();
  }

  onSegmentChange(event: any) {
    const value = event.detail.value;
    if (value) this.onFilterChange(value);
  }

  async markAsRead(notificationId: string) {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification && !notification.read) {
      notification.read = true;
      this.filterNotifications();
      if (this.currentUserUid) {
        await this.authService.markNotificationAsRead(this.currentUserUid, notificationId);
      }
    }
  }

  async markAllAsRead() {
    this.notifications.forEach(n => n.read = true);
    this.filterNotifications();
    if (this.currentUserUid) {
      await this.authService.markAllNotificationsAsRead(this.currentUserUid);
    }
  }

  async deleteNotification(notificationId: string) {
    this.notifications = this.notifications.filter(n => n.id !== notificationId);
    this.filterNotifications();
    if (this.currentUserUid) {
      await this.authService.deleteNotification(this.currentUserUid, notificationId);
    }
  }

  openNotification(notificationId: string) {
    this.markAsRead(notificationId);
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification?.redirectLink) {
      this.router.navigate([notification.redirectLink]);
    }
  }

  getUnreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  getNotificationColor(type: string): string {
    const colors: { [key: string]: string } = {
      success: 'success',
      error: 'danger',
      warning: 'warning',
      info: 'primary',
      system: 'tertiary',
      mention: 'primary',
      comment: 'secondary',
      like: 'danger',
      connection: 'success',
      event: 'warning',
      message: 'tertiary',
      achievement: 'success',
      points: 'warning',
      update: 'primary'
    };
    return colors[type] || 'primary';
  }
}
