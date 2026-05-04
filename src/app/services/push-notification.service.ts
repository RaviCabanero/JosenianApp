import { Injectable } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

@Injectable({ providedIn: 'root' })
export class PushNotificationService {

  async requestPermissions(): Promise<void> {
    const { display } = await LocalNotifications.requestPermissions();
    if (display !== 'granted') {
      console.warn('Notification permission not granted');
    }
  }

  async initChannel(): Promise<void> {
    await LocalNotifications.createChannel({
      id: 'josenian-notifications',
      name: 'JosenianLink Notifications',
      description: 'App notifications',
      importance: 5,
      vibration: true,
      sound: 'default',
    });
  }

  async showNotification(title: string, body: string): Promise<void> {
    await Haptics.impact({ style: ImpactStyle.Medium });
    await LocalNotifications.schedule({
      notifications: [{
        id: Date.now(),
        title,
        body,
        channelId: 'josenian-notifications',
        schedule: { at: new Date(Date.now() + 100) },
      }]
    });
  }

  async vibrate(): Promise<void> {
    await Haptics.impact({ style: ImpactStyle.Medium });
  }
}
