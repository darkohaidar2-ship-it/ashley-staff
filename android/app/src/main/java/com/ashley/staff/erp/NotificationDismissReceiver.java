package com.ashley.staff.erp;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

public class NotificationDismissReceiver extends BroadcastReceiver {
    private static final String TAG = "AshleyNotifDismiss";

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.i(TAG, "Notification was swiped/dismissed. Checking service state...");
        try {
            Intent serviceIntent = new Intent(context, BackgroundAttendanceService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
        } catch (Throwable t) {
            Log.w(TAG, "Safe catch on notification dismiss restart: " + t.getMessage());
        }
    }
}
