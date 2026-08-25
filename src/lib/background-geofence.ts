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
  region?: GeofenceRegion;
  regions?: GeofenceRegion[];
  onStatusChange?: (status: { 
    isInside: boolean; 
    distance: number; 
    matchedRegionName?: string; 
    lastAction?: string; 
    message?: string 
  }) => void;
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
          maximumAge: 3000,
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
    
    // Support multiple locations (Ashley Main, Huana Warehouse, etc.)
    const regions = this.config.regions && this.config.regions.length > 0 
      ? this.config.regions 
      : (this.config.region ? [this.config.region] : []);

    if (regions.length === 0) return;

    let closestDistance = Infinity;
    let currentlyInside = false;
    let matchedRegion = regions[0];

    for (const reg of regions) {
      const d = getDistanceMeters(currentLat, currentLng, reg.lat, reg.lng);
      if (d < closestDistance) {
        closestDistance = d;
        matchedRegion = reg;
      }
      const effectiveRadius = reg.radiusMeters + 35; // 35m tolerance buffer
      if (d <= effectiveRadius) {
        currentlyInside = true;
        matchedRegion = reg;
      }
    }

    // Report status to UI callback
    this.config.onStatusChange?.({
      isInside: currentlyInside,
      distance: closestDistance,
      matchedRegionName: matchedRegion.name,
    });

    const now = Date.now();
    const todayDateStr = new Date().toISOString().slice(0, 10);
    const checkInDateKey = `ashley_last_auto_checkin_date_${this.config.userId}`;
    const checkOutDateKey = `ashley_last_auto_checkout_date_${this.config.userId}`;
    const lastCheckInDate = localStorage.getItem(checkInDateKey);
    const lastCheckOutDate = localStorage.getItem(checkOutDateKey);

    const COOLDOWN_MS = 20 * 1000; // 20s cooldown

    // Case 1: Currently Inside the Geofence -> Auto-CheckIn immediately if not checked in today
    if (currentlyInside) {
      this.isInsideState = true;
      localStorage.setItem(`ashley_geostate_${this.config.userId}`, 'inside');
      localStorage.removeItem(`ashley_exit_timestamp_${this.config.userId}`);

      if (lastCheckInDate !== todayDateStr) {
        if (now - this.lastTriggerTime > COOLDOWN_MS) {
          this.lastTriggerTime = now;
          localStorage.setItem(checkInDateKey, todayDateStr);
          await this.triggerGeofenceEvent('ENTER', currentLat, currentLng, closestDistance, matchedRegion);
        }
      }
    }
    // Case 2: Currently Outside the Geofence -> Auto-CheckOut after grace period if checked in today
    else if (!currentlyInside) {
      if (lastCheckInDate === todayDateStr && lastCheckOutDate !== todayDateStr) {
        const exitStartKey = `ashley_exit_timestamp_${this.config.userId}`;
        const firstExitTime = Number(localStorage.getItem(exitStartKey)) || now;
        if (!localStorage.getItem(exitStartKey)) {
          localStorage.setItem(exitStartKey, String(now));
        }

        const GRACE_PERIOD_MS = 2 * 60 * 1000; // 2 minutes grace period for errands/signal
        if (now - firstExitTime >= GRACE_PERIOD_MS && now - this.lastTriggerTime > COOLDOWN_MS) {
          this.isInsideState = false;
          this.lastTriggerTime = now;
          localStorage.setItem(`ashley_geostate_${this.config.userId}`, 'outside');
          localStorage.setItem(checkOutDateKey, todayDateStr);
          localStorage.removeItem(exitStartKey);
          await this.triggerGeofenceEvent('EXIT', currentLat, currentLng, closestDistance, matchedRegion);
        }
      } else {
        this.isInsideState = false;
        localStorage.setItem(`ashley_geostate_${this.config.userId}`, 'outside');
      }
    }
  }

  public async triggerGeofenceEvent(
    event: 'ENTER' | 'EXIT',
    lat: number,
    lng: number,
    distanceMeters?: number,
    region?: GeofenceRegion
  ) {
    if (!this.config) return;

    const payload = {
      userId: this.config.userId,
      userName: this.config.userName,
      deviceToken: this.config.deviceToken || 'dev-auto',
      event,
      lat,
      lng,
      distance: distanceMeters,
      regionName: region?.name || 'کۆمپانیای ئاشڵی',
      timestamp: new Date().toISOString(),
    };

    try {
      const res = await fetch('/api/attendance/autonomous-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        const title = event === 'ENTER' ? '🟢 چوونەژوورەوەی خۆکارانە' : '👋 دەرچوونی خۆکارانە';
        const msg = data.message || (event === 'ENTER' ? `هاتن بە سەرکەوتوویی لە (${payload.regionName}) تۆمارکرا.` : `دەرچوون بە سەرکەوتوویی لە (${payload.regionName}) تۆمارکرا.`);
        sendLocalNotification(title, msg);

        if (typeof window !== 'undefined') {
          const raw = localStorage.getItem('ashley_live_checkins');
          const list = raw ? JSON.parse(raw) : [];
          list.unshift(data.record || {
            id: `auto-${Date.now()}`,
            userId: this.config.userId,
            userName: this.config.userName,
            type: event === 'ENTER' ? 'هاتن (Check In)' : 'دەرچوون (Check Out)',
            time: new Date().toLocaleString(),
            distance: `${distanceMeters}m (${payload.regionName})`,
          });
          localStorage.setItem('ashley_live_checkins', JSON.stringify(list.slice(0, 100)));
          window.dispatchEvent(new Event('ashley_attendance_updated'));
        }
      }
    } catch {
      this.enqueueOfflineEvent(payload);
    }
  }

  private enqueueOfflineEvent(payload: any) {
    if (typeof window === 'undefined') return;
    try {
      const queue = JSON.parse(localStorage.getItem('ashley_offline_geofence_queue') || '[]');
      queue.push(payload);
      localStorage.setItem('ashley_offline_geofence_queue', JSON.stringify(queue));
    } catch {}
  }

  private async flushOfflineQueue() {
    if (typeof window === 'undefined' || !navigator.onLine) return;
    try {
      const queue = JSON.parse(localStorage.getItem('ashley_offline_geofence_queue') || '[]');
      if (queue.length === 0) return;

      const remaining: any[] = [];
      for (const item of queue) {
        try {
          await fetch('/api/attendance/autonomous-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item),
          });
        } catch {
          remaining.push(item);
        }
      }
      localStorage.setItem('ashley_offline_geofence_queue', JSON.stringify(remaining));
    } catch {}
  }
}

export const autonomousGeofenceManager = new AutonomousGeofenceManager();
