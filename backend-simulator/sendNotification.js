// sendNotification.js
const admin = require('firebase-admin');


const serviceAccount = require('./serviceAccountKey.json'); 

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


const targetFcmToken = 'c__WW7gjRsiou5NJGW_Uup:APA91bG7y91Jy81whNiaq_xFcO6WzupD1ZA7K2cisejVw1Pb9-sZQNshXwHHZf7ALy8rdiYvaFMpktfw8iNXL3lf4QkYvzRHwxTCoE6EWMBerxh8c_aIIKM'; // *** IMPORTANT: UPDATE THIS WITH YOUR APP'S TOKEN ***


const firebaseProjectId = 'spacechat-b24a8'; 


// When the app is in the foreground, @react-native-firebase/messaging's onMessage handles it.
const notificationMessage = {
  notification: {
    title: 'Hello from Node.js Backend!',
    body: 'This is a test notification from your simulated backend.',
  },
  data: {
    customKey: 'customValue',
    link: 'notificationapp://app/details/nodejs_test_123', 
  },
  token: targetFcmToken,
};


// You would then use the native module to display a custom notification/UI.
const dataOnlyMessage = {
  data: {
    title: 'Incoming Call from Node.js!',
    body: 'Alice is calling you for a video chat.',
    type: 'call',
    callerId: 'alice123',
    link: 'notificationapp://app/call/alice', 
  },
  token: targetFcmToken,

  android: {
    priority: 'high',
  },
  apns: { // For iOS, ensure you have APNs setup for high priority
    headers: {
      'apns-priority': '10',
    },
  },
};

/**
 * Sends a push notification using Firebase Admin SDK.
 * @param {object} message The message payload (notification or data).
 */
async function sendPushNotification(message) {
  try {
    const response = await admin.messaging().send(message);
    console.log('Successfully sent message:', response);
  } catch (error) {
    console.error('Error sending message:', error);
  }
}


sendPushNotification(notificationMessage);
// sendPushNotification(dataOnlyMessage); // This is more relevant for the WhatsApp-like call scenario