package com.ashley.staff.erp;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.SystemClock;
import android.util.Log;
import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class BackgroundAttendanceService extends Service implements LocationListener {

    private static final String TAG = "AshleyBgAttendance";
    public static final String CHANNEL_ID = "ashley_attendance_bg_channel_v5";
    public static final String ALERT_CHANNEL_ID = "ashley_attendance_alert_channel_v5";
    private static final int NOTIFICATION_ID = 1001;

    public static volatile boolean isServiceRunning = false;

    private LocationManager locationManager;
    private PowerManager.WakeLock wakeLock;
    private ScheduledExecutorService scheduledExecutor;
    private SharedPreferences prefs;

    // Company Locations
    private static final double ASHLEY_BASE_LAT = 35.508918;
    private static final double ASHLEY_BASE_LNG = 45.452935;
    private static final float ASHLEY_BASE_RADIUS = 160f; // meters

    private static final double HUANA_LAT = 35.562431;
    private static final double HUANA_LNG = 45.474792;
    private static final float HUANA_RADIUS = 160f; // meters

    private long lastTriggerTime = 0;

    @Override
    public void onCreate() {
        super.onCreate();
        isServiceRunning = true;
        prefs = getSharedPreferences("ashley_prefs", Context.MODE_PRIVATE);
        scheduledExecutor = Executors.newScheduledThreadPool(1);

        createNotificationChannels();

        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Ashley::BgWakeLockV5");
                wakeLock.setReferenceCounted(false);
                wakeLock.acquire(10 * 60 * 1000L); // 10 min safe timeout
            }
        } catch (Exception e) {
            Log.w(TAG, "WakeLock acquire error: " + e.getMessage());
        }

        Notification notification = buildStickyNotification();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            try {
                startForeground(NOTIFICATION_ID, notification);
            } catch (Exception ignored) {}
        }

        startSmartLocationUpdates();
        startPeriodicGeofenceEngine();
        Log.i(TAG, "BackgroundAttendanceService created successfully.");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        isServiceRunning = true;
        if (intent != null) {
            try {
                SharedPreferences.Editor editor = prefs.edit();
                if (intent.hasExtra("userId")) {
                    editor.putString("userId", intent.getStringExtra("userId"));
                }
                if (intent.hasExtra("userName")) {
                    editor.putString("userName", intent.getStringExtra("userName"));
                }
                if (intent.hasExtra("deviceToken")) {
                    editor.putString("deviceToken", intent.getStringExtra("deviceToken"));
                }
                if (intent.hasExtra("checkInTime")) {
                    editor.putString("checkInTime", intent.getStringExtra("checkInTime"));
                }
                if (intent.hasExtra("checkOutTime")) {
                    editor.putString("checkOutTime", intent.getStringExtra("checkOutTime"));
                }
                editor.apply();

                updateStickyNotification();
            } catch (Exception ignored) {}
        }
        return START_STICKY;
    }

    private void startSmartLocationUpdates() {
        try {
            locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
            if (locationManager == null) return;

            // Stable 15s intervals, 5m threshold - Prevents battery drain & OS process kill
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(
                        LocationManager.GPS_PROVIDER,
                        15000L,
                        5.0f,
                        this
                );
            }

            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(
                        LocationManager.NETWORK_PROVIDER,
                        15000L,
                        5.0f,
                        this
                );
            }
        } catch (SecurityException se) {
            Log.e(TAG, "Location permission missing: " + se.getMessage());
        } catch (Exception e) {
            Log.e(TAG, "Error starting location updates: " + e.getMessage());
        }
    }

    private void startPeriodicGeofenceEngine() {
        if (scheduledExecutor == null || scheduledExecutor.isShutdown()) return;
        scheduledExecutor.scheduleWithFixedDelay(() -> {
            try {
                if (locationManager == null) return;

                Location loc = null;
                try {
                    if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                        loc = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
                    }
                    if (loc == null && locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                        loc = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
                    }
                } catch (SecurityException ignored) {}

                if (loc != null) {
                    onLocationChanged(loc);
                }

                drainOfflineEvents();
            } catch (Exception e) {
                Log.w(TAG, "Periodic geofence loop notice: " + e.getMessage());
            }
        }, 10, 20, TimeUnit.SECONDS);
    }

    @Override
    public void onLocationChanged(Location location) {
        if (location == null) return;

        double lat = location.getLatitude();
        double lng = location.getLongitude();

        float[] distAshley = new float[1];
        Location.distanceBetween(lat, lng, ASHLEY_BASE_LAT, ASHLEY_BASE_LNG, distAshley);

        float[] distHuana = new float[1];
        Location.distanceBetween(lat, lng, HUANA_LAT, HUANA_LNG, distHuana);

        boolean insideAshley = distAshley[0] <= ASHLEY_BASE_RADIUS;
        boolean insideHuana = distHuana[0] <= HUANA_RADIUS;
        boolean isInsideAny = insideAshley || insideHuana;

        String matchedName = insideHuana ? "کۆگای سەرەکی هوانە" : "کۆمپانیای سەرەکی ئاشڵی";
        float closestDistance = insideHuana ? distHuana[0] : distAshley[0];

        handleGeofenceLogic(isInsideAny, lat, lng, closestDistance, matchedName);
    }

    private synchronized void handleGeofenceLogic(boolean isInside, double lat, double lng, float distance, String locationName) {
        String userId = prefs.getString("userId", null);
        String userName = prefs.getString("userName", "کارمەند");
        String deviceToken = prefs.getString("deviceToken", "dev-auto");

        if (userId == null || userId.isEmpty()) {
            return;
        }

        String todayDateStr = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        String currentTimeStr = new SimpleDateFormat("HH:mm", Locale.US).format(new Date());

        boolean wasInside = prefs.getBoolean("is_inside", false);
        String lastCheckInDate = prefs.getString("last_checkin_date", "");
        long now = System.currentTimeMillis();

        if (now - lastTriggerTime < 15000) {
            return; // 15 seconds cooldown
        }

        // Case 1: Entered Geofence (Was outside, now inside)
        if (isInside && !wasInside) {
            lastTriggerTime = now;
            prefs.edit().putBoolean("is_inside", true).apply();

            String firstCheckIn = prefs.getString("checkInTime", "");
            boolean isInitialTodayCheckIn = firstCheckIn.isEmpty() || !todayDateStr.equals(lastCheckInDate);

            if (isInitialTodayCheckIn) {
                prefs.edit()
                        .putString("last_checkin_date", todayDateStr)
                        .putString("checkInTime", currentTimeStr)
                        .remove("checkOutTime")
                        .apply();

                showKurdishAlertNotification(
                        "🎉 بەخێربێیت بۆ دەوام",
                        "سڵاو " + userName + "! هاتنی سەرەکی لە کاتژمێر " + currentTimeStr + " تۆمارکرا."
                );
            } else {
                prefs.edit().remove("checkOutTime").apply();
                showKurdishAlertNotification(
                        "🏢 گەڕانەوە بۆ دەوام",
                        "سڵاو " + userName + "! گەڕانەوەت لە کاتژمێر " + currentTimeStr + " تۆمارکرا."
                );
            }

            postAutonomousEvent("ENTER", userId, userName, deviceToken, lat, lng, Math.round(distance), locationName);
            updateStickyNotification();
        }
        // Case 2: Exited Geofence (Was inside, now outside)
        else if (!isInside && wasInside) {
            lastTriggerTime = now;
            prefs.edit()
                    .putBoolean("is_inside", false)
                    .putString("last_checkout_date", todayDateStr)
                    .putString("checkOutTime", currentTimeStr)
                    .apply();

            postAutonomousEvent("EXIT", userId, userName, deviceToken, lat, lng, Math.round(distance), locationName);
            updateStickyNotification();

            showKurdishAlertNotification(
                    "👋 چوونەدەرەوە لە دەوام",
                    userName + " گیان، دەرچوونت لە کاتژمێر " + currentTimeStr + " تۆمارکرا."
            );
        }
    }

    private void postAutonomousEvent(String event, String userId, String userName, String deviceToken, double lat, double lng, int distance, String regionName) {
        if (scheduledExecutor == null || scheduledExecutor.isShutdown()) return;
        scheduledExecutor.execute(() -> {
            try {
                JSONObject json = new JSONObject();
                json.put("userId", userId);
                json.put("userName", userName);
                json.put("deviceToken", deviceToken);
                json.put("event", event);
                json.put("lat", lat);
                json.put("lng", lng);
                json.put("distance", distance);
                json.put("regionName", regionName);
                json.put("timestamp", new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).format(new Date()));

                boolean success = sendEventHttp(json);
                if (!success) {
                    Log.w(TAG, "No internet. Caching event offline.");
                    queueOfflineEvent(json);
                } else {
                    drainOfflineEvents();
                }
            } catch (Exception e) {
                Log.e(TAG, "Error in postAutonomousEvent: " + e.getMessage());
            }
        });
    }

    private void queueOfflineEvent(JSONObject json) {
        try {
            String existingQueueStr = prefs.getString("offline_events_queue", "[]");
            org.json.JSONArray queue = new org.json.JSONArray(existingQueueStr);
            queue.put(json);
            prefs.edit().putString("offline_events_queue", queue.toString()).apply();
        } catch (Exception ignored) {}
    }

    private void drainOfflineEvents() {
        try {
            String existingQueueStr = prefs.getString("offline_events_queue", "[]");
            org.json.JSONArray queue = new org.json.JSONArray(existingQueueStr);
            if (queue.length() == 0) return;

            org.json.JSONArray remaining = new org.json.JSONArray();
            for (int i = 0; i < queue.length(); i++) {
                JSONObject item = queue.getJSONObject(i);
                boolean sent = sendEventHttp(item);
                if (!sent) remaining.put(item);
            }
            prefs.edit().putString("offline_events_queue", remaining.toString()).apply();
        } catch (Exception ignored) {}
    }

    private boolean sendEventHttp(JSONObject json) {
        try {
            URL url = new URL("https://ashley-staff.vercel.app/api/attendance/autonomous-event");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json; utf-8");
            conn.setRequestProperty("Accept", "application/json");
            conn.setDoOutput(true);
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);

            try (OutputStream os = conn.getOutputStream()) {
                byte[] input = json.toString().getBytes("utf-8");
                os.write(input, 0, input.length);
            }

            int responseCode = conn.getResponseCode();
            conn.disconnect();
            return (responseCode >= 200 && responseCode < 300);
        } catch (Exception e) {
            return false;
        }
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(NotificationManager.class);
            if (nm != null) {
                NotificationChannel serviceChannel = new NotificationChannel(
                        CHANNEL_ID,
                        "Ashley 24/7 Persistent Attendance",
                        NotificationManager.IMPORTANCE_LOW
                );
                serviceChannel.setDescription("چاودێری دەوامی بەردەوامی ٢٤ کاتژمێری");
                serviceChannel.setShowBadge(true);
                serviceChannel.setSound(null, null);
                serviceChannel.enableVibration(false);
                nm.createNotificationChannel(serviceChannel);

                NotificationChannel alertChannel = new NotificationChannel(
                        ALERT_CHANNEL_ID,
                        "Ashley Attendance Alerts",
                        NotificationManager.IMPORTANCE_HIGH
                );
                alertChannel.setDescription("ئاگادارکردنەوەی کاتی هاتن و ڕۆیشتن");
                alertChannel.enableVibration(true);
                alertChannel.setShowBadge(true);
                nm.createNotificationChannel(alertChannel);
            }
        }
    }

    public void updateStickyNotification() {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.notify(NOTIFICATION_ID, buildStickyNotification());
            }
        } catch (Exception ignored) {}
    }

    private Notification buildStickyNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, notificationIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        Intent deleteIntent = new Intent(this, NotificationDismissReceiver.class);
        PendingIntent deletePendingIntent = PendingIntent.getBroadcast(
                this, 1001, deleteIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        String userName = prefs.getString("userName", "کارمەند");
        String checkInTime = prefs.getString("checkInTime", null);
        String checkOutTime = prefs.getString("checkOutTime", null);
        boolean isInside = prefs.getBoolean("is_inside", false);

        String statusLine;
        if (isInside) {
            if (checkInTime != null && !checkInTime.isEmpty()) {
                statusLine = "لە دەوامیت 🟢 • کاتژمێر " + checkInTime + " هاتوویت";
            } else {
                statusLine = "لە دەوامیت 🟢 (لەناو کۆمپانیا)";
            }
        } else {
            if (checkOutTime != null && !checkOutTime.isEmpty()) {
                statusLine = "دەرچوویت 🏁 • کاتژمێر " + checkOutTime + " تۆمارکرا";
            } else {
                statusLine = "مۆبایلەکە لە کاردایە 🟢 • چاودێری دەوامی ٢٤ سەعاتە";
            }
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("سیستەمی ئاشڵی (Ashley Staff) • " + userName)
                .setContentText(statusLine)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(pendingIntent)
                .setDeleteIntent(deletePendingIntent)
                .setOngoing(true)
                .setAutoCancel(false)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setCategory(NotificationCompat.CATEGORY_SERVICE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            builder.setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE);
        }

        Notification notif = builder.build();
        notif.flags |= Notification.FLAG_ONGOING_EVENT | Notification.FLAG_NO_CLEAR;
        return notif;
    }

    private void showKurdishAlertNotification(String title, String message) {
        try {
            Intent intent = new Intent(this, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pendingIntent = PendingIntent.getActivity(
                    this, (int) System.currentTimeMillis(), intent,
                    PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
            );

            NotificationCompat.Builder builder = new NotificationCompat.Builder(this, ALERT_CHANNEL_ID)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle(title)
                    .setContentText(message)
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setDefaults(NotificationCompat.DEFAULT_ALL)
                    .setAutoCancel(true)
                    .setContentIntent(pendingIntent);

            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.notify((int) System.currentTimeMillis(), builder.build());
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onDestroy() {
        isServiceRunning = false;
        try {
            if (locationManager != null) {
                locationManager.removeUpdates(this);
            }
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
            if (scheduledExecutor != null) {
                scheduledExecutor.shutdown();
            }
        } catch (Exception ignored) {}
        super.onDestroy();
        Log.i(TAG, "BackgroundAttendanceService destroyed cleanly.");
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override public void onStatusChanged(String provider, int status, Bundle extras) {}
    @Override public void onProviderEnabled(String provider) {}
    @Override public void onProviderDisabled(String provider) {}
}
