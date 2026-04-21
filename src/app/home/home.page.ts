import { Component } from '@angular/core';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage {
  // Mock user data
  user = {
    name: 'Juan Dela Cruz',
    initials: 'JDC',
    avatar: 'assets/images/avatar.jpg',
  };

  // Mock notification data
  notifications = 5;
  unreadChats = 3;

  // Dashboard cards data
  dashboardCards = [
    {
      id: 1,
      title: 'My Department',
      icon: 'business',
      value: '8',
      description: 'Members',
      color: 'primary',
    },
    {
      id: 2,
      title: 'My Network',
      icon: 'people',
      value: '156',
      description: 'Connections',
      color: 'secondary',
    },
    {
      id: 3,
      title: 'History',
      icon: 'time',
      value: '24',
      description: 'Recent Events',
      color: 'tertiary',
    },
    {
      id: 4,
      title: 'Feeds',
      icon: 'newspaper',
      value: '42',
      description: 'New Posts',
      color: 'success',
    },
    {
      id: 5,
      title: 'Statistics',
      icon: 'bar-chart',
      value: '89%',
      description: 'Engagement',
      color: 'warning',
    },
  ];

  constructor() {}
}
