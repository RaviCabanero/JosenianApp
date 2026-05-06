import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { AuthService } from '../services/auth.service';
import { ImageService } from '../services/image.service';
import { SafeUrl } from '@angular/platform-browser';
import * as XLSX from 'xlsx';
import * as QRCode from 'qrcode';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.page.html',
  styleUrls: ['./admin.page.scss'],
  standalone: false,
})
export class AdminPage implements OnInit {
  isLoggedIn: boolean = false;
  activeTab: string = 'dashboard';

  pendingUsers: any[] = [];
  selectedUser: any = null;

  totalPendingCount: number = 0;
  totalApprovedCount: number = 0;
  totalRejectedCount: number = 0;
  totalUsersCount: number = 0;
  totalStudentsCount: number = 0;
  totalAlumniCount: number = 0;
  recentUsers: any[] = [];

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

  showCreateUserForm: boolean = false;
  isCreatingUser: boolean = false;
  createUserCourses: string[] = [];
  createUserData = {
    firstName: '',
    lastName: '',
    email: '',
    userType: 'alumni' as 'alumni' | 'hod',
    department: '',
    studentNumber: '',
    course: '',
    graduationYear: ''
  };

  events: any[] = [];
  showEventForm: boolean = false;
  editingEventId: string | null = null;
  isSubmittingEvent: boolean = false;
  selectedEvent: any = null;
  newEvent = {
    title: '', description: '', date: '', time: '',
    location: '', eventType: 'global', maxParticipants: '',
    coverImageBase64: '', coverImageFileName: '',
    eventCategory: 'regular', pointValue: 10
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
  departmentSearchTerm: string = '';
  selectedDepartmentId: string | null = null;
  showDepartmentForm: boolean = false;
  showCourseForm: boolean = false;
  isLoadingDepts: boolean = false;
  isRefreshing: boolean = false;
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
          this.loadEvents();
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
      const appUsers = allUsers.filter((u: any) => u.userType === 'student' || u.userType === 'alumni');
      this.totalUsersCount = appUsers.length;
      this.totalStudentsCount = appUsers.filter((u: any) => u.userType === 'student').length;
      this.totalAlumniCount = appUsers.filter((u: any) => u.userType === 'alumni').length;
      this.totalPendingCount = appUsers.filter((u: any) => u.status === 'pending').length;
      this.totalApprovedCount = appUsers.filter((u: any) => u.status === 'approved').length;
      this.totalRejectedCount = appUsers.filter((u: any) => u.status === 'rejected').length;
      this.recentUsers = appUsers
        .filter((u: any) => u.status !== 'rejected')
        .sort((a: any, b: any) => this.getDateTime(b.createdAt || b.joinDate) - this.getDateTime(a.createdAt || a.joinDate))
        .slice(0, 5);
    } catch (error) {
      console.error('Error calculating stats:', error);
    }
  }

  private getDateTime(value: any): number {
    if (!value) return 0;
    if (value.toMillis) return value.toMillis();
    if (value.toDate) return value.toDate().getTime();
    return new Date(value).getTime() || 0;
  }

  formatUserDate(user: any): string {
    const value = user?.createdAt || user?.joinDate;
    if (!value) return 'Recently';
    const date = value.toDate ? value.toDate() : new Date(value);
    return isNaN(date.getTime()) ? 'Recently' : date.toLocaleDateString();
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

  get filteredDepartments(): any[] {
    if (!this.departmentSearchTerm.trim()) {
      return this.departments;
    }

    const searchLower = this.departmentSearchTerm.toLowerCase();
    return this.departments
      .map((dept: any) => {
        // Filter courses based on search term
        const filteredCourses = dept.courses.filter((course: string) =>
          course.toLowerCase().includes(searchLower)
        );

        // Include department if it matches the search or has matching courses
        if (
          dept.name.toLowerCase().includes(searchLower) ||
          filteredCourses.length > 0
        ) {
          return {
            ...dept,
            courses: dept.name.toLowerCase().includes(searchLower)
              ? dept.courses // Show all courses if department matches
              : filteredCourses // Show only matching courses if department doesn't match
          };
        }
        return null;
      })
      .filter((dept: any) => dept !== null);
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
    const department = this.departments.find(d => d.id === departmentId);
    const courseName = department?.courses?.[courseIndex] || 'this course';
    const confirmed = await this.showConfirm('Delete Course', `Are you sure you want to delete "${courseName}"?`);
    if (!confirmed) return;
    try {
      await this.authService.deleteCourse(departmentId, courseIndex);
      if (department) department.courses.splice(courseIndex, 1);
    } catch (error) {
      console.error('Error deleting course:', error);
      await this.showAlert('Error', 'Failed to delete course.');
    }
  }

  async editDepartment(departmentId: string, currentName: string) {
    const newName = await this.showPrompt('Rename Department', currentName);
    if (!newName || !newName.trim() || newName.trim() === currentName) return;
    try {
      await this.authService.updateDepartment(departmentId, newName.trim());
      const dept = this.departments.find(d => d.id === departmentId);
      if (dept) dept.name = newName.trim();
      this.departmentMap[departmentId] = newName.trim();
    } catch (error) {
      console.error('Error renaming department:', error);
      await this.showAlert('Error', 'Failed to rename department.');
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

  async editCourse(departmentId: string, courseIndex: number, currentName: string) {
    const newName = await this.showPrompt('Rename Course', currentName);
    if (!newName || !newName.trim() || newName.trim() === currentName) return;
    try {
      await this.authService.updateCourse(departmentId, courseIndex, newName.trim());
      const dept = this.departments.find(d => d.id === departmentId);
      if (dept) dept.courses[courseIndex] = newName.trim();
    } catch (error) {
      console.error('Error renaming course:', error);
      await this.showAlert('Error', 'Failed to rename course.');
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
      // Registered student/alumni users must be approved to appear in the management tab
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
    if (this.showAlumniForm) this.showCreateUserForm = false;
    if (!this.showAlumniForm) this.resetAlumniForm();
  }

  toggleCreateUserForm() {
    this.showCreateUserForm = !this.showCreateUserForm;
    if (this.showCreateUserForm) this.showAlumniForm = false;
    if (!this.showCreateUserForm) this.resetCreateUserForm();
  }

  resetCreateUserForm() {
    this.createUserData = {
      firstName: '', lastName: '', email: '',
      userType: 'alumni', department: '',
      studentNumber: '', course: '', graduationYear: ''
    } as any;
    this.createUserCourses = [];
  }

  onCreateUserDeptChange() {
    const dept = this.departments.find((d: any) => d.id === this.createUserData.department);
    this.createUserCourses = dept?.courses || [];
    this.createUserData.course = '';
  }

  async createUser() {
    const { firstName, lastName, email, userType, department, studentNumber, course, graduationYear } = this.createUserData;
    const isHOD = userType === 'hod';
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !department) {
      await this.showAlert('Required', 'Please fill in all required fields.');
      return;
    }
    if (!isHOD && !studentNumber.trim()) {
      await this.showAlert('Required', 'Please enter the student number.');
      return;
    }
    if (userType === 'alumni' && !graduationYear.trim()) {
      await this.showAlert('Required', 'Please enter the graduation year for alumni.');
      return;
    }
    this.isCreatingUser = true;
    try {
      await this.authService.adminCreateUser(email, {
        firstName, lastName,
        userType: isHOD ? 'alumni' : userType as 'student' | 'alumni',
        role: isHOD ? 'hod' : 'user',
        department,
        studentNumber: isHOD ? '' : studentNumber,
        course, graduationYear
      });
      this.showCreateUserForm = false;
      this.resetCreateUserForm();
      await this.loadAlumni();
      await this.calculateStats();
      await this.showAlert('Account Created', `Account created successfully! A password setup email has been sent to ${email}.`);
    } catch (error: any) {
      const msg = error?.message || 'Failed to create account.';
      await this.showAlert('Error', msg.includes('email-already-in-use') ? 'This email is already registered.' : msg);
    } finally {
      this.isCreatingUser = false;
    }
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
    if (!alumniToDelete) return;

    const isRegistered = alumniToDelete.source === 'registered';
    const confirmed = await this.showConfirm(
      'Delete User',
      isRegistered
        ? `Permanently delete the account of "${alumniToDelete.name}"? This removes all their profile data.`
        : `Delete the alumni record for "${alumniToDelete.name}"?`
    );
    if (!confirmed) return;

    try {
      if (isRegistered) {
        await this.authService.deleteRegisteredUser(alumniId);
      } else {
        await this.authService.deleteAlumni(alumniId);
      }
      this.alumni = this.alumni.filter(a => a.id !== alumniId);
      if (this.selectedAlumni?.id === alumniId) this.selectedAlumni = null;
      this.filterAlumni();
      await this.calculateStats();
    } catch (error) {
      console.error('Error deleting user:', error);
      await this.showAlert('Error', 'Failed to delete user.');
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

  isReminding: boolean = false;

  hasIncompleteProfile(alumnus: any): boolean {
    return alumnus?.source === 'registered' &&
      (!alumnus.contactNumber || !alumnus.gender || !alumnus.address);
  }

  async remindUpdateProfile(userId: string) {
    if (this.isReminding) return;
    this.isReminding = true;
    try {
      await this.authService.createNotification(
        userId,
        'Complete Your Profile',
        'Your profile is incomplete. Please update your mobile number, sex, and address so others can connect with you better.',
        'info',
        '/profile'
      );
      await this.showAlert('Reminder Sent', 'A profile update reminder has been sent to this user.');
    } catch (error) {
      console.error('Error sending reminder:', error);
      await this.showAlert('Error', 'Failed to send reminder.');
    } finally {
      this.isReminding = false;
    }
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

  // ==================== MANAGE EVENTS ====================

  async loadEvents() {
    try {
      this.events = await this.authService.getGlobalEvents();
    } catch (error) {
      console.error('Error loading events:', error);
    }
  }

  toggleEventForm() {
    this.showEventForm = !this.showEventForm;
    if (!this.showEventForm) this.resetEventForm();
  }

  resetEventForm() {
    this.newEvent = {
      title: '', description: '', date: '', time: '',
      location: '', eventType: 'global', maxParticipants: '',
      coverImageBase64: '', coverImageFileName: '',
      eventCategory: 'regular', pointValue: 10
    };
    this.editingEventId = null;
  }

  onCoverImageSelected(event: any) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      this.showAlert('File Too Large', 'Please select an image under 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.compressEventImage(e.target.result).then(base64 => {
        this.newEvent.coverImageBase64 = base64;
        this.newEvent.coverImageFileName = file.name;
      });
    };
    reader.readAsDataURL(file);
  }

  private compressEventImage(dataUrl: string): Promise<string> {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 800;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          const ratio = Math.min(MAX / w, MAX / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.7).split(',')[1]);
      };
      img.src = dataUrl;
    });
  }

  removeCoverImage() {
    this.newEvent.coverImageBase64 = '';
    this.newEvent.coverImageFileName = '';
  }

  async saveEvent() {
    const { title, description, date, location } = this.newEvent;
    if (!title.trim() || !description.trim() || !date || !location.trim()) {
      await this.showAlert('Required', 'Please fill in Title, Description, Date, and Location.');
      return;
    }
    this.isSubmittingEvent = true;
    try {
      const payload = {
        title: this.newEvent.title.trim(),
        description: this.newEvent.description.trim(),
        date: this.newEvent.date,
        time: this.newEvent.time,
        location: this.newEvent.location.trim(),
        eventType: this.newEvent.eventType,
        maxParticipants: this.newEvent.maxParticipants ? Number(this.newEvent.maxParticipants) : null,
        coverImageBase64: this.newEvent.coverImageBase64,
        coverImageFileName: this.newEvent.coverImageFileName
      };
      if (this.editingEventId) {
        await this.authService.updateGlobalEvent(this.editingEventId, payload);
      } else {
        await this.authService.addGlobalEvent(payload);
      }
      this.showEventForm = false;
      this.resetEventForm();
      await this.loadEvents();
      await this.showAlert('Success', this.editingEventId ? 'Event updated.' : 'Event created and published to Feeds.');
    } catch (error) {
      await this.showAlert('Error', 'Failed to save event.');
    } finally {
      this.isSubmittingEvent = false;
    }
  }

  editEvent(eventId: string) {
    const ev = this.events.find(e => e.id === eventId);
    if (!ev) return;
    this.newEvent = {
      title: ev.title || '',
      description: ev.description || '',
      date: ev.date || '',
      time: ev.time || '',
      location: ev.location || '',
      eventType: ev.eventType || 'global',
      maxParticipants: ev.maxParticipants || '',
      coverImageBase64: ev.coverImageBase64 || '',
      coverImageFileName: ev.coverImageFileName || '',
      eventCategory: ev.eventCategory || 'regular',
      pointValue: ev.pointValue ?? 10
    };
    this.editingEventId = eventId;
    this.showEventForm = true;
    this.selectedEvent = null;
  }

  async deleteEvent(eventId: string) {
    const confirmed = await this.showConfirm('Delete Event', 'Are you sure you want to delete this event? It will be removed from Feeds.');
    if (confirmed) {
      try {
        await this.authService.deleteGlobalEvent(eventId);
        this.events = this.events.filter(e => e.id !== eventId);
        if (this.selectedEvent?.id === eventId) this.selectedEvent = null;
      } catch (error) {
        await this.showAlert('Error', 'Failed to delete event.');
      }
    }
  }

  eventParticipants: any[] = [];
  loadingParticipants: boolean = false;
  showParticipantsForEvent: string | null = null;

  // QR Attendance
  showQRModal: boolean = false;
  qrModalEvent: any = null;
  qrCodeDataUrl: string = '';
  attendanceList: any[] = [];
  isLoadingAttendance: boolean = false;
  showAttendanceInModal: boolean = false;
  isGeneratingQR: boolean = false;

  selectEventDetail(event: any) {
    const same = this.selectedEvent?.id === event.id;
    this.selectedEvent = same ? null : event;
    this.showParticipantsForEvent = null;
    this.eventParticipants = [];
  }

  async toggleParticipants(event: any) {
    if (this.showParticipantsForEvent === event.id) {
      this.showParticipantsForEvent = null;
      this.eventParticipants = [];
      return;
    }
    this.showParticipantsForEvent = event.id;
    this.loadingParticipants = true;
    try {
      this.eventParticipants = await this.authService.getUserProfiles(event.attendees || []);
    } catch {
      this.eventParticipants = [];
    } finally {
      this.loadingParticipants = false;
    }
  }

  formatEventDate(event: any): string {
    if (!event.date) return 'TBD';
    const d = new Date(`${event.date}T${event.time || '00:00'}`);
    return isNaN(d.getTime()) ? event.date : d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  formatEventTime(event: any): string {
    if (!event.time) return '';
    const [h, m] = event.time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  isEventPast(event: any): boolean {
    if (!event.date) return false;
    return new Date(`${event.date}T${event.time || '23:59'}`) < new Date();
  }

  // ==================== QR ATTENDANCE ====================

  async showEventQR(event: any) {
    this.isGeneratingQR = true;
    this.qrModalEvent = event;
    this.showQRModal = true;
    this.attendanceList = [];
    this.showAttendanceInModal = false;
    this.qrCodeDataUrl = '';
    try {
      let token: string = event.qrToken;
      if (!token) {
        token = await this.authService.generateEventQRToken(event.id);
        const idx = this.events.findIndex(e => e.id === event.id);
        if (idx !== -1) this.events[idx].qrToken = token;
        this.qrModalEvent = { ...event, qrToken: token };
      }
      await this.renderQRCode(event.id, token);
      await this.loadEventAttendance(event.id);
    } catch {
      await this.showAlert('Error', 'Failed to generate QR code.');
      this.closeQRModal();
    } finally {
      this.isGeneratingQR = false;
    }
  }

  async refreshQRCode() {
    if (!this.qrModalEvent) return;
    this.isGeneratingQR = true;
    this.qrCodeDataUrl = '';
    try {
      const token = await this.authService.generateEventQRToken(this.qrModalEvent.id);
      const idx = this.events.findIndex(e => e.id === this.qrModalEvent.id);
      if (idx !== -1) this.events[idx].qrToken = token;
      this.qrModalEvent = { ...this.qrModalEvent, qrToken: token };
      await this.renderQRCode(this.qrModalEvent.id, token);
    } catch {
      await this.showAlert('Error', 'Failed to refresh QR code.');
    } finally {
      this.isGeneratingQR = false;
    }
  }

  private async renderQRCode(eventId: string, token: string) {
    const payload = `josenianlink::${eventId}::${token}`;
    this.qrCodeDataUrl = await QRCode.toDataURL(payload, {
      width: 280,
      margin: 2,
      color: { dark: '#111827', light: '#ffffff' },
      errorCorrectionLevel: 'M'
    });
  }

  async loadEventAttendance(eventId: string) {
    this.isLoadingAttendance = true;
    try {
      this.attendanceList = await this.authService.getEventAttendance(eventId);
    } catch {
      this.attendanceList = [];
    } finally {
      this.isLoadingAttendance = false;
    }
  }

  toggleAttendanceList() {
    this.showAttendanceInModal = !this.showAttendanceInModal;
    if (this.showAttendanceInModal && this.qrModalEvent) {
      this.loadEventAttendance(this.qrModalEvent.id);
    }
  }

  closeQRModal() {
    this.showQRModal = false;
    this.qrModalEvent = null;
    this.qrCodeDataUrl = '';
    this.attendanceList = [];
    this.showAttendanceInModal = false;
  }

  formatAttendanceTime(scannedAt: any): string {
    if (!scannedAt) return '';
    const d = scannedAt.toDate ? scannedAt.toDate() : new Date(scannedAt);
    return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  }

  // ==================== POINTS MANAGEMENT ====================

  adjustPointsUserId: string = '';
  adjustPointsAmount: number = 0;
  adjustPointsReason: string = '';
  leaderboard: any[] = [];
  isLoadingLeaderboard: boolean = false;

  onEventCategoryChange() {
    this.newEvent.pointValue = this.authService.getDefaultPoints(this.newEvent.eventCategory);
  }

  async adjustUserPoints(userId: string) {
    if (!this.adjustPointsAmount || !this.adjustPointsReason.trim()) {
      await this.showAlert('Required', 'Enter both an amount and a reason.');
      return;
    }
    try {
      await this.authService.adminAdjustPoints(userId, this.adjustPointsAmount, this.adjustPointsReason);
      this.adjustPointsAmount = 0;
      this.adjustPointsReason = '';
      await this.showAlert('Done', `Points adjusted by ${this.adjustPointsAmount > 0 ? '+' : ''}${this.adjustPointsAmount}.`);
    } catch {
      await this.showAlert('Error', 'Failed to adjust points.');
    }
  }

  async loadLeaderboard() {
    this.isLoadingLeaderboard = true;
    try {
      this.leaderboard = await this.authService.getLeaderboard(10);
    } catch {
      this.leaderboard = [];
    } finally {
      this.isLoadingLeaderboard = false;
    }
  }

  // ==================== ATTENDANCE DASHBOARD ====================

  activeDashboardEventId: string = '';
  dashboardEvent: any = null;
  dashboardAttendees: any[] = [];
  filteredDashboardAttendees: any[] = [];
  dashboardSearch: string = '';
  dashboardStatusFilter: string = 'all';
  isLoadingDashboard: boolean = false;
  dashboardStats = { registered: 0, attended: 0, noShows: 0, rate: 0 };
  chartPoints: { x: number; y: number; label: string; count: number }[] = [];

  async selectDashboardEvent(eventId: string) {
    this.dashboardEvent = this.events.find((e: any) => e.id === eventId) || null;
    if (!this.dashboardEvent) return;
    await this.loadDashboardData();
  }

  async loadDashboardData() {
    if (!this.dashboardEvent) return;
    this.isLoadingDashboard = true;
    try {
      const attendance = await this.authService.getEventAttendance(this.dashboardEvent.id);
      const registeredIds: string[] = this.dashboardEvent.attendees || [];
      let registeredProfiles: any[] = [];
      if (registeredIds.length > 0) {
        registeredProfiles = await this.authService.getUserProfiles(registeredIds);
      }

      const attendedMap = new Map<string, any>();
      attendance.forEach((a: any) => attendedMap.set(a.userId, a));

      this.dashboardAttendees = registeredProfiles.map((p: any) => {
        const record = attendedMap.get(p.id);
        return {
          id: p.id,
          name: `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.email || 'Unknown',
          initials: ((p.firstName?.charAt(0) || '') + (p.lastName?.charAt(0) || '')).toUpperCase() || 'U',
          course: p.course || '',
          department: p.department || '',
          userType: p.userType || '',
          scannedAt: record?.scannedAt || null,
          status: record ? 'attended' : 'no-show',
          photoUrl: p.photoUrl || '',
        };
      });

      attendance.forEach((a: any) => {
        if (!this.dashboardAttendees.find((u: any) => u.id === a.userId)) {
          this.dashboardAttendees.push({
            id: a.userId,
            name: a.userName || 'Unknown',
            initials: (a.userName || 'U').charAt(0).toUpperCase(),
            course: '', department: '', userType: a.userType || '',
            scannedAt: a.scannedAt, status: 'attended', photoUrl: '',
          });
        }
      });

      const attended = this.dashboardAttendees.filter((u: any) => u.status === 'attended').length;
      const registered = this.dashboardAttendees.length;
      this.dashboardStats = {
        registered,
        attended,
        noShows: registered - attended,
        rate: registered > 0 ? Math.round((attended / registered) * 100) : 0,
      };

      this.buildChartData(attendance);
      this.filterDashboardList();
    } catch (err) {
      console.error('Error loading attendance dashboard:', err);
    } finally {
      this.isLoadingDashboard = false;
    }
  }

  private buildChartData(attendance: any[]) {
    const sorted = attendance
      .filter((a: any) => a.scannedAt)
      .map((a: any) => ({ time: a.scannedAt.toDate ? a.scannedAt.toDate() : new Date(a.scannedAt) }))
      .sort((a: any, b: any) => a.time - b.time);

    if (sorted.length < 2) { this.chartPoints = []; return; }

    const minT = sorted[0].time.getTime();
    const maxT = sorted[sorted.length - 1].time.getTime();
    const rangeT = maxT - minT || 1;
    const W = 560, H = 120, padL = 40, padR = 20, padT = 10, padB = 28;
    const cW = W - padL - padR, cH = H - padT - padB;

    this.chartPoints = sorted.map((p: any, i: number) => ({
      x: padL + ((p.time.getTime() - minT) / rangeT) * cW,
      y: padT + cH - ((i + 1) / sorted.length) * cH,
      label: p.time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      count: i + 1,
    }));
  }

  get chartSvgPath(): string {
    const pts = this.chartPoints;
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const cpx = (pts[i - 1].x + pts[i].x) / 2;
      d += ` C ${cpx} ${pts[i - 1].y}, ${cpx} ${pts[i].y}, ${pts[i].x} ${pts[i].y}`;
    }
    return d;
  }

  get chartFillPath(): string {
    const pts = this.chartPoints;
    if (pts.length < 2) return '';
    const bottom = 148;
    let d = `M ${pts[0].x} ${bottom} L ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const cpx = (pts[i - 1].x + pts[i].x) / 2;
      d += ` C ${cpx} ${pts[i - 1].y}, ${cpx} ${pts[i].y}, ${pts[i].x} ${pts[i].y}`;
    }
    d += ` L ${pts[pts.length - 1].x} ${bottom} Z`;
    return d;
  }

  filterDashboardList() {
    this.filteredDashboardAttendees = this.dashboardAttendees.filter((u: any) => {
      const nameMatch = !this.dashboardSearch ||
        u.name.toLowerCase().includes(this.dashboardSearch.toLowerCase());
      const statusMatch = !this.dashboardStatusFilter || this.dashboardStatusFilter === 'all' ||
        u.status === this.dashboardStatusFilter;
      return nameMatch && statusMatch;
    });
  }

  formatDashboardTime(scannedAt: any): string {
    if (!scannedAt) return '—';
    const d = scannedAt.toDate ? scannedAt.toDate() : new Date(scannedAt);
    return isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  exportAttendanceCSV() {
    if (!this.dashboardEvent) return;
    const headers = ['Name', 'Course', 'Department', 'Role', 'Time Scanned', 'Status'];
    const rows = this.filteredDashboardAttendees.map((u: any) => [
      u.name, u.course || '—', this.getDepartmentName(u.department),
      u.userType === 'alumni' ? 'Alumni' : 'Student',
      this.formatDashboardTime(u.scannedAt),
      u.status === 'attended' ? 'Attended' : 'No-show',
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${this.dashboardEvent.title}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ==================== EXPORT ====================

  exportCSV() {
    const headers = ['Student Number', 'Name', 'Email', 'Department', 'Course', 'Batch/Year', 'Type', 'Status', 'Source'];
    const rows = this.filteredAlumni.map(a => [
      a.studentNumber || '',
      a.name || '',
      a.email || '',
      this.getDepartmentName(a.department),
      a.course || '',
      a.batch || '',
      a.userType === 'alumni' ? 'Alumni' : 'Student',
      a.status || '',
      a.source === 'registered' ? 'Registered' : 'Manual',
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `alumni-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  exportExcel() {
    const headers = ['Student Number', 'Name', 'Email', 'Department', 'Course', 'Batch/Year', 'Type', 'Status', 'Source'];
    const rows = this.filteredAlumni.map(a => [
      a.studentNumber || '',
      a.name || '',
      a.email || '',
      this.getDepartmentName(a.department),
      a.course || '',
      a.batch || '',
      a.userType === 'alumni' ? 'Alumni' : 'Student',
      a.status || '',
      a.source === 'registered' ? 'Registered' : 'Manual',
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Alumni');
    XLSX.writeFile(wb, `alumni-${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  // ==================== NAVIGATION ====================

  selectTab(tab: string) {
    this.activeTab = tab;
    if (tab === 'attendance' && this.leaderboard.length === 0) {
      this.loadLeaderboard();
    }
  }

  async refreshData() {
    this.isRefreshing = true;
    try {
      await Promise.all([
        this.loadPendingUsers(),
        this.loadDepartments(),
        this.loadAlumni(),
        this.loadPendingAlumniVerification(),
        this.loadEvents()
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      this.isRefreshing = false;
    }
  }

  async logout() {
    try {
      await this.authService.logout();
      this.isLoggedIn = false;
      this.activeTab = 'dashboard';
      this.pendingUsers = [];
      this.departments = [];
      this.alumni = [];
      this.filteredAlumni = [];
      this.events = [];
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
}
