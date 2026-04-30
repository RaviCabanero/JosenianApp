import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ImageService } from '../services/image.service';
import { SafeUrl } from '@angular/platform-browser';

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
  activeTab: string = 'approval'; // 'approval', 'departments', 'alumni', or 'alumni-verification'

  // Pending Users for Approval (from Firestore)
  pendingUsers: any[] = [];

  // Selected user for detail panel
  selectedUser: any = null;

  // Statistics
  totalPendingCount: number = 0;
  totalApprovedCount: number = 0;
  totalRejectedCount: number = 0;
  totalUsersCount: number = 0;

  // Admin notes for selected user
  adminNotes: string = '';

  // Alumni ID Verification
  pendingAlumniVerification: any[] = [];
  expandedAlumniId: string | null = null;

  // Departments & Courses (from Firestore - dynamic)
  departments: any[] = [];

  // Alumni Management
  alumni: any[] = [];
  filteredAlumni: any[] = [];
  showAlumniForm: boolean = false;
  editingAlumniId: string | null = null;
  
  // Alumni form data
  newAlumni = {
    studentNumber: '',
    name: '',
    email: '',
    department: '',
    course: '',
    batch: ''
  };
  
  // Alumni search filters
  alumniSearchFilters = {
    name: '',
    department: '',
    batch: '',
    userType: ''
  };

  // Pagination and Search for Account Approval
  searchTerm: string = '';
  filterByRole: string = '';
  filteredUsers: any[] = [];
  paginatedUsers: any[] = [];
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalPages: number = 1;

  // Form state for adding department
  newDepartmentName: string = '';
  newCourseName: string = '';
  selectedDepartmentId: string | null = null;
  showDepartmentForm: boolean = false;
  showCourseForm: boolean = false;
  isLoadingDepts: boolean = false;

  constructor(
    private router: Router,
    private authService: AuthService,
    private imageService: ImageService
  ) { }

  ngOnInit() {
    // Check if user is already logged in via Firebase
    if (this.authService.isLoggedIn()) {
      this.authService.isAdmin().then(isAdmin => {
        if (isAdmin) {
          this.isLoggedIn = true;
          this.loadPendingUsers(); // Load users from Firestore
          this.loadDepartments(); // Load departments from Firestore
          this.loadAlumni(); // Load alumni from Firestore
          this.loadPendingAlumniVerification(); // Load alumni awaiting ID verification
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
      await this.calculateStats();
      // Initialize pagination and filtering
      this.filterAndPaginateUsers();
      // Auto-select first user if none selected
      if (this.paginatedUsers.length > 0 && !this.selectedUser) {
        this.selectUserForDetail(this.paginatedUsers[0]);
      }
    } catch (error) {
      console.error('Error loading pending users:', error);
    }
  }

  // Calculate statistics for summary cards
  async calculateStats() {
    try {
      const allUsers = await this.authService.getAllUsers();
      this.totalUsersCount = allUsers.length;
      this.totalPendingCount = allUsers.filter((u: any) => u.status === 'pending').length;
      this.totalApprovedCount = allUsers.filter((u: any) => u.status === 'approved').length;
      this.totalRejectedCount = allUsers.filter((u: any) => u.status === 'rejected').length;
    } catch (error) {
      console.error('Error calculating stats:', error);
    }
  }

  // Select user for detail panel
  selectUserForDetail(user: any) {
    this.selectedUser = user;
    this.adminNotes = '';
  }

  // Filter and paginate users for approval list
  filterAndPaginateUsers() {
    // Filter by search term and role
    this.filteredUsers = this.pendingUsers.filter(user => {
      const matchesSearch = !this.searchTerm || 
        user.firstName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        user.lastName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(this.searchTerm.toLowerCase());
      
      const matchesRole = !this.filterByRole || 
        user.userType?.toLowerCase() === this.filterByRole.toLowerCase();
      
      return matchesSearch && matchesRole;
    });

    // Reset to page 1 when filtering
    this.currentPage = 1;

    // Calculate pagination
    this.totalPages = Math.ceil(this.filteredUsers.length / this.itemsPerPage);
    this.paginatedUsers = this.getPaginatedUsers();
  }

  // Get users for current page
  getPaginatedUsers(): any[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.filteredUsers.slice(startIndex, endIndex);
  }

  // Go to next page
  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.paginatedUsers = this.getPaginatedUsers();
    }
  }

  // Go to previous page
  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.paginatedUsers = this.getPaginatedUsers();
    }
  }

  // Load alumni awaiting ID verification
  async loadPendingAlumniVerification() {
    try {
      this.pendingAlumniVerification = await this.authService.getPendingAlumniVerification();
      console.log('Loaded pending alumni verification:', this.pendingAlumniVerification);
    } catch (error) {
      console.error('Error loading pending alumni verification:', error);
    }
  }

  // Get safe URL for base64 image
  getImageSafeUrl(base64: string): SafeUrl {
    return this.imageService.base64ToSafeUrl(base64, 'image/jpeg');
  }

  // Download alumni ID
  downloadAlumniId(alumniId: any) {
    if (alumniId.alumniIdBase64 && alumniId.alumniIdFileName) {
      this.imageService.downloadBase64File(
        alumniId.alumniIdBase64,
        alumniId.alumniIdFileName,
        'image/jpeg'
      );
    }
  }

  // Approve alumni ID
  async approveAlumniId(userId: string) {
    try {
      await this.authService.verifyAlumniId(userId, 'approved', '');
      this.pendingAlumniVerification = this.pendingAlumniVerification.filter(a => a.id !== userId);
      console.log('Alumni ID approved:', userId);
    } catch (error) {
      console.error('Error approving alumni ID:', error);
      alert('Failed to approve alumni ID');
    }
  }

  // Reject alumni ID
  async rejectAlumniId(userId: string) {
    const reason = prompt('Enter reason for rejection:');
    if (reason !== null) {
      try {
        await this.authService.verifyAlumniId(userId, 'rejected', reason);
        this.pendingAlumniVerification = this.pendingAlumniVerification.filter(a => a.id !== userId);
        console.log('Alumni ID rejected:', userId);
      } catch (error) {
        console.error('Error rejecting alumni ID:', error);
        alert('Failed to reject alumni ID');
      }
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
      this.alumni = [];
      this.filteredAlumni = [];
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
      alert('User approved successfully. They can now login to their account.');
      console.log('User approved:', userId);
    } catch (error) {
      console.error('Error approving user:', error);
      alert('Failed to approve user');
    }
  }

  async rejectUser(userId: string) {
    const reason = prompt('Enter reason for rejection (optional):');
    if (reason !== null) {
      try {
        await this.authService.rejectUser(userId, reason);
        // Remove from pending list
        this.pendingUsers = this.pendingUsers.filter(u => u.id !== userId);
        alert('User rejected successfully.');
        console.log('User rejected:', userId);
      } catch (error) {
        console.error('Error rejecting user:', error);
        alert('Failed to reject user');
      }
    }
  }

  // Auto-approve eligible users
  async autoApproveEligibleUsers() {
    try {
      let autoApprovedCount = 0;
      for (const user of this.pendingUsers) {
        const isAutoApproved = await this.authService.autoApproveIfEligible(user.id);
        if (isAutoApproved) {
          autoApprovedCount++;
        }
      }
      
      if (autoApprovedCount > 0) {
        alert(`${autoApprovedCount} user(s) auto-approved with @usj.edu.ph email domain.`);
        await this.loadPendingUsers();
      }
    } catch (error) {
      console.error('Error in auto-approval:', error);
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

  // Alumni Management Methods

  // Load alumni from Firestore
  async loadAlumni() {
    try {
      this.alumni = await this.authService.getAlumni();
      this.filterAlumni();
      console.log('Loaded alumni:', this.alumni);
    } catch (error) {
      console.error('Error loading alumni:', error);
    }
  }

  // Filter alumni based on search criteria
  filterAlumni() {
    this.filteredAlumni = this.alumni.filter(a => {
      const nameMatch = a.name.toLowerCase().includes(this.alumniSearchFilters.name.toLowerCase());
      const deptMatch = this.alumniSearchFilters.department === '' || a.department === this.alumniSearchFilters.department;
      const batchMatch = this.alumniSearchFilters.batch === '' || a.batch === this.alumniSearchFilters.batch;
      const userTypeMatch = this.alumniSearchFilters.userType === '' || a.userType === this.alumniSearchFilters.userType;
      return nameMatch && deptMatch && batchMatch && userTypeMatch;
    });
  }

  // Check if filtered alumni contains alumni type (for conditional batch column header)
  hasAlumniType(): boolean {
    return this.filteredAlumni.some(a => a.userType === 'alumni');
  }

  // Toggle alumni form
  toggleAlumniForm() {
    this.showAlumniForm = !this.showAlumniForm;
    if (!this.showAlumniForm) {
      this.resetAlumniForm();
    }
  }

  // Reset alumni form
  resetAlumniForm() {
    this.newAlumni = {
      studentNumber: '',
      name: '',
      email: '',
      department: '',
      course: '',
      batch: ''
    };
    this.editingAlumniId = null;
  }

  // Add or update alumni
  async saveAlumni() {
    if (!this.newAlumni.studentNumber.trim() || !this.newAlumni.name.trim() || !this.newAlumni.email.trim() || 
        !this.newAlumni.department.trim() || !this.newAlumni.course.trim() || !this.newAlumni.batch.trim()) {
      alert('Please fill in all fields');
      return;
    }

    try {
      if (this.editingAlumniId) {
        // Update existing alumni
        await this.authService.updateAlumni(this.editingAlumniId, this.newAlumni);
        const index = this.alumni.findIndex(a => a.id === this.editingAlumniId);
        if (index !== -1) {
          this.alumni[index] = { ...this.alumni[index], ...this.newAlumni };
        }
        console.log('Alumni updated successfully');
      } else {
        // Add new alumni
        await this.authService.addAlumni(this.newAlumni);
        await this.loadAlumni();
        console.log('Alumni added successfully');
      }
      this.resetAlumniForm();
      this.showAlumniForm = false;
      this.filterAlumni();
    } catch (error) {
      console.error('Error saving alumni:', error);
      alert('Failed to save alumni');
    }
  }

  // Edit alumni
  editAlumni(alumniId: string) {
    const alumniToEdit = this.alumni.find(a => a.id === alumniId);
    if (alumniToEdit) {
      this.newAlumni = { ...alumniToEdit };
      this.editingAlumniId = alumniId;
      this.showAlumniForm = true;
    }
  }

  // Delete alumni
  async deleteAlumni(alumniId: string) {
    if (confirm('Are you sure you want to delete this alumni record?')) {
      try {
        await this.authService.deleteAlumni(alumniId);
        this.alumni = this.alumni.filter(a => a.id !== alumniId);
        this.filterAlumni();
        console.log('Alumni deleted successfully');
      } catch (error) {
        console.error('Error deleting alumni:', error);
        alert('Failed to delete alumni');
      }
    }
  }

  // Get unique batches for filter dropdown
  getUniqueBatches(): string[] {
    const batches = this.alumni.map(a => a.batch);
    return Array.from(new Set(batches)).sort().reverse();
  }

  // Get unique departments for filter dropdown
  getUniqueDepartmentsForAlumni(): string[] {
    const depts = this.alumni.map(a => a.department);
    return Array.from(new Set(depts)).sort();
  }
}
