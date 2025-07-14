package com.spacechat; // Replace with your actual package name (e.g., com.notificationapp)

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

// Import your MainActivity and R class
import com.spacechat.MainActivity; // Make sure this matches your app's package and MainActivity name
import com.spacechat.R; // Make sure this matches your app's package

public class MyFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "MyFirebaseMsgService";
    // Ensure this CHANNEL_ID matches the one in your AndroidManifest.xml
    public static final String CHANNEL_ID = "default_channel";

    /**
     * Called when message is received.
     *
     * @param remoteMessage Object representing the FCM message data.
     */
    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        Log.d(TAG, "From: " + remoteMessage.getFrom());

        // Check if message contains a notification payload.
        if (remoteMessage.getNotification() != null) {
            Log.d(TAG, "Message Notification Body: " + remoteMessage.getNotification().getBody());
            sendNotification(remoteMessage.getNotification().getTitle(), remoteMessage.getNotification().getBody(), remoteMessage.getData());
        } else if (remoteMessage.getData().size() > 0) {
            // Handle data payload when no notification payload is present
            Log.d(TAG, "Message Data Payload: " + remoteMessage.getData());
            // For WhatsApp-like calls, you might send a data-only message and show a custom UI/notification
            // based on the data here, even if the app is killed.
            sendNotification(remoteMessage.getData().get("title"), remoteMessage.getData().get("body"), remoteMessage.getData());
        }
    }

    /**
     * Called if FCM registration token is updated. This may occur when the token expires,
     * or if the device has been restored to a new state.
     *
     * @param token The new token.
     */
    @Override
    public void onNewToken(String token) {
        Log.d(TAG, "Refreshed token: " + token);
        // If you want to send messages to this application instance or
        // manage this apps subscriptions on the server side, send the
        // FCM registration token to your app server.
        // You would typically send this token to your backend here.
    }

    /**
     * Create and show a simple notification containing the received FCM message.
     *
     * @param messageTitle FCM message title.
     * @param messageBody FCM message body.
     * @param dataPayload FCM data payload for deep linking.
     */
    private void sendNotification(String messageTitle, String messageBody, Map<String, String> dataPayload) {
        // Define the intent to open your main activity
        Intent intent = new Intent(this, MainActivity.class); // MainActivity should now be found
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);

        // Add deep link data if available
        if (dataPayload != null && dataPayload.containsKey("link")) {
            String deepLink = dataPayload.get("link");
            intent.setData(Uri.parse(deepLink));
            Log.d(TAG, "Deep link added to intent: " + deepLink);
        }

        PendingIntent pendingIntent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // For Android 12 (API 31) and above, specify FLAG_IMMUTABLE or FLAG_MUTABLE
            pendingIntent = PendingIntent.getActivity(this, 0 /* Request code */, intent,
                    PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE);
        } else {
            pendingIntent = PendingIntent.getActivity(this, 0 /* Request code */, intent,
                    PendingIntent.FLAG_ONE_SHOT);
        }

        Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        NotificationCompat.Builder notificationBuilder =
                new NotificationCompat.Builder(this, CHANNEL_ID)
                        .setSmallIcon(R.mipmap.ic_launcher) // R.mipmap.ic_launcher should now be found
                        .setContentTitle(messageTitle != null ? messageTitle : "New Message")
                        .setContentText(messageBody != null ? messageBody : "You have a new notification.")
                        .setAutoCancel(true)
                        .setSound(defaultSoundUri)
                        .setPriority(NotificationCompat.PRIORITY_HIGH) // High priority for heads-up
                        .setContentIntent(pendingIntent);

        NotificationManager notificationManager =
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        // Since Android 8.0 (API level 26) notification channels are required.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID,
                    "Default Channel",
                    NotificationManager.IMPORTANCE_HIGH); // Use IMPORTANCE_HIGH for heads-up notifications
            notificationManager.createNotificationChannel(channel);
        }

        notificationManager.notify(0 /* ID of notification */, notificationBuilder.build());
    }
}
