package com.ashley.staff.erp;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebChromeClient;
import android.webkit.PermissionRequest;
import android.webkit.WebView;
import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "AshleyMainActivity";
    private static final int PERMISSION_REQUEST_CODE = 2027;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Global crash guard to prevent unexpected app termination
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            Log.e(TAG, "Uncaught native exception caught safely: " + throwable.getMessage(), throwable);
        });

        super.onCreate(savedInstanceState);

        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                WebView webView = this.bridge.getWebView();
                WebSettings settings = webView.getSettings();
                settings.setJavaScriptEnabled(true);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                settings.setAllowFileAccess(true);
                settings.setAllowContentAccess(true);
                settings.setMediaPlaybackRequiresUserGesture(false);

                // Automatically grant WebRTC camera permission to WebView
                webView.setWebChromeClient(new WebChromeClient() {
                    @Override
                    public void onPermissionRequest(final PermissionRequest request) {
                        MainActivity.this.runOnUiThread(() -> {
                            try {
                                request.grant(request.getResources());
                            } catch (Exception ignored) {}
                        });
                    }
                });

                // Inject Native JavaScript Bridge into Capacitor WebView WITHOUT replacing BridgeWebViewClient
                webView.addJavascriptInterface(new AshleyNativeBridge(this), "AshleyNativeBridge");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error configuring webView settings: " + e.getMessage());
        }

        checkAndRequestPermissions();
    }

    @Override
    public void onResume() {
        super.onResume();
        if (hasLocationPermissions()) {
            startBackgroundServiceSafely();
        }
    }

    private boolean hasLocationPermissions() {
        boolean fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean coarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        return fine || coarse;
    }

    private void checkAndRequestPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            List<String> permissions = new ArrayList<>();
            permissions.add(Manifest.permission.CAMERA);
            permissions.add(Manifest.permission.ACCESS_FINE_LOCATION);
            permissions.add(Manifest.permission.ACCESS_COARSE_LOCATION);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                permissions.add(Manifest.permission.POST_NOTIFICATIONS);
            }

            List<String> needed = new ArrayList<>();
            for (String perm : permissions) {
                if (ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED) {
                    needed.add(perm);
                }
            }

            if (!needed.isEmpty()) {
                ActivityCompat.requestPermissions(this, needed.toArray(new String[0]), PERMISSION_REQUEST_CODE);
            } else {
                startBackgroundServiceSafely();
            }
        } else {
            startBackgroundServiceSafely();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQUEST_CODE) {
            if (hasLocationPermissions()) {
                startBackgroundServiceSafely();
            }
        }
    }

    public void startBackgroundServiceSafely() {
        try {
            Intent serviceIntent = new Intent(this, BackgroundAttendanceService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent);
            } else {
                startService(serviceIntent);
            }
            Log.i(TAG, "BackgroundAttendanceService started successfully.");
        } catch (Throwable t) {
            Log.w(TAG, "Safe catch starting background service: " + t.getMessage());
        }
    }

    public static class AshleyNativeBridge {
        private final Context context;

        public AshleyNativeBridge(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public void syncEmployee(String userId, String userName, String deviceToken, String checkInTime) {
            try {
                SharedPreferences prefs = context.getSharedPreferences("ashley_prefs", Context.MODE_PRIVATE);
                SharedPreferences.Editor editor = prefs.edit()
                        .putString("userId", userId)
                        .putString("userName", userName)
                        .putString("deviceToken", deviceToken);
                if (checkInTime != null && !checkInTime.isEmpty()) {
                    editor.putString("checkInTime", checkInTime);
                }
                editor.apply();

                Intent serviceIntent = new Intent(context, BackgroundAttendanceService.class);
                serviceIntent.putExtra("userId", userId);
                serviceIntent.putExtra("userName", userName);
                serviceIntent.putExtra("deviceToken", deviceToken);
                if (checkInTime != null && !checkInTime.isEmpty()) {
                    serviceIntent.putExtra("checkInTime", checkInTime);
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
            } catch (Throwable t) {
                Log.w(TAG, "Bridge syncEmployee error caught safely: " + t.getMessage());
            }
        }

        @JavascriptInterface
        public void syncShift(String checkInTime, String checkOutTime) {
            try {
                SharedPreferences prefs = context.getSharedPreferences("ashley_prefs", Context.MODE_PRIVATE);
                SharedPreferences.Editor editor = prefs.edit();
                if (checkInTime != null) editor.putString("checkInTime", checkInTime);
                if (checkOutTime != null) editor.putString("checkOutTime", checkOutTime);
                editor.apply();

                Intent serviceIntent = new Intent(context, BackgroundAttendanceService.class);
                if (checkInTime != null) serviceIntent.putExtra("checkInTime", checkInTime);
                if (checkOutTime != null) serviceIntent.putExtra("checkOutTime", checkOutTime);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
            } catch (Throwable t) {
                Log.w(TAG, "Bridge syncShift error caught safely: " + t.getMessage());
            }
        }

        @JavascriptInterface
        public void openBatterySettings() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                try {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + context.getPackageName()));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(intent);
                } catch (Exception e) {
                    try {
                        Intent fallback = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                        fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        context.startActivity(fallback);
                    } catch (Exception ignored) {}
                }
            }
        }
    }
}
