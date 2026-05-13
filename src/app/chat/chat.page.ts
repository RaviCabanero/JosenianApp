import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { ChatService, Message } from '../services/chat.service';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.page.html',
  styleUrls: ['./chat.page.scss'],
  standalone: false,
})
export class ChatPage implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesList') messagesList!: ElementRef;

  otherUid = '';
  otherUser = { name: 'Loading...', avatar: '?' };
  messages: Message[] = [];
  newMessage = '';
  conversationId = '';
  currentUid = '';
  isLoading = true;
  isSending = false;
  private msgUnsubscribe: (() => void) | null = null;
  private shouldScroll = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private chatService: ChatService
  ) {}

  ngOnInit() {
    this.otherUid = this.route.snapshot.paramMap.get('uid') || '';

    this.authService.currentUser$.pipe(
      filter(user => !!user),
      take(1)
    ).subscribe(async user => {
      if (!user) { this.router.navigate(['/login']); return; }
      this.currentUid = user.uid;
      await this.loadOtherUser();
      this.conversationId = await this.chatService.getOrCreateConversation(this.currentUid, this.otherUid);
      await this.chatService.markAsRead(this.conversationId, this.currentUid);
      this.subscribeToMessages();
      this.isLoading = false;
    });
  }

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  ngOnDestroy() {
    this.msgUnsubscribe?.();
  }

  private async loadOtherUser() {
    try {
      const profile = await this.authService.getUserProfile(this.otherUid);
      if (profile) {
        const firstName = profile['firstName'] || '';
        const lastName = profile['lastName'] || '';
        this.otherUser = {
          name: `${firstName} ${lastName}`.trim() || profile['email'] || 'User',
          avatar: firstName.charAt(0).toUpperCase() || '?'
        };
      }
    } catch (err) {
      console.error('Error loading user profile:', err);
    }
  }

  private subscribeToMessages() {
    this.msgUnsubscribe = this.chatService.subscribeToMessages(this.conversationId, messages => {
      this.messages = messages;
      this.shouldScroll = true;
      this.chatService.markAsRead(this.conversationId, this.currentUid);
    });
  }

  async sendMessage() {
    const text = this.newMessage.trim();
    if (!text || !this.conversationId || this.isSending) return;
    this.newMessage = '';
    this.isSending = true;
    try {
      await this.chatService.sendMessage(this.conversationId, this.currentUid, this.otherUid, text);
    } finally {
      this.isSending = false;
    }
  }

  handleEnter(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  private scrollToBottom() {
    try {
      const el = this.messagesList?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }

  formatTime(date: Date): string {
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  formatDate(date: Date): string {
    if (!date) return '';
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - new Date(date).getTime()) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  isSameDay(a: Date, b: Date): boolean {
    return new Date(a).toDateString() === new Date(b).toDateString();
  }

  goBack() {
    this.router.navigate(['/messages']);
  }

  viewProfile() {
    this.router.navigate(['/user-profile', this.otherUid]);
  }
}
