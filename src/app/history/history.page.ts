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
  activeFilter: 'all' | 'global' | 'department' = 'all';
  isLoading = false;
  departmentMap: Record<string, string> = {};

  constructor(private router: Router, private authService: AuthService) {}

  ngOnInit() {
    this.loadEvents();
  }

  async loadEvents() {
    this.isLoading = true;
    try {
      const user = this.authService.getCurrentUser();
      if (!user) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const depts = await this.authService.getDepartments();
      depts.forEach((d: any) => { this.departmentMap[d.id] = d.name; });

      const allGlobal = await this.authService.getEvents();
      const joinedGlobal = allGlobal
        .filter(e => (e.attendees || []).includes(user.uid) && e.date && new Date(e.date + 'T00:00:00') < today)
        .map(e => ({ ...e, source: 'global' }));

      const profile = await this.authService.getUserProfile(user.uid);
      const deptIds: string[] = [];
      if (profile?.department) deptIds.push(profile.department);
      (profile?.followedDepartments || []).forEach((id: string) => {
        if (!deptIds.includes(id)) deptIds.push(id);
      });

      const deptEventArrays = await Promise.all(
        deptIds.map(deptId =>
          this.authService.getDepartmentEvents(deptId).then(evts =>
            evts
              .filter(e => (e.attendees || []).includes(user.uid) && e.date && new Date(e.date + 'T00:00:00') < today)
              .map(e => ({ ...e, source: 'department', departmentId: deptId }))
          )
        )
      );

      this.events = [...joinedGlobal, ...deptEventArrays.flat()]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      this.applyFilter();
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      this.isLoading = false;
    }
  }

  applyFilter() {
    this.filteredEvents = this.activeFilter === 'all'
      ? this.events
      : this.events.filter(e => e.source === this.activeFilter);
  }

  setFilter(filter: 'all' | 'global' | 'department') {
    this.activeFilter = filter;
    this.applyFilter();
  }

  get globalCount(): number { return this.events.filter(e => e.source === 'global').length; }
  get deptCount(): number   { return this.events.filter(e => e.source === 'department').length; }

  getDeptName(id: string): string {
    return this.departmentMap[id] || 'Department';
  }

  getEventIcon(event: any): string {
    const icons: Record<string, string> = {
      academic: 'school-outline', seminar: 'mic-outline', workshop: 'construct-outline',
      social: 'people-outline', sports: 'football-outline', meeting: 'people-outline',
      fair: 'briefcase-outline', other: 'calendar-outline'
    };
    return icons[event.type] || 'calendar-outline';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  goBack() {
    this.router.navigate(['/home']);
  }
}
