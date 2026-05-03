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
      alumniIdBase64?: string;
      alumniIdFileName?: string;
      alumniIdVerificationStatus?: string;
    }
  ): Promise<any> {
    try {
      const result = await createUserWithEmailAndPassword(this.auth, email, password);

      const userData: any = {
        email: email,
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        userType: profileData.userType,
        studentNumber: profileData.studentNumber || '',
        department: profileData.department,
        course: profileData.course || '',
        graduationYear: profileData.graduationYear || '',
        role: 'user',
        status: 'pending',
        createdAt: new Date(),
        joinDate: new Date().toISOString().split('T')[0],
      };

      if (profileData.alumniIdBase64) {
        userData.alumniIdBase64 = profileData.alumniIdBase64;
        userData.alumniIdFileName = profileData.alumniIdFileName || '';
        userData.alumniIdVerificationStatus = profileData.alumniIdVerificationStatus || 'pending';
      }

      // Create user profile in Firestore with all data
      await setDoc(doc(this.firestore, 'users', result.user.uid), userData);

      // Automatically add user as member to their selected department
      await this.addMemberToDepartment(
        profileData.department,
        result.user.uid,
        {
          name: `${profileData.firstName} ${profileData.lastName}`,
          email: email,
          userType: profileData.userType,
          role: profileData.userType === 'student' ? 'student' : 'alumni',
          studentNumber: profileData.studentNumber || '',
          course: profileData.course || '',
          joinedDate: new Date().toISOString().split('T')[0],
        }
      );
      
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
      
      // Check user status
      const userData = userDoc.exists() ? userDoc.data() : await getDoc(doc(this.firestore, 'users', result.user.uid)).then(d => d.data());
      const userStatus = userData?.['status'] || 'pending';
      
      if (userStatus === 'pending') {
        await signOut(this.auth);
        throw new Error('Your account is pending admin approval. Please check back later.');
      }
      
      if (userStatus === 'rejected') {
        await signOut(this.auth);
        throw new Error('Your account registration was not approved. Please contact the administrator.');
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

  // Get all users (for statistics)
  async getAllUsers(): Promise<any[]> {
    try {
      const q = query(collection(this.firestore, 'users'));
      const querySnapshot = await getDocs(q);
      const users: any[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        users.push({
          id: doc.id,
          status: data['status'] || 'pending',
          ...data
        });
      });
      
      return users;
    } catch (error) {
      console.error('Error fetching all users:', error);
      return [];
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
          members: data['members'] || [],
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
        members: [],
        createdAt: new Date()
      });
      
      console.log('Department added with ID:', docRef.id);
      return {
        id: docRef.id,
        name: departmentName,
        courses: [],
        members: []
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

  // Add member to a department
  async addMemberToDepartment(
    departmentId: string,
    userId: string,
    memberData: {
      name: string;
      email: string;
      userType: 'student' | 'alumni';
      role: 'student' | 'alumni';
      studentNumber?: string;
      course?: string;
      joinedDate: string;
    }
  ): Promise<void> {
    try {
      const deptRef = doc(this.firestore, 'departments', departmentId);
      const deptDoc = await getDoc(deptRef);
      
      if (deptDoc.exists()) {
        const members = deptDoc.data()['members'] || [];
        
        // Check if user is already a member
        const memberExists = members.some((m: any) => m.userId === userId);
        
        if (!memberExists) {
          members.push({
            userId: userId,
            name: memberData.name,
            email: memberData.email,
            userType: memberData.userType,
            role: memberData.role,
            studentNumber: memberData.studentNumber || '',
            course: memberData.course || '',
            joinedDate: memberData.joinedDate,
          });
          
          await updateDoc(deptRef, { members: members });
          console.log('User added as member to department:', departmentId);
        }
      } else {
        console.warn('Department not found:', departmentId);
      }
    } catch (error) {
      console.error('Error adding member to department:', error);
      throw error;
    }
  }

  // Get members of a department
  async getDepartmentMembers(departmentId: string): Promise<any[]> {
    try {
      const deptDoc = await getDoc(doc(this.firestore, 'departments', departmentId));
      if (deptDoc.exists()) {
        return deptDoc.data()['members'] || [];
      }
      return [];
    } catch (error) {
      console.error('Error fetching department members:', error);
      return [];
    }
  }

  // Remove member from department
  async removeMemberFromDepartment(departmentId: string, userId: string): Promise<void> {
    try {
      const deptRef = doc(this.firestore, 'departments', departmentId);
      const deptDoc = await getDoc(deptRef);
      
      if (deptDoc.exists()) {
        const members = deptDoc.data()['members'] || [];
        const filteredMembers = members.filter((m: any) => m.userId !== userId);
        
        await updateDoc(deptRef, { members: filteredMembers });
        console.log('User removed from department:', departmentId);
      }
    } catch (error) {
      console.error('Error removing member from department:', error);
      throw error;
    }
  }

  // ==================== ADMIN CHECKS ====================

  // ==================== ALUMNI MANAGEMENT ====================

  // Get alumni and student records for the admin management list
  async getAlumni(): Promise<any[]> {
    try {
      const alumniList: any[] = [];
      
      // Fetch registered student and alumni users from the users collection
      const q = query(collection(this.firestore, 'users'));
      
      const querySnapshot = await getDocs(q);
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const userType = data['userType'];
        if (userType !== 'student' && userType !== 'alumni') return;

        alumniList.push({
          id: doc.id,
          studentNumber: data['studentNumber'] || '',
          name: `${data['firstName'] || ''} ${data['lastName'] || ''}`.trim(),
          email: data['email'] || '',
          department: data['department'] || '',
          course: data['course'] || '',
          batch: data['graduationYear'] || '',
          userType,
          status: data['status'],
          role: data['role'] || 'user',
          createdAt: data['createdAt'],
          source: 'registered'
        });
      });
      
      // Also fetch manually managed alumni from the alumni collection
      try {
        const manualAlumniSnapshot = await getDocs(collection(this.firestore, 'alumni'));
        manualAlumniSnapshot.forEach((doc) => {
          const data = doc.data();
          alumniList.push({
            id: doc.id,
            studentNumber: data['studentNumber'] || '',
            name: data['name'] || '',
            email: data['email'] || '',
            department: data['department'] || '',
            course: data['course'] || '',
            batch: data['batch'] || '',
            userType: 'alumni',
            createdAt: data['createdAt'],
            source: 'manual'
          });
        });
      } catch (error) {
        // Alumni collection might not exist, that's okay
        console.log('Alumni collection not found or empty');
      }
      
      // Sort by batch (newest first), then by name
      alumniList.sort((a, b) => {
        const batchA = parseInt(a.batch) || 0;
        const batchB = parseInt(b.batch) || 0;
        const batchDiff = batchB - batchA;
        if (batchDiff !== 0) return batchDiff;
        return a.name.localeCompare(b.name);
      });
      
      return alumniList;
    } catch (error) {
      console.error('Error fetching alumni:', error);
      return [];
    }
  }

  // Add new alumni to Firestore
  async addAlumni(alumniData: any): Promise<any> {
    try {
      const docRef = await addDoc(collection(this.firestore, 'alumni'), {
        studentNumber: alumniData.studentNumber,
        name: alumniData.name,
        email: alumniData.email,
        department: alumniData.department,
        course: alumniData.course,
        batch: alumniData.batch,
        userType: 'alumni',
        createdAt: new Date()
      });
      
      console.log('Alumni added with ID:', docRef.id);
      return {
        id: docRef.id,
        ...alumniData,
        userType: 'alumni'
      };
    } catch (error) {
      console.error('Error adding alumni:', error);
      throw error;
    }
  }

  // Update alumni record in Firestore
  async updateAlumni(alumniId: string, alumniData: any): Promise<void> {
    try {
      await updateDoc(doc(this.firestore, 'alumni', alumniId), {
        studentNumber: alumniData.studentNumber,
        name: alumniData.name,
        email: alumniData.email,
        department: alumniData.department,
        course: alumniData.course,
        batch: alumniData.batch,
        updatedAt: new Date()
      });
      console.log('Alumni updated:', alumniId);
    } catch (error) {
      console.error('Error updating alumni:', error);
      throw error;
    }
  }

  // Delete alumni record from Firestore
  async deleteAlumni(alumniId: string): Promise<void> {
    try {
      await deleteDoc(doc(this.firestore, 'alumni', alumniId));
      console.log('Alumni deleted:', alumniId);
    } catch (error) {
      console.error('Error deleting alumni:', error);
      throw error;
    }
  }

  // Get alumni by search criteria
  async searchAlumni(searchTerm: string): Promise<any[]> {
    try {
      const allAlumni = await this.getAlumni();
      return allAlumni.filter(a => 
        a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.studentNumber.toLowerCase().includes(searchTerm.toLowerCase())
      );
    } catch (error) {
      console.error('Error searching alumni:', error);
      return [];
    }
  }

  // Get alumni by department
  async getAlumniByDepartment(department: string): Promise<any[]> {
    try {
      const allAlumni = await this.getAlumni();
      return allAlumni.filter(a => a.department === department);
    } catch (error) {
      console.error('Error fetching alumni by department:', error);
      return [];
    }
  }

  // Get alumni by batch
  async getAlumniByBatch(batch: string): Promise<any[]> {
    try {
      const allAlumni = await this.getAlumni();
      return allAlumni.filter(a => a.batch === batch);
    } catch (error) {
      console.error('Error fetching alumni by batch:', error);
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

  // Update user role (e.g., to HOD, admin, or user)
  async updateUserRole(uid: string, newRole: string): Promise<void> {
    try {
      await updateDoc(doc(this.firestore, 'users', uid), {
        role: newRole,
        roleUpdatedAt: new Date()
      });
      console.log('User role updated:', uid, newRole);
    } catch (error) {
      console.error('Error updating user role:', error);
      throw error;
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

  // Get user profile from Firestore
  async getUserProfile(uid: string): Promise<any> {
    try {
      const userDoc = await getDoc(doc(this.firestore, 'users', uid));
      if (userDoc.exists()) {
        return userDoc.data();
      }
      return null;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }

  // Update user profile
  async updateUserProfile(uid: string, data: any): Promise<void> {
    try {
      await updateDoc(doc(this.firestore, 'users', uid), data);
      console.log('User profile updated successfully');
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
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

  // ==================== FILE UPLOAD ====================

  // Upload alumni ID for verification - Store as base64 in Firestore
  async uploadAlumniId(file: File): Promise<string> {
    try {
      const user = this.auth.currentUser;
      
      if (!user) {
        throw new Error('No user logged in');
      }

      // Convert file to base64
      let base64Data = await this.fileToBase64(file);
      
      // Compress image if it's larger than 500KB
      if (base64Data.length > 500000) {
        console.log('Compressing large image...');
        base64Data = await this.compressImage(file);
      }

      // Validate file size (max 1MB for Firestore)
      if (base64Data.length > 1000000) {
        throw new Error('Alumni ID file too large (max 1MB after compression)');
      }

      console.log(`Alumni ID converted to base64: ${base64Data.length} bytes`);
      
      // Return base64 string (will be stored in Firestore)
      return base64Data;
    } catch (error) {
      console.error('Error processing alumni ID:', error);
      throw error;
    }
  }

  // Convert file to base64 string
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Extract base64 part (remove "data:image/...;base64," prefix)
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      };
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      reader.readAsDataURL(file);
    });
  }

  // Compress image using Canvas
  private compressImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Reduce image size
          if (width > 1200 || height > 1200) {
            const ratio = Math.min(1200 / width, 1200 / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          
          // Compress to JPEG with 0.8 quality
          const compressed = canvas.toDataURL('image/jpeg', 0.8);
          const base64 = compressed.split(',')[1] || compressed;
          resolve(base64);
        };
        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };
        img.src = reader.result as string;
      };
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      reader.readAsDataURL(file);
    });
  }

  // ==================== ALUMNI ID VERIFICATION ====================

  // Get all alumni awaiting ID verification
  async getPendingAlumniVerification() {
    try {
      const usersRef = collection(this.firestore, 'users');
      const q = query(
        usersRef,
        where('userType', '==', 'alumni'),
        where('alumniIdVerificationStatus', '==', 'pending')
      );
      const querySnapshot = await getDocs(q);
      
      const alumni: any[] = [];
      querySnapshot.forEach((doc) => {
        alumni.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return alumni;
    } catch (error) {
      console.error('Error getting pending alumni verification:', error);
      throw error;
    }
  }

  // Verify (approve or reject) alumni ID
  async verifyAlumniId(userId: string, status: 'approved' | 'rejected', rejectionReason: string = '') {
    try {
      const userRef = doc(this.firestore, 'users', userId);
      const updateData: any = {
        alumniIdVerificationStatus: status,
        alumniIdVerificationDate: new Date().toISOString()
      };

      if (status === 'rejected' && rejectionReason) {
        updateData.alumniIdRejectionReason = rejectionReason;
      }

      await updateDoc(userRef, updateData);
      console.log(`Alumni ID ${status}:`, userId);
    } catch (error) {
      console.error('Error verifying alumni ID:', error);
      throw error;
    }
  }

  // ==================== ACCOUNT APPROVAL ====================

  // Approve user account
  async approveUser(userId: string): Promise<void> {
    try {
      const userRef = doc(this.firestore, 'users', userId);
      await updateDoc(userRef, {
        status: 'approved',
        approvalDate: new Date().toISOString(),
        approvalStatus: 'approved'
      });
      
      // Create notification for user
      await this.createNotification(userId, 'Account Approved', 'Your account has been approved. You can now access all features of JosenianLink.', 'success');
      console.log('User approved:', userId);
    } catch (error) {
      console.error('Error approving user:', error);
      throw error;
    }
  }

  // Reject user account
  async rejectUser(userId: string, rejectionReason: string = ''): Promise<void> {
    try {
      const userRef = doc(this.firestore, 'users', userId);
      await updateDoc(userRef, {
        status: 'rejected',
        rejectionDate: new Date().toISOString(),
        rejectionReason: rejectionReason
      });
      
      // Create notification for user
      await this.createNotification(userId, 'Account Registration Rejected', 'Your account registration was not approved. Please ensure your information is correct or contact the administrator.', 'error');
      console.log('User rejected:', userId);
    } catch (error) {
      console.error('Error rejecting user:', error);
      throw error;
    }
  }

  // Create notification for user
  async createNotification(userId: string, title: string, message: string, type: 'success' | 'error' | 'info' | 'warning'): Promise<void> {
    try {
      const notificationsRef = collection(this.firestore, 'users', userId, 'notifications');
      await addDoc(notificationsRef, {
        title: title,
        message: message,
        type: type,
        createdAt: new Date().toISOString(),
        read: false
      });
      console.log('Notification created for user:', userId);
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  }

  // Get notifications for user
  async getNotifications(userId: string): Promise<any[]> {
    try {
      const notificationsRef = collection(this.firestore, 'users', userId, 'notifications');
      const q = query(notificationsRef);
      const querySnapshot = await getDocs(q);
      
      const notifications: any[] = [];
      querySnapshot.forEach((doc) => {
        notifications.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.error('Error getting notifications:', error);
      return [];
    }
  }

  // Mark notification as read
  async markNotificationAsRead(userId: string, notificationId: string): Promise<void> {
    try {
      const notifRef = doc(this.firestore, 'users', userId, 'notifications', notificationId);
      await updateDoc(notifRef, { read: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  // Mark all notifications as read
  async markAllNotificationsAsRead(userId: string): Promise<void> {
    try {
      const notificationsRef = collection(this.firestore, 'users', userId, 'notifications');
      const q = query(notificationsRef, where('read', '==', false));
      const snapshot = await getDocs(q);
      await Promise.all(snapshot.docs.map(d => updateDoc(d.ref, { read: true })));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }

  // Delete a notification
  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    try {
      await deleteDoc(doc(this.firestore, 'users', userId, 'notifications', notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  // ==================== EVENTS ====================

  // Get all events from Firestore
  async getEvents(): Promise<any[]> {
    try {
      const snapshot = await getDocs(collection(this.firestore, 'events'));
      return snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    } catch (error) {
      console.error('Error fetching events:', error);
      return [];
    }
  }

  async getUserPostCount(uid: string): Promise<number> {
    try {
      const snapshot = await getDocs(collection(this.firestore, `users/${uid}/posts`));
      return snapshot.size;
    } catch (error) {
      console.error('Error fetching post count:', error);
      return 0;
    }
  }

  // Add an event to Firestore
  async addEvent(eventData: { title: string; date: string; type: string; description?: string; attendees?: number }): Promise<any> {
    try {
      const docRef = await addDoc(collection(this.firestore, 'events'), {
        ...eventData,
        attendees: eventData.attendees || 0,
        createdAt: new Date()
      });
      return { id: docRef.id, ...eventData };
    } catch (error) {
      console.error('Error adding event:', error);
      throw error;
    }
  }

  // ==================== DEPARTMENT EVENTS ====================

  async getDepartmentEvents(departmentId: string): Promise<any[]> {
    try {
      const snap = await getDocs(collection(this.firestore, `departments/${departmentId}/events`));
      return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());
    } catch (error) {
      console.error('Error fetching department events:', error);
      return [];
    }
  }

  async addDepartmentEvent(departmentId: string, eventData: any): Promise<any> {
    try {
      const docRef = await addDoc(collection(this.firestore, `departments/${departmentId}/events`), {
        ...eventData,
        attendees: [],
        createdAt: new Date()
      });
      return { id: docRef.id, ...eventData, attendees: [] };
    } catch (error) {
      console.error('Error adding department event:', error);
      throw error;
    }
  }

  async updateDepartmentEvent(departmentId: string, eventId: string, data: any): Promise<void> {
    try {
      await updateDoc(doc(this.firestore, `departments/${departmentId}/events`, eventId), {
        ...data,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating department event:', error);
      throw error;
    }
  }

  async deleteDepartmentEvent(departmentId: string, eventId: string): Promise<void> {
    try {
      await deleteDoc(doc(this.firestore, `departments/${departmentId}/events`, eventId));
    } catch (error) {
      console.error('Error deleting department event:', error);
      throw error;
    }
  }

  async joinDepartmentEvent(departmentId: string, eventId: string, userId: string): Promise<void> {
    try {
      const eventRef = doc(this.firestore, `departments/${departmentId}/events`, eventId);
      const eventDoc = await getDoc(eventRef);
      if (eventDoc.exists()) {
        const attendees: string[] = eventDoc.data()['attendees'] || [];
        if (!attendees.includes(userId)) {
          attendees.push(userId);
          await updateDoc(eventRef, { attendees });
        }
      }
    } catch (error) {
      console.error('Error joining department event:', error);
      throw error;
    }
  }

  async leaveDepartmentEvent(departmentId: string, eventId: string, userId: string): Promise<void> {
    try {
      const eventRef = doc(this.firestore, `departments/${departmentId}/events`, eventId);
      const eventDoc = await getDoc(eventRef);
      if (eventDoc.exists()) {
        const attendees: string[] = (eventDoc.data()['attendees'] || []).filter((id: string) => id !== userId);
        await updateDoc(eventRef, { attendees });
      }
    } catch (error) {
      console.error('Error leaving department event:', error);
      throw error;
    }
  }

  // ==================== DEPARTMENT WALL ====================

  async getDepartmentWallPosts(departmentId: string): Promise<any[]> {
    try {
      const snap = await getDocs(collection(this.firestore, `departments/${departmentId}/wall`));
      return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => {
          const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
          const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
          return bTime - aTime;
        });
    } catch (error) {
      console.error('Error fetching wall posts:', error);
      return [];
    }
  }

  async addDepartmentWallPost(departmentId: string, postData: any): Promise<any> {
    try {
      const docRef = await addDoc(collection(this.firestore, `departments/${departmentId}/wall`), {
        ...postData,
        likes: [],
        createdAt: new Date()
      });
      return { id: docRef.id, ...postData, likes: [] };
    } catch (error) {
      console.error('Error adding wall post:', error);
      throw error;
    }
  }

  async deleteDepartmentWallPost(departmentId: string, postId: string): Promise<void> {
    try {
      await deleteDoc(doc(this.firestore, `departments/${departmentId}/wall`, postId));
    } catch (error) {
      console.error('Error deleting wall post:', error);
      throw error;
    }
  }

  async toggleDepartmentWallLike(departmentId: string, postId: string, userId: string): Promise<void> {
    try {
      const postRef = doc(this.firestore, `departments/${departmentId}/wall`, postId);
      const postDoc = await getDoc(postRef);
      if (postDoc.exists()) {
        let likes: string[] = postDoc.data()['likes'] || [];
        likes = likes.includes(userId) ? likes.filter(id => id !== userId) : [...likes, userId];
        await updateDoc(postRef, { likes });
      }
    } catch (error) {
      console.error('Error toggling wall like:', error);
      throw error;
    }
  }

  // Auto-approve user if email domain is @usj.edu.ph
  async autoApproveIfEligible(userId: string): Promise<boolean> {
    try {
      const userRef = doc(this.firestore, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) return false;
      
      const userData = userDoc.data();
      const email = userData?.['email'] || '';
      
      // Auto-approve if email ends with @usj.edu.ph
      if (email.endsWith('@usj.edu.ph')) {
        await this.approveUser(userId);
        console.log('Auto-approved user with @usj.edu.ph email:', userId);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error in auto-approval check:', error);
      return false;
    }
  }
}
