package com.ashley.staff.erp;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class BackgroundAttendanceService extends Service implements LocationListener {

    private static final String TAG = "AshleyBgAttendance";
    public static final String CHANNEL_ID = "ashley_attendance_bg_channel";
    public static final String ALERT_CHANNEL_ID = "ashley_attendance_alert_channel";
    public static final int NOTIFICATION_ID = 1001;

    private LocationManager locationManager;
    private PowerManager.WakeLock wakeLock;
    private ExecutorService executorService;
    private SharedPreferences prefs;

    // Company Locations
    private static final double ASHLEY_BASE_LAT = 35.508918;
    private static final double ASHLEY_BASE_LNG = 45.452935;
    private static final float ASHLEY_BASE_RADIUS = 100f; // meters

    private static final double HUANA_LAT = 35.562431;
    private static final double HUANA_LNG = 45.474792;
    private static final float HUANA_RADIUS = 120f; // meters

    private long lastTriggerTime = 0;

    @Override
    public void onCreate() {
        super.onCreate();
        prefs = getSharedPreferences("ashley_prefs", Context.MODE_PRIVATE);
        executorService = Executors.newSingleThreadExecutor();

        createNotificationChannels();

        // Acquire partial wake lock to maintain location monitoring
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Ashley::BgWakeLock");
                wakeLock.acquire(10 * 60 * 1000L /*10 minutes max per acquisition*/);
            }
        } catch (Exception e) {
            Log.w(TAG, "WakeLock error: " + e.getMessage());
        }

        startForeground(NOTIFICATION_ID, buildStickyNotification());
        startLocationUpdates();
        Log.i(TAG, "BackgroundAttendanceService started successfully.");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
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
        }
        return START_STICKY;
    }

    private void startLocationUpdates() {
        try {
            locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
            if (locationManager == null) return;

            // GPS Provider
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(
                        LocationManager.GPS_PROVIDER,
                        15000L, // 15 seconds
                        5f,     // 5 meters
                        this
                );
            }

            // Network Provider as fallback
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(
                        LocationManager.NETWORK_PROVIDER,
                        15000L,
                        5f,
                        this
                );
            }
        } catch (SecurityException se) {
            Log.e(TAG, "Location permission missing: " + se.getMessage());
        } catch (Exception e) {
            Log.e(TAG, "Error starting location updates: " + e.getMessage());
        }
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

    private void handleGeofenceLogic(boolean isInside, double lat, double lng, float distance, String locationName) {
        String userId = prefs.getString("userId", null);
        String userName = prefs.getString("userName", "کارمەند");
        String deviceToken = prefs.getString("deviceToken", "dev-auto");

        if (userId == null || userId.isEmpty()) {
            return; // No employee bound yet
        }

        String todayDateStr = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        String currentTimeStr = new SimpleDateFormat("HH:mm", Locale.US).format(new Date());

        String lastCheckInDate = prefs.getString("last_checkin_date", "");
        String lastCheckOutDate = prefs.getString("last_checkout_date", "");
        long now = System.currentTimeMillis();

        if (now - lastTriggerTime < 20000) {
            return; // Cooldown 20 seconds
        }

        // Case 1: Entered Geofence -> Auto Check-In
        if (isInside) {
            prefs.edit().putBoolean("is_inside", true).apply();

            if (!todayDateStr.equals(lastCheckInDate)) {
                lastTriggerTime = now;
                prefs.edit()
                        .putString("last_checkin_date", todayDateStr)
                        .putString("checkInTime", currentTimeStr)
                        .apply();

                postAutonomousEvent("ENTER", userId, userName, deviceToken, lat, lng, Math.round(distance), locationName);

                updateStickyNotification();

                showKurdishAlertNotification(
                        "🎉 بەخێربێیت بۆ دەوام",
                        "سڵاو " + userName + "! هاتنت بە سەرکەوتوویی لە باکگراوند لە کاتژمێر " + currentTimeStr + " تۆمارکرا."
                );
            }
        }
        // Case 2: Exited Geofence -> Auto Check-Out
        else {
            boolean wasInside = prefs.getBoolean("is_inside", false);
            prefs.edit().putBoolean("is_inside", false).apply();

            if (todayDateStr.equals(lastCheckInDate) && !todayDateStr.equals(lastCheckOutDate)) {
                lastTriggerTime = now;
                prefs.edit()
                        .putString("last_checkout_date", todayDateStr)
                        .putString("checkOutTime", currentTimeStr)
                        .apply();

                postAutonomousEvent("EXIT", userId, userName, deviceToken, lat, lng, Math.round(distance), locationName);

                updateStickyNotification();

                showKurdishAlertNotification(
                        "👋 تۆمارکردنی ڕۆیشتن لە دەوام",
                        userName + " گیان، ڕۆیشتنت لە دەوام لە کاتژمێر " + currentTimeStr + " لە باکگراوند تۆمارکرا. ماندوو نەبیت!"
                );
            }
        }
    }

    private void postAutonomousEvent(String event, String userId, String userName, String deviceToken, double lat, double lng, int distance, String regionName) {
        executorService.execute(() -> {
            try {
                URL url = new URL("https://ashley-staff.vercel.app/api/attendance/autonomous-event");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json; utf-8");
                conn.setRequestProperty("Accept", "application/json");
                conn.setDoOutput(true);
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);

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

                try (OutputStream os = conn.getOutputStream()) {
                    byte[] input = json.toString().getBytes("utf-8");
                    os.write(input, 0, input.length);
                }

                int responseCode = conn.getResponseCode();
                Log.i(TAG, "Autonomous event sent: " + event + " -> HTTP " + responseCode);
                conn.disconnect();
            } catch (Exception e) {
                Log.e(TAG, "Error posting autonomous event: " + e.getMessage());
            }
        });
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(NotificationManager.class);
            if (nm != null) {
                // Sticky Service Channel (Silent)
                NotificationChannel serviceChannel = new NotificationChannel(
                        CHANNEL_ID,
                        "Ashley Background Service",
                        NotificationManager.IMPORTANCE_LOW
                );
                serviceChannel.setDescription("سیستەمی چاودێری ئامادەبوونی باکگراوند");
                serviceChannel.setShowBadge(false);
                nm.createNotificationChannel(serviceChannel);

                // Alert Channel (Sound & Vibration)
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
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(NOTIFICATION_ID, buildStickyNotification());
        }
    }

    private Notification buildStickyNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, notificationIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        String userName = prefs.getString("userName", "سیستەمی ئاشڵی");
        String checkInTime = prefs.getString("checkInTime", null);
        String checkOutTime = prefs.getString("checkOutTime", null);
        boolean isInside = prefs.getBoolean("is_inside", false);

        String statusLine;
        if (checkOutTime != null && !checkOutTime.isEmpty()) {
            statusLine = "دەوامت تەواو کردووە 🏁 • کاتژمێر " + checkOutTime + " ڕۆیشتوویت";
        } else if (checkInTime != null && !checkInTime.isEmpty()) {
            statusLine = "لە دەوامیت 🟢 • کاتژمێر " + checkInTime + " هاتوویت";
        } else if (isInside) {
            statusLine = "لە دەوامیت 🟢 (لەناو کۆمپانیا)";
        } else {
            statusLine = "لە دەرەوەی دەوامیت ⚪ • چاودێری باکگراوند چالاکە";
        }

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("سیستەمی ئاشڵی (Ashley Staff)")
                .setContentText(statusLine)
                .setSubText(userName)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .build();
    }

    private void showKurdishAlertNotification(String title, String message) {
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
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (locationManager != null) {
            locationManager.removeUpdates(this);
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        if (executorService != null) {
            executorService.shutdown();
        }
        Log.i(TAG, "BackgroundAttendanceService destroyed.");
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override public void onStatusChanged(String provider, int status, Bundle extras) {}
    @Override public void onProviderEnabled(String provider) {}
    @Override public void onProviderDisabled(String provider) {}
}
