import React, { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  Button,
  Linking,
} from 'react-native';

// Import AsyncStorage for local storage
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import FirebaseMessagingTypes for better type safety
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';

// Define a TypeScript interface for the notification content
interface NotificationContent {
  id: string; // Unique ID for each notification, typically remoteMessage.messageId
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
  data?: { [key: string]: string }; // Optional data payload from FCM
}

// Helper function to extract title and body from remoteMessage
const extractNotificationContent = (remoteMessage: FirebaseMessagingTypes.RemoteMessage): Omit<NotificationContent, 'id' | 'timestamp' | 'read'> => {
  const notification = remoteMessage.notification;
  const data = remoteMessage.data;

  let displayTitle = 'New Message';
  let displayBody = 'You have a new notification.';

  if (notification) {
    displayTitle = notification.title || displayTitle;
    displayBody = notification.body || displayBody;
  } else if (data) {
    displayTitle = data.title || displayTitle;
    displayBody = data.body || displayBody;
  }
  return { title: displayTitle, body: displayBody, data: data };
};

// --- Global/Utility Functions (outside App component) ---
const NOTIFICATION_STORAGE_KEY = '@notifications';

// Function to load all stored notifications from AsyncStorage
const loadNotificationsFromStorage = async (): Promise<NotificationContent[]> => {
  try {
    const notificationsJson = await AsyncStorage.getItem(NOTIFICATION_STORAGE_KEY);
    return notificationsJson ? JSON.parse(notificationsJson) : [];
  } catch (e) {
    console.error('Failed to load notifications from storage', e);
    return [];
  }
};

// Function to save notifications to AsyncStorage
const saveNotificationsToStorage = async (notifications: NotificationContent[]) => {
  try {
    await AsyncStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(notifications));
    console.log('Notifications saved to storage.');
  } catch (e) {
    console.error('Failed to save notifications to storage', e);
  }
};

// Function to update the application badge count
const updateBadgeCount = (notifications: NotificationContent[]) => {
  const unreadCount = notifications.filter(notif => !notif.read).length;
  console.log('Attempting to set badge count to:', unreadCount);

  try {
    const firebaseMessagingInstance = messaging();
    // Check if messaging() is initialized and setBadge is available
    // This can sometimes be null or undefined if Firebase hasn't fully initialized yet,
    // especially during very early app startup or if there's an issue with firebase setup.
    if (firebaseMessagingInstance && typeof firebaseMessagingInstance.setBadge === 'function') {
      firebaseMessagingInstance.setBadge(unreadCount);
      console.log('Badge count successfully updated to:', unreadCount);
    } else {
      console.warn('Firebase messaging instance or setBadge function not available. Badge count might not update.');
    }
  } catch (error) {
    console.error('Error calling messaging().setBadge:', error);
  }
};


// Headless task for background messages (when app is in background but not killed)
messaging().setBackgroundMessageHandler(async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
  console.log('Message handled in the background!', remoteMessage);
  const extracted = extractNotificationContent(remoteMessage);
  const notificationId = remoteMessage.messageId || Date.now().toString(); // Ensure unique ID

  let existingNotifications = await loadNotificationsFromStorage();
  const existingIndex = existingNotifications.findIndex(n => n.id === notificationId);

  if (existingIndex !== -1) {
    // Update existing notification, mark as unread if it's a new "ping"
    existingNotifications[existingIndex] = {
      ...existingNotifications[existingIndex],
      ...extracted,
      timestamp: Date.now(),
      read: false, // Re-mark as unread if it's received again in background
    };
    console.log('Existing notification updated in background.');
  } else {
    // Add new notification
    const newNotification: NotificationContent = {
      id: notificationId,
      ...extracted,
      timestamp: Date.now(),
      read: false, // Mark as unread when received in background
    };
    existingNotifications.push(newNotification);
    console.log('New notification added to storage in background.');
  }

  await saveNotificationsToStorage(existingNotifications);
  // Badge count will be updated when app comes to foreground and refreshStoredNotifications is called
  // (Alternatively, you could call updateBadgeCount here directly if you want real-time background badge updates,
  // but it's generally handled better by the foreground logic for consistency)
});


