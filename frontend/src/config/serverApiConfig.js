const getBackendServer = () => {
  if (typeof window !== 'undefined') {
    if (
      import.meta.env.PROD ||
      window.location.origin.includes('vercel.app') ||
      (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
    ) {
      return window.location.origin;
    }
  }
  if (import.meta.env.VITE_BACKEND_SERVER) {
    return import.meta.env.VITE_BACKEND_SERVER;
  }
  return 'http://localhost:8888/';
};

const backendServer = getBackendServer();

export const API_BASE_URL = backendServer.replace(/\/?$/, '/api/');
export const BASE_URL = backendServer.replace(/\/?$/, '/');

export const WEBSITE_URL =
  import.meta.env.VITE_WEBSITE_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000/');
export const DOWNLOAD_BASE_URL = backendServer.replace(/\/?$/, '/download/');
export const ACCESS_TOKEN_NAME = 'x-auth-token';

export const FILE_BASE_URL = import.meta.env.VITE_FILE_BASE_URL || BASE_URL;

export const SHOUTOUT_URL =
  import.meta.env.VITE_SHOUTOUT_URL || 'https://shoutout-three.vercel.app/dashboard';
