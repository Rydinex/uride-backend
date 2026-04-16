import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: boolean;
  vibrate?: boolean;
}

export interface RideRequestNotification extends NotificationPayload {
  type: "ride_request";
  rideId: string;
  pickupAddress: string;
  dropoffAddress: string;
  estimatedFare: number;
  estimatedDistance: number;
  expiresIn: number; // seconds
}

export interface SurgePricingNotification extends NotificationPayload {
  type: "surge_alert";
  zoneId: string;
  multiplier: number;
  location: string;
  estimatedEarnings: number;
}

export class NotificationService {
  /**
   * Request notification permissions from user
   */
  static async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      return status === "granted";
    } catch (error) {
      console.error("Failed to request notification permissions:", error);
      return false;
    }
  }

  /**
   * Get device push token for backend notifications
   */
  static async getPushToken(): Promise<string | null> {
    try {
      const token = await Notifications.getExpoPushTokenAsync();
      return token.data;
    } catch (error) {
      console.error("Failed to get push token:", error);
      return null;
    }
  }

  /**
   * Send local ride request notification
   */
  static async sendRideRequestNotification(
    notification: RideRequestNotification
  ): Promise<string> {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: notification.title,
        body: notification.body,
        sound: notification.sound !== false ? "default" : undefined,
        vibrate: notification.vibrate !== false ? [0, 250, 250, 250] : undefined,
        data: {
          type: "ride_request",
          rideId: notification.rideId,
          pickupAddress: notification.pickupAddress,
          dropoffAddress: notification.dropoffAddress,
          estimatedFare: notification.estimatedFare,
          estimatedDistance: notification.estimatedDistance,
          ...notification.data,
        },
      },
      trigger: null, // Send immediately
    });
  }

  /**
   * Send local surge pricing alert notification
   */
  static async sendSurgePricingNotification(
    notification: SurgePricingNotification
  ): Promise<string> {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: notification.title,
        body: notification.body,
        sound: notification.sound !== false ? "default" : undefined,
        vibrate: notification.vibrate !== false ? [0, 250, 250, 250] : undefined,
        data: {
          type: "surge_alert",
          zoneId: notification.zoneId,
          multiplier: notification.multiplier,
          location: notification.location,
          estimatedEarnings: notification.estimatedEarnings,
          ...notification.data,
        },
      },
      trigger: null, // Send immediately
    });
  }

  /**
   * Schedule a delayed notification
   */
  static async scheduleNotification(
    content: Notifications.NotificationContentInput,
    delaySeconds: number
  ): Promise<string> {
    return await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        seconds: delaySeconds,
      } as any,
    });
  }

  /**
   * Cancel a scheduled notification
   */
  static async cancelNotification(notificationId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }

  /**
   * Cancel all scheduled notifications
   */
  static async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  /**
   * Listen for incoming notifications (foreground)
   */
  static onNotificationReceived(
    callback: (notification: Notifications.Notification) => void
  ) {
    return Notifications.addNotificationReceivedListener(callback);
  }

  /**
   * Listen for notification responses (when user taps notification)
   */
  static onNotificationResponse(
    callback: (response: Notifications.NotificationResponse) => void
  ) {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }

  /**
   * Get all scheduled notifications
   */
  static async getScheduledNotifications(): Promise<
    Notifications.NotificationRequest[]
  > {
    return await Notifications.getAllScheduledNotificationsAsync();
  }

  /**
   * Dismiss a notification by ID
   */
  static async dismissNotification(notificationId: string): Promise<void> {
    await Notifications.dismissNotificationAsync(notificationId);
  }

  /**
   * Dismiss all notifications
   */
  static async dismissAllNotifications(): Promise<void> {
    await Notifications.dismissAllNotificationsAsync();
  }
}
