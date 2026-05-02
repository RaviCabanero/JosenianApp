import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
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
  isLoggedIn: boolean = false;
  activeTab: string = 'approval';

  pendingUsers: any[] = [];
  selectedUser: any = null;

  totalPendingCount: number = 0;
  totalApprovedCount: number = 0;
  totalRejectedCount: number = 0;
  totalUsersCount: number = 0;

  adminNotes: string = '';

  pendingAlumniVerification: any[] = [];
  expandedAlumniId: string | null = null;

  departments: any[] = [];

  alumni: any[] = [];
  filteredAlumni: any[] = [];
  showAlumniForm: boolean = false;
  editingAlumniId: string | null = null;
  selectedAlumni: any = null;
  selectedAlumniRole: string = 'user';
  showRoleManagementModal: boolean = false;

  newAlumni = {
    studentNumber: '',
    name: '',
    email: '',
    department: '',
    course: '',
    batch: ''
  };

  alumniSearchFilters = {
    name: '',
    department: '',
    batch: '',
    userType: ''
  };

  searchTerm: string = '';
  filterByRole: string = '';
  filteredUsers: any[] = [];
  paginatedUsers: any[] = [];
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalPages: number = 1;

  newDepartmentName: string = '';
  newCourseName: string = '';
  selectedDepartmentId: string | null = null;
  showDepartmentForm: boolean = false;
  showCourseForm: boolean = false;
  isLoadingDepts: boolean = false;
  departmentMap: {[id: string]: string} = {};

  constructor(
    private router: Router,
    private authService: AuthService,
    private imageService: ImageService,
    private alertCtrl: AlertController
  ) {}

  ngOnInit() {
    if (this.authService.isLoggedIn()) {
      this.authService.isAdmin().then(isAdmin => {
        if (isAdmin) {
          this.isLoggedIn = true;
          this.loadPendingUsers();
          this.loadDepartments();
          this.loadAlumni();
          this.loadPendingAlumniVerification();
        } else {
          this.router.navigate(['/login']);
        }
      });
    } else {
      this.router.navigate(['/login']);
    }
  }

  // ==================== PRIVATE DIALOG HELPERS ====================

  private async showAlert(header: string, message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header, message, buttons: ['OK'] });
    await alert.present();
  }

  private async showConfirm(header: string, message: string): Promise<boolean> {
    return new Promise(async resolve => {
      const alert = await this.alertCtrl.create({
        header,
        message,
        buttons: [
          { text: 'Cancel', role: 'cancel', handler: () => resolve(false) },
          { text: 'Confirm', cssClass: 'alert-button-danger', handler: () => resolve(true) }
        ]
      });
      await alert.present();
    });
  }

  private async showPrompt(header: string, placeholder: string = ''): Promise<string | null> {
    return new Promise(async resolve => {
      const alert = await this.alertCtrl.create({
        header,
        inputs: [{ name: 'value', type: 'text', placeholder }],
        buttons: [
          { text: 'Cancel', role: 'cancel', handler: () => resolve(null) },
          { text: 'Submit', handler: data => resolve(data['value'] !== undefined ? data['value'] : '') }
        ]
      });
      await alert.present();
    });
  }

  // ==================== ACCOUNT APPROVAL ====================

  async loadPendingUsers() {
    try {
      this.pendingUsers = await this.authService.getPendingUsers();
      await this.calculateStats();
      this.filterAndPaginateUsers();
      if (this.pendingUsers.length > 0 && !this.selectedUser) {
        this.selectUserForDetail(this.pendingUsers[0]);
      }
    } catch (error) {
      console.error('Error loading pending users:', error);
    }
  }

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

  filterAndPaginateUsers() {
    this.filteredUsers = this.pendingUsers.filter(user => {
      const fullName = (user.firstName + ' ' + user.lastName).toLowerCase();
      const email = (user.email || '').toLowerCase();
      const searchLower = this.searchTerm.toLowerCase();
      const matchesSearch = !this.searchTerm ||
        fullName.includes(searchLower) ||
        email.includes(searchLower);
      const matchesRole = !this.filterByRole || user.userType === this.filterByRole;
      return matchesSearch && matchesRole;
    });
    this.totalPages = Math.ceil(this.filteredUsers.length / this.itemsPerPage) || 1;
    if (this.currentPage > this.totalPages) this.currentPage = 1;
    this.paginatedUsers = this.getPaginatedUsers();
  }

  getPaginatedUsers(): any[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredUsers.slice(startIndex, startIndex + this.itemsPerPage);
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.paginatedUsers = this.getPaginatedUsers();
    }
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.paginatedUsers = this.getPaginatedUsers();
    }
  }

  selectUserForDetail(user: any) {
    this.selectedUser = user;
    this.adminNotes = '';
  }

  async approveUser(userId: string) {
    try {
      await this.authService.approveUser(userId);
      if (this.selectedUser?.id === userId) {
        this.selectedUser = { ...this.selectedUser, status: 'approved' };
      }
      this.pendingUsers = this.pendingUsers.filter(u => u.id !== userId);
      this.filterAndPaginateUsers();
      await this.calculateStats();
      await this.showAlert('Approved', 'User approved successfully. They can now log in.');
    } catch (error) {
      console.error('Error approving user:', error);
      await this.showAlert('Error', 'Failed to approve user. Please try again.');
    }
  }

  async rejectUser(userId: string) {
    const reason = await this.showPrompt('Rejection Reason', 'Enter reason (optional)');
    if (reason !== null) {
      try {
        await this.authService.rejectUser(userId, reason);
        if (this.selectedUser?.id === userId) {
          this.selectedUser = { ...this.selectedUser, status: 'rejected' };
        }
        this.pendingUsers = this.pendingUsers.filter(u => u.id !== userId);
        this.filterAndPaginateUsers();
        await this.calculateStats();
        await this.showAlert('Rejected', 'User has been rejected.');
      } catch (error) {
        console.error('Error rejecting user:', error);
        await this.showAlert('Error', 'Failed to reject user. Please try again.');
      }
    }
  }

  async autoApproveEligibleUsers() {
    try {
      let autoApprovedCount = 0;
      for (const user of this.pendingUsers) {
        const isAutoApproved = await this.authService.autoApproveIfEligible(user.id);
        if (isAutoApproved) autoApprovedCount++;
      }
      if (autoApprovedCount > 0) {
        await this.showAlert('Auto-Approved', `${autoApprovedCount} user(s) auto-approved with @usj.edu.ph email.`);
        await this.loadPendingUsers();
      }
    } catch (error) {
      console.error('Error in auto-approval:', error);
    }
  }

  // ==================== ALUMNI ID VERIFICATION ====================

  async loadPendingAlumniVerification() {
    try {
      this.pendingAlumniVerification = await this.authService.getPendingAlumniVerification();
    } catch (error) {
      console.error('Error loading pending alumni verification:', error);
    }
  }

  getImageSafeUrl(base64: string): SafeUrl {
    return this.imageService.base64ToSafeUrl(base64, 'image/jpeg');
  }

  downloadAlumniId(alumniId: any) {
    if (alumniId.alumniIdBase64 && alumniId.alumniIdFileName) {
      this.imageService.downloadBase64File(alumniId.alumniIdBase64, alumniId.alumniIdFileName, 'image/jpeg');
    }
  }

  async approveAlumniId(userId: string) {
    try {
      await this.authService.verifyAlumniId(userId, 'approved', '');
      this.pendingAlumniVerification = this.pendingAlumniVerification.filter(a => a.id !== userId);
    } catch (error) {
      console.error('Error approving alumni ID:', error);
      await this.showAlert('Error', 'Failed to approve alumni ID.');
    }
  }

  async rejectAlumniId(userId: string) {
    const reason = await this.showPrompt('Rejection Reason', 'Enter reason for rejection');
    if (reason !== null) {
      try {
        await this.authService.verifyAlumniId(userId, 'rejected', reason);
        this.pendingAlumniVerification = this.pendingAlumniVerification.filter(a => a.id !== userId);
      } catch (error) {
        console.error('Error rejecting alumni ID:', error);
        await this.showAlert('Error', 'Failed to reject alumni ID.');
      }
    }
  }

  // ==================== DEPARTMENTS ====================

  async loadDepartments() {
    try {
      this.isLoadingDepts = true;
      this.departments = await this.authService.getDepartments();
      this.departmentMap = {};
      this.departments.forEach(dept => {
        this.departmentMap[dept.id] = dept.name;
      });
    } catch (error) {
      console.error('Error loading departments:', error);
    } finally {
      this.isLoadingDepts = false;
    }
  }

  getDepartmentName(departmentId: string): string {
    if (!departmentId) return 'N/A';
    return this.departmentMap[departmentId] || departmentId;
  }

  getTotalCourses(): number {
    return this.departments.reduce((total, dept) => total + (dept.courses?.length || 0), 0);
  }

  getDepartmentsWithCourses(): number {
    return this.departments.filter(dept => (dept.courses?.length || 0) > 0).length;
  }

  toggleDepartmentForm() {
    this.showDepartmentForm = !this.showDepartmentForm;
    if (!this.showDepartmentForm) this.newDepartmentName = '';
  }

  toggleCourseForm(departmentId: string) {
    this.selectedDepartmentId = this.selectedDepartmentId === departmentId ? null : departmentId;
    this.newCourseName = '';
    this.showCourseForm = this.selectedDepartmentId !== null;
  }

  async addDepartment() {
    if (!this.newDepartmentName.trim()) {
      await this.showAlert('Required', 'Please enter a department name.');
      return;
    }
    try {
      await this.authService.addDepartment(this.newDepartmentName);
      this.newDepartmentName = '';
      this.showDepartmentForm = false;
      await this.loadDepartments();
    } catch (error) {
      console.error('Error adding department:', error);
      await this.showAlert('Error', 'Failed to add department.');
    }
  }

  async addCourse(departmentId: string) {
    if (!this.newCourseName.trim()) {
      await this.showAlert('Required', 'Please enter a course name.');
      return;
    }
    try {
      await this.authService.addCourse(departmentId, this.newCourseName);
      const department = this.departments.find(d => d.id === departmentId);
      if (department) department.courses.push(this.newCourseName);
      this.newCourseName = '';
      this.showCourseForm = false;
      this.selectedDepartmentId = null;
    } catch (error) {
      console.error('Error adding course:', error);
      await this.showAlert('Error', 'Failed to add course.');
    }
  }

  async deleteCourse(departmentId: string, courseIndex: number) {
    try {
      await this.authService.deleteCourse(departmentId, courseIndex);
      const department = this.departments.find(d => d.id === departmentId);
      if (department) department.courses.splice(courseIndex, 1);
    } catch (error) {
      console.error('Error deleting course:', error);
      await this.showAlert('Error', 'Failed to delete course.');
    }
  }

  async deleteDepartment(departmentId: string) {
    const confirmed = await this.showConfirm('Delete Department', 'Are you sure you want to delete this department?');
    if (confirmed) {
      try {
        await this.authService.deleteDepartment(departmentId);
        this.departments = this.departments.filter(d => d.id !== departmentId);
      } catch (error) {
        console.error('Error deleting department:', error);
        await this.showAlert('Error', 'Failed to delete department.');
      }
    }
  }

  // ==================== ALUMNI MANAGEMENT ====================

  async loadAlumni() {
    try {
      this.alumni = await this.authService.getAlumni();
      this.filterAlumni();
    } catch (error) {
      console.error('Error loading alumni:', error);
    }
  }

  filterAlumni() {
    this.filteredAlumni = this.alumni.filter(a => {
      // Registered alumni must be approved to appear in the management tab
      if (a.source === 'registered' && a.status !== 'approved') return false;
      const nameMatch = a.name.toLowerCase().includes(this.alumniSearchFilters.name.toLowerCase());
      const deptMatch = this.alumniSearchFilters.department === '' || a.department === this.alumniSearchFilters.department;
      const batchMatch = this.alumniSearchFilters.batch === '' || a.batch === this.alumniSearchFilters.batch;
      const userTypeMatch = this.alumniSearchFilters.userType === '' || a.userType === this.alumniSearchFilters.userType;
      return nameMatch && deptMatch && batchMatch && userTypeMatch;
    });
  }

  toggleAlumniForm() {
    this.showAlumniForm = !this.showAlumniForm;
    if (!this.showAlumniForm) this.resetAlumniForm();
  }

  resetAlumniForm() {
    this.newAlumni = { studentNumber: '', name: '', email: '', department: '', course: '', batch: '' };
    this.editingAlumniId = null;
  }

  async saveAlumni() {
    const { studentNumber, name, email, department, course, batch } = this.newAlumni;
    if (!studentNumber.trim() || !name.trim() || !email.trim() || !department.trim() || !course.trim() || !batch.trim()) {
      await this.showAlert('Required', 'Please fill in all required fields.');
      return;
    }
    try {
      if (this.editingAlumniId) {
        await this.authService.updateAlumni(this.editingAlumniId, this.newAlumni);
        const index = this.alumni.findIndex(a => a.id === this.editingAlumniId);
        if (index !== -1) this.alumni[index] = { ...this.alumni[index], ...this.newAlumni };
      } else {
        await this.authService.addAlumni(this.newAlumni);
        await this.loadAlumni();
      }
      this.resetAlumniForm();
      this.showAlumniForm = false;
      this.filterAlumni();
    } catch (error) {
      console.error('Error saving alumni:', error);
      await this.showAlert('Error', 'Failed to save alumni record.');
    }
  }

  async editAlumni(alumniId: string) {
    const alumniToEdit = this.alumni.find(a => a.id === alumniId);
    if (!alumniToEdit) return;
    if (alumniToEdit.source === 'registered') {
      await this.showAlert('Not Allowed', 'Registered alumni users cannot be edited directly. They are managed through their user accounts.');
      return;
    }
    this.newAlumni = {
      studentNumber: alumniToEdit.studentNumber || '',
      name: alumniToEdit.name || '',
      email: alumniToEdit.email || '',
      department: alumniToEdit.department || '',
      course: alumniToEdit.course || '',
      batch: alumniToEdit.batch || ''
    };
    this.editingAlumniId = alumniId;
    this.showAlumniForm = true;
  }

  async deleteAlumni(alumniId: string) {
    const alumniToDelete = this.alumni.find(a => a.id === alumniId);
    if (alumniToDelete && alumniToDelete.source === 'registered') {
      await this.showAlert('Not Allowed', 'Cannot delete registered alumni users from this panel. Use the User Management section.');
      return;
    }
    const confirmed = await this.showConfirm('Delete Alumni', 'Are you sure you want to delete this alumni record?');
    if (confirmed) {
      try {
        await this.authService.deleteAlumni(alumniId);
        this.alumni = this.alumni.filter(a => a.id !== alumniId);
        this.filterAlumni();
      } catch (error) {
        console.error('Error deleting alumni:', error);
        await this.showAlert('Error', 'Failed to delete alumni record.');
      }
    }
  }

  getUniqueBatches(): string[] {
    return Array.from(new Set(this.alumni.map(a => a.batch))).sort().reverse() as string[];
  }

  getUniqueDepartmentsForAlumni(): string[] {
    return Array.from(new Set(this.alumni.map(a => a.department))).sort() as string[];
  }

  selectAlumniForDetail(alumni: any) {
    this.selectedAlumni = alumni;
    this.selectedAlumniRole = alumni.role || 'user';
  }

  closeAlumniDetail() {
    this.selectedAlumni = null;
    this.showRoleManagementModal = false;
  }

  openRoleManagement() {
    this.showRoleManagementModal = true;
  }

  async updateAlumniRole(newRole: string) {
    if (!this.selectedAlumni || this.selectedAlumni.source !== 'registered') {
      await this.showAlert('Not Allowed', 'Roles can only be changed for registered alumni users.');
      return;
    }
    if (this.selectedAlumni.userType !== 'alumni') {
      await this.showAlert('Not Allowed', 'HOD role can only be assigned to Alumni accounts.');
      return;
    }
    const allowedRoles: string[] = ['user', 'hod'];
    if (!allowedRoles.includes(newRole)) {
      await this.showAlert('Invalid Role', 'Only "User" and "HOD" roles can be assigned here.');
      return;
    }
    try {
      await this.authService.updateUserRole(this.selectedAlumni.id, newRole);
      this.selectedAlumni.role = newRole;
      const index = this.alumni.findIndex(a => a.id === this.selectedAlumni.id);
      if (index !== -1) this.alumni[index].role = newRole;
      const label = newRole === 'hod' ? 'Head of Department (HOD)' : 'User';
      await this.showAlert('Role Updated', `${this.selectedAlumni.name} is now assigned as: ${label}.`);
    } catch (error) {
      console.error('Error updating alumni role:', error);
      await this.showAlert('Error', 'Failed to update user role.');
    }
  }

  // ==================== NAVIGATION ====================

  selectTab(tab: string) {
    this.activeTab = tab;
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
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
}
