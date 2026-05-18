import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { AuthService } from '../services/auth.service';

interface NetworkUser {
  uid: string;
  name: string;
  initials: string;
  photoUrl: string;
  department: string;
  userType: string;
  course: string;
  graduationYear: string;
  isPrivate: boolean;
  friendStatus: 'friend' | 'pending' | 'none';
}

interface FriendRequest {
  id: string;
  fromId: string;
  fromName: string;
  fromInitials: string;
  fromPhotoUrl: string;
  sentAt: string;
}

@Component({
  selector: 'app-network',
  templateUrl: './network.page.html',
  styleUrls: ['./network.page.scss'],
  standalone: false
})
export class NetworkPage implements OnInit {
  activeTab: 'friends' | 'people' | 'requests' = 'friends';

  currentUserId = '';
  private friendIds = new Set<string>();
  private sentRequestIds = new Set<string>();

  friends: NetworkUser[] = [];
  filteredFriends: NetworkUser[] = [];
  allPeople: NetworkUser[] = [];
  filteredPeople: NetworkUser[] = [];
  incomingRequests: FriendRequest[] = [];
  filteredRequests: FriendRequest[] = [];

  searchQuery = '';
  filterBatch = '';
  availableBatches: string[] = [];
  isLoading = false;
  processingIds = new Set<string>();

  get friendsCount(): number { return this.friends.length; }
  get requestsCount(): number { return this.incomingRequests.length; }

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

  private deptMap: Record<string, string> = {};

  async loadAll() {
    this.isLoading = true;
    try {
      const [myProfile, allUsers, requests, departments] = await Promise.all([
        this.authService.getUserProfile(this.currentUserId),
        this.authService.getAllUsers(),
        this.authService.getFriendRequests(this.currentUserId),
        this.authService.getDepartments()
      ]);

      this.deptMap = {};
      departments.forEach((d: any) => { this.deptMap[d.id] = d.name; });

      this.friendIds = new Set<string>(myProfile?.['friends'] || []);
      this.sentRequestIds = new Set<string>(myProfile?.['sentRequests'] || []);
      this.incomingRequests = requests.map((r: any) => ({
        ...r,
        fromPhotoUrl: allUsers.find((u: any) => u.id === r.fromId)?.photoUrl || ''
      }));

      const others = allUsers.filter((u: any) =>
        u.id !== this.currentUserId &&
        u.status === 'approved' &&
        (u.role || '').toLowerCase() !== 'admin'
      );

      this.friends = others
        .filter((u: any) => this.friendIds.has(u.id))
        .map((u: any) => this.toNetworkUser(u, 'friend'));

      this.allPeople = others
        .filter((u: any) => !this.friendIds.has(u.id))
        .map((u: any) => this.toNetworkUser(u, this.sentRequestIds.has(u.id) ? 'pending' : 'none'));

      this.availableBatches = [...new Set(
        this.allPeople.map(u => u.graduationYear).filter(y => !!y)
      )].sort((a, b) => Number(b) - Number(a));

      this.filteredFriends = [...this.friends];
      this.filteredPeople = [...this.allPeople];
      this.filteredRequests = [...this.incomingRequests];
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
    const deptId = u.department || '';
    const department = this.deptMap[deptId] || deptId || '';
    return { uid: u.id, name, initials, photoUrl: u.photoUrl || '', department, userType: u.userType || 'student', course: u.course || '', graduationYear: u.graduationYear || '', isPrivate: u.isPrivate === true, friendStatus };
  }

  switchTab(tab: 'friends' | 'people' | 'requests') {
    this.activeTab = tab;
    this.searchQuery = '';
    this.filterBatch = '';
    this.applySearch('');
  }

  applyBatchFilter() {
    this.applySearch(this.searchQuery);
  }

  onNetworkSearch(event: any) {
    const q = (event.detail?.value || '').toLowerCase();
    this.searchQuery = q;
    this.applySearch(q);
  }

  private applySearch(q: string) {
    this.filteredFriends = this.friends.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.department.toLowerCase().includes(q) ||
      u.userType.toLowerCase().includes(q)
    );
    this.filteredPeople = this.allPeople.filter(u =>
      (u.name.toLowerCase().includes(q) ||
       u.department.toLowerCase().includes(q) ||
       u.userType.toLowerCase().includes(q)) &&
      (!this.filterBatch || u.graduationYear === this.filterBatch)
    );
    this.filteredRequests = this.incomingRequests.filter(r =>
      r.fromName.toLowerCase().includes(q)
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
      this.applySearch(this.searchQuery);
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
        photoUrl: req.fromPhotoUrl || '',
        department: '', userType: 'student', course: '', graduationYear: '', isPrivate: false, friendStatus: 'friend'
      };
      this.friends.unshift(newFriend);
      this.incomingRequests = this.incomingRequests.filter(r => r.fromId !== req.fromId);
      this.allPeople = this.allPeople.filter(u => u.uid !== req.fromId);
      this.applySearch(this.searchQuery);
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
      this.applySearch(this.searchQuery);
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
