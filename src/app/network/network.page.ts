import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-network',
  templateUrl: './network.page.html',
  styleUrls: ['./network.page.scss'],
  standalone: false
})
export class NetworkPage implements OnInit {

  connections = [
    { id: 1, name: 'Alice Johnson', role: 'Software Engineer', mutualConnections: 12 },
    { id: 2, name: 'Bob Smith', role: 'Product Manager', mutualConnections: 8 },
    { id: 3, name: 'Carol White', role: 'Data Scientist', mutualConnections: 15 },
    { id: 4, name: 'David Brown', role: 'UX Designer', mutualConnections: 10 },
    { id: 5, name: 'Eva Green', role: 'Project Manager', mutualConnections: 18 },
    { id: 6, name: 'Frank Lee', role: 'Developer', mutualConnections: 7 },
  ];

  networkStats = {
    totalConnections: 156,
    commonConnections: 52,
    recentAdded: 5,
  };

  constructor(private router: Router) {}

  ngOnInit() {}

  goBack() {
    this.router.navigate(['/home']);
  }

  viewConnection(connectionId: number) {
    console.log('View connection:', connectionId);
  }
}
