/**
 * Production logging utility for Android/iOS
 * Logs can be viewed via:
 * - ADB logcat (Android)
 * - Xcode console (iOS)
 * - Remote logging service (optional)
 */

import { useAuthStore } from '../stores/auth';
import { Capacitor } from '@capacitor/core';
import config from '../config';

interface LogEntry {
  level: 'log' | 'warn' | 'error' | 'info';
  message: string;
  timestamp: string;
  context?: any;
}

class ProductionLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // Keep last 1000 logs in memory
  private remoteLoggingEnabled = false;
  private remoteLoggingUrl: string | null = null;
  private appVersion: string | null = null;

  /**
   * Enable remote logging to send logs to a server
   */
  enableRemoteLogging(url: string) {
    this.remoteLoggingEnabled = true;
    this.remoteLoggingUrl = url;
  }

  /**
   * Set app version for logging
   */
  setAppVersion(version: string) {
    this.appVersion = version;
  }

  /**
   * Get all stored logs
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.logs = [];
  }

  /**
   * Export logs as JSON string
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Send logs to remote server
   */
  private async sendToRemote(entry: LogEntry) {
    if (!this.remoteLoggingEnabled || !this.remoteLoggingUrl) {
      return;
    }

    try {
      // Get auth token if available
      let authToken: string | null = null;
      try {
        const authStore = useAuthStore();
        if (authStore.jwt) {
          authToken = authStore.jwt;
        }
      } catch (error) {
        // Auth store might not be available, continue without token
      }

      // Get device/platform info
      const platform = Capacitor.getPlatform();
      const isNative = Capacitor.isNativePlatform();

      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      if (this.appVersion) {
        headers['X-App-Version'] = this.appVersion;
      }

      headers['X-Platform'] = platform || 'unknown';
      headers['X-Device-Id'] = this.getDeviceId();

      // Send log entry
      await fetch(this.remoteLoggingUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          level: entry.level,
          message: entry.message,
          timestamp: entry.timestamp,
          context: entry.context,
        }),
      });
    } catch (error) {
      // Silently fail - don't break the app if logging fails
      console.error('Failed to send log to remote:', error);
    }
  }

  /**
   * Get or generate a device ID (stored in localStorage)
   */
  private getDeviceId(): string {
    try {
      let deviceId = localStorage.getItem('device_id');
      if (!deviceId) {
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('device_id', deviceId);
      }
      return deviceId;
    } catch (error) {
      // localStorage might not be available
      return 'unknown';
    }
  }

  private logInternal(level: LogEntry['level'], message: string, ...args: any[]) {
    const entry: LogEntry = {
      level,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      timestamp: new Date().toISOString(),
      context: args.length > 0 ? args : undefined,
    };

    // Store log
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift(); // Remove oldest log
    }

    // Send to remote if enabled
    if (this.remoteLoggingEnabled) {
      this.sendToRemote(entry).catch(() => {
        // Ignore errors
      });
    }

    // Always log to console (will appear in ADB logcat)
    const consoleMethod = console[level] || console.log;
    consoleMethod(`[${entry.timestamp}] [${level.toUpperCase()}]`, message, ...args);
  }

  log(message: string, ...args: any[]) {
    this.logInternal('log', message, ...args);
  }

  info(message: string, ...args: any[]) {
    this.logInternal('info', message, ...args);
  }

  warn(message: string, ...args: any[]) {
    this.logInternal('warn', message, ...args);
  }

  error(message: string, ...args: any[]) {
    this.logInternal('error', message, ...args);
  }
}

// Export singleton instance
export const logger = new ProductionLogger();

// Enable remote logging automatically using the auth URL
// Can be overridden via environment variable
// Defer initialization to avoid circular dependency with config.ts
setTimeout(() => {
  try {
    const loggingUrl = import.meta.env.VITE_REMOTE_LOGGING_URL || `${config.authUrl}/api/logs`;
    logger.enableRemoteLogging(loggingUrl);
  } catch (error) {
    // Silently fail - config might not be ready yet, but that's okay
    // Remote logging will be disabled in this case
    console.warn('Failed to initialize remote logging:', error);
  }
}, 0);

