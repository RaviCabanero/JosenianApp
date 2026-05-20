import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, IonModal, AlertController } from '@ionic/angular';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { NgZone } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { ViewWillEnter } from '@ionic/angular';

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
export class ProfilePage implements OnInit, ViewWillEnter {
  @ViewChild('editModal') editModal!: IonModal;
  @ViewChild('workModal') workModal!: IonModal;
  @ViewChild('photoModal') photoModal!: IonModal;
  @ViewChild('sigCanvas') sigCanvas!: ElementRef<HTMLCanvasElement>;

  userProfile = {
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    userType: '',
    role: '',
    department: '',
    course: '',
    studentNumber: '',
    graduationYear: '',
    birthdate: '',
    bio: '',
    initials: '',
    gender: '',
    address: '',
    contactNumber: '',
    photoUrl: '',
    totalPoints: 0,
  };

  workExperiences: WorkExperience[] = [];

  editFormData = {
    bio: '',
    gender: '',
    address: '',
    contactNumber: '',
    birthdate: '',
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
  verificationTermGraduated = '';
  verificationSocialMedia = '';
  isSubmittingVerification = false;

  private signaturePad: any = null;
  userSignatureUrl = '';

  showDigitalId = false;
  readonly logoSrc = 'assets/transparent_Logo.png';
  isFlipped = false;
  isLandscape = false;
  alumniIdReferenceNumber = '';
  adminSignatureUrl = '';
  qrCodeDataUrl = '';
  isGeneratingPdf = false;

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

  get currentJob(): WorkExperience | undefined {
    return this.workExperiences.find(w => w.isCurrent === true);
  }

  get pastJobs(): WorkExperience[] {
    return this.workExperiences
      .filter(w => w.isCurrent !== true)
      .sort((a, b) => {
        const aYear = parseInt(a.endYear) || 0;
        const bYear = parseInt(b.endYear) || 0;
        return bYear - aYear;
      });
  }

  formatPhoneNumber(phoneNumber: string | null | undefined): string {
    if (!phoneNumber || !phoneNumber.trim()) {
      return 'No phone number added';
    }

    let cleaned = phoneNumber.trim().replace(/[^\d+]/g, '');

    if (cleaned.startsWith('+63')) {
      if (cleaned.length === 13) {
        return cleaned.replace(/(\+63)(\d{3})(\d{3})(\d{4})/, '$1 $2 $3 $4');
      }
    } else if (cleaned.startsWith('+')) {
      if (cleaned.length > 10) {
        const countryCode = cleaned.substring(0, 3); // +63, +1, etc.
        const rest = cleaned.substring(3);
        if (rest.length === 10) {
          return `${countryCode} ${rest.substring(0, 3)} ${rest.substring(3, 6)} ${rest.substring(6)}`;
        }
      }
    } else if (cleaned.startsWith('0')) {
      if (cleaned.length === 11) {
        return cleaned.replace(/(\d{4})(\d{3})(\d{4})/, '$1 $2 $3');
      }
    } else if (cleaned.length === 10) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    }

    return phoneNumber;
  }

  validateAndFormatPhoneNumber(phoneNumber: string | null | undefined): string {
    if (!phoneNumber || !phoneNumber.trim()) {
      return '';
    }

    let cleaned = phoneNumber.trim().replace(/[^\d+]/g, '');

    if (cleaned.startsWith('09')) {
      cleaned = '+63' + cleaned.substring(1);
    } else if (!cleaned.startsWith('+')) {
      cleaned = '+63' + cleaned;
    }

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
  }

  async ionViewWillEnter() {
    await this.loadUserProfile();
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
            middleName: profile.middleName || '',
            lastName: profile.lastName || '',
            email: profile.email || '',
            userType: profile.userType || '',
            role: profile.role || '',
            department: profile.department || '',
            course: profile.course || '',
            studentNumber: profile.studentNumber || '',
            graduationYear: profile.graduationYear || '',
            birthdate: profile.birthdate || '',
            bio: profile.bio || '',
            gender: profile.gender || '',
            address: profile.address || '',
            contactNumber: profile.contactNumber || '',
            photoUrl: profile.photoUrl || '',
            initials: ((profile.firstName?.charAt(0) || '') + (profile.lastName?.charAt(0) || '')).toUpperCase() || 'U',
            totalPoints: profile.totalPoints || 0,
          };
          if (this.userProfile.department) {
            try {
              const depts = await this.authService.getDepartments();
              const match = depts.find(
                (d: any) => d.id === this.userProfile.department || d.name === this.userProfile.department
              );
              if (match) this.userProfile.department = match.name;
            } catch {
            }
          }

