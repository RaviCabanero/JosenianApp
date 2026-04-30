import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private auth: Auth;
  private firestore: Firestore;
  private storage: FirebaseStorage;

  constructor() {
    try {
      // Initialize Firebase
      console.log('Initializing Firebase with config:', environment.firebase);
      const app = initializeApp(environment.firebase);
      console.log('Firebase app initialized:', app.name);
      
      this.auth = getAuth(app);
      console.log('Firebase Auth initialized');
      
      this.firestore = getFirestore(app);
      console.log('Firestore initialized');
      
      this.storage = getStorage(app);
      console.log('Firebase Storage initialized');
    } catch (error) {
      console.error('Firebase initialization error:', error);
      throw error;
    }
  }

  // Get Auth instance
  getAuth(): Auth {
    return this.auth;
  }

  // Get Firestore instance
  getFirestore(): Firestore {
    return this.firestore;
  }

  // Get Storage instance
  getStorage(): FirebaseStorage {
    return this.storage;
  }
}
