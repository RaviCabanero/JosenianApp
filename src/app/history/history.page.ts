import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-history',
  templateUrl: './history.page.html',
  styleUrls: ['./history.page.scss'],
  standalone: false
})
export class HistoryPage implements OnInit {

  events = [
    { id: 1, title: 'Engineering Seminar', date: '2024-04-20', type: 'seminar', attendees: 45 },
    { id: 2, title: 'Networking Event', date: '2024-04-18', type: 'event', attendees: 120 },
    { id: 3, title: 'Department Meeting', date: '2024-04-15', type: 'meeting', attendees: 28 },
    { id: 4, title: 'Workshop: Python Basics', date: '2024-04-12', type: 'workshop', attendees: 65 },
    { id: 5, title: 'Social Gathering', date: '2024-04-10', type: 'social', attendees: 89 },
    { id: 6, title: 'Career Fair', date: '2024-04-05', type: 'fair', attendees: 300 },
  ];

  eventTypeColors: {[key: string]: string} = {
    seminar: 'primary',
    event: 'secondary',
    meeting: 'tertiary',
    workshop: 'success',
    social: 'warning',
    fair: 'danger'
  };

  constructor(private router: Router) {}

  ngOnInit() {}

  goBack() {
    this.router.navigate(['/home']);
  }

  getEventIcon(type: string): string {
    const icons: {[key: string]: string} = {
      seminar: 'school',
      event: 'calendar',
      meeting: 'people',
      workshop: 'laptop',
      social: 'beer',
      fair: 'briefcase'
    };
    return icons[type] || 'calendar';
  }

  viewEventDetails(eventId: number) {
    console.log('View event details:', eventId);
  }
}
