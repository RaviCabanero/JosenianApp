import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: false,
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(30px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateX(0)' }))
      ]),
      transition(':leave', [
        animate('300ms ease-in', style({ opacity: 0, transform: 'translateX(-30px)' }))
      ])
    ])
  ]
})
export class RegisterPage implements OnInit {
  // Form state
  userType: 'student' | 'alumni' = 'student';
  firstName: string = '';
  lastName: string = '';
  email: string = '';
  password: string = '';
  confirmPassword: string = '';
  studentNumber: string = '';
  department: string = '';
  course: string = '';
  graduationYear: string = '';

  // UI state
  showPassword: boolean = false;
  showConfirmPassword: boolean = false;
  isLoading: boolean = false;
  registerError: string = '';

  // Department list (loaded from Firestore dynamically)
  departments: any[] = [];
  courses: string[] = [];
  isLoadingDepts: boolean = false;

  // Alumni ID upload
  alumniIdFile: File | null = null;
  alumniIdFileName: string = '';
  alumniIdFileSize: string = '';

  constructor(private router: Router, private authService: AuthService) {}

  ngOnInit() {
    // Load departments from Firestore
    this.loadDepartments();
  }

  // Load departments dynamically from Firestore
  async loadDepartments() {
    try {
      this.isLoadingDepts = true;
      this.departments = await this.authService.getDepartments();
      console.log('Loaded departments:', this.departments);
      this.isLoadingDepts = false;
    } catch (error) {
      console.error('Error loading departments:', error);
      this.isLoadingDepts = false;
    }
  }

  // Toggle password visibility
  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  // Toggle confirm password visibility
  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  // Handle user type change
  onUserTypeChange(event: any) {
    this.userType = event.detail.value;
    // Clear conditional fields when switching
    if (this.userType === 'student') {
      this.graduationYear = '';
    } else {
      this.studentNumber = '';
      this.course = '';
    }
  }

  // Handle department change - load courses for selected department
  async onDepartmentChange(event: any) {
    this.department = event.detail.value;
    this.course = ''; // Reset course selection
    
    // Find selected department and get its courses
    const selectedDept = this.departments.find(d => d.id === this.department);
    if (selectedDept) {
      this.courses = selectedDept.courses || [];
      console.log('Courses for', selectedDept.name, ':', this.courses);
    } else {
      this.courses = [];
    }
  }

  // Register handler
  async register() {
    this.registerError = '';

    // Validation
    if (!this.firstName.trim()) {
      this.registerError = 'Please enter your first name';
      return;
    }

    if (!this.lastName.trim()) {
      this.registerError = 'Please enter your last name';
      return;
    }

    if (!this.email.trim()) {
      this.registerError = 'Please enter your email';
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      this.registerError = 'Please enter a valid email address';
      return;
    }

    if (!this.password.trim()) {
      this.registerError = 'Please enter your password';
      return;
    }

    if (this.password.length < 6) {
      this.registerError = 'Password must be at least 6 characters';
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.registerError = 'Passwords do not match';
      return;
    }

    if (!this.department) {
      this.registerError = 'Please select a department';
      return;
    }

    // Conditional validation
    if (this.userType === 'student') {
      if (!this.studentNumber.trim()) {
        this.registerError = 'Please enter your student number';
        return;
      }
      if (!this.course.trim()) {
        this.registerError = 'Please enter your course';
        return;
      }
    } else {
      if (!this.graduationYear) {
        this.registerError = 'Please select your graduation year';
        return;
      }
      if (!this.alumniIdFile) {
        this.registerError = 'Please upload your alumni ID for verification';
        return;
      }
    }

    this.isLoading = true;

    try {
      // Call Firebase registration and store user data in Firestore
      const profileData: any = {
        firstName: this.firstName,
        lastName: this.lastName,
        userType: this.userType,
        studentNumber: this.userType === 'student' ? this.studentNumber : '',
        department: this.department,
        course: this.userType === 'student' ? this.course : '',
        graduationYear: this.userType === 'alumni' ? this.graduationYear : '',
        status: 'pending', // Account pending admin approval
      };

      // Upload alumni ID if user is alumni
      if (this.userType === 'alumni' && this.alumniIdFile) {
        const alumniIdBase64 = await this.authService.uploadAlumniId(this.alumniIdFile);
        profileData.alumniIdBase64 = alumniIdBase64;
        profileData.alumniIdFileName = this.alumniIdFileName;
        profileData.alumniIdVerificationStatus = 'pending';
      }

      await this.authService.registerWithProfile(
        this.email,
        this.password,
        profileData
      );

      console.log('Registration successful');
      this.isLoading = false;
      
      // Show success message about pending approval
      alert('Registration successful! Your account is under review by the admin. Please check back later to login.');
      
      // Navigate to login page
      this.router.navigate(['/login']);
    } catch (error: any) {
      this.isLoading = false;
      this.registerError = error.message || 'Registration failed';
      console.error('Registration error:', error);
    }
  }

  // Navigate to login page
  navigateToLogin() {
    this.router.navigate(['/login']);
  }

  // Handle Enter key press
  handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.register();
    }
  }

  // Handle alumni ID file selection
  onAlumniIdFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (file) {
      // Validate file type (only images and PDF)
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        this.registerError = 'Please upload a valid file (JPG, PNG, GIF, or PDF)';
        this.alumniIdFile = null;
        this.alumniIdFileName = '';
        return;
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        this.registerError = 'File size must be less than 5MB';
        this.alumniIdFile = null;
        this.alumniIdFileName = '';
        return;
      }

      this.alumniIdFile = file;
      this.alumniIdFileName = file.name;
      this.alumniIdFileSize = (file.size / 1024).toFixed(2) + ' KB';
      this.registerError = ''; // Clear any previous errors
    }
  }

  // Remove alumni ID file
  removeAlumniIdFile() {
    this.alumniIdFile = null;
    this.alumniIdFileName = '';
    this.alumniIdFileSize = '';
    // Clear the file input
    const fileInput = document.getElementById('alumniIdInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }
}
