import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { AuthService } from '../services/auth.service';

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
}

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.page.html',
  styleUrls: ['./notifications.page.scss'],
  standalone: false,
})
export class NotificationsPage implements OnInit {
  selectedFilter = 'all';
  notifications: Notification[] = [];
  filteredNotifications: Notification[] = [];
  isLoading = false;
  private currentUserUid: string | null = null;

  constructor(
    private router: Router,
    private auth: Auth,
    private authService: AuthService
  ) {}

  ngOnInit() {
    authState(this.auth).subscribe(async user => {
      if (!user) {
        this.router.navigate(['/login']);
        return;
      }
      this.currentUserUid = user.uid;
      await this.loadNotifications();
    });
  }

  async loadNotifications() {
    if (!this.currentUserUid) return;
    this.isLoading = true;
    try {
      const raw = await this.authService.getNotifications(this.currentUserUid);
      this.notifications = raw.map(n => this.mapToNotification(n));
      this.filterNotifications();
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      this.isLoading = false;
    }
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
      createdAt: raw.createdAt
    };
  }

  private getIcon(type: string): string {
    const icons: { [key: string]: string } = {
      success: 'checkmark-circle',
      error: 'close-circle',
      warning: 'alert-circle',
      info: 'information-circle',
      mention: 'at',
      comment: 'chatbox',
      like: 'heart',
      connection: 'person-add',
      event: 'calendar',
      message: 'mail',
      achievement: 'trophy',
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
      mention: 'primary',
      comment: 'secondary',
      like: 'danger',
      connection: 'success',
      event: 'warning',
      message: 'tertiary',
      achievement: 'success',
      update: 'primary'
    };
    return colors[type] || 'primary';
  }
}
