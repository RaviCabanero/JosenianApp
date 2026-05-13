import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { Auth, authState } from '@angular/fire/auth';
import { AuthService } from '../services/auth.service';
import { ChatService, ConversationItem } from '../services/chat.service';

@Component({
  selector: 'app-messages',
  templateUrl: './messages.page.html',
  styleUrls: ['./messages.page.scss'],
  standalone: false,
})
export class MessagesPage implements OnInit, OnDestroy {
  searchQuery = '';
  allItems: ConversationItem[] = [];
  filteredItems: ConversationItem[] = [];
  isLoading = true;
  private currentUserUid: string | null = null;
  private convUnsubscribe: (() => void) | null = null;

  constructor(
    private router: Router,
    private auth: Auth,
    private authService: AuthService,
    private chatService: ChatService,
    private alertCtrl: AlertController
  ) {}

  ngOnInit() {
    authState(this.auth).subscribe(async user => {
      if (!user) { this.router.navigate(['/login']); return; }
      this.currentUserUid = user.uid;
      await this.loadFriends();
    });
  }

  ngOnDestroy() {
    this.convUnsubscribe?.();
  }

  private async loadFriends() {
    if (!this.currentUserUid) return;
    this.isLoading = true;
    try {
      const profile = await this.authService.getUserProfile(this.currentUserUid);
      const friendUids: string[] = profile?.['friends'] || [];

      const allUsers = await this.authService.getAllUsers();
      const friendProfiles = allUsers.filter((u: any) => friendUids.includes(u.id));

      this.allItems = friendProfiles.map((u: any) => {
        const firstName = u.firstName || '';
        const lastName = u.lastName || '';
        return {
          id: this.chatService.getConversationId(this.currentUserUid!, u.id),
          otherUid: u.id,
          otherName: `${firstName} ${lastName}`.trim() || u.email || 'User',
          otherAvatar: firstName.charAt(0).toUpperCase() || '?',
          otherPhotoUrl: u.photoUrl || '',
          lastMessage: '',
          lastMessageAt: null,
          unreadCount: 0,
          hasConversation: false
        } as ConversationItem;
      });

      this.applyFilter();
      this.subscribeToConversations();
    } catch (err) {
      console.error('Error loading friends:', err);
    } finally {
      this.isLoading = false;
    }
  }

  private subscribeToConversations() {
    if (!this.currentUserUid) return;
    this.convUnsubscribe = this.chatService.subscribeToConversations(
      this.currentUserUid,
      (rawConvs: any[]) => {
        this.allItems = this.allItems.map(item => {
          const conv = rawConvs.find(c => c.id === item.id);
          if (!conv) return item;
          return {
            ...item,
            lastMessage: conv.lastMessage || '',
            lastMessageAt: conv.lastMessageAt?.toDate?.() ?? null,
            unreadCount: conv.unreadCount?.[this.currentUserUid!] ?? 0,
            hasConversation: !!(conv.lastMessage)
          };
        });

        this.allItems.sort((a, b) => {
          if (a.lastMessageAt && b.lastMessageAt) {
            return b.lastMessageAt.getTime() - a.lastMessageAt.getTime();
          }
          if (a.lastMessageAt) return -1;
          if (b.lastMessageAt) return 1;
          return a.otherName.localeCompare(b.otherName);
        });

        this.applyFilter();
      }
    );
  }

  private applyFilter() {
    const q = this.searchQuery.toLowerCase();
    this.filteredItems = q
      ? this.allItems.filter(i => i.otherName.toLowerCase().includes(q))
      : [...this.allItems];
  }

  onSearchChange(event: any) {
    this.searchQuery = event.detail.value || '';
    this.applyFilter();
  }

  openChat(otherUid: string) {
    this.router.navigate(['/chat', otherUid]);
  }

  formatTime(date: Date | null): string {
    if (!date) return '';
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
    if (diffDays === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  async removeConversation(item: ConversationItem) {
    const alert = await this.alertCtrl.create({
      header: 'Delete Conversation',
      message: `Delete your conversation with ${item.otherName}? This cannot be undone.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            try {
              await this.chatService.deleteConversation(item.id);
              this.allItems = this.allItems.filter(i => i.id !== item.id);
              this.applyFilter();
            } catch (err) {
              console.error('Error deleting conversation:', err);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async startNewConversation() {
    if (this.allItems.length === 0) {
      const alert = await this.alertCtrl.create({
        header: 'No Friends Yet',
        message: 'Connect with people in My Network to start messaging.',
        buttons: ['OK']
      });
      return alert.present();
    }
    const alert = await this.alertCtrl.create({
      header: 'New Conversation',
      inputs: this.allItems.map(item => ({
        type: 'radio' as const,
        label: item.otherName,
        value: item.otherUid
      })),
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Open',
          handler: (uid: string) => {
            if (uid) this.openChat(uid);
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
