/**
 * Real-time WebSocket context.
 *
 * Connects to the NestJS Socket.io gateway after login, disconnects on logout.
 * Broadcasts `notification` and `assignment_updated` events to subscribers
 * registered via the hook.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { config } from '../libs/config';
import { ACCESS_TOKEN_KEY } from '../libs/session';

export interface NotificationEvent {
  id?: string;
  type: string;
  title: string;
  message: string;
  referenceId?: string | null;
  createdAt?: string;
}

export interface AssignmentUpdatedEvent {
  bookingId: string;
  assignmentId: string;
  status: string;
}

type EventMap = {
  notification: NotificationEvent;
  assignment_updated: AssignmentUpdatedEvent;
};

type Listener<T> = (data: T) => void;

interface SocketContextValue {
  connected: boolean;
  on: <K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>) => () => void;
  /** Latest unread notification count (resets to 0 on markAllRead). */
  unreadCount: number;
  notifications: NotificationEvent[];
  markAllRead: () => void;
}

const SocketContext = createContext<SocketContextValue>({
  connected: false,
  on: () => () => {},
  unreadCount: 0,
  notifications: [],
  markAllRead: () => {},
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // External event listeners registered via the `on()` helper.
  const listenersRef = useRef<Map<string, Set<Listener<unknown>>>>(new Map());

  const emit = useCallback((event: string, data: unknown) => {
    const listeners = listenersRef.current.get(event);
    if (listeners) {
      for (const fn of listeners) fn(data);
    }
  }, []);

  useEffect(() => {
    let socket: Socket;

    async function connect() {
      const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      if (!token) return;

      // Derive the WebSocket server URL from the REST API base URL.
      // e.g. http://192.168.1.5:4000/api → http://192.168.1.5:4000
      const wsUrl = config.apiUrl.replace(/\/api\/?$/, '');

      socket = io(wsUrl, {
        auth: { token },
        transports: ['websocket'],
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
      });

      socket.on('connect', () => setConnected(true));
      socket.on('disconnect', () => setConnected(false));

      socket.on('notification', (data: NotificationEvent) => {
        setNotifications((prev) => [data, ...prev]);
        setUnreadCount((n) => n + 1);
        emit('notification', data);
      });

      socket.on('assignment_updated', (data: AssignmentUpdatedEvent) => {
        emit('assignment_updated', data);
      });

      socketRef.current = socket;
    }

    void connect();

    return () => {
      socket?.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
    // Re-connect whenever the API URL changes (e.g. env switch).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const on = useCallback(
    <K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>) => {
      const map = listenersRef.current;
      if (!map.has(event)) map.set(event, new Set());
      (map.get(event) as Set<Listener<unknown>>).add(listener as Listener<unknown>);
      return () => {
        (map.get(event) as Set<Listener<unknown>>)?.delete(listener as Listener<unknown>);
      };
    },
    [],
  );

  const markAllRead = useCallback(() => setUnreadCount(0), []);

  return (
    <SocketContext.Provider value={{ connected, on, unreadCount, notifications, markAllRead }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
