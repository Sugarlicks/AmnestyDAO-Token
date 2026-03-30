interface NotificationData {
  [key: string]: string | number | boolean | null;
}

class NotificationService {
  private static instance: NotificationService;
  private isInitialized = false;

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async initialize() {
    if (this.isInitialized) return;

    // Web notification setup
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        // Web notification setup
      }
    }

    this.isInitialized = true;
  }

  async showNotification(title: string, body: string, data?: NotificationData) {
    // For web, use the browser's Notification API
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/icons/icon-192x192.png', // Make sure this icon exists in your public folder
          data
        });
      }
    }
  }
}

export const notificationService = NotificationService.getInstance(); 