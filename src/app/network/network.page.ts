import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { AuthService } from '../services/auth.service';

interface NetworkUser {
  uid: string;
  name: string;
  initials: string;
  department: string;
  userType: string;
  course: string;
  isPrivate: boolean;
  friendStatus: 'friend' | 'pending' | 'none';
}

interface FriendRequest {
  id: string;
  fromId: string;
  fromName: string;
  fromInitials: string;
  sentAt: string;
}

@Component({
  selector: 'app-network',
  templateUrl: './network.page.html',
  styleUrls: ['./network.page.scss'],
  standalone: false
})
export class NetworkPage implements OnInit {
  activeTab: 'friends' | 'department' | 'people' | 'requests' = 'friends';

  currentUserId = '';
  private friendIds = new Set<string>();
  private sentRequestIds = new Set<string>();

  friends: NetworkUser[] = [];
  departmentUsers: NetworkUser[] = [];
  departmentName = '';
  allPeople: NetworkUser[] = [];
  filteredPeople: NetworkUser[] = [];
  incomingRequests: FriendRequest[] = [];

  isLoading = false;
  processingIds = new Set<string>();

  get friendsCount(): number { return this.friends.length; }
  get requestsCount(): number { return this.incomingRequests.length; }
  get deptCount(): number { return this.departmentUsers.length; }

  constructor(
    private router: Router,
    private auth: Auth,
    private authService: AuthService
  ) {}

  ngOnInit() {
    authState(this.auth).subscribe(async user => {
      if (!user) { this.router.navigate(['/login']); return; }
      this.currentUserId = user.uid;
      await this.loadAll();
    });
  }

  async loadAll() {
    this.isLoading = true;
    try {
      const [myProfile, allUsers, requests, departments] = await Promise.all([
        this.authService.getUserProfile(this.currentUserId),
        this.authService.getAllUsers(),
        this.authService.getFriendRequests(this.currentUserId),
        this.authService.getDepartments()
      ]);

      this.friendIds = new Set<string>(myProfile?.['friends'] || []);
      this.sentRequestIds = new Set<string>(myProfile?.['sentRequests'] || []);
      this.incomingRequests = requests;

      const myDeptId: string = myProfile?.['department'] || '';
      const deptObj = departments.find((d: any) => d.id === myDeptId);
      this.departmentName = deptObj?.name || '';

      const others = allUsers.filter((u: any) =>
        u.id !== this.currentUserId &&
        u.status === 'approved' &&
        (u.role || '').toLowerCase() !== 'admin'
      );

      this.friends = others
        .filter((u: any) => this.friendIds.has(u.id))
        .map((u: any) => this.toNetworkUser(u, 'friend'));

      this.departmentUsers = myDeptId
        ? others
            .filter((u: any) => u.department === myDeptId)
            .map((u: any) => this.toNetworkUser(u, this.friendIds.has(u.id) ? 'friend' : this.sentRequestIds.has(u.id) ? 'pending' : 'none'))
        : [];

      this.allPeople = others
        .filter((u: any) => !this.friendIds.has(u.id))
        .map((u: any) => this.toNetworkUser(u, this.sentRequestIds.has(u.id) ? 'pending' : 'none'));

      this.filteredPeople = [...this.allPeople];
    } catch (e) {
      console.error('Error loading network:', e);
    } finally {
      this.isLoading = false;
    }
  }

  private toNetworkUser(u: any, friendStatus: 'friend' | 'pending' | 'none'): NetworkUser {
    const firstName = u.firstName || '';
    const lastName = u.lastName || '';
    const name = `${firstName} ${lastName}`.trim() || u.email || 'Unknown';
    const initials = name.split(' ').filter(Boolean).map((w: string) => w[0].toUpperCase()).join('').slice(0, 2) || '?';
    return { uid: u.id, name, initials, department: u.department || 'No Department', userType: u.userType || 'student', course: u.course || '', isPrivate: u.isPrivate === true, friendStatus };
  }

  switchTab(tab: 'friends' | 'department' | 'people' | 'requests') {
    this.activeTab = tab;
  }

  onSearchChange(event: any) {
    const q = (event.detail?.value || '').toLowerCase();
    this.filteredPeople = this.allPeople.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.department.toLowerCase().includes(q) ||
      u.userType.toLowerCase().includes(q)
    );
  }

  async sendRequest(user: NetworkUser) {
    if (this.processingIds.has(user.uid)) return;
    this.processingIds.add(user.uid);
    try {
      await this.authService.sendFriendRequest(user.uid);
      user.friendStatus = 'pending';
      this.sentRequestIds.add(user.uid);
    } catch (e) {
      console.error(e);
    } finally {
      this.processingIds.delete(user.uid);
    }
  }

  async cancelRequest(user: NetworkUser) {
    if (this.processingIds.has(user.uid)) return;
    this.processingIds.add(user.uid);
    try {
      await this.authService.cancelFriendRequest(user.uid);
      user.friendStatus = 'none';
      this.sentRequestIds.delete(user.uid);
    } catch (e) {
      console.error(e);
    } finally {
      this.processingIds.delete(user.uid);
    }
  }

  async removeFriend(user: NetworkUser) {
    if (this.processingIds.has(user.uid)) return;
    this.processingIds.add(user.uid);
    try {
      await this.authService.removeFriend(user.uid);
      this.friends = this.friends.filter(f => f.uid !== user.uid);
      this.friendIds.delete(user.uid);
      user.friendStatus = 'none';
      this.allPeople.unshift(user);
      this.filteredPeople = [...this.allPeople];
      const deptUser = this.departmentUsers.find(u => u.uid === user.uid);
      if (deptUser) deptUser.friendStatus = 'none';
    } catch (e) {
      console.error(e);
    } finally {
      this.processingIds.delete(user.uid);
    }
  }

  async acceptRequest(req: FriendRequest) {
    if (this.processingIds.has(req.fromId)) return;
    this.processingIds.add(req.fromId);
    try {
      await this.authService.acceptFriendRequest(req.fromId);
      this.incomingRequests = this.incomingRequests.filter(r => r.fromId !== req.fromId);
      this.friendIds.add(req.fromId);
      const newFriend: NetworkUser = {
        uid: req.fromId, name: req.fromName, initials: req.fromInitials,
        department: '', userType: 'student', course: '', isPrivate: false, friendStatus: 'friend'
      };
      this.friends.unshift(newFriend);
      this.allPeople = this.allPeople.filter(u => u.uid !== req.fromId);
      this.filteredPeople = this.filteredPeople.filter(u => u.uid !== req.fromId);
      const deptUser = this.departmentUsers.find(u => u.uid === req.fromId);
      if (deptUser) deptUser.friendStatus = 'friend';
    } catch (e) {
      console.error(e);
    } finally {
      this.processingIds.delete(req.fromId);
    }
  }

  async declineRequest(req: FriendRequest) {
    if (this.processingIds.has(req.fromId)) return;
    this.processingIds.add(req.fromId);
    try {
      await this.authService.declineFriendRequest(req.fromId);
      this.incomingRequests = this.incomingRequests.filter(r => r.fromId !== req.fromId);
    } catch (e) {
      console.error(e);
    } finally {
      this.processingIds.delete(req.fromId);
    }
  }

  viewUser(uid: string) {
    this.router.navigate(['/user-profile', uid]);
  }

  goBack() {
    this.router.navigate(['/home']);
  }
}
