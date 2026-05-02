import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-history',
  templateUrl: './history.page.html',
  styleUrls: ['./history.page.scss'],
  standalone: false
})
export class HistoryPage implements OnInit {

  events: any[] = [];
  filteredEvents: any[] = [];
  selectedType: string = 'all';
  isLoading: boolean = false;

  eventTypeColors: { [key: string]: string } = {
    seminar:  'primary',
    event:    'secondary',
    meeting:  'tertiary',
    workshop: 'success',
    social:   'warning',
    fair:     'danger'
  };

  constructor(private router: Router, private authService: AuthService) {}

  ngOnInit() {
    this.loadEvents();
  }

  async loadEvents() {
    this.isLoading = true;
    try {
      this.events = await this.authService.getEvents();
      this.applyFilter();
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      this.isLoading = false;
    }
  }

  applyFilter() {
    this.filteredEvents = this.selectedType === 'all'
      ? this.events
      : this.events.filter(e => e.type === this.selectedType);
  }

  onTypeChange(event: any) {
    this.selectedType = event.detail.value || 'all';
    this.applyFilter();
  }

  getUniqueTypes(): string[] {
    return Array.from(new Set(this.events.map(e => e.type).filter(Boolean))) as string[];
  }

  goBack() {
    this.router.navigate(['/home']);
  }

  getEventIcon(type: string): string {
    const icons: { [key: string]: string } = {
      seminar:  'school',
      event:    'calendar',
      meeting:  'people',
      workshop: 'laptop',
      social:   'beer',
      fair:     'briefcase'
    };
    return icons[type] || 'calendar';
  }

  viewEventDetails(eventId: string) {
    console.log('View event details:', eventId);
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }
}
