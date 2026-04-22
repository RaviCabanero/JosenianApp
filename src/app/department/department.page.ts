import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-department',
  templateUrl: './department.page.html',
  styleUrls: ['./department.page.scss'],
  standalone: false
})
export class DepartmentPage implements OnInit {

  members = [
    { id: 1, name: 'John Doe', role: 'Faculty', status: 'Active' },
    { id: 2, name: 'Jane Smith', role: 'Student', status: 'Active' },
    { id: 3, name: 'Mike Johnson', role: 'Faculty', status: 'Active' },
    { id: 4, name: 'Sarah Williams', role: 'Student', status: 'Active' },
    { id: 5, name: 'Tom Brown', role: 'Staff', status: 'Active' },
    { id: 6, name: 'Emily Davis', role: 'Student', status: 'Inactive' },
    { id: 7, name: 'Chris Wilson', role: 'Faculty', status: 'Active' },
    { id: 8, name: 'Lisa Anderson', role: 'Student', status: 'Active' },
  ];

  departmentInfo = {
    name: 'Department of Engineering',
    memberCount: 8,
    description: 'A diverse group of students, faculty, and staff working together in the engineering field.',
    established: '2015',
  };

  constructor(private router: Router) {}

  ngOnInit() {}

  goBack() {
    this.router.navigate(['/home']);
  }

  viewMemberProfile(memberId: number) {
    console.log('View profile for member:', memberId);
  }
}