          this.isPrivate = profile.isPrivate === true;

          if (profile.userType === 'alumni') {
            this.workExperiences = ((profile.workExperiences as WorkExperience[]) || []).slice().sort(this.sortWork);
            this.updateCurrentJobStatus();
            this.alumniIdVerificationStatus = profile.alumniIdVerificationStatus || 'unverified';
            this.alumniIdRejectionReason = profile.alumniIdRejectionReason || '';
            this.alumniIdReferenceNumber = profile.alumniIdReferenceNumber || '';
            this.adminSignatureUrl = profile.adminSignatureUrl || '';
            this.userSignatureUrl = profile.userSignatureUrl || '';
            const rawGradPhoto = profile.alumniGradPhotoUrl || profile.alumniGradPhotoBase64 || '';
            if (rawGradPhoto.startsWith('http') || rawGradPhoto.startsWith('data:')) {
              this.alumniGradPhotoBase64 = rawGradPhoto;
            } else if (rawGradPhoto) {
              this.alumniGradPhotoBase64 = `data:image/jpeg;base64,${rawGradPhoto}`;
            } else {
              this.alumniGradPhotoBase64 = '';
            }
            if (this.alumniIdReferenceNumber) {
              this.generateQrCode();
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


  async openPhotoModal() {
    await this.photoModal.present();
  }

  async closePhotoModal() {
    await this.photoModal.dismiss();
  }

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


  async openEditModal() {
    this.editFormData = {
      bio: this.userProfile.bio,
      gender: this.userProfile.gender,
      address: this.userProfile.address,
      contactNumber: this.userProfile.contactNumber,
      birthdate: this.userProfile.birthdate,
    };
    this.updatePhoneNumberLength();
    await this.editModal.present();
  }

  updatePhoneNumberLength() {
    this.phoneNumberLength = this.editFormData.contactNumber ? this.editFormData.contactNumber.length : 0;
  }

  onPhoneNumberChange() {
    this.updatePhoneNumberLength();
  }

  onAddressInput(event: any) {
    const value: string = event.target.value;
    if (!value) return;
    const result = value.replace(/(^|[\s,])([a-z])/g, (_, sep, char) => sep + char.toUpperCase());
    this.editFormData.address = result;
    event.target.value = result;
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
        const formattedPhone = this.validateAndFormatPhoneNumber(this.editFormData.contactNumber);

        await this.authService.updateUserProfile(currentUser.uid, {
          bio: this.editFormData.bio,
          gender: this.editFormData.gender,
          address: this.editFormData.address,
          contactNumber: formattedPhone,
          birthdate: this.editFormData.birthdate,
        });
        this.userProfile.bio = this.editFormData.bio;
        this.userProfile.gender = this.editFormData.gender;
        this.userProfile.address = this.editFormData.address;
        this.userProfile.contactNumber = formattedPhone;
        this.userProfile.birthdate = this.editFormData.birthdate;
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


  updateCurrentJobStatus() {
    this.hasCurrentJob = this.workExperiences.some(w => w.isCurrent === true);
  }

  validateWorkForm(): string {
    if (!this.workFormData.company || !this.workFormData.company.trim()) {
      return 'Company/Organization is required';
    }
    if (!this.workFormData.position || !this.workFormData.position.trim()) {
      return 'Position/Role is required';
    }
    if (!this.workFormData.startYear) {
      return 'Start Year is required';
    }

    if (!this.workFormData.isCurrent && !this.workFormData.endYear) {
      return 'End Year is required (unless currently working)';
    }

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

    const duplicateStartYear = this.workExperiences.some(
      work => work.startYear === this.workFormData.startYear && work.id !== this.workFormData.id
    );
    if (duplicateStartYear) {
      return 'You already have an entry for ' + this.workFormData.startYear;
    }

    const overlappingWork = this.workExperiences.some(work => {
      if (work.id === this.workFormData.id) return false; // Skip current entry when editing

      const workStart = parseInt(work.startYear);
      const workEnd = work.isCurrent ? 9999 : parseInt(work.endYear);
      const newStart = parseInt(this.workFormData.startYear);
      const newEnd = this.workFormData.isCurrent ? 9999 : parseInt(this.workFormData.endYear);

      return !(newEnd < workStart || newStart > workEnd);
    });

    if (overlappingWork) {
      return 'This work period overlaps with an existing entry';
    }

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

  generateEndYearOptions() {
    if (!this.workFormData.startYear) {
      this.endYearOptions = [];
      return;
    }
    
    const startYear = parseInt(this.workFormData.startYear);
    const currentYear = new Date().getFullYear();
    this.endYearOptions = [];
    
    for (let y = currentYear; y > startYear; y--) {
      this.endYearOptions.push(y.toString());
    }
  }

  onStartYearChange() {
    this.generateEndYearOptions();
    
    if (this.workFormData.endYear) {
      const startYear = parseInt(this.workFormData.startYear);
      const endYear = parseInt(this.workFormData.endYear);
      
      if (endYear <= startYear) {
        this.workFormData.endYear = (startYear + 1).toString();
      } else if (!this.endYearOptions.includes(this.workFormData.endYear)) {
        this.workFormData.endYear = '';
      }
    }
  }

  onEndYearChange() {
    if (this.workFormData.startYear && this.workFormData.endYear) {
      const startYear = parseInt(this.workFormData.startYear);
      const endYear = parseInt(this.workFormData.endYear);
      
      if (endYear <= startYear) {
        this.workFormData.endYear = (startYear + 1).toString();
      }
    }
  }

  onCurrentlyWorkingChange() {
    if (this.workFormData.isCurrent) {
      this.workFormData.endYear = '';
      this.endYearOptions = [];
    } else {
      this.generateEndYearOptions();
    }
  }

  async saveWorkExperience() {
    if (this.isSaving) return;
    
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

  async onRequestVerification() {
    const hasGender = !!this.userProfile.gender;
    const hasContact = !!this.userProfile.contactNumber;
    if (!hasGender || !hasContact) {
      await this.showSimpleAlert(
        'Update Your Profile First',
        'Please complete your profile before requesting alumni ID verification. Make sure to add your sex and contact number.'
      );
      return;
    }
    this.showVerificationUpload = !this.showVerificationUpload;
    if (this.showVerificationUpload) {
      this.initSignaturePad();
    }
  }

  async initSignaturePad() {
    await new Promise(r => setTimeout(r, 150));
    if (!this.sigCanvas?.nativeElement) return;
    const { default: SignaturePad } = await import('signature_pad');
    const canvas = this.sigCanvas.nativeElement;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    this.signaturePad = new SignaturePad(canvas, {
      backgroundColor: 'rgba(0,0,0,0)',
      penColor: '#111827',
      minWidth: 1.5,
      maxWidth: 3,
    });
  }

  clearSignaturePad() {
    this.signaturePad?.clear();
  }

  private async getSignatureFile(): Promise<File | undefined> {
    if (!this.signaturePad || this.signaturePad.isEmpty()) return undefined;
    const dataUrl = this.signaturePad.toDataURL('image/png');
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], 'user-signature.png', { type: 'image/png' });
  }


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

  isSocialMediaLinkValid(): boolean {
    const val = this.verificationSocialMedia.trim();
    if (!val) return true;
    try {
      const url = val.startsWith('http://') || val.startsWith('https://') ? val : `https://${val}`;
      const parsed = new URL(url);
      return parsed.hostname.includes('.');
    } catch {
      return false;
    }
  }

  async submitVerificationRequest() {
    if (!this.verificationGradFile || !this.verificationTermGraduated || this.isSubmittingVerification) return;
    if (!this.isSocialMediaLinkValid()) {
      await this.showSimpleAlert('Invalid Link', 'Please enter a valid URL for the social media link (e.g. facebook.com/yourname).');
      return;
    }
    const user = this.authService.getCurrentUser();
    if (!user) return;
    this.isSubmittingVerification = true;
    try {
      const signatureFile = await this.getSignatureFile();
      await this.authService.requestAlumniIdVerification(
        user.uid,
        this.verificationGradFile,
        this.verificationTermGraduated,
        this.verificationSocialMedia,
        signatureFile
      );
      this.alumniIdVerificationStatus = 'pending';
      this.showVerificationUpload = false;
      this.removeVerificationGradFile();
      this.verificationTermGraduated = '';
      this.verificationSocialMedia = '';
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


  openDigitalId() {
    this.showDigitalId = true;
    this.isFlipped = false;
    this.isLandscape = false;
  }

  closeDigitalId() {
    this.showDigitalId = false;
  }

  get gradPhotoStyle(): string {
    return this.alumniGradPhotoBase64 ? `url(${this.alumniGradPhotoBase64})` : 'none';
  }

  get flipperTransform(): string {
    return this.isFlipped ? 'rotateY(180deg)' : 'none';
  }

  flipCard() {
    this.isFlipped = !this.isFlipped;
  }

  toggleLandscape() {
    this.isLandscape = !this.isLandscape;
  }

  async generateQrCode() {
    try {
      const QRCode = await import('qrcode');
      this.qrCodeDataUrl = await QRCode.toDataURL(
        `USJ-R Verified | ${this.alumniIdReferenceNumber}`,
        { width: 120, margin: 1 }
      );
    } catch (e) {
      console.error('QR generation failed', e);
    }
  }

  private async urlToBase64(url: string): Promise<string> {
    if (!url || url.startsWith('data:') || url.startsWith('blob:')) return url;
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return url;
    }
  }

  async downloadIdAsPdf() {
    this.isGeneratingPdf = true;
    const wasFlipped = this.isFlipped;
    this.isFlipped = false;

    // Save originals
    const origGradPhoto  = this.alumniGradPhotoBase64;
    const origUserSig    = this.userSignatureUrl;
    const origAdminSig   = this.adminSignatureUrl;

    // Pre-convert all remote Firebase Storage URLs to base64 so html2canvas
    // can embed them without running into CORS restrictions
    [
      this.alumniGradPhotoBase64,
      this.userSignatureUrl,
      this.adminSignatureUrl,
    ] = await Promise.all([
      this.urlToBase64(this.alumniGradPhotoBase64),
      this.urlToBase64(this.userSignatureUrl),
      this.urlToBase64(this.adminSignatureUrl),
    ]);

    await new Promise(r => setTimeout(r, 150)); // let Angular re-render with base64 sources

    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const front = document.querySelector('.did-card-front') as HTMLElement;
      const back  = document.querySelector('.did-card-back')  as HTMLElement;
      if (!front || !back) return;

      const frontCanvas = await html2canvas(front, { scale: 3, useCORS: true, logging: false });

      // temporarily un-flip the back for capture
      back.style.transform = 'rotateY(0deg)';
      back.style.backfaceVisibility = 'visible';
      await new Promise(r => setTimeout(r, 50));
      const backCanvas = await html2canvas(back, { scale: 3, useCORS: true, logging: false });
      back.style.transform = '';
      back.style.backfaceVisibility = '';

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a6' });
      const w = pdf.internal.pageSize.getWidth();
      const h = pdf.internal.pageSize.getHeight();

      pdf.addImage(frontCanvas.toDataURL('image/png'), 'PNG', 0, 0, w, h);
      pdf.addPage();
      pdf.addImage(backCanvas.toDataURL('image/png'), 'PNG', 0, 0, w, h);

      const lastName = this.userProfile.lastName || 'Alumni';
      const ref = this.alumniIdReferenceNumber || 'ID';
      const fileName = `Alumni-ID-${lastName}-${ref}.pdf`;

      if (Capacitor.isNativePlatform()) {
        const base64 = pdf.output('datauristring').split(',')[1];
        await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Documents,
        });
        const alert = await this.alertController.create({
          header: 'Downloaded',
          message: `Alumni ID saved to your Documents folder as "${fileName}".`,
          buttons: ['OK'],
        });
        await alert.present();
      } else {
        pdf.save(fileName);
      }
    } catch (e) {
      console.error('PDF generation failed', e);
    } finally {
      // Restore original URLs so the live card still shows correctly
      this.alumniGradPhotoBase64 = origGradPhoto;
      this.userSignatureUrl      = origUserSig;
      this.adminSignatureUrl     = origAdminSig;
      this.isFlipped = wasFlipped;
      this.isGeneratingPdf = false;
    }
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
