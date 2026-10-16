const getBackendServer = () => {
  if (import.meta.env.VITE_BACKEND_SERVER) {
    return import.meta.env.VITE_BACKEND_SERVER;
  }
  if (typeof window !== 'undefined' && window.location.origin.includes('vercel.app')) {
    return window.location.origin;
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
