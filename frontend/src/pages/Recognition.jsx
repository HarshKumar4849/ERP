import React, { useEffect } from 'react';
import { Spin } from 'antd';
import { SHOUTOUT_URL } from '@/config/serverApiConfig';

export default function Recognition() {
  useEffect(() => {
    window.location.replace(SHOUTOUT_URL);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: 16,
      }}
    >
      <Spin size="large" />
      <span style={{ color: '#595959', fontSize: 14 }}>
        Redirecting to TecMotiv Shoutout Recognition system...
      </span>
    </div>
  );
}

