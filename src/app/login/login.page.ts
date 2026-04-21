import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage implements OnInit {
  // Form state
  username: string = '';
  password: string = '';
  showPassword: boolean = false;
  isLoading: boolean = false;
  loginError: string = '';

  constructor(private router: Router, private authService: AuthService) {}

  ngOnInit() {}

  // Toggle password visibility
  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  // Login handler with Firebase Authentication
  async login() {
    this.loginError = '';

    // Validation
    if (!this.username.trim()) {
      this.loginError = 'Please enter your email';
      return;
    }

    if (!this.password.trim()) {
      this.loginError = 'Please enter your password';
      return;
    }

    if (this.password.length < 6) {
      this.loginError = 'Password must be at least 6 characters';
      return;
    }

    this.isLoading = true;

    try {
      // Call Firebase authentication
      await this.authService.login(this.username, this.password);
      
      console.log('Login successful:', this.username);
      
      // Check if user is admin
      const isAdmin = await this.authService.isAdmin();
      
      this.isLoading = false;
      this.username = '';
      this.password = '';
      
      // Navigate to admin page if admin, otherwise to home page
      if (isAdmin) {
        console.log('Admin user detected, redirecting to admin panel');
        this.router.navigate(['/admin']);
      } else {
        console.log('Regular user detected, redirecting to home');
        this.router.navigate(['/home']);
      }
    } catch (error: any) {
      this.isLoading = false;
      console.error('Login error:', error);
      this.loginError = error.message || 'Login failed. Please try again.';
    }
  }

  // Navigate to register page
  navigateToRegister() {
    this.router.navigate(['/register']);
  }

  // Handle Enter key press
  handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.login();
    }
  }
}
