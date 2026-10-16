import React, { useState, useEffect } from 'react';
import {
  Row,
  Col,
  Card,
  Input,
  Select,
  Button,
  Tag,
  Space,
  Typography,
  Tabs,
  Badge,
  Tooltip,
  Dropdown,
  Popconfirm,
  Empty,
  Spin,
  message,
  Statistic,
} from 'antd';
import {
  SearchOutlined,
  FileTextOutlined,
  PlusOutlined,
  CopyOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
  TagOutlined,
  MailOutlined,
  CheckCircleOutlined,
  ShareAltOutlined,
  SolutionOutlined,
} from '@ant-design/icons';
import { request } from '@/request';
import TemplateFormModal, { TEMPLATE_CATEGORIES } from './TemplateFormModal';
import TemplatePreviewModal from './TemplatePreviewModal';

const { Title, Text, Paragraph } = Typography;

const CATEGORY_COLORS = {
  'HR Templates': '#1890ff',
  Communication: '#722ed1',
  'Marketing/Event': '#fa8c16',
};

export default function TemplateLibrary({ userRole }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedType, setSelectedType] = useState('All');
  const [searchText, setSearchText] = useState('');

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const queryParams = { items: 100 };
      if (activeCategory !== 'All') {
        queryParams.category = activeCategory;
      }
      if (selectedType !== 'All') {
        queryParams.type = selectedType;
      }
      if (searchText.trim()) {
        queryParams.search = searchText.trim();
      }

      const res = await request.list({
        entity: 'template',
        options: queryParams,
      });

      if (res && res.result) {
        setTemplates(res.result);
      } else {
        setTemplates([]);
      }
    } catch (err) {
      console.error('Error fetching templates:', err);
      message.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [activeCategory, selectedType]);

  const handleSearch = () => {
    fetchTemplates();
  };

  const handleDelete = async (id) => {
    try {
      const res = await request.delete({ entity: `template/delete/${id}` });
      if (res && res.success) {
        message.success('Template deleted successfully');
        fetchTemplates();
      } else {
        message.error(res?.message || 'Delete failed');
      }
    } catch (e) {
      message.error('Error deleting template');
    }
  };

  const handleCopyRaw = (content) => {
    navigator.clipboard.writeText(content);
    message.success('Template raw content copied!');
  };

  // KPI counts
  const hrCount = templates.filter((t) => t.category === 'HR Templates').length;
  const commCount = templates.filter((t) => t.category === 'Communication').length;
  const mktCount = templates.filter((t) => t.category === 'Marketing/Event').length;

  const currentAvailableTypes =
    activeCategory !== 'All' ? TEMPLATE_CATEGORIES[activeCategory] || [] : [];

  const tabItems = [
    {
      key: 'All',
      label: (
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          All Templates ({templates.length})
        </span>
      ),
    },
    {
      key: 'HR Templates',
      label: (
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          <SolutionOutlined style={{ marginRight: 6 }} /> HR Templates
        </span>
      ),
    },
    {
      key: 'Communication',
      label: (
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          <MailOutlined style={{ marginRight: 6 }} /> Communication
        </span>
      ),
    },
    {
      key: 'Marketing/Event',
      label: (
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          <ShareAltOutlined style={{ marginRight: 6 }} /> Marketing / Event
        </span>
      ),
    },
  ];

  return (
    <div>
      {/* Top Header & Metrics */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0, color: '#002244' }}>
            TecMotiv Template Library
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            Standardized company templates with automated variable interpolation and live preview.
          </Text>
        </div>

        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="large"
            style={{ borderRadius: 8, fontWeight: 600, background: '#002244', borderColor: '#002244' }}
            onClick={() => {
              setEditingTemplate(null);
              setIsFormModalOpen(true);
            }}
          >
            Create Template
          </Button>
        </Space>
      </div>

      {/* KPI Cards Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 8, borderLeft: '4px solid #1890ff' }}>
            <Statistic
              title="HR Operational Templates"
              value={hrCount}
              prefix={<SolutionOutlined style={{ color: '#1890ff' }} />}
              suffix="Standard Letters"
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 8, borderLeft: '4px solid #722ed1' }}>
            <Statistic
              title="Communication & Celebrations"
              value={commCount}
              prefix={<MailOutlined style={{ color: '#722ed1' }} />}
              suffix="Wishes & Notices"
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 8, borderLeft: '4px solid #fa8c16' }}>
            <Statistic
              title="Marketing & Event Notices"
              value={mktCount}
              prefix={<ShareAltOutlined style={{ color: '#fa8c16' }} />}
              suffix="Promos & Reminders"
            />
          </Card>
        </Col>
      </Row>

      {/* Tabs for Category */}
      <Tabs
        activeKey={activeCategory}
        onChange={(cat) => {
          setActiveCategory(cat);
          setSelectedType('All');
        }}
        items={tabItems}
        size="large"
        style={{ marginBottom: 12 }}
      />

      {/* Controls Bar */}
      <Card
        size="small"
        style={{
          borderRadius: 8,
          marginBottom: 20,
          background: '#fafafa',
          border: '1px solid #f0f0f0',
        }}
      >
        <Row gutter={[12, 12]} align="middle" justify="space-between">
          <Col xs={24} md={10}>
            {currentAvailableTypes.length > 0 && (
              <Space>
                <Text strong style={{ fontSize: 13 }}>Filter Sub-Type:</Text>
                <Select
                  value={selectedType}
                  onChange={setSelectedType}
                  style={{ width: 200 }}
                  options={[
                    { value: 'All', label: 'All Sub-Types' },
                    ...currentAvailableTypes.map((t) => ({ value: t, label: t })),
                  ]}
                />
              </Space>
            )}
          </Col>

          <Col xs={24} md={14} style={{ textAlign: 'right' }}>
            <Space>
              <Input
                placeholder="Search templates, variables, text..."
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onPressEnter={handleSearch}
                style={{ width: 280 }}
                allowClear
              />
              <Button onClick={fetchTemplates}>Search</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Template Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" tip="Loading template library..." />
        </div>
      ) : templates.length === 0 ? (
        <Card style={{ borderRadius: 12, textAlign: 'center', padding: '40px 0' }}>
          <Empty description="No templates found matching your selection." />
        </Card>
      ) : (
        <Row gutter={[20, 20]}>
          {templates.map((tmpl) => {
            const catColor = CATEGORY_COLORS[tmpl.category] || '#1890ff';
            const variables = tmpl.variables || [];

            return (
              <Col xs={24} sm={12} lg={8} key={tmpl._id}>
                <Card
                  hoverable
                  style={{
                    borderRadius: 10,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    border: '1px solid #e8e8e8',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                  }}
                  bodyStyle={{ padding: 18, flex: 1, display: 'flex', flexDirection: 'column' }}
                >
                  <div style={{ flex: 1 }}>
                    {/* Header tags */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <Tag color={catColor} style={{ fontWeight: 600, borderRadius: 4 }}>
                        {tmpl.type}
                      </Tag>
                      {tmpl.isDefault && (
                        <Tag color="cyan" style={{ fontSize: 11, borderRadius: 4 }}>
                          Standard
                        </Tag>
                      )}
                    </div>

                    {/* Title */}
                    <Title
                      level={5}
                      style={{
                        margin: '0 0 6px',
                        color: '#002244',
                        cursor: 'pointer',
                        fontSize: 15,
                        lineHeight: 1.3,
                      }}
                      onClick={() => setPreviewTemplate(tmpl)}
                    >
                      {tmpl.title}
                    </Title>

                    {/* Description */}
                    <Paragraph
                      ellipsis={{ rows: 2 }}
                      style={{ color: '#595959', fontSize: 13, marginBottom: 12, minHeight: 38 }}
                    >
                      {tmpl.description || 'Standard TecMotiv automated template.'}
                    </Paragraph>

                    {/* Subject snippet if present */}
                    {tmpl.subject && (
                      <div
                        style={{
                          background: '#f5f5f5',
                          padding: '6px 8px',
                          borderRadius: 6,
                          fontSize: 12,
                          color: '#595959',
                          marginBottom: 12,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        <strong>Subject:</strong> {tmpl.subject}
                      </div>
                    )}

                    {/* Variable Pills */}
                    <div style={{ marginBottom: 16 }}>
                      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
                        Variables:
                      </Text>
                      <Space wrap size={[4, 4]}>
                        {variables.slice(0, 4).map((v) => (
                          <Tag key={v.name} style={{ fontSize: 10, borderRadius: 4, background: '#e6f7ff', borderColor: '#91d5ff', color: '#0958d9' }}>
                            {`{{${v.name}}}`}
                          </Tag>
                        ))}
                        {variables.length > 4 && (
                          <Tag style={{ fontSize: 10, borderRadius: 4 }}>
                            +{variables.length - 4} more
                          </Tag>
                        )}
                      </Space>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                      paddingTop: 12,
                      borderTop: '1px solid #f0f0f0',
                    }}
                  >
                    <Button
                      type="primary"
                      icon={<EyeOutlined />}
                      style={{ flex: 1, background: '#002244', borderColor: '#002244', fontWeight: 600 }}
                      onClick={() => setPreviewTemplate(tmpl)}
                    >
                      Preview & Generate
                    </Button>

                    <Tooltip title="Copy Raw Text">
                      <Button icon={<CopyOutlined />} onClick={() => handleCopyRaw(tmpl.content)} />
                    </Tooltip>

                    <Dropdown
                      menu={{
                        items: [
                          {
                            key: 'edit',
                            label: 'Edit Template',
                            icon: <EditOutlined />,
                            onClick: () => {
                              setEditingTemplate(tmpl);
                              setIsFormModalOpen(true);
                            },
                          },
                          ...(!tmpl.isDefault
                            ? [
                                { type: 'divider' },
                                {
                                  key: 'delete',
                                  label: 'Delete Template',
                                  danger: true,
                                  icon: <DeleteOutlined />,
                                  onClick: () => handleDelete(tmpl._id),
                                },
                              ]
                            : []),
                        ],
                      }}
                    >
                      <Button icon={<MoreOutlined />} />
                    </Dropdown>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {/* Form Modal */}
      <TemplateFormModal
        visible={isFormModalOpen}
        templateData={editingTemplate}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingTemplate(null);
        }}
        onSuccess={fetchTemplates}
      />

      {/* Preview & Generate Modal */}
      <TemplatePreviewModal
        visible={Boolean(previewTemplate)}
        template={previewTemplate}
        onClose={() => setPreviewTemplate(null)}
      />
    </div>
  );
}
