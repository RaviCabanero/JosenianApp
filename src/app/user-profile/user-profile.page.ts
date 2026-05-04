import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { AuthService } from '../services/auth.service';

interface WorkExperience {
  id: string;
  company: string;
  position: string;
  startYear: string;
  endYear: string;
  isCurrent: boolean;
  description: string;
}

@Component({
  selector: 'app-user-profile',
  templateUrl: './user-profile.page.html',
  styleUrls: ['./user-profile.page.scss'],
  standalone: false
})
export class UserProfilePage implements OnInit {
  targetUid = '';
  currentUid = '';

  profile = {
    firstName: '',
    lastName: '',
    email: '',
    userType: '',
    role: '',
    department: '',
    course: '',
    studentNumber: '',
    graduationYear: '',
    bio: '',
    gender: '',
    contactNumber: '',
    photoUrl: '',
    initials: '',
  };

  workExperiences: WorkExperience[] = [];
  friendStatus: 'friend' | 'pending' | 'none' = 'none';
  isPrivate = false;
  isLoading = true;
  isProcessing = false;
  isOwnProfile = false;

  get displayName(): string {
    return `${this.profile.firstName} ${this.profile.lastName}`.trim() || this.profile.email || 'Unknown';
  }

  get displayUserType(): string {
    const role = (this.profile.role || '').toLowerCase();
    if (role === 'hod') return 'HOD';
    if (role === 'admin') return 'Admin';
    return this.profile.userType === 'alumni' ? 'Alumni' : 'Student';
  }

  get userTypeIcon(): string {
    const role = (this.profile.role || '').toLowerCase();
    if (role === 'hod' || role === 'admin') return 'shield-checkmark';
    return this.profile.userType === 'alumni' ? 'briefcase' : 'school';
  }

  get canSeeFullProfile(): boolean {
    return !this.isPrivate || this.friendStatus === 'friend' || this.isOwnProfile;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: Auth,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.targetUid = this.route.snapshot.paramMap.get('uid') || '';
    authState(this.auth).subscribe(async user => {
      if (!user) { this.router.navigate(['/login']); return; }
      this.currentUid = user.uid;
      this.isOwnProfile = this.currentUid === this.targetUid;
      if (this.isOwnProfile) {
        this.router.navigate(['/profile']);
        return;
      }
      await this.loadProfile();
    });
  }

  async loadProfile() {
    this.isLoading = true;
    try {
      const [targetData, myProfile, departments] = await Promise.all([
        this.authService.getUserProfile(this.targetUid),
        this.authService.getUserProfile(this.currentUid),
        this.authService.getDepartments()
      ]);

      if (!targetData) { this.router.navigate(['/home']); return; }

      const firstName = targetData['firstName'] || '';
      const lastName = targetData['lastName'] || '';
      let dept = targetData['department'] || '';
      const deptMatch = departments.find((d: any) => d.id === dept || d.name === dept);
      if (deptMatch) dept = deptMatch.name;

      this.profile = {
        firstName,
        lastName,
        email: targetData['email'] || '',
        userType: targetData['userType'] || 'student',
        role: targetData['role'] || '',
        department: dept,
        course: targetData['course'] || '',
        studentNumber: targetData['studentNumber'] || '',
        graduationYear: targetData['graduationYear'] || '',
        bio: targetData['bio'] || '',
        gender: targetData['gender'] || '',
        contactNumber: targetData['contactNumber'] || '',
        photoUrl: targetData['photoUrl'] || '',
        initials: ((firstName.charAt(0) || '') + (lastName.charAt(0) || '')).toUpperCase() || '?',
      };

      this.isPrivate = targetData['isPrivate'] === true;

      if (targetData['userType'] === 'alumni') {
        const sortWork = (a: WorkExperience, b: WorkExperience) => {
          if (a.isCurrent && !b.isCurrent) return -1;
          if (!a.isCurrent && b.isCurrent) return 1;
          const aY = a.isCurrent ? 9999 : (parseInt(a.endYear) || 0);
          const bY = b.isCurrent ? 9999 : (parseInt(b.endYear) || 0);
          return bY - aY;
        };
        this.workExperiences = ((targetData['workExperiences'] as WorkExperience[]) || []).slice().sort(sortWork);
      }

      const friends: string[] = myProfile?.['friends'] || [];
      const sentRequests: string[] = myProfile?.['sentRequests'] || [];
      if (friends.includes(this.targetUid)) {
        this.friendStatus = 'friend';
      } else if (sentRequests.includes(this.targetUid)) {
        this.friendStatus = 'pending';
      } else {
        this.friendStatus = 'none';
      }
    } catch (e) {
      console.error('Error loading user profile:', e);
    } finally {
      this.isLoading = false;
    }
  }

  async sendRequest() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    try {
      await this.authService.sendFriendRequest(this.targetUid);
      this.friendStatus = 'pending';
    } catch (e) {
      console.error(e);
    } finally {
      this.isProcessing = false;
    }
  }

  async cancelRequest() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    try {
      await this.authService.cancelFriendRequest(this.targetUid);
      this.friendStatus = 'none';
    } catch (e) {
      console.error(e);
    } finally {
      this.isProcessing = false;
    }
  }

  async removeFriend() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    try {
      await this.authService.removeFriend(this.targetUid);
      this.friendStatus = 'none';
    } catch (e) {
      console.error(e);
    } finally {
      this.isProcessing = false;
    }
  }

  goBack() {
    this.router.navigate(['/network']);
  }
}
