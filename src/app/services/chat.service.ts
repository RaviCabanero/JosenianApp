import { Injectable } from '@angular/core';
import {
  Firestore, collection, doc, setDoc, getDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot, serverTimestamp, increment
} from 'firebase/firestore';
import { FirebaseService } from './firebase.service';

export interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: Date;
  isRead: boolean;
}

export interface ConversationItem {
  id: string;
  otherUid: string;
  otherName: string;
  otherAvatar: string;
  lastMessage: string;
  lastMessageAt: Date | null;
  unreadCount: number;
  hasConversation: boolean;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private db: Firestore;

  constructor(private firebaseService: FirebaseService) {
    this.db = this.firebaseService.getFirestore();
  }

  /** Stable deterministic ID for a 1-on-1 conversation */
  getConversationId(uid1: string, uid2: string): string {
    return [uid1, uid2].sort().join('_');
  }

  /** Ensures a conversation document exists and returns its ID */
  async getOrCreateConversation(currentUid: string, otherUid: string): Promise<string> {
    const convId = this.getConversationId(currentUid, otherUid);
    const convRef = doc(this.db, 'conversations', convId);
    const snap = await getDoc(convRef);
    if (!snap.exists()) {
      await setDoc(convRef, {
        participants: [currentUid, otherUid],
        lastMessage: '',
        lastMessageAt: null,
        lastMessageSenderId: '',
        unreadCount: { [currentUid]: 0, [otherUid]: 0 },
        createdAt: serverTimestamp()
      });
    }
    return convId;
  }

  /** Real-time message listener for a conversation */
  subscribeToMessages(
    conversationId: string,
    callback: (messages: Message[]) => void
  ): () => void {
    const q = query(
      collection(this.db, 'conversations', conversationId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    return onSnapshot(q, snapshot => {
      const messages: Message[] = snapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          senderId: data['senderId'],
          text: data['text'],
          createdAt: data['createdAt']?.toDate?.() ?? new Date(),
          isRead: data['isRead'] ?? false
        };
      });
      callback(messages);
    });
  }

  /** Send a message and update the conversation's last-message metadata */
  async sendMessage(
    conversationId: string,
    senderId: string,
    recipientId: string,
    text: string
  ): Promise<void> {
    await addDoc(
      collection(this.db, 'conversations', conversationId, 'messages'),
      { senderId, text, createdAt: serverTimestamp(), isRead: false }
    );
    await updateDoc(doc(this.db, 'conversations', conversationId), {
      lastMessage: text,
      lastMessageAt: serverTimestamp(),
      lastMessageSenderId: senderId,
      [`unreadCount.${recipientId}`]: increment(1)
    });
    await this.createMessageNotification(recipientId, senderId, text);
  }

  private async createMessageNotification(
    recipientId: string,
    senderId: string,
    messagePreview: string
  ): Promise<void> {
    try {
      const preview = messagePreview.length > 60
        ? messagePreview.slice(0, 57) + '...'
        : messagePreview;
      await addDoc(collection(this.db, 'users', recipientId, 'notifications'), {
        title: 'New Message',
        message: preview,
        type: 'message',
        redirectLink: `/chat/${senderId}`,
        createdAt: new Date().toISOString(),
        read: false
      });
    } catch (err) {
      console.error('Error creating message notification:', err);
    }
  }

  /** Delete a conversation document for both users */
  async deleteConversation(conversationId: string): Promise<void> {
    await deleteDoc(doc(this.db, 'conversations', conversationId));
  }

  /** Reset unread count to 0 for the current user */
  async markAsRead(conversationId: string, currentUid: string): Promise<void> {
    try {
      await updateDoc(doc(this.db, 'conversations', conversationId), {
        [`unreadCount.${currentUid}`]: 0
      });
    } catch (err) {
      console.error('Error marking conversation as read:', err);
    }
  }

  /** Real-time listener for all conversations a user participates in */
  subscribeToConversations(
    currentUid: string,
    callback: (items: any[]) => void
  ): () => void {
    const q = query(
      collection(this.db, 'conversations'),
      where('participants', 'array-contains', currentUid)
    );
    return onSnapshot(q, snapshot => {
      callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }

  /** Real-time total unread chat count across all conversations */
  subscribeToUnreadChatCount(
    currentUid: string,
    callback: (count: number) => void
  ): () => void {
    const q = query(
      collection(this.db, 'conversations'),
      where('participants', 'array-contains', currentUid)
    );
    return onSnapshot(q, snapshot => {
      let total = 0;
      snapshot.docs.forEach(d => {
        total += d.data()['unreadCount']?.[currentUid] ?? 0;
      });
      callback(total);
    });
  }
}
