import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, IonModal } from '@ionic/angular';
import { AuthService } from '../services/auth.service';
import * as QRCode from 'qrcode';

interface Department {
  id: string;
  name: string;
  courses?: string[];
  createdAt?: any;
  members?: any[];
  description?: string;
  hodName?: string | null;
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
  maxParticipants?: number;
  isPinned?: boolean;
  qrToken?: string;
  attendanceCount?: number;
}

interface DeptWallPost {
  id?: string;
  content: string;
  authorId: string;
  authorName: string;
  authorInitials: string;
  likes: string[];
  createdAt?: any;
}

@Component({
  selector: 'app-department',
  templateUrl: './department.page.html',
  styleUrls: ['./department.page.scss'],
  standalone: false
})
export class DepartmentPage implements OnInit {
  @ViewChild('detailModal') detailModal!: IonModal;

  allDepartments: Department[] = [];
  userDepartments: UserDepartment[] = [];

  currentUserId = '';
  currentUserType = '';
  currentUserRole = '';
  currentUserName = '';
  currentUserDepartmentId = '';

  selectedDepartment: Department | null = null;
  isLoading = false;
  errorMessage = '';
  activeTab = 'overview';

  departmentEvents: DeptEvent[] = [];
  isLoadingEvents = false;
  showEventForm = false;
  isEditingEvent = false;
  editingEventId = '';
  eventForm: DeptEvent = this.emptyEventForm();

  eventFilter: 'upcoming' | 'past' = 'upcoming';
  eventTypeFilter = 'all';
  expandedEventId: string | null = null;
  attendeeNames: Record<string, string[]> = {};

  readonly eventTypes = ['all', 'academic', 'seminar', 'workshop', 'social', 'sports', 'other'];

  wallPosts: DeptWallPost[] = [];
  isLoadingWall = false;
  wallInput = '';
  isPostingWall = false;

  showQRModal = false;
  qrModalEvent: DeptEvent | null = null;
  qrCodeDataUrl = '';
  deptAttendanceList: any[] = [];
  isLoadingDeptAttendance = false;
  isGeneratingDeptQR = false;
  showAttendanceInModal = false;

  // Event participation stats
  userDeptStats: { totalEvents: number; eventsJoined: number; eventsAttended: number; attendanceRate: number } | null = null;
  hodDeptStats: { totalEvents: number; totalAttendances: number; totalRegistrations: number; avgAttendanceRate: number; eventsByType: { type: string; count: number }[] } | null = null;
  isLoadingStats = false;

  readonly tabs = ['overview', 'members', 'events', 'wall'];

  private readonly colorClasses = [
    'c-blue', 'c-green', 'c-purple', 'c-orange',
    'c-red', 'c-cyan', 'c-amber', 'c-pink'
  ];

  get isHOD(): boolean {
    if (this.currentUserRole !== 'hod') return false;
    return !!this.selectedDepartment && this.selectedDepartment.id === this.currentUserDepartmentId;
  }

  get filteredEvents(): DeptEvent[] {
    const today = new Date().toISOString().split('T')[0];
    let events = this.eventFilter === 'upcoming'
      ? this.departmentEvents.filter(e => !e.date || e.date >= today)
      : this.departmentEvents.filter(e => !!e.date && e.date < today);
    if (this.eventTypeFilter !== 'all')
      events = events.filter(e => e.type === this.eventTypeFilter);
    return events.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
  }

  get totalMembers(): number {
    return this.allDepartments.reduce((sum, d) => sum + (d.members?.length || 0), 0);
  }

  constructor(
    private router: Router,
    private authService: AuthService,
    private alertCtrl: AlertController
  ) {}

