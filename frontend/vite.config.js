import path from 'path';

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default ({ mode }) => {
  process.env = { ...process.env, ...loadEnv(mode, process.cwd()) };

  const proxy_url =
    process.env.VITE_DEV_REMOTE === 'remote'
      ? process.env.VITE_BACKEND_SERVER
      : 'http://localhost:8888/';

  const config = {
    plugins: [react()],
    resolve: {
      base: '/',
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: proxy_url,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('antd') || id.includes('@ant-design') || id.includes('rc-')) {
                return 'vendor-antd';
              }
              if (id.includes('@reduxjs') || id.includes('redux')) {
                return 'vendor-redux';
              }
              if (id.includes('dayjs') || id.includes('axios') || id.includes('currency.js')) {
                return 'vendor-utils';
              }
            }
          },
        },
      },
    },
  };
  return defineConfig(config);
};
