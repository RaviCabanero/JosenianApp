import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { AuthService } from '../services/auth.service';

interface Department {
  id: string;
  name: string;
  courses?: string[];
  createdAt?: any;
  members?: any[];
  description?: string;
}

interface UserDepartment {
  departmentId: string;
  status: 'primary' | 'following'; // primary = enrolled, following = just following
  joinedDate: string;
}

@Component({
  selector: 'app-department',
  templateUrl: './department.page.html',
  styleUrls: ['./department.page.scss'],
  standalone: false
})
export class DepartmentPage implements OnInit {

  // Departments
  allDepartments: Department[] = [];
  userDepartments: UserDepartment[] = [];
  
  // UI State
  selectedDepartment: Department | null = null;
  showDetailModal: boolean = false;
  isLoading: boolean = false;
  errorMessage: string = '';
  activeTab: string = 'overview';

  // Tab content
  departments_tabs = ['overview', 'members', 'events', 'discussion', 'resources'];

  constructor(
    private router: Router,
    private modalController: ModalController,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.loadDepartments();
    this.loadUserDepartments();
  }

  // Load all departments from Firestore
  async loadDepartments() {
    try {
      this.isLoading = true;
      this.errorMessage = '';
      this.allDepartments = await this.authService.getDepartments();
      console.log('All departments loaded:', this.allDepartments);
    } catch (error) {
      console.error('Error loading departments:', error);
      this.errorMessage = 'Failed to load departments. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }

  // Load user's department memberships
  async loadUserDepartments() {
    try {
      const user = this.authService.getCurrentUser();
      if (user) {
        // Fetch user profile to get their primary department
        const userProfile = await this.authService.getUserProfile(user.uid);
        if (userProfile && userProfile['department']) {
          // User's primary department is stored in their profile
          this.userDepartments.push({
            departmentId: userProfile['department'],
            status: 'primary',
            joinedDate: userProfile['joinDate'] || new Date().toISOString()
          });
        }
        console.log('User departments loaded:', this.userDepartments);
      }
    } catch (error) {
      console.error('Error loading user departments:', error);
    }
  }

  // Check if user is in this department
  isUserInDepartment(deptId: string): boolean {
    const user = this.authService.getCurrentUser();
    if (!user) return false;
    
    // Check if user is in the department's members array
    const department = this.allDepartments.find(d => d.id === deptId);
    if (department && department.members) {
      return department.members.some((m: any) => m.userId === user.uid);
    }
    
    // Fallback to userDepartments
    return this.userDepartments.some(ud => ud.departmentId === deptId);
  }

  // Check if this is user's primary department
  isPrimaryDepartment(deptId: string): boolean {
    const user = this.authService.getCurrentUser();
    if (!user) return false;
    
    // Check if user's profile shows this as primary department
    return this.userDepartments.some(ud => ud.departmentId === deptId && ud.status === 'primary');
  }

  goBack() {
    this.router.navigate(['/home']);
  }

  openDepartmentDetail(department: Department) {
    this.selectedDepartment = department;
    this.showDetailModal = true;
    this.activeTab = 'overview';
  }

  closeDetailModal() {
    this.showDetailModal = false;
    this.selectedDepartment = null;
  }

  switchTab(tab: string) {
    this.activeTab = tab;
  }

  getTabIcon(tab: string): string {
    const icons: { [key: string]: string } = {
      overview: 'information-circle',
      members: 'people',
      events: 'calendar',
      discussion: 'chatbubble',
      resources: 'document'
    };
    return icons[tab] || 'document';
  }

  // Register for department (make it primary)
  async registerDepartment() {
    if (this.selectedDepartment) {
      try {
        console.log('Registering for department:', this.selectedDepartment.name);
        // TODO: Save to Firestore
        // await this.authService.setUserPrimaryDepartment(this.selectedDepartment.id);
        
        this.userDepartments.push({
          departmentId: this.selectedDepartment.id,
          status: 'primary',
          joinedDate: new Date().toISOString()
        });
        
        alert(`Successfully registered for ${this.selectedDepartment.name}!`);
        this.closeDetailModal();
      } catch (error) {
        console.error('Error registering:', error);
        alert('Failed to register for department');
      }
    }
  }

  // Follow/Join department (without making it primary)
  async followDepartment() {
    if (this.selectedDepartment) {
      try {
        console.log('Following department:', this.selectedDepartment.name);
        // TODO: Save to Firestore
        
        this.userDepartments.push({
          departmentId: this.selectedDepartment.id,
          status: 'following',
          joinedDate: new Date().toISOString()
        });
        
        alert(`Now following ${this.selectedDepartment.name}!`);
      } catch (error) {
        console.error('Error following:', error);
        alert('Failed to follow department');
      }
    }
  }

  refreshDepartments() {
    this.loadDepartments();
    this.loadUserDepartments();
  }
}