// Function to handle deep links
const handleDeepLink = (url: string) => {
  if (url) {
    const route = url.replace(/.*?:\/\//g, '');
    const screen = route.split('/')[0];
    const params = route.split('/')[1];
    console.log(`Deep link received: Screen: ${screen}, Params: ${params}`);
    Alert.alert('Deep Link', `Opened screen: ${screen} with params: ${params}`);
    // Here you would navigate to the specific screen based on 'screen' and 'params'
    // Example: navigation.navigate(screen, { id: params });
  }
};

// --- Main App Component ---
function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [storedNotifications, setStoredNotifications] = useState<NotificationContent[]>([]);

  // Callback to refresh stored notifications from AsyncStorage and update state
  const refreshStoredNotifications = useCallback(async () => {
    const notifications = await loadNotificationsFromStorage();
    // Sort by timestamp descending for display (latest first)
    notifications.sort((a, b) => b.timestamp - a.timestamp);
    setStoredNotifications(notifications);
    console.log('Stored notifications refreshed and state updated.');
  }, []); // No dependencies, as loadNotificationsFromStorage is global

  // Function to get FCM token
  const getFcmToken = useCallback(async () => {
    const fcmToken = await messaging().getToken();
    if (fcmToken) {
      console.log('Your Firebase Token is:', fcmToken);
      Alert.alert('FCM Token', `Your FCM Token: ${fcmToken}\nUse this to send push notifications.`);
    } else {
      console.log('Failed to get FCM token');
    }
  }, []);

  // Function to request notification permissions
  const requestUserPermission = useCallback(async () => {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      console.log('Authorization status:', authStatus);
      getFcmToken();
    } else {
      console.log('Failed to get authorization status');
      Alert.alert('Permission Denied', 'Notification permission was denied. You may not receive push notifications.');
    }

    if (Platform.OS === 'android' && Platform.Version >= 33) {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          {
            title: "Notification Permission",
            message: "This app needs access to send you notifications.",
            buttonNeutral: "Ask Me Later",
            buttonNegative: "Cancel",
            buttonPositive: "OK"
          }
        );
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          console.log("POST_NOTIFICATIONS permission granted");
        } else {
          console.log("POST_NOTIFICATIONS permission denied");
        }
      } catch (err) {
        console.warn('Error requesting POST_NOTIFICATIONS permission:', err);
      }
    }
  }, [getFcmToken]);

  // Function to mark all notifications as read and reset badge count
  const markAllNotificationsAsRead = async () => {
    console.log('Mark All As Read button pressed!');
    try {
      const existingNotifications = await loadNotificationsFromStorage();
      const updatedNotifications = existingNotifications.map(notif => ({ ...notif, read: true }));
      await saveNotificationsToStorage(updatedNotifications);
      console.log('All notifications marked as read in storage.');
      refreshStoredNotifications(); // Refresh state to update UI and badge
    } catch (e) {
      console.error('Failed to mark notifications as read', e);
    }
  };

  useEffect(() => {
    // Request permissions and get token on app start
    requestUserPermission();

    // Load existing notifications and update badge count on app start
    refreshStoredNotifications();

    // Foreground messages (when app is open and active)
    const unsubscribeOnMessage = messaging().onMessage(async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
      console.log('A new FCM message arrived in foreground!', remoteMessage);
      const extracted = extractNotificationContent(remoteMessage);
      const notificationId = remoteMessage.messageId || Date.now().toString(); // Ensure unique ID

      let existingNotifications = await loadNotificationsFromStorage();
      const existingIndex = existingNotifications.findIndex(n => n.id === notificationId);

      let notificationToSave: NotificationContent;

      if (existingIndex !== -1) {
        // Update existing notification, ensure it's marked unread and timestamp updated
        notificationToSave = {
          ...existingNotifications[existingIndex],
          ...extracted, // Update title/body/data if they changed
          timestamp: Date.now(), // Bring to top of list
          read: false, // Mark as unread if it's a new foreground message
        };
        existingNotifications[existingIndex] = notificationToSave;
        console.log('Foreground: Existing notification updated.');
      } else {
        // Add new notification
        notificationToSave = {
          id: notificationId,
          ...extracted,
          timestamp: Date.now(),
          read: false, // Mark as unread when received in foreground
        };
        existingNotifications.push(notificationToSave);
        console.log('Foreground: New notification added.');
      }

      await saveNotificationsToStorage(existingNotifications);
      refreshStoredNotifications(); // Refresh state to update UI and badge

      // Optionally show an alert for foreground messages
      Alert.alert(extracted.title, extracted.body);
    });

    // Handle initial notification when app is opened from a killed state by tapping a notification
    messaging().getInitialNotification().then(async (remoteMessage: FirebaseMessagingTypes.RemoteMessage | null) => {
      if (remoteMessage) {
        console.log('Notification caused app to open from killed state:', remoteMessage);
        const extracted = extractNotificationContent(remoteMessage);
        const notificationId = remoteMessage.messageId || Date.now().toString();

        let existingNotifications = await loadNotificationsFromStorage();
        const existingIndex = existingNotifications.findIndex(n => n.id === notificationId);

        let notificationToSave: NotificationContent;

        if (existingIndex !== -1) {
          // If exists, mark it as read and update its content, bring to top
          notificationToSave = {
            ...existingNotifications[existingIndex],
            ...extracted,
            timestamp: Date.now(),
            read: true,
          };
          existingNotifications[existingIndex] = notificationToSave;
          console.log('Killed state: Existing notification updated and marked read.');
        } else {
          // If it's a truly new notification, add it as read
          notificationToSave = {
            id: notificationId,
            ...extracted,
            timestamp: Date.now(),
            read: true,
          };
          existingNotifications.push(notificationToSave);
          console.log('Killed state: New notification added and marked read.');
        }

        await saveNotificationsToStorage(existingNotifications);
        refreshStoredNotifications(); // Refresh state to update UI and badge
        handleDeepLink(remoteMessage.data?.link || '');
      }
    });

    // Handle notification when app is in background and opened by tapping a notification
    const unsubscribeOnNotificationOpenedApp = messaging().onNotificationOpenedApp(async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
      console.log('Notification caused app to open from background state:', remoteMessage);
      const extracted = extractNotificationContent(remoteMessage);
      const notificationId = remoteMessage.messageId || Date.now().toString();

      let existingNotifications = await loadNotificationsFromStorage();
      const existingIndex = existingNotifications.findIndex(n => n.id === notificationId);

      let notificationToSave: NotificationContent;

      if (existingIndex !== -1) {
        // If exists, mark it as read and update its content, bring to top
        notificationToSave = {
          ...existingNotifications[existingIndex],
          ...extracted,
          timestamp: Date.now(),
          read: true,
        };
        existingNotifications[existingIndex] = notificationToSave;
        console.log('Background opened: Existing notification updated and marked read.');
      } else {
        // If it's a truly new notification, add it as read
        notificationToSave = {
          id: notificationId,
          ...extracted,
          timestamp: Date.now(),
          read: true,
        };
        existingNotifications.push(notificationToSave);
        console.log('Background opened: New notification added and marked read.');
      }

      await saveNotificationsToStorage(existingNotifications);
      refreshStoredNotifications(); // Refresh state to update UI and badge
      handleDeepLink(remoteMessage.data?.link || '');
    });

    // Handle deep links from outside FCM (e.g., browser)
    const unsubscribeLinking = Linking.addEventListener('url', ({ url }: { url: string }) => {
      handleDeepLink(url);
    });

    // Initial check for deep links if app was launched via one
    Linking.getInitialURL().then(url => {
      if (url) {
        handleDeepLink(url);
      }
    });

    return () => {
      unsubscribeOnMessage();
      unsubscribeOnNotificationOpenedApp();
      unsubscribeLinking.remove();
    };
  }, [refreshStoredNotifications, requestUserPermission]); // Added dependencies to useEffect

  // This useEffect will run whenever storedNotifications changes, ensuring badge count is always updated
  useEffect(() => {
    updateBadgeCount(storedNotifications);
  }, [storedNotifications]);


  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>React Native Push Notifications</Text>
          <Text style={styles.subtitle}>Internship Assignment</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>FCM Status</Text>
          <Text style={styles.sectionDescription}>
            This app integrates Firebase Cloud Messaging for push notifications.
            Ensure you grant notification permissions when prompted.
          </Text>
          <Button title="Get FCM Token" onPress={getFcmToken} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stored Notifications</Text>
          {storedNotifications.length === 0 ? (
            <Text style={styles.sectionDescription}>No notifications stored yet.</Text>
          ) : (
            <>
              {storedNotifications.map((notif) => (
                <View key={notif.id} style={styles.notificationItem}>
                  <Text style={styles.notificationItemTitle}>{notif.title}</Text>
                  <Text style={styles.notificationItemBody}>{notif.body}</Text>
                  <Text style={styles.notificationItemMeta}>
                    {new Date(notif.timestamp).toLocaleString()} - {notif.read ? 'Read' : 'Unread'}
                  </Text>
                </View>
              ))}
              <Button title="Mark All As Read" onPress={markAllNotificationsAsRead} />
            </>
          )}
        </View>


        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How to Test:</Text>
          <Text style={styles.sectionDescription}>
            1. Run the app on an Android device/emulator.
            2. Grant notification permissions.
            3. Copy the FCM Token displayed in the alert.
            4. Use the backend simulation (Step 6) to send a notification to this token.
            5. Test with the app in foreground, background, and killed states.
            6. Check the "Stored Notifications" section and the app icon badge.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
  scrollView: {
    backgroundColor: '#f0f4f8',
  },
  header: {
    backgroundColor: '#6200ee',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 18,
    color: '#e0e0e0',
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 15,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  sectionDescription: {
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
    marginBottom: 10,
  },
  notificationItem: {
    backgroundColor: '#e8f0fe',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#6200ee',
  },
  notificationItemTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  notificationItemBody: {
    fontSize: 14,
    color: '#555',
    marginTop: 4,
  },
  notificationItemMeta: {
    fontSize: 12,
    color: '#777',
    marginTop: 4,
  },
});

export default App;