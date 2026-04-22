import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.page.html',
  styleUrls: ['./notifications.page.scss'],
  standalone: false,
})
export class NotificationsPage implements OnInit {
  selectedFilter = 'all'; // all, unread, mentions

  notifications = [
    {
      id: 1,
      type: 'mention',
      title: 'You were mentioned in a post',
      message: 'Sarah Johnson mentioned you in "Project Kickoff Discussion"',
      avatar: 'SJ',
      timestamp: '5 minutes ago',
      read: false,
      icon: 'at',
    },
    {
      id: 2,
      type: 'comment',
      title: 'New comment on your post',
      message: 'Mike Chen commented: "Great presentation, thanks for sharing!"',
      avatar: 'MC',
      timestamp: '30 minutes ago',
      read: false,
      icon: 'chatbox',
    },
    {
      id: 3,
      type: 'like',
      title: 'Your post got a like',
      message: '5 people liked your department update',
      avatar: 'DP',
      timestamp: '1 hour ago',
      read: false,
      icon: 'heart',
    },
    {
      id: 4,
      type: 'connection',
      title: 'New connection request',
      message: 'Emily Rodriguez sent you a connection request',
      avatar: 'ER',
      timestamp: '2 hours ago',
      read: true,
      icon: 'person-add',
    },
    {
      id: 5,
      type: 'event',
      title: 'Upcoming event reminder',
      message: 'Annual Networking Conference starts tomorrow at 9 AM',
      avatar: 'EV',
      timestamp: '5 hours ago',
      read: true,
      icon: 'calendar',
    },
    {
      id: 6,
      type: 'message',
      title: 'New message from John Doe',
      message: 'John: "Can we schedule a meeting to discuss the proposal?"',
      avatar: 'JD',
      timestamp: 'Yesterday',
      read: true,
      icon: 'mail',
    },
    {
      id: 7,
      type: 'achievement',
      title: 'Achievement unlocked',
      message: 'You\'ve reached 100 connections! 🎉',
      avatar: 'AC',
      timestamp: '2 days ago',
      read: true,
      icon: 'trophy',
    },
    {
      id: 8,
      type: 'update',
      title: 'Department update',
      message: 'Your department has shared a new policy document',
      avatar: 'DU',
      timestamp: '3 days ago',
      read: true,
      icon: 'document-text',
    },
  ];

  filteredNotifications = this.notifications;

  constructor(private router: Router) {}

  ngOnInit() {
    this.filterNotifications();
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
    if (value) {
      this.onFilterChange(value);
    }
  }

  markAsRead(notificationId: number) {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      this.filterNotifications();
    }
  }

  markAllAsRead() {
    this.notifications.forEach(n => n.read = true);
    this.filterNotifications();
  }

  deleteNotification(notificationId: number) {
    this.notifications = this.notifications.filter(n => n.id !== notificationId);
    this.filterNotifications();
  }

  openNotification(notificationId: number) {
    this.markAsRead(notificationId);
    // Navigate to notification detail or take appropriate action
    console.log('Opening notification:', notificationId);
  }

  getUnreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  getNotificationColor(type: string): string {
    const colors: {[key: string]: string} = {
      mention: 'primary',
      comment: 'secondary',
      like: 'danger',
      connection: 'success',
      event: 'warning',
      message: 'tertiary',
      achievement: 'success',
      update: 'primary',
    };
    return colors[type] || 'primary';
  }
}
