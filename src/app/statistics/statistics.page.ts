import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-statistics',
  templateUrl: './statistics.page.html',
  styleUrls: ['./statistics.page.scss'],
  standalone: false
})
export class StatisticsPage implements OnInit {

  stats = {
    engagement: 89,
    activeUsers: 234,
    totalInteractions: 1250,
    growthRate: 12.5,
    retention: 78,
    satisfaction: 4.5
  };

  monthlyData = [
    { month: 'Jan', value: 65 },
    { month: 'Feb', value: 72 },
    { month: 'Mar', value: 78 },
    { month: 'Apr', value: 85 },
    { month: 'May', value: 89 },
    { month: 'Jun', value: 92 }
  ];

  categories = [
    { name: 'Events Attended', value: 12, color: 'primary' },
    { name: 'Posts Made', value: 28, color: 'secondary' },
    { name: 'Connections', value: 156, color: 'tertiary' },
    { name: 'Profile Views', value: 45, color: 'success' },
  ];

  constructor(private router: Router) {}

  ngOnInit() {}

  goBack() {
    this.router.navigate(['/home']);
  }

  getChartHeight(value: number): string {
    const maxValue = Math.max(...this.monthlyData.map(m => m.value));
    const height = (value / maxValue) * 150;
    return `${height}px`;
  }
}
