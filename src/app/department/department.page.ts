import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
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
  status: 'primary' | 'following';
  joinedDate: string;
}

interface DeptEvent {
  id?: string;
  title: string;
  description: string;
  date: string;
  time: string;
  venue: string;
  type: string;
  createdBy?: string;
  createdByName?: string;
  attendees?: string[];
  status?: string;
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

  // Current user
  currentUserId: string = '';
  currentUserType: string = '';
  currentUserRole: string = '';
  currentUserName: string = '';

  // UI State
  selectedDepartment: Department | null = null;
  showDetailModal: boolean = false;
  isLoading: boolean = false;
  errorMessage: string = '';
  activeTab: string = 'overview';

  // Events
  departmentEvents: DeptEvent[] = [];
  isLoadingEvents: boolean = false;
  showEventForm: boolean = false;
  isEditingEvent: boolean = false;
  editingEventId: string = '';
  eventForm: DeptEvent = this.emptyEventForm();

  // Tab content
  departments_tabs = ['overview', 'members', 'events', 'discussion', 'resources'];

  get isHOD(): boolean {
    return this.currentUserType === 'alumni' && this.currentUserRole === 'hod';
  }

  constructor(
    private router: Router,
    private authService: AuthService,
    private alertCtrl: AlertController
  ) {}

  async ngOnInit() {
    await this.loadCurrentUserProfile();
    this.loadDepartments();
    this.loadUserDepartments();
  }

  private emptyEventForm(): DeptEvent {
    return { title: '', description: '', date: '', time: '', venue: '', type: 'academic' };
  }

  async loadCurrentUserProfile() {
    const user = this.authService.getCurrentUser();
    if (!user) return;
    this.currentUserId = user.uid;
    const profile = await this.authService.getUserProfile(user.uid);
    if (profile) {
      this.currentUserType = profile['userType'] || '';
      this.currentUserRole = profile['role'] || 'user';
      this.currentUserName = `${profile['firstName'] || ''} ${profile['lastName'] || ''}`.trim();
    }
  }