  async ngOnInit() {
    await this.loadCurrentUserProfile();
    await Promise.all([this.loadDepartments(), this.loadUserDepartments()]);
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
      this.currentUserRole = (profile['role'] || 'user').toLowerCase();
      this.currentUserName = `${profile['firstName'] || ''} ${profile['lastName'] || ''}`.trim();
      this.currentUserDepartmentId = profile['department'] || '';
    }
  }

  async loadDepartments() {
    try {
      this.isLoading = true;
      this.errorMessage = '';
      const [depts, allUsers] = await Promise.all([
        this.authService.getDepartments(),
        this.authService.getAllUsers()
      ]);
      // Map HOD per department: find users with role 'hod'/'HOD' whose department matches
      const hodMap: Record<string, string> = {};
      allUsers
        .filter((u: any) => (u.role || '').toLowerCase() === 'hod')
        .forEach((u: any) => {
          const deptId = u.department || '';
          if (deptId) {
            hodMap[deptId] = `${u.firstName || ''} ${u.lastName || ''}`.trim();
          }
        });
      this.allDepartments = depts.map((d: Department) => ({
        ...d,
        hodName: hodMap[d.id] || null
      }));
    } catch {
      this.errorMessage = 'Failed to load departments. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }

  async loadUserDepartments() {
    try {
      const user = this.authService.getCurrentUser();
      this.userDepartments = [];
      if (!user) return;
      const profile = await this.authService.getUserProfile(user.uid);
      const primary: string = profile?.['department'] || '';
      const followed: string[] = profile?.['followedDepartments'] || [];
      if (primary) {
        this.userDepartments.push({ departmentId: primary, status: 'primary', joinedDate: profile['joinDate'] || '' });
      }
      followed.filter(id => id && id !== primary).forEach(id => {
        this.userDepartments.push({ departmentId: id, status: 'following', joinedDate: '' });
      });
    } catch {
      // ignore
    }
  }

  // ── Helpers ────────────────────────────────────────

  getDeptAbbr(name: string): string {
    const skip = new Set(['of', 'the', 'and', 'for', 'a', 'an', 'in']);
    return name
      .split(/\s+/)
      .filter(w => !skip.has(w.toLowerCase()))
      .map(w => w.charAt(0).toUpperCase())
      .slice(0, 3)
      .join('');
  }

  getDeptColorClass(index: number): string {
    return this.colorClasses[index % this.colorClasses.length];
  }

  getTabIcon(tab: string): string {
    const map: Record<string, string> = {
      overview: 'information-circle-outline',
      members: 'people-outline',
      events: 'calendar-outline',
      wall: 'chatbubbles-outline',
    };
    return map[tab] || 'ellipse-outline';
  }

  isUserInDepartment(deptId: string): boolean {
    const user = this.authService.getCurrentUser();
    if (!user) return false;
    const dept = this.allDepartments.find(d => d.id === deptId);
    if (dept?.members?.some((m: any) => m.userId === user.uid)) return true;
    return this.userDepartments.some(ud => ud.departmentId === deptId);
  }

  isPrimaryDepartment(deptId: string): boolean {
    return this.userDepartments.some(ud => ud.departmentId === deptId && ud.status === 'primary');
  }

  // ── Modal ──────────────────────────────────────────

  async openDepartmentDetail(department: Department) {
    this.selectedDepartment = department;
    this.activeTab = 'overview';
    this.departmentEvents = [];
    this.showEventForm = false;
    this.eventFilter = 'upcoming';
    this.expandedEventId = null;
    this.attendeeNames = {};
    this.wallPosts = [];
    this.wallInput = '';
    this.userDeptStats = null;
    this.hodDeptStats = null;
    await this.detailModal.present();
  }

  async closeDetailModal() {
    await this.detailModal.dismiss();
    this.selectedDepartment = null;
    this.departmentEvents = [];
    this.showEventForm = false;
    this.userDeptStats = null;
    this.hodDeptStats = null;
  }

  switchTab(tab: string) {
    this.activeTab = tab;
    if (tab === 'events') {
      this.eventFilter = 'upcoming';
      this.eventTypeFilter = 'all';
      this.expandedEventId = null;
      this.attendeeNames = {};
      this.loadDepartmentEvents();
      this.loadEventStats();
    }
    if (tab === 'wall') {
      this.wallInput = '';
      this.loadWallPosts();
    }
  }

  toggleAttendees(event: DeptEvent) {
    if (!event.id) return;
    if (this.expandedEventId === event.id) {
      this.expandedEventId = null;
      return;
    }
    this.expandedEventId = event.id;
    if (!this.attendeeNames[event.id] && (event.attendees || []).length > 0) {
      const memberMap: Record<string, string> = {};
      (this.selectedDepartment?.members || []).forEach((m: any) => {
        if (m.userId) memberMap[m.userId] = m.name;
      });
      this.attendeeNames[event.id] = (event.attendees || []).map(uid => memberMap[uid] || 'Member');
    }
  }

  // ── Events ─────────────────────────────────────────

  async loadDepartmentEvents() {
    if (!this.selectedDepartment) return;
    this.isLoadingEvents = true;
    try {
      this.departmentEvents = await this.authService.getDepartmentEvents(this.selectedDepartment.id);
    } catch {
      // ignore
    } finally {
      this.isLoadingEvents = false;
    }
  }

  openEventForm(event?: DeptEvent) {
    if (event?.id) {
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
        await this.authService.updateDepartmentEvent(this.selectedDepartment.id, this.editingEventId, { ...this.eventForm });
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

  formatEventDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  isEventFull(event: DeptEvent): boolean {
    if (!event.maxParticipants) return false;
    return (event.attendees?.length || 0) >= event.maxParticipants;
  }

  getCapacityClass(event: DeptEvent): string {
    if (!event.maxParticipants) return '';
    const ratio = (event.attendees?.length || 0) / event.maxParticipants;
    if (ratio >= 1) return 'capacity-full';
    if (ratio >= 0.75) return 'capacity-near';
    return '';
  }

  async togglePinEvent(event: DeptEvent) {
    if (!this.selectedDepartment || !event.id) return;
    const newPinned = !event.isPinned;
    await this.authService.updateDepartmentEvent(this.selectedDepartment.id, event.id, { isPinned: newPinned });
    event.isPinned = newPinned;
  }

  async deleteEvent(event: DeptEvent) {
    if (!this.selectedDepartment || !event.id) return;
    const alert = await this.alertCtrl.create({
      header: 'Delete Event',
      message: `Delete "${event.title}"?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete', role: 'destructive',
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

  // ── Department Actions ─────────────────────────────

  async registerDepartment() {
    if (!this.selectedDepartment) return;
    const user = this.authService.getCurrentUser();
    if (!user) return;
    try {
      const profile = await this.authService.getUserProfile(user.uid);
      const joinedDate = new Date().toISOString().split('T')[0];
      await this.authService.updateUserProfile(user.uid, { department: this.selectedDepartment.id, joinDate: joinedDate });
      await this.authService.addMemberToDepartment(this.selectedDepartment.id, user.uid, {
        name: `${profile?.['firstName'] || ''} ${profile?.['lastName'] || ''}`.trim() || user.email || '',
        email: user.email || '',
        userType: profile?.['userType'] || 'student',
        role: profile?.['userType'] || 'student',
        studentNumber: profile?.['studentNumber'] || '',
        course: profile?.['course'] || '',
        joinedDate
      });
      this.userDepartments = this.userDepartments.filter(ud => ud.status !== 'primary');
      this.userDepartments.push({ departmentId: this.selectedDepartment.id, status: 'primary', joinedDate });
      await this.closeDetailModal();
      await this.loadDepartments();
    } catch (error) {
      console.error('Error registering department:', error);
    }
  }

  async followDepartment() {
    if (!this.selectedDepartment) return;
    const user = this.authService.getCurrentUser();
    if (!user) return;
    try {
      const profile = await this.authService.getUserProfile(user.uid);
      const followed: string[] = profile?.['followedDepartments'] || [];
      if (!followed.includes(this.selectedDepartment.id)) {
        followed.push(this.selectedDepartment.id);
        await this.authService.updateUserProfile(user.uid, { followedDepartments: followed });
      }
      if (!this.userDepartments.some(ud => ud.departmentId === this.selectedDepartment!.id)) {
        this.userDepartments.push({ departmentId: this.selectedDepartment.id, status: 'following', joinedDate: new Date().toISOString() });
      }
    } catch (error) {
      console.error('Error following department:', error);
    }
  }

  // ── Wall ───────────────────────────────────────────

  async loadWallPosts() {
    if (!this.selectedDepartment) return;
    this.isLoadingWall = true;
    try {
      this.wallPosts = await this.authService.getDepartmentWallPosts(this.selectedDepartment.id);
    } catch {
      // ignore
    } finally {
      this.isLoadingWall = false;
    }
  }

  async submitWallPost() {
    if (!this.selectedDepartment || !this.wallInput.trim() || this.isPostingWall) return;
    this.isPostingWall = true;
    try {
      const initials = this.currentUserName
        .split(' ').filter(Boolean).map(w => w[0].toUpperCase()).slice(0, 2).join('');
      const post = await this.authService.addDepartmentWallPost(this.selectedDepartment.id, {
        content: this.wallInput.trim(),
        authorId: this.currentUserId,
        authorName: this.currentUserName || 'Member',
        authorInitials: initials || 'M',
      });
      this.wallPosts = [post, ...this.wallPosts];
      this.wallInput = '';
    } catch (error) {
      console.error('Error posting to wall:', error);
    } finally {
      this.isPostingWall = false;
    }
  }

  async deleteWallPost(post: DeptWallPost) {
    if (!this.selectedDepartment || !post.id) return;
    const alert = await this.alertCtrl.create({
      header: 'Delete Post',
      message: 'Remove this post from the wall?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete', role: 'destructive',
          handler: async () => {
            await this.authService.deleteDepartmentWallPost(this.selectedDepartment!.id, post.id!);
            this.wallPosts = this.wallPosts.filter(p => p.id !== post.id);
          }
        }
      ]
    });
    await alert.present();
  }

  async toggleWallLike(post: DeptWallPost) {
    if (!this.selectedDepartment || !post.id || !this.currentUserId) return;
    const liked = (post.likes || []).includes(this.currentUserId);
    post.likes = liked
      ? (post.likes || []).filter(id => id !== this.currentUserId)
      : [...(post.likes || []), this.currentUserId];
    await this.authService.toggleDepartmentWallLike(this.selectedDepartment.id, post.id, this.currentUserId);
  }

  isWallPostOwner(post: DeptWallPost): boolean {
    return post.authorId === this.currentUserId;
  }

  formatWallTime(createdAt: any): string {
    if (!createdAt) return '';
    const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // ── Event Stats ────────────────────────────────────────────

  async loadEventStats() {
    if (!this.selectedDepartment) return;
    this.isLoadingStats = true;
    try {
      if (this.isHOD) {
        this.hodDeptStats = await this.authService.getDeptOverallStats(this.selectedDepartment.id);
      }
      if (this.currentUserId) {
        this.userDeptStats = await this.authService.getUserDeptEventStats(this.currentUserId, this.selectedDepartment.id);
      }
    } catch {
      // ignore
    } finally {
      this.isLoadingStats = false;
    }
  }

  // ── QR Attendance ──────────────────────────────────────────

  async showEventQR(event: DeptEvent) {
    if (!this.selectedDepartment || !event.id) return;
    this.isGeneratingDeptQR = true;
    this.qrModalEvent = event;
    this.showQRModal = true;
    this.deptAttendanceList = [];
    this.showAttendanceInModal = false;
    this.qrCodeDataUrl = '';
    try {
      let token = event.qrToken;
      if (!token) {
        token = await this.authService.generateDepartmentEventQRToken(this.selectedDepartment.id, event.id);
        event.qrToken = token;
        this.qrModalEvent = { ...event };
      }
      await this.renderDeptQRCode(this.selectedDepartment.id, event.id, token);
      await this.loadDeptEventAttendance(this.selectedDepartment.id, event.id);
    } catch {
      this.closeQRModal();
    } finally {
      this.isGeneratingDeptQR = false;
    }
  }

  async refreshQRCode() {
    if (!this.selectedDepartment || !this.qrModalEvent?.id) return;
    this.isGeneratingDeptQR = true;
    this.qrCodeDataUrl = '';
    try {
      const token = await this.authService.generateDepartmentEventQRToken(this.selectedDepartment.id, this.qrModalEvent.id);
      this.qrModalEvent.qrToken = token;
      await this.renderDeptQRCode(this.selectedDepartment.id, this.qrModalEvent.id, token);
    } catch {
      // ignore
    } finally {
      this.isGeneratingDeptQR = false;
    }
  }

  private async renderDeptQRCode(deptId: string, eventId: string, token: string) {
    const payload = `josenianlink-dept::${deptId}::${eventId}::${token}`;
    this.qrCodeDataUrl = await QRCode.toDataURL(payload, {
      width: 260,
      margin: 2,
      color: { dark: '#111827', light: '#ffffff' },
      errorCorrectionLevel: 'M'
    });
  }

  async loadDeptEventAttendance(deptId: string, eventId: string) {
    this.isLoadingDeptAttendance = true;
    try {
      this.deptAttendanceList = await this.authService.getDeptEventAttendance(deptId, eventId);
    } catch {
      this.deptAttendanceList = [];
    } finally {
      this.isLoadingDeptAttendance = false;
    }
  }

  toggleAttendanceList() {
    this.showAttendanceInModal = !this.showAttendanceInModal;
    if (this.showAttendanceInModal && this.selectedDepartment && this.qrModalEvent?.id) {
      this.loadDeptEventAttendance(this.selectedDepartment.id, this.qrModalEvent.id);
    }
  }

  closeQRModal() {
    this.showQRModal = false;
    this.qrModalEvent = null;
    this.qrCodeDataUrl = '';
    this.deptAttendanceList = [];
    this.showAttendanceInModal = false;
  }

  scanEventQR(event: DeptEvent) {
    if (!this.selectedDepartment || !event.id) return;
    this.router.navigate(['/qr-scanner'], {
      queryParams: {
        eventId: event.id,
        eventTitle: event.title,
        departmentId: this.selectedDepartment.id
      }
    });
  }

  formatAttendanceTime(scannedAt: any): string {
    if (!scannedAt) return '';
    const d = scannedAt.toDate ? scannedAt.toDate() : new Date(scannedAt);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  isEventToday(event: DeptEvent): boolean {
    if (!event.date) return false;
    const today = new Date().toISOString().split('T')[0];
    return event.date === today;
  }

  goBack() { this.router.navigate(['/home']); }

  refreshDepartments() {
    this.loadDepartments();
    this.loadUserDepartments();
  }
}
