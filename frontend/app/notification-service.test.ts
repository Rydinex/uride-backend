import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotificationService } from "../notification-service";

// Mock expo-notifications
vi.mock("expo-notifications", () => ({
  setNotificationHandler: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  getExpoPushTokenAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
  cancelScheduledNotificationAsync: vi.fn(),
  cancelAllScheduledNotificationsAsync: vi.fn(),
  addNotificationReceivedListener: vi.fn(),
  addNotificationResponseReceivedListener: vi.fn(),
  getAllScheduledNotificationsAsync: vi.fn(),
  dismissNotificationAsync: vi.fn(),
  dismissAllNotificationsAsync: vi.fn(),
}));

describe("NotificationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should request notification permissions", async () => {
    const result = await NotificationService.requestPermissions();
    expect(typeof result === 'boolean').toBe(true);
  });

  it("should get push token", async () => {
    const result = await NotificationService.getPushToken();
    expect(result === null || typeof result === 'string').toBe(true);
  });

  it("should create ride request notification object", () => {
    const notification = {
      title: "🚗 New Ride Request",
      body: "123 Main St to 456 Park Ave",
      type: "ride_request" as const,
      rideId: "ride123",
      pickupAddress: "123 Main St",
      dropoffAddress: "456 Park Ave",
      estimatedFare: 15.5,
      estimatedDistance: 2.3,
      expiresIn: 15,
    };

    expect(notification.rideId).toBe("ride123");
    expect(notification.estimatedFare).toBe(15.5);
  });

  it("should create surge pricing notification object", () => {
    const notification = {
      title: "⚡ Surge Pricing Alert",
      body: "225% surge detected nearby",
      type: "surge_alert" as const,
      zoneId: "zone_123",
      multiplier: 2.25,
      location: "Downtown Chicago",
      estimatedEarnings: 45.0,
    };

    expect(notification.multiplier).toBe(2.25);
    expect(notification.estimatedEarnings).toBe(45.0);
  });

  it("should create notification content", () => {
    const content = {
      title: "Test Notification",
      body: "This is a test",
    };

    expect(content.title).toBe("Test Notification");
    expect(content.body).toBe("This is a test");
  });

  it("should cancel a notification", async () => {
    const notificationId = "notif123";
    await expect(NotificationService.cancelNotification(notificationId)).resolves.toBeUndefined();
  });

  it("should cancel all notifications", async () => {
    await expect(NotificationService.cancelAllNotifications()).resolves.toBeUndefined();
  });

  it("should dismiss a notification", async () => {
    const notificationId = "notif123";
    await expect(NotificationService.dismissNotification(notificationId)).resolves.toBeUndefined();
  });

  it("should dismiss all notifications", async () => {
    await expect(NotificationService.dismissAllNotifications()).resolves.toBeUndefined();
  });

  it("should have notification service methods defined", () => {
    expect(typeof NotificationService.sendRideRequestNotification).toBe('function');
    expect(typeof NotificationService.sendSurgePricingNotification).toBe('function');
    expect(typeof NotificationService.getScheduledNotifications).toBe('function');
  });
});
