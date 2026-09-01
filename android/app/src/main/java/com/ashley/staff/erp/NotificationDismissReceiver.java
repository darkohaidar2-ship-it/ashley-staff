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
        Log.w(TAG, "Notification was swiped/dismissed by user. Immediately respawning service & notification...");
        
        try {
            Intent serviceIntent = new Intent(context, BackgroundAttendanceService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error respawning service on dismiss: " + e.getMessage());
        }
    }
}
