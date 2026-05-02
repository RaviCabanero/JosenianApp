import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { AuthService } from '../services/auth.service';

interface Connection {
  uid: string;
  name: string;
  avatar: string;
  department: string;
  userType: string;
  role: string;
}

@Component({
  selector: 'app-network',
  templateUrl: './network.page.html',
  styleUrls: ['./network.page.scss'],
  standalone: false
})
export class NetworkPage implements OnInit {

  connections: Connection[] = [];
  filteredConnections: Connection[] = [];
  searchQuery: string = '';
  isLoading: boolean = false;
  private currentUserUid: string | null = null;

  networkStats = {
    totalConnections: 0,
    students: 0,
    alumni: 0,
  };

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
      await this.loadConnections();
    });
  }

  async loadConnections() {
    this.isLoading = true;
    try {
      const allUsers = await this.authService.getAllUsers();
      this.connections = allUsers
        .filter((u: any) => u.status === 'approved' && u.role !== 'admin' && u.id !== this.currentUserUid)
        .map((u: any) => {
          const firstName = u.firstName || '';
          const lastName = u.lastName || '';
          const name = `${firstName} ${lastName}`.trim() || u.email || 'Unknown';
          return {
            uid: u.id,
            name,
            avatar: firstName.charAt(0).toUpperCase() || '?',
            department: u.department || 'No Department',
            userType: u.userType || 'student',
            role: u.role || 'user'
          };
        });

      this.networkStats.totalConnections = this.connections.length;
      this.networkStats.students = this.connections.filter(c => c.userType === 'student').length;
      this.networkStats.alumni = this.connections.filter(c => c.userType === 'alumni').length;

      this.filteredConnections = this.connections;
    } catch (error) {
      console.error('Error loading connections:', error);
    } finally {
      this.isLoading = false;
    }
  }

  onSearchChange(event: any) {
    const query = (event.detail.value || '').toLowerCase();
    this.filteredConnections = this.connections.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.department.toLowerCase().includes(query) ||
      c.userType.toLowerCase().includes(query)
    );
  }

  goBack() {
    this.router.navigate(['/home']);
  }

  viewConnection(uid: string) {
    console.log('View connection:', uid);
  }
}
