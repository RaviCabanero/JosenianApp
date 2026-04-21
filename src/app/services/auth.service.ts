import { Injectable } from '@angular/core';
import { FirebaseService } from './firebase.service';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  Auth,
  User,
  onAuthStateChanged,
  AuthError,
} from 'firebase/auth';
import { getDoc, setDoc, doc, Firestore, collection, query, where, getDocs, deleteDoc, updateDoc, addDoc } from 'firebase/firestore';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth: Auth;
  private firestore: Firestore;
  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser$: Observable<User | null>;

  constructor(private firebaseService: FirebaseService) {
    this.auth = firebaseService.getAuth();
    this.firestore = firebaseService.getFirestore();
    this.currentUserSubject = new BehaviorSubject<User | null>(null);
    this.currentUser$ = this.currentUserSubject.asObservable();

    // Listen to authentication state changes
    onAuthStateChanged(this.auth, (user: User | null) => {
      this.currentUserSubject.next(user);
      console.log('User auth state changed:', user?.email);
    });
  }

  // ==================== AUTHENTICATION ====================

  // Register new user with profile data
  async registerWithProfile(
    email: string,
    password: string,
    profileData: {
      firstName: string;
      lastName: string;
      userType: 'student' | 'alumni';
      studentNumber?: string;
      department: string;
      course?: string;
      graduationYear?: string;
    }
  ): Promise<any> {
    try {
      const result = await createUserWithEmailAndPassword(this.auth, email, password);
      
      // Create user profile in Firestore with all data
      await setDoc(doc(this.firestore, 'users', result.user.uid), {
        email: email,
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        userType: profileData.userType,
        studentNumber: profileData.studentNumber || '',
        department: profileData.department,
        course: profileData.course || '',
        graduationYear: profileData.graduationYear || '',
        role: 'user',
        status: 'pending', // Pending admin approval
        createdAt: new Date(),
        joinDate: new Date().toISOString().split('T')[0], // Format: YYYY-MM-DD
      });
      
      return result;
    } catch (error) {
      throw this.handleAuthError(error as AuthError);
    }
  }

  // Register new user (basic)
  async register(email: string, password: string): Promise<any> {
    try {
      const result = await createUserWithEmailAndPassword(this.auth, email, password);
      
      // Create user profile in Firestore
      await setDoc(doc(this.firestore, 'users', result.user.uid), {
        email: email,
        role: 'user', // Default role
        status: 'pending',
        createdAt: new Date(),
        displayName: '',
      });
      
      return result;
    } catch (error) {
      throw this.handleAuthError(error as AuthError);
    }
  }

  // Login user
  async login(email: string, password: string): Promise<any> {
    try {
      const result = await signInWithEmailAndPassword(this.auth, email, password);
      
      // Verify user exists and is registered
      const userDoc = await getDoc(doc(this.firestore, 'users', result.user.uid));
      if (!userDoc.exists()) {
        // User exists in Auth but not in Firestore - create profile
        await setDoc(doc(this.firestore, 'users', result.user.uid), {
          email: email,
          role: 'user',
          status: 'pending',
          createdAt: new Date(),
          displayName: '',
        });
      }
      
      return result;
    } catch (error) {
      throw this.handleAuthError(error as AuthError);
    }
  }

  // Admin login
  async adminLogin(email: string, password: string): Promise<any> {
    try {
      const result = await signInWithEmailAndPassword(this.auth, email, password);
      
      // Check if user has admin role
      const userDoc = await getDoc(doc(this.firestore, 'users', result.user.uid));
      
      if (!userDoc.exists()) {
        await signOut(this.auth);
        throw new Error('User not found in system');
      }
      
      const userData = userDoc.data();
      if (userData['role'] !== 'admin') {
        await signOut(this.auth);
        throw new Error('Unauthorized: Admin access required');
      }
      
      return result;
    } catch (error) {
      throw this.handleAuthError(error as AuthError);
    }
  }

  // ==================== USER MANAGEMENT ====================

  // Get pending users from Firestore (for admin approval)
  async getPendingUsers(): Promise<any[]> {
    try {
      const q = query(
        collection(this.firestore, 'users'),
        where('status', '==', 'pending')
      );
      
      const querySnapshot = await getDocs(q);
      const users: any[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        users.push({
          id: doc.id,
          name: `${data['firstName']} ${data['lastName']}`,
          email: data['email'],
          type: data['userType'] === 'student' ? 'Student' : 'Alumni',
          joinDate: data['joinDate'] || new Date().toISOString().split('T')[0],
          department: data['department'],
          studentNumber: data['studentNumber'] || '',
          course: data['course'] || '',
          ...data
        });
      });
      
      return users;
    } catch (error) {
      console.error('Error fetching pending users:', error);
      return [];
    }
  }

  // Approve user (update status in Firestore)
  async approveUser(userId: string): Promise<void> {
    try {
      await setDoc(doc(this.firestore, 'users', userId), {
        status: 'approved'
      }, { merge: true });
      console.log('User approved:', userId);
    } catch (error) {
      console.error('Error approving user:', error);
    }
  }

  // Reject user (update status in Firestore)
  async rejectUser(userId: string): Promise<void> {
    try {
      await setDoc(doc(this.firestore, 'users', userId), {
        status: 'rejected'
      }, { merge: true });
      console.log('User rejected:', userId);
    } catch (error) {
      console.error('Error rejecting user:', error);
    }
  }

  // ==================== DEPARTMENTS & COURSES ====================

  // Get all departments from Firestore
  async getDepartments(): Promise<any[]> {
    try {
      const querySnapshot = await getDocs(collection(this.firestore, 'departments'));
      const departments: any[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        departments.push({
          id: doc.id,
          name: data['name'],
          courses: data['courses'] || [],
          createdAt: data['createdAt']
        });
      });
      
      // Sort by name
      departments.sort((a, b) => a.name.localeCompare(b.name));
      
      return departments;
    } catch (error) {
      console.error('Error fetching departments:', error);
      return [];
    }
  }

  // Add new department to Firestore
  async addDepartment(departmentName: string): Promise<any> {
    try {
      const docRef = await addDoc(collection(this.firestore, 'departments'), {
        name: departmentName,
        courses: [],
        createdAt: new Date()
      });
      
      console.log('Department added with ID:', docRef.id);
      return {
        id: docRef.id,
        name: departmentName,
        courses: []
      };
    } catch (error) {
      console.error('Error adding department:', error);
      throw error;
    }
  }

  // Delete department from Firestore
  async deleteDepartment(departmentId: string): Promise<void> {
    try {
      await deleteDoc(doc(this.firestore, 'departments', departmentId));
      console.log('Department deleted:', departmentId);
    } catch (error) {
      console.error('Error deleting department:', error);
      throw error;
    }
  }

  // Add course to a department
  async addCourse(departmentId: string, courseName: string): Promise<void> {
    try {
      const deptRef = doc(this.firestore, 'departments', departmentId);
      const deptDoc = await getDoc(deptRef);
      
      if (deptDoc.exists()) {
        const courses = deptDoc.data()['courses'] || [];
        courses.push(courseName);
        
        await updateDoc(deptRef, {
          courses: courses
        });
        console.log('Course added to department:', departmentId);
      }
    } catch (error) {
      console.error('Error adding course:', error);
      throw error;
    }
  }

  // Delete course from a department
  async deleteCourse(departmentId: string, courseIndex: number): Promise<void> {
    try {
      const deptRef = doc(this.firestore, 'departments', departmentId);
      const deptDoc = await getDoc(deptRef);
      
      if (deptDoc.exists()) {
        const courses = deptDoc.data()['courses'] || [];
        courses.splice(courseIndex, 1);
        
        await updateDoc(deptRef, {
          courses: courses
        });
        console.log('Course deleted from department:', departmentId);
      }
    } catch (error) {
      console.error('Error deleting course:', error);
      throw error;
    }
  }

  // Get courses for a specific department
  async getCoursesByDepartment(departmentId: string): Promise<string[]> {
    try {
      const deptDoc = await getDoc(doc(this.firestore, 'departments', departmentId));
      if (deptDoc.exists()) {
        return deptDoc.data()['courses'] || [];
      }
      return [];
    } catch (error) {
      console.error('Error fetching courses:', error);
      return [];
    }
  }

  // ==================== ADMIN CHECKS ====================

  // Check if current user is admin
  async isAdmin(): Promise<boolean> {
    const user = this.currentUserSubject.value;
    if (!user) return false;
    
    try {
      const userDoc = await getDoc(doc(this.firestore, 'users', user.uid));
      return userDoc.exists() && userDoc.data()['role'] === 'admin';
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  }

  // Get user role
  async getUserRole(uid: string): Promise<string> {
    try {
      const userDoc = await getDoc(doc(this.firestore, 'users', uid));
      return userDoc.exists() ? userDoc.data()['role'] : 'user';
    } catch (error) {
      console.error('Error getting user role:', error);
      return 'user';
    }
  }

  // ==================== AUTH STATE ====================

  // Logout user
  async logout(): Promise<void> {
    return signOut(this.auth);
  }

  // Get current user
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  // Check if user is logged in
  isLoggedIn(): boolean {
    return this.currentUserSubject.value !== null;
  }

  // ==================== ERROR HANDLING ====================

  // Handle Firebase auth errors
  private handleAuthError(error: AuthError): Error {
    console.error('Auth error:', error.code);
    
    switch (error.code) {
      case 'auth/user-not-found':
        return new Error('Account not registered. Please sign up first.');
      case 'auth/wrong-password':
        return new Error('Invalid password. Please try again.');
      case 'auth/invalid-email':
        return new Error('Invalid email format.');
      case 'auth/user-disabled':
        return new Error('This account has been disabled.');
      case 'auth/too-many-requests':
        return new Error('Too many login attempts. Please try again later.');
      case 'auth/email-already-in-use':
        return new Error('Email already registered. Please login or use a different email.');
      default:
        return new Error(error.message || 'Authentication failed');
    }
  }
}
