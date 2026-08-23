/**
 * Autonomous Background Geofencing Attendance Engine
 * Ashley ERP - 2027
 * 
 * Automatically monitors GPS boundaries and records Check-In / Check-Out
 * upon crossing company geofence regions with zero manual interaction.
 */

export interface GeofenceRegion {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusMeters: number;
}

export interface GeofenceConfig {
  userId: string;
  userName: string;
  deviceToken?: string;
  region: GeofenceRegion;
  onStatusChange?: (status: { isInside: boolean; distance: number; lastAction?: string; message?: string }) => void;
}

// Calculate Haversine distance in meters between two GPS coordinates
export function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Request and dispatch native notification
export async function sendLocalNotification(title: string, body: string) {
  if (typeof window === 'undefined') return;

  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/icon.png',
          badge: '/icon.png',
          dir: 'rtl',
          lang: 'ku',
        });
      } catch {}
    } else if (Notification.permission !== 'denied') {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        try {
          new Notification(title, { body, icon: '/icon.png', dir: 'rtl' });
        } catch {}
      }
    }
  }
}

class AutonomousGeofenceManager {
  private watchId: number | null = null;
  private isInsideState: boolean | null = null;
  private lastTriggerTime: number = 0;
  private config: GeofenceConfig | null = null;
  private isRunning: boolean = false;

  public start(config: GeofenceConfig) {
    if (typeof window === 'undefined') return;
    this.config = config;
    this.isRunning = true;

    // Load last known state from localStorage
    const savedState = localStorage.getItem(`ashley_geostate_${config.userId}`);
    if (savedState) {
      this.isInsideState = savedState === 'inside';
    }

    // Flush any pending offline queue
    this.flushOfflineQueue();

    if ('geolocation' in navigator) {
      this.watchId = navigator.geolocation.watchPosition(
        (pos) => this.handlePositionUpdate(pos),
        (err) => console.warn('Geofence GPS Watcher warning:', err.message),
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 15000,
        }
      );
    }
  }

  public stop() {
    if (this.watchId !== null && typeof navigator !== 'undefined') {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isRunning = false;
  }

  private async handlePositionUpdate(pos: GeolocationPosition) {
    if (!this.config || !this.isRunning) return;

    const currentLat = pos.coords.latitude;
    const currentLng = pos.coords.longitude;
    const target = this.config.region;

    const distance = getDistanceMeters(currentLat, currentLng, target.lat, target.lng);
    const effectiveRadius = target.radiusMeters + 25; // 25m tolerance buffer
    const currentlyInside = distance <= effectiveRadius;

    // Report status to UI callback
    this.config.onStatusChange?.({
      isInside: currentlyInside,
      distance,
    });

    const now = Date.now();
    // Cooldown of 90 seconds between auto-triggers to prevent GPS bounce
    const COOLDOWN_MS = 90 * 1000;

    // State Transition 1: Outside -> Inside (ENTER)
    if (this.isInsideState === false && currentlyInside) {
      if (now - this.lastTriggerTime > COOLDOWN_MS) {
        this.isInsideState = true;
        this.lastTriggerTime = now;
        localStorage.setItem(`ashley_geostate_${this.config.userId}`, 'inside');
        await this.triggerGeofenceEvent('ENTER', currentLat, currentLng, distance);
      }
    }
    // State Transition 2: Inside -> Outside (EXIT)
    else if (this.isInsideState === true && !currentlyInside) {
      if (now - this.lastTriggerTime > COOLDOWN_MS) {
        this.isInsideState = false;
        this.lastTriggerTime = now;
        localStorage.setItem(`ashley_geostate_${this.config.userId}`, 'outside');
        await this.triggerGeofenceEvent('EXIT', currentLat, currentLng, distance);
      }
    }
    // Initial Baseline initialization
    else if (this.isInsideState === null) {
      this.isInsideState = currentlyInside;
      localStorage.setItem(`ashley_geostate_${this.config.userId}`, currentlyInside ? 'inside' : 'outside');
    }
  }

  public async triggerGeofenceEvent(
    event: 'ENTER' | 'EXIT',
    lat: number,
    lng: number,
    distanceMeters?: number
  ) {
    if (!this.config) return;

    const payload = {
      userId: this.config.userId,
      employeeName: this.config.userName,
      deviceToken: this.config.deviceToken || 'mobile-token-auto',
      event,
      lat,
      lng,
      warehouseId: this.config.region.id,
    };

    try {
      const res = await fetch('/api/attendance/auto-geofence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const notifTitle = event === 'ENTER' ? '🟢 چێک‌ئینـی خۆکارانە' : '👋 چێک‌ئاوتـی خۆکارانە';
        const notifBody = data.message || (event === 'ENTER' ? 'هاتنەکەت لە کاتی خۆیدا تۆمارکرا' : 'دەرچوونەکەت تۆمارکرا');

        sendLocalNotification(notifTitle, notifBody);

        // Update local logs for instant UI responsiveness
        if (data.record) {
          const raw = localStorage.getItem('ashley_live_checkins');
          const list = raw ? JSON.parse(raw) : [];
          list.unshift(data.record);
          localStorage.setItem('ashley_live_checkins', JSON.stringify(list));
        }

        window.dispatchEvent(new Event('ashley_attendance_updated'));
        window.dispatchEvent(new Event('storage'));

        this.config.onStatusChange?.({
          isInside: event === 'ENTER',
          distance: distanceMeters || 0,
          lastAction: event === 'ENTER' ? 'چێک‌ئین' : 'چێک‌ئاوت',
          message: data.message,
        });
      } else {
        console.warn('Geofence trigger response:', data);
      }
    } catch (err) {
      // Offline fallback: save event to offline queue
      console.warn('Network offline, queueing geofence event:', err);
      this.queueOfflineEvent(payload);
    }
  }

  private queueOfflineEvent(payload: any) {
    try {
      const raw = localStorage.getItem('ashley_geofence_offline_queue');
      const queue = raw ? JSON.parse(raw) : [];
      queue.push({ ...payload, queuedAt: new Date().toISOString() });
      localStorage.setItem('ashley_geofence_offline_queue', JSON.stringify(queue));
    } catch {}
  }

  private async flushOfflineQueue() {
    try {
      const raw = localStorage.getItem('ashley_geofence_offline_queue');
      if (!raw) return;
      const queue = JSON.parse(raw);
      if (!Array.isArray(queue) || queue.length === 0) return;

      for (const item of queue) {
        await fetch('/api/attendance/auto-geofence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        });
      }
      localStorage.removeItem('ashley_geofence_offline_queue');
    } catch {}
  }
}

export const autonomousGeofenceManager = new AutonomousGeofenceManager();
