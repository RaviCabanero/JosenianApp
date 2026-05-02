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

  editFormData = {
    bio: '',
    gender: '',
    address: '',
    contactNumber: '',
  };

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

  genders = ['Male', 'Female', 'Other', 'Prefer not to say'];
  yearOptions: string[] = [];
  isLoading = true;

  private sortWork = (a: WorkExperience, b: WorkExperience): number => {
    if (a.isCurrent && !b.isCurrent) return -1;
    if (!a.isCurrent && b.isCurrent) return 1;
    const aYear = a.isCurrent ? 9999 : (parseInt(a.endYear) || 0);
    const bYear = b.isCurrent ? 9999 : (parseInt(b.endYear) || 0);
    return bYear - aYear;
  };

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

          if (profile.userType === 'alumni') {
            this.workExperiences = ((profile.workExperiences as WorkExperience[]) || []).slice().sort(this.sortWork);
          }
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

  private handlePhotoFile(e: Event) {
    const file = (e.target as HTMLInputElement)?.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      console.error('File exceeds 5 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (ev: any) => {
      try {
        const base64 = ev.target.result as string;
        const currentUser = this.authService.getCurrentUser();
        if (currentUser) {
          await this.authService.updateUserProfile(currentUser.uid, { photoUrl: base64 });
          this.userProfile.photoUrl = base64;
          await this.photoModal.dismiss();
        }
      } catch (err) {
        console.error('Error saving photo:', err);
      }
    };
    reader.readAsDataURL(file);
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
    await this.editModal.present();
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
        await this.authService.updateUserProfile(currentUser.uid, {
          bio: this.editFormData.bio,
          gender: this.editFormData.gender,
          address: this.editFormData.address,
          contactNumber: this.editFormData.contactNumber,
        });
        this.userProfile.bio = this.editFormData.bio;
        this.userProfile.gender = this.editFormData.gender;
        this.userProfile.address = this.editFormData.address;
        this.userProfile.contactNumber = this.editFormData.contactNumber;
        await this.editModal.dismiss();
      }
    } catch (err) {
      console.error('Error updating profile:', err);
    } finally {
      this.isSaving = false;
    }
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
    await this.workModal.present();
  }

  async openEditWorkModal(work: WorkExperience) {
    this.isEditingWork = true;
    this.editingWorkId = work.id;
    this.workFormData = { ...work };
    await this.workModal.present();
  }

  async closeWorkModal() {
    await this.workModal.dismiss();
  }

  async saveWorkExperience() {
    if (this.isSaving) return;
    try {
      this.isSaving = true;
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
      await this.workModal.dismiss();
    } catch (err) {
      console.error('Error saving work experience:', err);
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
}
