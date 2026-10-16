import { io } from 'socket.io-client';
import { BASE_URL } from '@/config/serverApiConfig';
import storePersist from '@/redux/storePersist';

let socketInstance = null;

export const getSocket = () => {
  const auth = storePersist.get('auth');
  const token = auth?.current?.token;

  if (!token) {
    if (socketInstance) {
      socketInstance.disconnect();
      socketInstance = null;
    }
    return null;
  }

  if (socketInstance && socketInstance.connected) {
    return socketInstance;
  }

  try {
    socketInstance = io(BASE_URL, {
      auth: {
        authorization: `Bearer ${token}`,
      },
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
      autoConnect: true,
    });

    socketInstance.on('connect_error', (err) => {
      // Non-blocking log; application gracefully falls back to HTTP polling
      console.warn('Socket connection warning (falling back to polling):', err.message);
    });

    return socketInstance;
  } catch (err) {
    console.warn('Socket initialization skipped:', err.message);
    return null;
  }
};

export const disconnectSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
};
