import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, IonModal } from '@ionic/angular';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class ProfilePage implements OnInit {
  @ViewChild('editModal') editModal!: IonModal;
  @ViewChild('photoFileInput') photoFileInput!: ElementRef;
  
  userProfile = {
    firstName: '',
    lastName: '',
    email: '',
    userType: '',
    department: '',
    course: '',
    studentNumber: '',
    graduationYear: '',
    bio: '',
    initials: '',
    gender: '',
    ageGroup: '',
    photoUrl: '',
  };

  editFormData = {
    gender: '',
    ageGroup: '',
  };

  genders = ['Male', 'Female', 'Other'];
  ageGroups = ['Junior', 'Adult', 'Senior'];

  isLoading = true;
  presentingElement: any;
  isPhotoModalOpen = false;

  constructor(private authService: AuthService, private router: Router) {}

  async ngOnInit() {
    this.presentingElement = document.querySelector('ion-content');
    await this.loadUserProfile();
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
            department: profile.department || '',
            course: profile.course || '',
            studentNumber: profile.studentNumber || '',
            graduationYear: profile.graduationYear || '',
            bio: profile.bio || '',
            gender: profile.gender || '',
            ageGroup: profile.ageGroup || '',
            photoUrl: profile.photoUrl || '',
            initials: (profile.firstName?.charAt(0) + profile.lastName?.charAt(0)).toUpperCase() || 'U',
          };
          console.log('Profile loaded:', this.userProfile);
        }
      } else {
        // No user logged in, redirect to login
        this.router.navigate(['/login']);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      this.isLoading = false;
    }
  }

  onPhotoSelected(event: any) {
    const file = event.target.files[0];
    console.log('Photo selected:', file);
    
    if (file) {
      // Validate file size (max 5MB)
      const maxSizeInBytes = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSizeInBytes) {
        console.error('File is too large. Maximum size is 5MB');
        return;
      }

      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async (e: any) => {
        try {
          const base64String = e.target.result;
          this.userProfile.photoUrl = base64String;
          console.log('Photo converted to base64');
          
          // Save to Firestore
          const currentUser = this.authService.getCurrentUser();
          if (currentUser) {
            await this.authService.updateUserProfile(currentUser.uid, {
              photoUrl: base64String,
            });
            console.log('Photo uploaded and saved successfully');
            
            // Reset file input
            if (this.photoFileInput && this.photoFileInput.nativeElement) {
              this.photoFileInput.nativeElement.value = '';
            }
            
            // Close modal
            this.isPhotoModalOpen = false;
          }
        } catch (error) {
          console.error('Error saving photo:', error);
        }
      };
      reader.readAsDataURL(file);
    }
  }

  async openPhotoModal() {
    this.isPhotoModalOpen = true;
  }

  async closePhotoModal() {
    this.isPhotoModalOpen = false;
  }

  selectAddPhoto() {
    console.log('selectAddPhoto called');
    try {
      if (this.photoFileInput && this.photoFileInput.nativeElement) {
        console.log('Clicking file input');
        this.photoFileInput.nativeElement.click();
      } else {
        console.error('Photo file input not found:', this.photoFileInput);
      }
    } catch (error) {
      console.error('Error selecting photo:', error);
    }
  }

  async removeProfilePicture() {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (currentUser) {
        // Remove photo from Firestore
        await this.authService.updateUserProfile(currentUser.uid, {
          photoUrl: '',
        });
        
        // Update local profile
        this.userProfile.photoUrl = '';
        console.log('Profile picture removed successfully');
        await this.closePhotoModal();
      }
    } catch (error) {
      console.error('Error removing profile picture:', error);
    }
  }

  async openEditModal() {
    // Initialize form with current values
    this.editFormData.gender = this.userProfile.gender || '';
    this.editFormData.ageGroup = this.userProfile.ageGroup || '';
    await this.editModal.present();
  }

  async closeEditModal() {
    await this.editModal.dismiss();
  }

  async saveProfileChanges() {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (currentUser) {
        // Update user profile in Firestore
        await this.authService.updateUserProfile(currentUser.uid, {
          gender: this.editFormData.gender,
          ageGroup: this.editFormData.ageGroup,
        });
        
        // Update local profile
        this.userProfile.gender = this.editFormData.gender;
        this.userProfile.ageGroup = this.editFormData.ageGroup;
        
        await this.editModal.dismiss();
        console.log('Profile updated successfully');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  }

  goBack() {
    this.router.navigate(['/home']);
  }
}
