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
  // User data
  user = {
    name: 'User',
    initials: 'U',
    avatar: 'assets/images/avatar.jpg',
    firstName: '',
    lastName: '',
    bio: '',
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

  constructor(private authService: AuthService, private router: Router) {}

  async ngOnInit() {
    await this.loadUserProfile();
  }

  async loadUserProfile() {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (currentUser) {
        const profile = await this.authService.getUserProfile(currentUser.uid);
        if (profile) {
          this.user.firstName = profile.firstName || '';
          this.user.lastName = profile.lastName || '';
          this.user.name = `${this.user.firstName} ${this.user.lastName}`;
          this.user.bio = profile.bio || '';
          
          // Generate initials
          const firstInitial = this.user.firstName.charAt(0).toUpperCase();
          const lastInitial = this.user.lastName.charAt(0).toUpperCase();
          this.user.initials = (firstInitial + lastInitial) || 'U';
        }
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  }

  goToProfile() {
    this.router.navigate(['/profile']);
  }

  goToCard(cardId: number) {
    const routes: {[key: number]: string} = {
      1: '/department',
      2: '/network',
      3: '/history',
      4: '/feeds',
      5: '/statistics'
    };
    
    const route = routes[cardId];
    if (route) {
      this.router.navigate([route]);
    }
  }

  goToMessages() {
    this.router.navigate(['/messages']);
  }

  goToNotifications() {
    this.router.navigate(['/notifications']);
  }
}
