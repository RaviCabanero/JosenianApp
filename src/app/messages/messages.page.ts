import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { AuthService } from '../services/auth.service';

interface Conversation {
  uid: string;
  name: string;
  avatar: string;
  role: string;
  department: string;
  online: boolean;
}

@Component({
  selector: 'app-messages',
  templateUrl: './messages.page.html',
  styleUrls: ['./messages.page.scss'],
  standalone: false,
})
export class MessagesPage implements OnInit {
  searchQuery = '';
  conversations: Conversation[] = [];
  filteredConversations: Conversation[] = [];
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
      await this.loadConversations();
    });
  }

  async loadConversations() {
    this.isLoading = true;
    try {
      const allUsers = await this.authService.getAllUsers();
      this.conversations = allUsers
        .filter((u: any) => u.status === 'approved' && u.role !== 'admin' && u.id !== this.currentUserUid)
        .map((u: any) => {
          const firstName = u.firstName || '';
          const lastName = u.lastName || '';
          const name = `${firstName} ${lastName}`.trim() || u.email || 'Unknown';
          return {
            uid: u.id,
            name,
            avatar: firstName.charAt(0).toUpperCase() || '?',
            role: u.userType === 'alumni' ? 'Alumni' : 'Student',
            department: u.department || 'No Department',
            online: false
          };
        });
      this.filteredConversations = this.conversations;
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      this.isLoading = false;
    }
  }

  goBack() {
    this.router.navigate(['/home']);
  }

  openChat(uid: string) {
    console.log('Opening chat with:', uid);
  }

  onSearchChange(event: any) {
    const query = (event.detail.value || '').toLowerCase();
    this.filteredConversations = this.conversations.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.role.toLowerCase().includes(query) ||
      c.department.toLowerCase().includes(query)
    );
  }
}
