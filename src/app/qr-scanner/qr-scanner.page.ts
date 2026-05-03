import { Component, OnDestroy, NgZone, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import jsQR from 'jsqr';

type ScanStatus = 'scanning' | 'verifying' | 'success' | 'error' | 'camera-error';

@Component({
  selector: 'app-qr-scanner',
  templateUrl: './qr-scanner.page.html',
  styleUrls: ['./qr-scanner.page.scss'],
  standalone: false
})
export class QrScannerPage implements OnDestroy {
  @ViewChild('videoEl') videoElRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl') canvasElRef!: ElementRef<HTMLCanvasElement>;

  eventId = '';
  eventTitle = '';
  scanStatus: ScanStatus = 'scanning';
  resultMessage = '';
  cameraErrorMsg = '';
  scannedAt = '';
  attendedEventTitle = '';

  private stream: MediaStream | null = null;
  private animFrameId: number | null = null;
  private scanning = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ionViewDidEnter() {
    this.eventId = this.route.snapshot.queryParamMap.get('eventId') || '';
    this.eventTitle = this.route.snapshot.queryParamMap.get('eventTitle') || 'Event';
    this.scanStatus = 'scanning';
    this.cdr.detectChanges(); // force *ngIf to render the video element before accessing ViewChild
    this.startCamera();
  }

  ionViewWillLeave() {
    this.stopCamera();
  }

  ngOnDestroy() {
    this.stopCamera();
  }

  async startCamera() {
    this.stopCamera(); // release any previous stream before requesting a new one

    try {
      // Try rear-facing camera first
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } }
        });
      } catch (firstErr: any) {
        if (firstErr?.name === 'NotAllowedError') throw firstErr;
        // Rear camera unavailable — fall back to any available camera
        this.stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      const video = this.videoElRef.nativeElement;
      video.srcObject = this.stream;
      await video.play();
      this.scanning = true;
      this.scheduleScan();
    } catch (e: any) {
      this.ngZone.run(() => {
        this.scanStatus = 'camera-error';
        if (e?.name === 'NotAllowedError') {
          this.cameraErrorMsg = 'Camera permission denied. Please allow camera access in your app settings.';
        } else if (e?.name === 'NotFoundError') {
          this.cameraErrorMsg = 'No camera found on this device.';
        } else if (e?.name === 'NotReadableError') {
          this.cameraErrorMsg = 'Camera is in use by another app. Close it and tap Try Again.';
        } else {
          this.cameraErrorMsg = 'Could not start the camera. Tap Try Again.';
        }
      });
    }
  }

  private scheduleScan() {
    this.animFrameId = requestAnimationFrame(() => this.scanFrame());
  }

  private scanFrame() {
    if (!this.scanning) return;
    const video = this.videoElRef?.nativeElement;
    const canvas = this.canvasElRef?.nativeElement;
    if (!video || !canvas) { this.scheduleScan(); return; }

    if (video.readyState < video.HAVE_ENOUGH_DATA) {
      this.scheduleScan();
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert'
    });

    if (code?.data) {
      this.scanning = false;
      this.stopCamera();
      this.ngZone.run(() => this.handleScannedData(code.data));
      return;
    }

    this.scheduleScan();
  }

  private async handleScannedData(raw: string) {
    // Expected: josenianlink::EVENTID::TOKEN
    const parts = raw.split('::');
    if (parts.length !== 3 || parts[0] !== 'josenianlink') {
      this.scanStatus = 'error';
      this.resultMessage = 'Invalid QR code. Please scan the JosenianLink event QR code displayed at the venue.';
      return;
    }

    const [, scannedEventId, token] = parts;

    if (this.eventId && scannedEventId !== this.eventId) {
      this.scanStatus = 'error';
      this.resultMessage = 'This QR code belongs to a different event. Please scan the correct QR code.';
      return;
    }

    this.scanStatus = 'verifying';

    const user = this.authService.getCurrentUser();
    if (!user) {
      this.scanStatus = 'error';
      this.resultMessage = 'You must be logged in to record attendance.';
      return;
    }

    const result = await this.authService.verifyAndRecordAttendance(scannedEventId, token, user.uid);
    this.scanStatus = result.success ? 'success' : 'error';
    this.resultMessage = result.message;

    if (result.success) {
      this.scannedAt = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: true
      });
    }
  }

  retryScanning() {
    this.scanStatus = 'scanning';
    this.resultMessage = '';
    this.cameraErrorMsg = '';
    this.startCamera();
  }

  stopCamera() {
    this.scanning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
  }

  goBack() {
    this.router.navigate(['/feeds']);
  }
}
