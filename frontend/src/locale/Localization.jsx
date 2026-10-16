import { ConfigProvider } from 'antd';

export default function Localization({ children }) {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#339393',
          colorLink: '#1640D6',
          borderRadius: 0,
        },
        components: {
          Menu: {
            itemSelectedColor: '#00474f',
            itemSelectedBg: '#e6f4f2',
          },
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
