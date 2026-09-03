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
        if (!BackgroundAttendanceService.isServiceRunning) {
            Log.i(TAG, "Watchdog found service inactive. Restarting...");
            try {
                Intent serviceIntent = new Intent(context, BackgroundAttendanceService.class);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
            } catch (Throwable t) {
                Log.w(TAG, "Watchdog start suppressed by OS background limitations: " + t.getMessage());
            }
        }
    }
}
