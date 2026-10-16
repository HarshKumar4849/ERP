import { Space, Layout, Divider, Typography } from 'antd';
import logo from '@/style/images/idurar-crm-erp.svg';
import useLanguage from '@/locale/useLanguage';
import { useSelector } from 'react-redux';

const { Content } = Layout;
const { Title, Text } = Typography;

export default function SideContent() {
  const translate = useLanguage();

  return (
    <Content
      style={{
        padding: '150px 30px 30px',
        width: '100%',
        maxWidth: '450px',
        margin: '0 auto',
      }}
      className="sideContent"
    >
      <div style={{ width: '100%' }}>
        <img
          src={logo}
          alt="TecMotiv Solutions"
          style={{ margin: '0 0 32px', display: 'block', maxWidth: '240px', height: 'auto' }}
        />

        <Title level={1} style={{ fontSize: 28, color: '#002244' }}>
          TecMotiv Solutions
        </Title>
        <Text style={{ fontSize: 15, color: '#595959' }}>
          Enterprise ERP, HR & Operations Management System
        </Text>

        <div className="space20"></div>
      </div>
    </Content>
  );
}
