package com.ashley.staff.erp;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

public class ServiceWatchdogReceiver extends BroadcastReceiver {
    private static final String TAG = "AshleyWatchdog";

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.i(TAG, "Watchdog heartbeat received. Ensuring BackgroundAttendanceService is active...");
        
        try {
            Intent serviceIntent = new Intent(context, BackgroundAttendanceService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
        } catch (Exception e) {
            Log.e(TAG, "Watchdog error: " + e.getMessage());
        }
    }
}
