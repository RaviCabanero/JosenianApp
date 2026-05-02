import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-statistics',
  templateUrl: './statistics.page.html',
  styleUrls: ['./statistics.page.scss'],
  standalone: false
})
export class StatisticsPage implements OnInit {

  isLoading = false;

  stats = {
    totalUsers: 0,
    approvedUsers: 0,
    pendingUsers: 0,
    students: 0,
    alumni: 0,
    approvalRate: 0
  };

  // Monthly registrations (last 6 months)
  monthlyData: { month: string; value: number }[] = [];

  // Department distribution
  departments: { name: string; value: number; color: string }[] = [];

  private readonly chartColors = ['primary', 'secondary', 'tertiary', 'success', 'warning', 'danger'];

  constructor(private router: Router, private authService: AuthService) {}

  ngOnInit() {
    this.loadStats();
  }

  async loadStats() {
    this.isLoading = true;
    try {
      const allUsers = await this.authService.getAllUsers();
      const nonAdmin = allUsers.filter((u: any) => u.role !== 'admin');

      this.stats.totalUsers    = nonAdmin.length;
      this.stats.approvedUsers = nonAdmin.filter((u: any) => u.status === 'approved').length;
      this.stats.pendingUsers  = nonAdmin.filter((u: any) => u.status === 'pending').length;
      this.stats.students      = nonAdmin.filter((u: any) => u.userType === 'student').length;
      this.stats.alumni        = nonAdmin.filter((u: any) => u.userType === 'alumni').length;
      this.stats.approvalRate  = this.stats.totalUsers > 0
        ? Math.round((this.stats.approvedUsers / this.stats.totalUsers) * 100)
        : 0;

      this.buildMonthlyData(nonAdmin);
      this.buildDepartmentData(nonAdmin);
    } catch (error) {
      console.error('Error loading statistics:', error);
    } finally {
      this.isLoading = false;
    }
  }

  private buildMonthlyData(users: any[]) {
    const now = new Date();
    const months: { month: string; value: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('default', { month: 'short' });
      const count = users.filter((u: any) => {
        const created = u.createdAt?.toDate?.() || (u.createdAt ? new Date(u.createdAt) : null);
        if (!created) return false;
        return created.getFullYear() === d.getFullYear() && created.getMonth() === d.getMonth();
      }).length;
      months.push({ month: label, value: count });
    }
    this.monthlyData = months;
  }

  private buildDepartmentData(users: any[]) {
    const deptMap: { [key: string]: number } = {};
    users.forEach((u: any) => {
      const dept = u.department || 'Unassigned';
      deptMap[dept] = (deptMap[dept] || 0) + 1;
    });
    this.departments = Object.entries(deptMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([name, value], i) => ({ name, value, color: this.chartColors[i % this.chartColors.length] }));
  }

  getChartHeight(value: number): string {
    const max = Math.max(...this.monthlyData.map(m => m.value), 1);
    return `${Math.round((value / max) * 150)}px`;
  }

  goBack() {
    this.router.navigate(['/home']);
  }
}
