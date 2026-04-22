import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-messages',
  templateUrl: './messages.page.html',
  styleUrls: ['./messages.page.scss'],
  standalone: false,
})
export class MessagesPage implements OnInit {
  searchQuery = '';
  
  // Chat conversations
  conversations = [
    {
      id: 1,
      name: 'John Doe',
      role: 'Department Head',
      avatar: 'JD',
      lastMessage: 'Thanks for your feedback on the project',
      timestamp: '2 minutes ago',
      unread: 2,
      online: true,
    },
    {
      id: 2,
      name: 'Sarah Johnson',
      role: 'Colleague',
      avatar: 'SJ',
      lastMessage: 'Let\'s meet tomorrow to discuss',
      timestamp: '15 minutes ago',
      unread: 0,
      online: true,
    },
    {
      id: 3,
      name: 'Mike Chen',
      role: 'Team Lead',
      avatar: 'MC',
      lastMessage: 'The report is ready for review',
      timestamp: '1 hour ago',
      unread: 1,
      online: false,
    },
    {
      id: 4,
      name: 'Emily Rodriguez',
      role: 'Colleague',
      avatar: 'ER',
      lastMessage: 'See you at the conference next week',
      timestamp: '3 hours ago',
      unread: 0,
      online: true,
    },
    {
      id: 5,
      name: 'David Park',
      role: 'Senior Advisor',
      avatar: 'DP',
      lastMessage: 'Great work on the presentation',
      timestamp: 'Yesterday',
      unread: 0,
      online: false,
    },
    {
      id: 6,
      name: 'Lisa Wang',
      role: 'Colleague',
      avatar: 'LW',
      lastMessage: 'Thanks for sharing the document',
      timestamp: 'Yesterday',
      unread: 0,
      online: true,
    },
  ];

  filteredConversations = this.conversations;

  constructor(private router: Router) {}

  ngOnInit() {
  }

  goBack() {
    this.router.navigate(['/home']);
  }

  openChat(conversationId: number) {
    // Navigate to chat detail page when ready
    console.log('Opening chat:', conversationId);
  }

  onSearchChange(event: any) {
    const query = event.detail.value.toLowerCase();
    this.filteredConversations = this.conversations.filter(conv =>
      conv.name.toLowerCase().includes(query) ||
      conv.role.toLowerCase().includes(query)
    );
  }

  getTotalUnread(): number {
    return this.conversations.reduce((sum, conv) => sum + conv.unread, 0);
  }
}
