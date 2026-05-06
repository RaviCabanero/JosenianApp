import { Component } from '@angular/core';
import { PushNotificationService } from './services/push-notification.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  constructor(private pushNotificationService: PushNotificationService) {
    this.pushNotificationService.requestPermissions();
    this.pushNotificationService.initChannel();
  }
}
