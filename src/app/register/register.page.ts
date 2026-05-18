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
  userType: 'alumni' = 'alumni';
  firstName: string = '';
  middleName: string = '';
  lastName: string = '';
  email: string = '';
  password: string = '';
  confirmPassword: string = '';
  studentNumber: string = '';
  department: string = '';
  course: string = '';
  graduationYear: string = '';
  birthdate: string = '';

  // UI state
  showPassword: boolean = false;
  showConfirmPassword: boolean = false;
  isLoading: boolean = false;
  registerError: string = '';

  // Department list (loaded from Firestore dynamically)
  departments: any[] = [];
  courses: string[] = [];
  isLoadingDepts: boolean = false;

  constructor(private router: Router, private authService: AuthService) {}

  ngOnInit() {
    this.loadDepartments();
  }

  async loadDepartments() {
    try {
      this.isLoadingDepts = true;
      this.departments = await this.authService.getDepartments();
      this.isLoadingDepts = false;
    } catch (error) {
      console.error('Error loading departments:', error);
      this.isLoadingDepts = false;
    }
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  async onDepartmentChange(event: any) {
    this.department = event.detail.value;
    this.course = '';
    const selectedDept = this.departments.find(d => d.id === this.department);
    if (selectedDept) {
      const disabled: string[] = selectedDept.disabledCourses || [];
      this.courses = (selectedDept.courses || []).filter((c: string) => !disabled.includes(c));
    } else {
      this.courses = [];
    }
  }

  async register() {
    this.registerError = '';

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

    if (!this.studentNumber.trim()) {
      this.registerError = 'Please enter your student number';
      return;
    }
    if (!/^\d{10}$/.test(this.studentNumber)) {
      this.registerError = 'Student number must be exactly 10 digits';
      return;
    }

    if (!this.course.trim()) {
      this.registerError = 'Please enter your course';
      return;
    }

    if (!this.graduationYear) {
      this.registerError = 'Please enter your graduation year';
      return;
    }

    if (!this.birthdate) {
      this.registerError = 'Please enter your birthdate';
      return;
    }

    this.isLoading = true;

    try {
      const profileData: any = {
        firstName: this.firstName,
        middleName: this.middleName,
        lastName: this.lastName,
        userType: this.userType,
        studentNumber: this.studentNumber,
        department: this.department,
        course: this.course,
        graduationYear: this.graduationYear,
        birthdate: this.birthdate,
        status: 'pending',
        alumniIdVerificationStatus: 'unverified',
      };

      await this.authService.registerWithProfile(
        this.email,
        this.password,
        profileData
      );

      this.isLoading = false;
      alert('Registration successful! Your account is under review by the admin. Please check back later to login.');
      this.router.navigate(['/login']);
    } catch (error: any) {
      this.isLoading = false;
      this.registerError = error.message || 'Registration failed';
      console.error('Registration error:', error);
    }
  }

  navigateToLogin() {
    this.router.navigate(['/login']);
  }

  handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.register();
    }
  }

  onStudentNumberInput(event: any) {
    let value = event.target.value;
    value = value.replace(/[^0-9]/g, '');
    this.studentNumber = value;
    event.target.value = value;
  }

  capitalizeFirstLetter(value: string): string {
    if (!value) return '';
    return value.split(' ').map(word =>
      word ? word.charAt(0).toUpperCase() + word.slice(1) : ''
    ).join(' ');
  }

  onFirstNameInput(event: any) {
    this.firstName = this.capitalizeFirstLetter(event.target.value);
  }

  onLastNameInput(event: any) {
    this.lastName = this.capitalizeFirstLetter(event.target.value);
  }

  onMiddleNameInput(event: any) {
    this.middleName = this.capitalizeFirstLetter(event.target.value);
  }
}