  async loadDepartments() {
    try {
      this.isLoading = true;
      this.errorMessage = '';
      this.allDepartments = await this.authService.getDepartments();
    } catch (error) {
      console.error('Error loading departments:', error);
      this.errorMessage = 'Failed to load departments. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }

  async loadUserDepartments() {
    try {
      const user = this.authService.getCurrentUser();
      this.userDepartments = [];
      if (user) {
        const userProfile = await this.authService.getUserProfile(user.uid);
        const primaryDepartment = userProfile?.['department'] || '';
        const followedDepartments: string[] = userProfile?.['followedDepartments'] || [];

        if (primaryDepartment) {
          this.userDepartments.push({
            departmentId: primaryDepartment,
            status: 'primary',
            joinedDate: userProfile['joinDate'] || new Date().toISOString()
          });
        }

        followedDepartments
          .filter(departmentId => departmentId && departmentId !== primaryDepartment)
          .forEach(departmentId => {
            this.userDepartments.push({
              departmentId,
              status: 'following',
              joinedDate: new Date().toISOString()
            });
          });
      }
    } catch (error) {
      console.error('Error loading user departments:', error);
    }
  }

  // ==================== EVENTS ====================

  async loadDepartmentEvents() {
    if (!this.selectedDepartment) return;
    this.isLoadingEvents = true;
    try {
      this.departmentEvents = await this.authService.getDepartmentEvents(this.selectedDepartment.id);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      this.isLoadingEvents = false;
    }
  }

  openEventForm(event?: DeptEvent) {
    if (event && event.id) {
      this.isEditingEvent = true;
      this.editingEventId = event.id;
      this.eventForm = { ...event };
    } else {
      this.isEditingEvent = false;
      this.editingEventId = '';
      this.eventForm = this.emptyEventForm();
    }
    this.showEventForm = true;
  }

  cancelEventForm() {
    this.showEventForm = false;
    this.eventForm = this.emptyEventForm();
    this.isEditingEvent = false;
    this.editingEventId = '';
  }

  async submitEvent() {
    if (!this.selectedDepartment || !this.eventForm.title.trim() || !this.eventForm.date) return;
    try {
      if (this.isEditingEvent && this.editingEventId) {
        await this.authService.updateDepartmentEvent(
          this.selectedDepartment.id,
          this.editingEventId,
          { ...this.eventForm }
        );
      } else {
        await this.authService.addDepartmentEvent(this.selectedDepartment.id, {
          ...this.eventForm,
          createdBy: this.currentUserId,
          createdByName: this.currentUserName,
          status: 'upcoming'
        });
      }
      this.cancelEventForm();
      await this.loadDepartmentEvents();
    } catch (error) {
      console.error('Error saving event:', error);
    }
  }

  async deleteEvent(event: DeptEvent) {
    if (!this.selectedDepartment || !event.id) return;
    const alert = await this.alertCtrl.create({
      header: 'Delete Event',
      message: `Delete "${event.title}"?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            await this.authService.deleteDepartmentEvent(this.selectedDepartment!.id, event.id!);
            await this.loadDepartmentEvents();
          }
        }
      ]
    });
    await alert.present();
  }

  async joinEvent(event: DeptEvent) {
    if (!this.selectedDepartment || !event.id || !this.currentUserId) return;
    await this.authService.joinDepartmentEvent(this.selectedDepartment.id, event.id, this.currentUserId);
    await this.loadDepartmentEvents();
  }

  async leaveEvent(event: DeptEvent) {
    if (!this.selectedDepartment || !event.id || !this.currentUserId) return;
    await this.authService.leaveDepartmentEvent(this.selectedDepartment.id, event.id, this.currentUserId);
    await this.loadDepartmentEvents();
  }

  isJoinedEvent(event: DeptEvent): boolean {
    return (event.attendees || []).includes(this.currentUserId);
  }

  // ==================== DEPARTMENT UI ====================

  isUserInDepartment(deptId: string): boolean {
    const user = this.authService.getCurrentUser();
    if (!user) return false;
    const department = this.allDepartments.find(d => d.id === deptId);
    if (department && department.members) {
      return department.members.some((m: any) => m.userId === user.uid);
    }
    return this.userDepartments.some(ud => ud.departmentId === deptId);
  }

  isPrimaryDepartment(deptId: string): boolean {
    const user = this.authService.getCurrentUser();
    if (!user) return false;
    return this.userDepartments.some(ud => ud.departmentId === deptId && ud.status === 'primary');
  }

  goBack() {
    this.router.navigate(['/home']);
  }

  openDepartmentDetail(department: Department) {
    this.selectedDepartment = department;
    this.showDetailModal = true;
    this.activeTab = 'overview';
    this.departmentEvents = [];
    this.showEventForm = false;
  }

  closeDetailModal() {
    this.showDetailModal = false;
    this.selectedDepartment = null;
    this.departmentEvents = [];
    this.showEventForm = false;
  }

  switchTab(tab: string) {
    this.activeTab = tab;
    if (tab === 'events') {
      this.loadDepartmentEvents();
    }
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

  async registerDepartment() {
    if (!this.selectedDepartment) return;
    const user = this.authService.getCurrentUser();
    if (!user) return;
    try {
      const profile = await this.authService.getUserProfile(user.uid);
      const firstName = profile?.['firstName'] || '';
      const lastName = profile?.['lastName'] || '';
      const joinedDate = new Date().toISOString().split('T')[0];

      await this.authService.updateUserProfile(user.uid, {
        department: this.selectedDepartment.id,
        joinDate: joinedDate
      });

      await this.authService.addMemberToDepartment(
        this.selectedDepartment.id,
        user.uid,
        {
          name: `${firstName} ${lastName}`.trim() || user.email || '',
          email: user.email || '',
          userType: profile?.['userType'] || 'student',
          role: profile?.['userType'] || 'student',
          studentNumber: profile?.['studentNumber'] || '',
          course: profile?.['course'] || '',
          joinedDate
        }
      );

      this.userDepartments = this.userDepartments.filter(ud => ud.status !== 'primary');
      this.userDepartments.push({
        departmentId: this.selectedDepartment.id,
        status: 'primary',
        joinedDate
      });

      this.closeDetailModal();
      await this.loadDepartments();
    } catch (error) {
      console.error('Error registering for department:', error);
    }
  }

  async followDepartment() {
    if (!this.selectedDepartment) return;
    const user = this.authService.getCurrentUser();
    if (!user) return;
    try {
      const profile = await this.authService.getUserProfile(user.uid);
      const followedDepartments: string[] = profile?.['followedDepartments'] || [];

      if (!followedDepartments.includes(this.selectedDepartment.id)) {
        followedDepartments.push(this.selectedDepartment.id);
        await this.authService.updateUserProfile(user.uid, { followedDepartments });
      }

      const alreadyTracked = this.userDepartments.some(ud => ud.departmentId === this.selectedDepartment!.id);
      if (!alreadyTracked) {
        this.userDepartments.push({
          departmentId: this.selectedDepartment.id,
          status: 'following',
          joinedDate: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error following department:', error);
    }
  }

  refreshDepartments() {
    this.loadDepartments();
    this.loadUserDepartments();
  }
}
