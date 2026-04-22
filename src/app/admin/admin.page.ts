import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.page.html',
  styleUrls: ['./admin.page.scss'],
  standalone: false,
})
export class AdminPage implements OnInit {
  // Login state
  isLoggedIn: boolean = false;

  // Tab navigation
  activeTab: string = 'approval'; // 'approval' or 'departments'

  // Pending Users for Approval (from Firestore)
  pendingUsers: any[] = [];

  // Departments & Courses (from Firestore - dynamic)
  departments: any[] = [];

  // Form state for adding department
  newDepartmentName: string = '';
  newCourseName: string = '';
  selectedDepartmentId: string | null = null;
  showDepartmentForm: boolean = false;
  showCourseForm: boolean = false;
  isLoadingDepts: boolean = false;

  constructor(private router: Router, private authService: AuthService) { }

  ngOnInit() {
    // Check if user is already logged in via Firebase
    if (this.authService.isLoggedIn()) {
      this.authService.isAdmin().then(isAdmin => {
        if (isAdmin) {
          this.isLoggedIn = true;
          this.loadPendingUsers(); // Load users from Firestore
          this.loadDepartments(); // Load departments from Firestore
        } else {
          // User is logged in but not an admin - redirect to login
          this.router.navigate(['/login']);
        }
      });
    } else {
      // Not logged in - redirect to login page
      this.router.navigate(['/login']);
    }
  }

  // Load pending users from Firestore
  async loadPendingUsers() {
    try {
      this.pendingUsers = await this.authService.getPendingUsers();
      console.log('Loaded pending users:', this.pendingUsers);
    } catch (error) {
      console.error('Error loading pending users:', error);
    }
  }

  // Load departments from Firestore
  async loadDepartments() {
    try {
      this.isLoadingDepts = true;
      this.departments = await this.authService.getDepartments();
      console.log('Loaded departments:', this.departments);
      this.isLoadingDepts = false;
    } catch (error) {
      console.error('Error loading departments:', error);
      this.isLoadingDepts = false;
    }
  }

  async logout() {
    try {
      await this.authService.logout();
      this.isLoggedIn = false;
      this.activeTab = 'approval';
      this.pendingUsers = [];
      this.departments = [];
      // Navigate to login page
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  // Tab navigation
  selectTab(tab: string) {
    this.activeTab = tab;
  }

  // Approval handlers
  async approveUser(userId: string) {
    try {
      await this.authService.approveUser(userId);
      // Remove from pending list
      this.pendingUsers = this.pendingUsers.filter(u => u.id !== userId);
      console.log('User approved:', userId);
    } catch (error) {
      console.error('Error approving user:', error);
    }
  }

  async rejectUser(userId: string) {
    try {
      await this.authService.rejectUser(userId);
      // Remove from pending list
      this.pendingUsers = this.pendingUsers.filter(u => u.id !== userId);
      console.log('User rejected:', userId);
    } catch (error) {
      console.error('Error rejecting user:', error);
    }
  }

  // Department handlers
  toggleDepartmentForm() {
    this.showDepartmentForm = !this.showDepartmentForm;
    if (!this.showDepartmentForm) {
      this.newDepartmentName = '';
    }
  }

  toggleCourseForm(departmentId: string) {
    this.selectedDepartmentId = this.selectedDepartmentId === departmentId ? null : departmentId;
    this.newCourseName = '';
    this.showCourseForm = this.selectedDepartmentId !== null;
  }

  // Add department to Firestore
  async addDepartment() {
    if (!this.newDepartmentName.trim()) {
      alert('Please enter a department name');
      return;
    }

    try {
      await this.authService.addDepartment(this.newDepartmentName);
      this.newDepartmentName = '';
      this.showDepartmentForm = false;
      
      // Reload departments to show the new one
      await this.loadDepartments();
      console.log('Department added successfully');
    } catch (error) {
      console.error('Error adding department:', error);
      alert('Failed to add department');
    }
  }

  // Add course to a department in Firestore
  async addCourse(departmentId: string) {
    if (!this.newCourseName.trim()) {
      alert('Please enter a course name');
      return;
    }

    try {
      await this.authService.addCourse(departmentId, this.newCourseName);
      
      // Update local array
      const department = this.departments.find(d => d.id === departmentId);
      if (department) {
        department.courses.push(this.newCourseName);
      }
      
      this.newCourseName = '';
      this.showCourseForm = false;
      this.selectedDepartmentId = null;
      console.log('Course added successfully');
    } catch (error) {
      console.error('Error adding course:', error);
      alert('Failed to add course');
    }
  }

  // Delete course from a department in Firestore
  async deleteCourse(departmentId: string, courseIndex: number) {
    try {
      await this.authService.deleteCourse(departmentId, courseIndex);
      
      // Update local array
      const department = this.departments.find(d => d.id === departmentId);
      if (department) {
        department.courses.splice(courseIndex, 1);
      }
      
      console.log('Course deleted successfully');
    } catch (error) {
      console.error('Error deleting course:', error);
      alert('Failed to delete course');
    }
  }

  // Delete department from Firestore
  async deleteDepartment(departmentId: string) {
    if (confirm('Are you sure you want to delete this department?')) {
      try {
        await this.authService.deleteDepartment(departmentId);
        this.departments = this.departments.filter(d => d.id !== departmentId);
        console.log('Department deleted successfully');
      } catch (error) {
        console.error('Error deleting department:', error);
        alert('Failed to delete department');
      }
    }
  }
}
