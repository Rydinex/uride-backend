import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import * as Notifications from "expo-notifications";
import { NotificationService, RideRequestNotification, SurgePricingNotification } from "./notification-service";

export interface NotificationState {
  isPermissionGranted: boolean;
  pushToken: string | null;
  activeNotifications: Notifications.Notification[];
  rideRequestNotifications: Map<string, RideRequestNotification>;
  surgeAlertNotifications: Map<string, SurgePricingNotification>;
}

interface NotificationContextType extends NotificationState {
  requestPermissions: () => Promise<boolean>;
  sendRideRequestNotification: (notification: RideRequestNotification) => Promise<void>;
  sendSurgeAlert: (notification: SurgePricingNotification) => Promise<void>;
  dismissNotification: (notificationId: string) => Promise<void>;
  dismissAllNotifications: () => Promise<void>;
  cancelRideRequest: (rideId: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<NotificationState>({
    isPermissionGranted: false,
    pushToken: null,
    activeNotifications: [],
    rideRequestNotifications: new Map(),
    surgeAlertNotifications: new Map(),
  });

  const [notificationListeners, setNotificationListeners] = useState<{
    received?: Notifications.Subscription;
    response?: Notifications.Subscription;
  }>({});

  // Initialize notifications on mount
  useEffect(() => {
    const initializeNotifications = async () => {
      try {
        // Request permissions
        const permissionGranted = await NotificationService.requestPermissions();
        setState((prev) => ({ ...prev, isPermissionGranted: permissionGranted }));

        // Get push token
        if (permissionGranted) {
          const token = await NotificationService.getPushToken();
          setState((prev) => ({ ...prev, pushToken: token }));
        }

        // Set up notification listeners
        const receivedListener = NotificationService.onNotificationReceived((notification) => {
          console.log("Notification received:", notification);
          setState((prev) => ({
            ...prev,
            activeNotifications: [...prev.activeNotifications, notification],
          }));
        });

        const responseListener = NotificationService.onNotificationResponse((response) => {
          console.log("Notification response:", response);
          const { notification } = response;
          const data = notification.request.content.data;

          // Handle notification tap based on type
          if (data.type === "ride_request") {
            console.log("Ride request tapped:", data.rideId);
            // Navigate to ride acceptance screen
          } else if (data.type === "surge_alert") {
            console.log("Surge alert tapped:", data.zoneId);
            // Navigate to surge zone on map
          }
        });

        setNotificationListeners({
          received: receivedListener,
          response: responseListener,
        });
      } catch (error) {
        console.error("Failed to initialize notifications:", error);
      }
    };

    initializeNotifications();

    // Cleanup listeners on unmount
    return () => {
      notificationListeners.received?.remove();
      notificationListeners.response?.remove();
    };
  }, []);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    const granted = await NotificationService.requestPermissions();
    setState((prev) => ({ ...prev, isPermissionGranted: granted }));
    if (granted) {
      const token = await NotificationService.getPushToken();
      setState((prev) => ({ ...prev, pushToken: token }));
    }
    return granted;
  }, []);

  const sendRideRequestNotification = useCallback(
    async (notification: RideRequestNotification): Promise<void> => {
      try {
        const notificationId = await NotificationService.sendRideRequestNotification({
          ...notification,
          title: notification.title || "🚗 New Ride Request",
          body: notification.body || `${notification.pickupAddress} → ${notification.dropoffAddress}`,
        });

        setState((prev) => ({
          ...prev,
          rideRequestNotifications: new Map(prev.rideRequestNotifications).set(
            notification.rideId,
            notification
          ),
        }));

        // Auto-dismiss after expiration time
        if (notification.expiresIn) {
          setTimeout(() => {
            cancelRideRequest(notification.rideId);
          }, notification.expiresIn * 1000);
        }
      } catch (error) {
        console.error("Failed to send ride request notification:", error);
      }
    },
    []
  );

  const sendSurgeAlert = useCallback(
    async (notification: SurgePricingNotification): Promise<void> => {
      try {
        const multiplierText = `${(notification.multiplier * 100).toFixed(0)}%`;
        const earningsText = `+$${notification.estimatedEarnings.toFixed(2)}`;

        await NotificationService.sendSurgePricingNotification({
          ...notification,
          title: notification.title || `⚡ Surge Pricing Alert`,
          body: notification.body || `${multiplierText} surge in ${notification.location} • ${earningsText} potential`,
        });

        setState((prev) => ({
          ...prev,
          surgeAlertNotifications: new Map(prev.surgeAlertNotifications).set(
            notification.zoneId,
            notification
          ),
        }));
      } catch (error) {
        console.error("Failed to send surge alert notification:", error);
      }
    },
    []
  );

  const dismissNotification = useCallback(async (notificationId: string): Promise<void> => {
    try {
      await NotificationService.dismissNotification(notificationId);
    } catch (error) {
      console.error("Failed to dismiss notification:", error);
    }
  }, []);

  const dismissAllNotifications = useCallback(async (): Promise<void> => {
    try {
      await NotificationService.dismissAllNotifications();
      setState((prev) => ({
        ...prev,
        activeNotifications: [],
        rideRequestNotifications: new Map(),
        surgeAlertNotifications: new Map(),
      }));
    } catch (error) {
      console.error("Failed to dismiss all notifications:", error);
    }
  }, []);

  const cancelRideRequest = useCallback(async (rideId: string): Promise<void> => {
    setState((prev) => {
      const newMap = new Map(prev.rideRequestNotifications);
      newMap.delete(rideId);
      return {
        ...prev,
        rideRequestNotifications: newMap,
      };
    });
  }, []);

  const value: NotificationContextType = {
    ...state,
    requestPermissions,
    sendRideRequestNotification,
    sendSurgeAlert,
    dismissNotification,
    dismissAllNotifications,
    cancelRideRequest,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
}
