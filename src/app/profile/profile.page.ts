import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, IonModal, AlertController } from '@ionic/angular';
import { Router } from '@angular/router';
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
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class ProfilePage implements OnInit {
  @ViewChild('editModal') editModal!: IonModal;
  @ViewChild('workModal') workModal!: IonModal;
  @ViewChild('photoModal') photoModal!: IonModal;

  userProfile = {
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
    initials: '',
    gender: '',
    address: '',
    contactNumber: '',
    photoUrl: '',
  };

  workExperiences: WorkExperience[] = [];

  pointsData = { total: 0, level: { level: 'bronze', label: 'Bronze', next: 50, color: '#b45309', icon: 'ribbon' }, badges: [] as string[] };
  pointsHistory: any[] = [];
  isLoadingPoints = false;

  editFormData = {
    bio: '',
    gender: '',
    address: '',
    contactNumber: '',
  };

  phoneNumberLength: number = 0;
  maxPhoneLength: number = 20;

  workFormData: WorkExperience = {
    id: '',
    company: '',
    position: '',
    startYear: '',
    endYear: '',
    isCurrent: false,
    description: '',
  };

  isEditingWork = false;
  editingWorkId = '';
  isSaving = false;
  isPrivate = false;
  workValidationError: string = '';
  hasCurrentJob: boolean = false;

  genders = ['Male', 'Female', 'Other', 'Prefer not to say'];
  yearOptions: string[] = [];
  endYearOptions: string[] = [];
  isLoading = true;

  // Alumni ID Verification
  alumniIdVerificationStatus: 'unverified' | 'pending' | 'approved' | 'rejected' | '' = '';
  alumniIdRejectionReason = '';
  alumniGradPhotoBase64 = '';
  showVerificationUpload = false;
  verificationIdFile: File | null = null;
  verificationIdFileName = '';
  verificationIdFileSize = '';
  verificationGradFile: File | null = null;
  verificationGradFileName = '';
  verificationGradFileSize = '';
  isSubmittingVerification = false;

  // Digital Alumni ID
  showDigitalId = false;

  // INSPIRED Badge System
  inspiredPoints: Record<string, number> = {};
  inspiredMasterBadge = false;

  readonly INSPIRED_CATEGORIES: Array<{ key: string; label: string; letter: string; color: string; bg: string }> = [
    { key: 'interiority', label: 'Interiority', letter: 'I', color: '#8b5cf6', bg: '#f5f3ff' },
    { key: 'nationalism',  label: 'Nationalism',  letter: 'N', color: '#3b82f6', bg: '#eff6ff' },
    { key: 'service',      label: 'Service',      letter: 'S', color: '#10b981', bg: '#f0fdf4' },
    { key: 'pioneerism',   label: 'Pioneerism',   letter: 'P', color: '#f59e0b', bg: '#fffbeb' },
    { key: 'integrity',    label: 'Integrity',    letter: 'I', color: '#ef4444', bg: '#fef2f2' },
    { key: 'reliability',  label: 'Reliability',  letter: 'R', color: '#06b6d4', bg: '#ecfeff' },
    { key: 'excellence',   label: 'Excellence',   letter: 'E', color: '#fbbf24', bg: '#fffbeb' },
  ];

  private sortWork = (a: WorkExperience, b: WorkExperience): number => {
    if (a.isCurrent && !b.isCurrent) return -1;
    if (!a.isCurrent && b.isCurrent) return 1;
    const aYear = a.isCurrent ? 9999 : (parseInt(a.endYear) || 0);
    const bYear = b.isCurrent ? 9999 : (parseInt(b.endYear) || 0);
    return bYear - aYear;
  };

  // Get current job (should only be one)
  get currentJob(): WorkExperience | undefined {
    return this.workExperiences.find(w => w.isCurrent === true);
  }

  // Get past jobs sorted by end year (most recent first)
  get pastJobs(): WorkExperience[] {
    return this.workExperiences
      .filter(w => w.isCurrent !== true)
      .sort((a, b) => {
        const aYear = parseInt(a.endYear) || 0;
        const bYear = parseInt(b.endYear) || 0;
        return bYear - aYear;
      });
  }

  // Format phone number for display
  formatPhoneNumber(phoneNumber: string | null | undefined): string {
    if (!phoneNumber || !phoneNumber.trim()) {
      return 'No phone number added';
    }

    // Remove all non-digit characters except +
    let cleaned = phoneNumber.trim().replace(/[^\d+]/g, '');

    // Handle Philippine numbers
    if (cleaned.startsWith('+63')) {
      // Format: +63 917 123 4567
      if (cleaned.length === 13) {
        return cleaned.replace(/(\+63)(\d{3})(\d{3})(\d{4})/, '$1 $2 $3 $4');
      }
    } else if (cleaned.startsWith('+')) {
      // Generic international format for other countries
      if (cleaned.length > 10) {
        // Extract country code and rest
        const countryCode = cleaned.substring(0, 3); // +63, +1, etc.
        const rest = cleaned.substring(3);
        // Format rest in groups: 3-3-4
        if (rest.length === 10) {
          return `${countryCode} ${rest.substring(0, 3)} ${rest.substring(3, 6)} ${rest.substring(6)}`;
        }
      }
    } else if (cleaned.startsWith('0')) {
      // Local Philippine number format: 0917 123 4567
      if (cleaned.length === 11) {
        return cleaned.replace(/(\d{4})(\d{3})(\d{4})/, '$1 $2 $3');
      }
    } else if (cleaned.length === 10) {
      // Generic 10-digit format: XXX-XXX-XXXX
      return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    }

    // If no specific format matches, return as is
    return phoneNumber;
  }

  // Validate and format phone number for storage
  validateAndFormatPhoneNumber(phoneNumber: string | null | undefined): string {
    if (!phoneNumber || !phoneNumber.trim()) {
      return '';
    }

    let cleaned = phoneNumber.trim().replace(/[^\d+]/g, '');

    // Philippine number validation
    if (cleaned.startsWith('09')) {
      // Convert 09... to +639...
      cleaned = '+63' + cleaned.substring(1);
    } else if (!cleaned.startsWith('+')) {
      // Assume Philippine if no country code and doesn't start with 0
      cleaned = '+63' + cleaned;
    }

    // Basic validation: should be at least 10 digits for a phone number
    const digitCount = cleaned.replace(/\D/g, '').length;
    if (digitCount < 10) {
      return '';
    }

    return cleaned;
  }

  constructor(
    private authService: AuthService,
    private router: Router,
    private alertController: AlertController
  ) {
    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= 1970; y--) {
      this.yearOptions.push(y.toString());
    }
  }

  async ngOnInit() {
    await this.loadUserProfile();
    await this.loadPoints();
  }

  get displayUserType(): string {
    const role = (this.userProfile.role || '').toLowerCase();
    if (role === 'hod') return 'HOD';
    if (role === 'admin') return 'Admin';
    return this.userProfile.userType === 'alumni' ? 'Alumni' : 'Student';
  }

  get userTypeIcon(): string {
    const role = (this.userProfile.role || '').toLowerCase();
    if (role === 'hod' || role === 'admin') return 'shield-checkmark';
    return this.userProfile.userType === 'alumni' ? 'briefcase' : 'school';
  }

  async loadUserProfile() {
    try {
      this.isLoading = true;
      const currentUser = this.authService.getCurrentUser();
      if (currentUser) {
        const profile = await this.authService.getUserProfile(currentUser.uid);
        if (profile) {
          this.userProfile = {
            firstName: profile.firstName || '',
            lastName: profile.lastName || '',
            email: profile.email || '',
            userType: profile.userType || '',
            role: profile.role || '',
            department: profile.department || '',
            course: profile.course || '',
            studentNumber: profile.studentNumber || '',
            graduationYear: profile.graduationYear || '',
            bio: profile.bio || '',
            gender: profile.gender || '',
            address: profile.address || '',
            contactNumber: profile.contactNumber || '',
            photoUrl: profile.photoUrl || '',
            initials: ((profile.firstName?.charAt(0) || '') + (profile.lastName?.charAt(0) || '')).toUpperCase() || 'U',
          };
          // Resolve department ID → department name
          if (this.userProfile.department) {
            try {
              const depts = await this.authService.getDepartments();
              const match = depts.find(
                (d: any) => d.id === this.userProfile.department || d.name === this.userProfile.department
              );
              if (match) this.userProfile.department = match.name;
            } catch {
              // keep raw value if resolution fails
            }
          }

          this.isPrivate = profile.isPrivate === true;

          if (profile.userType === 'alumni') {
            this.workExperiences = ((profile.workExperiences as WorkExperience[]) || []).slice().sort(this.sortWork);
            this.updateCurrentJobStatus();
            this.alumniIdVerificationStatus = profile.alumniIdVerificationStatus || 'unverified';
            this.alumniIdRejectionReason = profile.alumniIdRejectionReason || '';
            // Support both legacy base64 field and new Storage URL field
            const rawGradPhoto = profile.alumniGradPhotoUrl || profile.alumniGradPhotoBase64 || '';
            if (rawGradPhoto.startsWith('http') || rawGradPhoto.startsWith('data:')) {
              this.alumniGradPhotoBase64 = rawGradPhoto;
            } else if (rawGradPhoto) {
              this.alumniGradPhotoBase64 = `data:image/jpeg;base64,${rawGradPhoto}`;
            } else {
              this.alumniGradPhotoBase64 = '';
            }
          }

          this.inspiredPoints = profile.inspiredPoints || {};
          this.inspiredMasterBadge = profile.inspiredMasterBadge === true;
        }
      } else {
        this.router.navigate(['/login']);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      this.isLoading = false;
    }
  }

  // ── Privacy ────────────────────────────────────────

  async onPrivacyChange(event: any) {
    const newValue: boolean = event.detail.checked;
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) return;
    this.isPrivate = newValue;
    try {
      await this.authService.updateUserProfile(currentUser.uid, { isPrivate: newValue });
    } catch {
      this.isPrivate = !newValue;
    }
  }

  // ── Photo ──────────────────────────────────────────

  async openPhotoModal() {
    await this.photoModal.present();
  }

  async closePhotoModal() {
    await this.photoModal.dismiss();
  }

  // Creates a fresh input outside the modal DOM so aria-hidden doesn't block it
  selectAddPhoto() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.onchange = (e: Event) => {
      this.handlePhotoFile(e);
      document.body.removeChild(input);
    };
    input.click();
  }

  private async handlePhotoFile(e: Event) {
    const file = (e.target as HTMLInputElement)?.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      console.error('File exceeds 5 MB');
      return;
    }
    try {
      const currentUser = this.authService.getCurrentUser();
      if (currentUser) {
        const photoUrl = await this.authService.uploadFile(`profile-pictures/${currentUser.uid}`, file);
        await this.authService.updateUserProfile(currentUser.uid, { photoUrl });
        this.userProfile.photoUrl = photoUrl;
        await this.photoModal.dismiss();
      }
    } catch (err) {
      console.error('Error saving photo:', err);
    }
  }

  async removeProfilePicture() {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (currentUser) {
        await this.authService.updateUserProfile(currentUser.uid, { photoUrl: '' });
        this.userProfile.photoUrl = '';
        await this.photoModal.dismiss();
      }
    } catch (err) {
      console.error('Error removing photo:', err);
    }
  }

  // ── Edit Profile ───────────────────────────────────

  async openEditModal() {
    this.editFormData = {
      bio: this.userProfile.bio,
      gender: this.userProfile.gender,
      address: this.userProfile.address,
      contactNumber: this.userProfile.contactNumber,
    };
    this.updatePhoneNumberLength();
    await this.editModal.present();
  }

  // Update phone number length for display
  updatePhoneNumberLength() {
    this.phoneNumberLength = this.editFormData.contactNumber ? this.editFormData.contactNumber.length : 0;
  }

  // Handle phone number input change
  onPhoneNumberChange() {
    this.updatePhoneNumberLength();
  }

  async closeEditModal() {
    await this.editModal.dismiss();
  }

  removeBio() {
    this.editFormData.bio = '';
  }

  async saveProfileChanges() {
    if (this.isSaving) return;
    try {
      this.isSaving = true;
      const currentUser = this.authService.getCurrentUser();
      if (currentUser) {
        // Validate and format phone number
        const formattedPhone = this.validateAndFormatPhoneNumber(this.editFormData.contactNumber);

        await this.authService.updateUserProfile(currentUser.uid, {
          bio: this.editFormData.bio,
          gender: this.editFormData.gender,
          address: this.editFormData.address,
          contactNumber: formattedPhone,
        });
        this.userProfile.bio = this.editFormData.bio;
        this.userProfile.gender = this.editFormData.gender;
        this.userProfile.address = this.editFormData.address;
        this.userProfile.contactNumber = formattedPhone;
        await this.authService.awardInspiredProfileComplete(currentUser.uid, {
          bio: this.editFormData.bio,
          gender: this.editFormData.gender,
          address: this.editFormData.address,
          contactNumber: formattedPhone,
        });
        await this.editModal.dismiss();
      }
    } catch (err) {
      console.error('Error updating profile:', err);
    } finally {
      this.isSaving = false;
    }
  }

  // ── Work Experience ────────────────────────────────

  // Check if there's already a current job
  updateCurrentJobStatus() {
    this.hasCurrentJob = this.workExperiences.some(w => w.isCurrent === true);
  }

  // Validate work experience form data
  validateWorkForm(): string {
    // Check required fields
    if (!this.workFormData.company || !this.workFormData.company.trim()) {
      return 'Company/Organization is required';
    }
    if (!this.workFormData.position || !this.workFormData.position.trim()) {
      return 'Position/Role is required';
    }
    if (!this.workFormData.startYear) {
      return 'Start Year is required';
    }

    // If not currently working, end year is required
    if (!this.workFormData.isCurrent && !this.workFormData.endYear) {
      return 'End Year is required (unless currently working)';
    }

    // Validate year range
    if (!this.workFormData.isCurrent) {
      const startYear = parseInt(this.workFormData.startYear);
      const endYear = parseInt(this.workFormData.endYear);

      if (isNaN(startYear) || isNaN(endYear)) {
        return 'Invalid year selection';
      }

      if (endYear <= startYear) {
        return 'End Year must be greater than Start Year';
      }
    }

    // Check for duplicate start years
    const duplicateStartYear = this.workExperiences.some(
      work => work.startYear === this.workFormData.startYear && work.id !== this.workFormData.id
    );
    if (duplicateStartYear) {
      return 'You already have an entry for ' + this.workFormData.startYear;
    }

    // Check for overlapping work periods
    const overlappingWork = this.workExperiences.some(work => {
      if (work.id === this.workFormData.id) return false; // Skip current entry when editing

      const workStart = parseInt(work.startYear);
      const workEnd = work.isCurrent ? 9999 : parseInt(work.endYear);
      const newStart = parseInt(this.workFormData.startYear);
      const newEnd = this.workFormData.isCurrent ? 9999 : parseInt(this.workFormData.endYear);

      // Check for overlap
      return !(newEnd < workStart || newStart > workEnd);
    });

    if (overlappingWork) {
      return 'This work period overlaps with an existing entry';
    }

    // Check if trying to add another current job
    if (this.workFormData.isCurrent) {
      const hasAnotherCurrentJob = this.workExperiences.some(
        work => work.isCurrent === true && work.id !== this.workFormData.id
      );
      if (hasAnotherCurrentJob) {
        return 'You can only have one current job. Please uncheck "Currently working here" for your previous job.';
      }
    }

    return ''; // No validation errors
  }

  // ── Work Experience ────────────────────────────────

  async openAddWorkModal() {
    this.isEditingWork = false;
    this.workFormData = {
      id: Date.now().toString(),
      company: '',
      position: '',
      startYear: '',
      endYear: '',
      isCurrent: false,
      description: '',
    };
    this.endYearOptions = [];
    this.workValidationError = '';
    await this.workModal.present();
  }

  async openEditWorkModal(work: WorkExperience) {
    this.isEditingWork = true;
    this.editingWorkId = work.id;
    this.workFormData = { ...work };
    this.workValidationError = '';
    // Generate end year options if start year exists
    if (this.workFormData.startYear) {
      this.generateEndYearOptions();
    } else {
      this.endYearOptions = [];
    }
    await this.workModal.present();
  }

  async closeWorkModal() {
    await this.workModal.dismiss();
  }

  // Generate end year options based on start year
  generateEndYearOptions() {
    if (!this.workFormData.startYear) {
      this.endYearOptions = [];
      return;
    }
    
    const startYear = parseInt(this.workFormData.startYear);
    const currentYear = new Date().getFullYear();
    this.endYearOptions = [];
    
    // Generate years from start year + 1 to current year
    for (let y = currentYear; y > startYear; y--) {
      this.endYearOptions.push(y.toString());
    }
  }

  // Handle start year change
  onStartYearChange() {
    this.generateEndYearOptions();
    
    // Auto-adjust end year if it's less than or equal to start year
    if (this.workFormData.endYear) {
      const startYear = parseInt(this.workFormData.startYear);
      const endYear = parseInt(this.workFormData.endYear);
      
      if (endYear <= startYear) {
        // Auto-set to start year + 1
        this.workFormData.endYear = (startYear + 1).toString();
      } else if (!this.endYearOptions.includes(this.workFormData.endYear)) {
        // If current end year is no longer valid, reset it
        this.workFormData.endYear = '';
      }
    }
  }

  // Handle end year change - validate it's after start year
  onEndYearChange() {
    if (this.workFormData.startYear && this.workFormData.endYear) {
      const startYear = parseInt(this.workFormData.startYear);
      const endYear = parseInt(this.workFormData.endYear);
      
      if (endYear <= startYear) {
        // Automatically adjust end year to start year + 1
        this.workFormData.endYear = (startYear + 1).toString();
      }
    }
  }

  // Handle currently working checkbox change
  onCurrentlyWorkingChange() {
    if (this.workFormData.isCurrent) {
      // If currently working, clear end year
      this.workFormData.endYear = '';
      this.endYearOptions = [];
    } else {
      // If unchecked, regenerate end year options
      this.generateEndYearOptions();
    }
  }

  async saveWorkExperience() {
    if (this.isSaving) return;
    
    // Validate form before saving
    const validationError = this.validateWorkForm();
    if (validationError) {
      this.workValidationError = validationError;
      return;
    }

    try {
      this.isSaving = true;
      this.workValidationError = ''; // Clear any previous errors
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) return;

      if (this.workFormData.isCurrent) {
        this.workFormData.endYear = 'Present';
      }

      let updated: WorkExperience[];
      if (this.isEditingWork) {
        updated = this.workExperiences.map(w =>
          w.id === this.editingWorkId ? { ...this.workFormData } : w
        );
      } else {
        updated = [...this.workExperiences, { ...this.workFormData }];
      }

      await this.authService.updateUserProfile(currentUser.uid, { workExperiences: updated });
      this.workExperiences = updated.slice().sort(this.sortWork);
      this.updateCurrentJobStatus();
      await this.workModal.dismiss();
    } catch (err) {
      console.error('Error saving work experience:', err);
      this.workValidationError = 'Failed to save work experience. Please try again.';
    } finally {
      this.isSaving = false;
    }
  }

  async deleteWorkExperience(workId: string) {
    const alert = await this.alertController.create({
      header: 'Remove Entry',
      message: 'Delete this work experience?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            try {
              const currentUser = this.authService.getCurrentUser();
              if (!currentUser) return;
              const updated = this.workExperiences.filter(w => w.id !== workId);
              await this.authService.updateUserProfile(currentUser.uid, { workExperiences: updated });
              this.workExperiences = updated;
              this.updateCurrentJobStatus();
            } catch (err) {
              console.error('Error deleting work experience:', err);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  goBack() {
    this.router.navigate(['/home']);
  }

  // ── Points & Rewards ──────────────────────────────────────

  async loadPoints() {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) return;
    this.isLoadingPoints = true;
    try {
      const profile = await this.authService.getUserProfile(currentUser.uid);
      const total = profile?.['totalPoints'] || 0;
      this.pointsData = {
        total,
        level: this.authService.getUserLevel(total),
        badges: profile?.['badges'] || [],
      };
      this.pointsHistory = await this.authService.getUserPointsHistory(currentUser.uid);
    } catch (err) {
      console.error('Error loading points:', err);
    } finally {
      this.isLoadingPoints = false;
    }
  }

  getBadgeLabel(badge: string): string {
    const map: { [k: string]: string } = {
      first_event:        'First Event',
      active_alumni:      'Active Alumni',
      event_supporter:    'Event Supporter',
      community_champion: 'Community Champion',
      top_contributor:    'Top Contributor',
    };
    return map[badge] || badge;
  }

  getBadgeIcon(badge: string): string {
    const map: { [k: string]: string } = {
      first_event:        'star-outline',
      active_alumni:      'people-outline',
      event_supporter:    'heart-outline',
      community_champion: 'shield-checkmark-outline',
      top_contributor:    'trophy-outline',
    };
    return map[badge] || 'ribbon-outline';
  }

  formatPointsDate(awardedAt: any): string {
    if (!awardedAt) return '';
    const d = awardedAt.toDate ? awardedAt.toDate() : new Date(awardedAt);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  get levelProgressPct(): number {
    const { total, level } = this.pointsData;
    if (level.next === -1) return 100;
    const prevThreshold = level.level === 'bronze' ? 0 : level.level === 'silver' ? 50 : level.level === 'gold' ? 150 : 300;
    return Math.min(100, Math.round(((total - prevThreshold) / (level.next - prevThreshold)) * 100));
  }

  // ── INSPIRED Badge System ─────────────────────────────────

  getInspiredLevel(key: string): string {
    return this.authService.getInspiredBadgeLevel(this.inspiredPoints[key] || 0);
  }

  getInspiredProgress(key: string): number {
    const pts = this.inspiredPoints[key] || 0;
    if (pts >= 25) return 100;
    if (pts >= 10) return Math.round(((pts - 10) / 15) * 100);
    return Math.round((pts / 10) * 100);
  }

  getInspiredNextLabel(key: string): string {
    const pts = this.inspiredPoints[key] || 0;
    if (pts >= 25) return 'Max level!';
    if (pts >= 10) return `${25 - pts} pts to Gold`;
    if (pts >= 1)  return `${10 - pts} pts to Silver`;
    return '10 pts to Bronze';
  }

  // ── Alumni ID Verification ────────────────────────────────

  get verificationStatusLabel(): string {
    const map: Record<string, string> = {
      unverified: 'Not Verified',
      pending: 'Pending Review',
      approved: 'Verified Alumni',
      rejected: 'Verification Rejected',
    };
    return map[this.alumniIdVerificationStatus] || 'Not Verified';
  }

  onVerificationIdFileSelected(event: any) {
    const file: File = event.target.files?.[0];
    if (!file) return;
    if (file.type && !file.type.startsWith('image/')) {
      this.showSimpleAlert('Invalid File', 'Please upload an image file (JPG, PNG, or WebP).');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      this.showSimpleAlert('File Too Large', 'Please choose an image under 15MB.');
      return;
    }
    this.verificationIdFile = file;
    this.verificationIdFileName = file.name;
    this.verificationIdFileSize = (file.size / 1024).toFixed(1) + ' KB';
  }

  removeVerificationIdFile() {
    this.verificationIdFile = null;
    this.verificationIdFileName = '';
    this.verificationIdFileSize = '';
  }

  onVerificationGradFileSelected(event: any) {
    const file: File = event.target.files?.[0];
    if (!file) return;
    if (file.type && !file.type.startsWith('image/')) {
      this.showSimpleAlert('Invalid File', 'Please upload an image file (JPG, PNG, or WebP).');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      this.showSimpleAlert('File Too Large', 'Please choose an image under 15MB.');
      return;
    }
    this.verificationGradFile = file;
    this.verificationGradFileName = file.name;
    this.verificationGradFileSize = (file.size / 1024).toFixed(1) + ' KB';
  }

  removeVerificationGradFile() {
    this.verificationGradFile = null;
    this.verificationGradFileName = '';
    this.verificationGradFileSize = '';
  }

  async submitVerificationRequest() {
    if (!this.verificationIdFile || !this.verificationGradFile || this.isSubmittingVerification) return;
    const user = this.authService.getCurrentUser();
    if (!user) return;
    this.isSubmittingVerification = true;
    try {
      await this.authService.requestAlumniIdVerification(
        user.uid,
        this.verificationIdFile,
        this.verificationIdFileName,
        this.verificationGradFile
      );
      this.alumniIdVerificationStatus = 'pending';
      this.showVerificationUpload = false;
      this.removeVerificationIdFile();
      this.removeVerificationGradFile();
      await this.showSimpleAlert('Submitted', 'Your Alumni ID has been submitted for verification. You will be notified once reviewed.');
    } catch (err) {
      console.error('Error submitting verification:', err);
      await this.showSimpleAlert('Error', 'Failed to submit. Please try again.');
    } finally {
      this.isSubmittingVerification = false;
    }
  }

  private async showSimpleAlert(header: string, message: string) {
    const alert = await this.alertController.create({ header, message, buttons: ['OK'] });
    await alert.present();
  }

  // ── Digital Alumni ID ────────────────────────────────────

  openDigitalId() {
    this.showDigitalId = true;
  }

  closeDigitalId() {
    this.showDigitalId = false;
  }

  async logout() {
    const alert = await this.alertController.create({
      header: 'Logout',
      message: 'Are you sure you want to logout?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Logout',
          role: 'destructive',
          handler: async () => {
            await this.authService.logout();
            this.router.navigate(['/login']);
          }
        }
      ]
    });
    await alert.present();
  }
}
