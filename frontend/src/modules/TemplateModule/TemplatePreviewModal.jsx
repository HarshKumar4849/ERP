import React, { useState, useEffect } from 'react';
import {
  Modal,
  Row,
  Col,
  Select,
  Input,
  Button,
  Card,
  Typography,
  Space,
  Tag,
  Divider,
  Alert,
  Tooltip,
  message,
} from 'antd';
import {
  FileTextOutlined,
  CopyOutlined,
  PrinterOutlined,
  DownloadOutlined,
  UserOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { request } from '@/request';

const { Title, Text, Paragraph } = Typography;

export default function TemplatePreviewModal({ visible, onClose, template }) {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [customVariables, setCustomVariables] = useState({});
  const [previewResult, setPreviewResult] = useState({
    renderedContent: '',
    renderedSubject: '',
    unresolvedVariables: [],
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await request.list({ entity: 'employee', options: { items: 100 } });
        if (res?.result) {
          setEmployees(res.result);
          if (res.result.length > 0 && !selectedEmployeeId) {
            setSelectedEmployeeId(res.result[0]._id);
          }
        }
      } catch (e) {
        console.error('Error fetching employees:', e);
      }
    };

    if (visible) {
      fetchEmployees();
      setCustomVariables({
        salary: '₹ 12,00,000 Per Annum',
        effectiveDate: dayjs().add(1, 'month').format('MMMM D, YYYY'),
        managerName: 'Aditya Varma (VP Engineering)',
        eventName: 'Annual Innovation Showcase 2026',
        eventDate: dayjs().add(14, 'day').format('MMMM D, YYYY'),
        venue: 'TecMotiv Corporate Auditorium',
        yearsCompleted: '3',
        festivalName: 'Diwali',
        awardTitle: 'Excellence in Enterprise Architecture',
      });
    }
  }, [visible]);

  // Call the secure preview endpoint whenever employee or customVariables change
  const fetchPreview = async () => {
    if (!template) return;
    try {
      setLoading(true);
      const res = await request.post({
        entity: `template/preview/${template._id}`,
        jsonData: {
          employeeId: selectedEmployeeId,
          variables: customVariables,
        },
      });

      if (res && res.result) {
        setPreviewResult(res.result);
      }
    } catch (e) {
      console.error('Error fetching preview:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && template) {
      fetchPreview();
    }
  }, [visible, template, selectedEmployeeId, customVariables]);

  const handleCopy = () => {
    const fullText = `${previewResult.renderedSubject ? `Subject: ${previewResult.renderedSubject}\n\n` : ''}${previewResult.renderedContent}`;
    navigator.clipboard.writeText(fullText);
    message.success('Rendered document copied to clipboard!');
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>${template?.title || 'TecMotiv Document'}</title>
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1f2937; line-height: 1.6; }
            .header { border-bottom: 2px solid #002244; padding-bottom: 12px; margin-bottom: 24px; }
            .company { font-size: 20px; font-weight: bold; color: #002244; }
            .address { font-size: 12px; color: #6b7280; }
            .subject { font-size: 15px; font-weight: bold; margin-bottom: 20px; color: #111827; }
            .content { white-space: pre-wrap; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company">TECMOTIV SOLUTIONS PVT. LTD.</div>
            <div class="address">TecMotiv Tower, Outer Ring Road, Bengaluru, Karnataka, 560103</div>
          </div>
          ${previewResult.renderedSubject ? `<div class="subject">Sub: ${previewResult.renderedSubject}</div>` : ''}
          <div class="content">${previewResult.renderedContent}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleDownloadTxt = () => {
    const fullText = `${previewResult.renderedSubject ? `SUBJECT: ${previewResult.renderedSubject}\n\n` : ''}${previewResult.renderedContent}`;
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${template?.title || 'template'}_${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!template) return null;

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 24 }}>
          <Space>
            <EyeOutlined style={{ color: '#1890ff' }} />
            <span style={{ fontSize: 17, color: '#002244' }}>
              Preview & Generate: {template.title}
            </span>
          </Space>
          <Tag color="blue">{template.category}</Tag>
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={1000}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
        <Button key="download" icon={<DownloadOutlined />} onClick={handleDownloadTxt}>
          Download .txt
        </Button>,
        <Button key="print" icon={<PrinterOutlined />} onClick={handlePrint}>
          Print / PDF
        </Button>,
        <Button
          key="copy"
          type="primary"
          icon={<CopyOutlined />}
          style={{ background: '#002244', borderColor: '#002244', fontWeight: 600 }}
          onClick={handleCopy}
        >
          Copy Rendered Text
        </Button>,
      ]}
      destroyOnClose
    >
      <Row gutter={[20, 20]}>
        {/* Left Column: Data Merge Controls */}
        <Col xs={24} md={9}>
          <Card
            size="small"
            title={<span style={{ fontSize: 13, fontWeight: 600 }}>Merge Data Controls</span>}
            style={{ borderRadius: 8, background: '#fafafa', border: '1px solid #e8e8e8' }}
          >
            {/* Employee Selector */}
            <div style={{ marginBottom: 14 }}>
              <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                <UserOutlined style={{ marginRight: 6, color: '#1890ff' }} />
                Select Employee for Auto-Fill:
              </Text>
              <Select
                value={selectedEmployeeId}
                onChange={setSelectedEmployeeId}
                style={{ width: '100%' }}
                placeholder="Choose colleague..."
                showSearch
                optionFilterProp="label"
                options={employees.map((e) => ({
                  value: e._id,
                  label: `${e.name} ${e.surname || ''} (${e.employeeId || 'ID'}) - ${e.departmentName || 'Employee'}`,
                }))}
              />
            </div>

            <Divider style={{ margin: '12px 0' }}>
              <span style={{ fontSize: 11, color: '#8c8c8c' }}>CUSTOM VARIABLE VALUES</span>
            </Divider>

            {/* Variable Overrides */}
            <div style={{ maxHeight: 260, overflowY: 'auto', paddingRight: 4 }}>
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>Compensation / Stipend {'{{salary}}'}</Text>
                  <Input
                    size="small"
                    value={customVariables.salary}
                    onChange={(e) => setCustomVariables({ ...customVariables, salary: e.target.value })}
                  />
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>Effective / Due Date {'{{effectiveDate}}'}</Text>
                  <Input
                    size="small"
                    value={customVariables.effectiveDate}
                    onChange={(e) => setCustomVariables({ ...customVariables, effectiveDate: e.target.value })}
                  />
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>Reporting Manager {'{{managerName}}'}</Text>
                  <Input
                    size="small"
                    value={customVariables.managerName}
                    onChange={(e) => setCustomVariables({ ...customVariables, managerName: e.target.value })}
                  />
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>Event Name {'{{eventName}}'}</Text>
                  <Input
                    size="small"
                    value={customVariables.eventName}
                    onChange={(e) => setCustomVariables({ ...customVariables, eventName: e.target.value })}
                  />
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>Venue Location {'{{venue}}'}</Text>
                  <Input
                    size="small"
                    value={customVariables.venue}
                    onChange={(e) => setCustomVariables({ ...customVariables, venue: e.target.value })}
                  />
                </div>
              </Space>
            </div>

            {/* Variable Status Indicator */}
            <div style={{ marginTop: 14 }}>
              {previewResult.unresolvedVariables?.length > 0 ? (
                <Alert
                  type="warning"
                  showIcon
                  icon={<WarningOutlined />}
                  message={
                    <span style={{ fontSize: 12 }}>
                      {previewResult.unresolvedVariables.length} Unresolved Variables:
                    </span>
                  }
                  description={
                    <Space wrap style={{ marginTop: 4 }}>
                      {previewResult.unresolvedVariables.map((v) => (
                        <Tag key={v} color="orange" style={{ fontSize: 11 }}>
                          {`{{${v}}}`}
                        </Tag>
                      ))}
                    </Space>
                  }
                />
              ) : (
                <Alert
                  type="success"
                  showIcon
                  icon={<CheckCircleOutlined />}
                  message={<span style={{ fontSize: 12 }}>All placeholders resolved cleanly!</span>}
                />
              )}
            </div>
          </Card>
        </Col>

        {/* Right Column: Live Rendered Document Paper View */}
        <Col xs={24} md={15}>
          <div
            style={{
              background: '#fff',
              border: '1px solid #d9d9d9',
              borderRadius: 8,
              padding: '24px 28px',
              minHeight: 460,
              maxHeight: 520,
              overflowY: 'auto',
              boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
              fontFamily: "'Segoe UI', Roboto, Helvetica, sans-serif",
            }}
          >
            {/* Letterhead Header */}
            <div
              style={{
                borderBottom: '2px solid #002244',
                paddingBottom: 12,
                marginBottom: 18,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#002244', letterSpacing: '0.5px' }}>
                  TECMOTIV SOLUTIONS PVT. LTD.
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                  TecMotiv Tower, Tech Enclave, Outer Ring Road, Bengaluru, 560103
                </div>
              </div>
              <Tag color="#002244" style={{ fontWeight: 600 }}>OFFICIAL DOCUMENT</Tag>
            </div>

            {/* Subject if applicable */}
            {previewResult.renderedSubject && (
              <div
                style={{
                  background: '#f0f5ff',
                  border: '1px solid #d6e4ff',
                  padding: '8px 12px',
                  borderRadius: 6,
                  marginBottom: 16,
                  fontWeight: 600,
                  fontSize: 13,
                  color: '#1d39c4',
                }}
              >
                Subject: {previewResult.renderedSubject}
              </div>
            )}

            {/* Rendered Body Text */}
            <div
              style={{
                whiteSpace: 'pre-wrap',
                fontSize: 13,
                lineHeight: 1.7,
                color: '#262626',
              }}
            >
              {previewResult.renderedContent || 'Loading preview...'}
            </div>
          </div>
        </Col>
      </Row>
    </Modal>
  );
}
