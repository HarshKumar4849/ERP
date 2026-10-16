import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Tag,
  Space,
  Modal,
  Form,
  Select,
  DatePicker,
  Input,
  Upload,
  message,
  Popconfirm,
  Tooltip,
  Card,
  Row,
  Col,
  Typography,
} from 'antd';
import {
  FileProtectOutlined,
  UploadOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EyeOutlined,
  FilePdfOutlined,
  FileImageOutlined,
  FileWordOutlined,
  FileOutlined,
  AlertOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import axios from 'axios';
import { API_BASE_URL } from '@/config/serverApiConfig';
import storePersist from '@/redux/storePersist';
import { useSelector } from 'react-redux';
import { selectCurrentAdmin } from '@/redux/auth/selectors';
import { normalizeRole, ROLES } from '@/utils/rbac';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

const DOCUMENT_TYPES = [
  'Aadhaar',
  'PAN',
  'Passport',
  'Education Certificate',
  'Experience Letter',
  'Joining Letter',
  'Appointment Letter',
  'NDA',
  'Employment Agreement',
  'Bank Details',
  'Salary Documents',
  'Resignation',
  'Relieving Letter',
  'Other HR Documents',
];

const getDocTypeColor = (type) => {
  switch (type) {
    case 'Aadhaar':
    case 'PAN':
    case 'Passport':
      return 'blue';
    case 'NDA':
    case 'Employment Agreement':
      return 'purple';
    case 'Appointment Letter':
    case 'Joining Letter':
      return 'cyan';
    case 'Salary Documents':
    case 'Bank Details':
      return 'green';
    case 'Education Certificate':
    case 'Experience Letter':
      return 'geekblue';
    case 'Resignation':
    case 'Relieving Letter':
      return 'orange';
    default:
      return 'default';
  }
};

const getFileIcon = (mime = '') => {
  if (mime.includes('pdf')) return <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />;
  if (mime.includes('image')) return <FileImageOutlined style={{ color: '#1677ff', fontSize: 18 }} />;
  if (mime.includes('word') || mime.includes('document'))
    return <FileWordOutlined style={{ color: '#2f54eb', fontSize: 18 }} />;
  return <FileOutlined style={{ color: '#8c8c8c', fontSize: 18 }} />;
};

const formatFileSize = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export default function EmployeeDocumentVault({ employeeId, employeeRecord }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});

  // Filters
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Upload Modal State
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadSubmitting, setUploadSubmitting] = useState(false);
  const [uploadFileList, setUploadFileList] = useState([]);
  const [uploadForm] = Form.useForm();

  // Verification Modal State
  const [verifyModalVisible, setVerifyModalVisible] = useState(false);
  const [verifySubmitting, setVerifySubmitting] = useState(false);
  const [verifyingDoc, setVerifyingDoc] = useState(null);
  const [verifyForm] = Form.useForm();

  const currentAdmin = useSelector(selectCurrentAdmin);
  const userRole = normalizeRole(currentAdmin?.role);
  const isPrivileged = [ROLES.ADMIN, ROLES.HR].includes(userRole);

  const getAuthHeaders = () => {
    const auth = storePersist.get('auth');
    const token = auth?.current?.token;
    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  };

  // Fetch Documents for this Employee
  const fetchDocuments = useCallback(async () => {
    if (!employeeId) return;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('employee', employeeId);
      params.append('items', 100);
      if (filterType !== 'all') params.append('documentType', filterType);
      if (filterStatus !== 'all') params.append('verificationStatus', filterStatus);

      const res = await axios.get(
        `${API_BASE_URL}document/list?${params.toString()}`,
        getAuthHeaders()
      );

      if (res.data.success) {
        setDocuments(res.data.result || []);
      }

      // Fetch summary stats
      const statsRes = await axios.get(
        `${API_BASE_URL}document/summary?employee=${employeeId}`,
        getAuthHeaders()
      );
      if (statsRes.data.success) {
        setStats(statsRes.data.result || {});
      }
    } catch (err) {
      console.error('Failed to load employee documents:', err);
      message.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [employeeId, filterType, filterStatus]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Secure Download / View
  const handleDownload = async (record, mode = 'attachment') => {
    try {
      const auth = storePersist.get('auth');
      const token = auth?.current?.token;
      const res = await axios.get(
        `${API_BASE_URL}document/download/${record._id}?mode=${mode}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob',
        }
      );

      const blob = new Blob([res.data], { type: record.file.mimeType || 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);

      if (mode === 'inline') {
        window.open(url, '_blank');
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', record.file.originalName || 'document.pdf');
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      setTimeout(() => window.URL.revokeObjectURL(url), 10000);
    } catch (err) {
      let errorMsg = 'Failed to download document.';
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          if (parsed.message) errorMsg = parsed.message;
        } catch (e) {
          errorMsg = 'Failed to load document file from server.';
        }
      } else if (err.response?.data?.message) {
        errorMsg = err.response.data.message;
      }
      message.error(errorMsg);
    }
  };

  // Delete Document
  const handleDelete = async (record) => {
    try {
      const res = await axios.delete(
        `${API_BASE_URL}document/delete/${record._id}`,
        getAuthHeaders()
      );
      if (res.data.success) {
        message.success('Document removed from vault.');
        fetchDocuments();
      } else {
        message.error(res.data.message || 'Failed to delete');
      }
    } catch (err) {
      message.error('Error deleting document');
    }
  };

  // Upload Form Submit
  const handleUploadSubmit = async (values) => {
    if (uploadFileList.length === 0) {
      message.error('Please attach a document file.');
      return;
    }

    try {
      setUploadSubmitting(true);
      const formData = new FormData();
      formData.append('employee', employeeId);
      formData.append('documentType', values.documentType);
      if (values.issueDate) formData.append('issueDate', values.issueDate.toISOString());
      if (values.expiryDate) formData.append('expiryDate', values.expiryDate.toISOString());
      if (values.remarks) formData.append('remarks', values.remarks);
      const fileToUpload = uploadFileList[0]?.originFileObj || uploadFileList[0];
      formData.append('file', fileToUpload);

      const auth = getAuthHeaders();
      const res = await axios.post(`${API_BASE_URL}document/upload`, formData, {
        headers: {
          ...auth.headers,
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.data.success) {
        message.success('Document uploaded to Vault successfully.');
        setUploadModalVisible(false);
        uploadForm.resetFields();
        setUploadFileList([]);
        fetchDocuments();
      } else {
        message.error(res.data.message || 'Upload failed');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Error uploading document';
      message.error(msg);
    } finally {
      setUploadSubmitting(false);
    }
  };

  // Verification Form Submit
  const handleVerifySubmit = async (values) => {
    if (!verifyingDoc) return;
    try {
      setVerifySubmitting(true);
      const res = await axios.patch(
        `${API_BASE_URL}document/verify/${verifyingDoc._id}`,
        {
          verificationStatus: values.verificationStatus,
          verificationRemarks: values.verificationRemarks || '',
        },
        getAuthHeaders()
      );

      if (res.data.success) {
        message.success(`Document marked as ${values.verificationStatus}`);
        setVerifyModalVisible(false);
        setVerifyingDoc(null);
        verifyForm.resetFields();
        fetchDocuments();
      } else {
        message.error(res.data.message || 'Verification failed');
      }
    } catch (err) {
      message.error('Error updating verification status');
    } finally {
      setVerifySubmitting(false);
    }
  };

  const columns = [
    {
      title: 'Document Type',
      key: 'documentType',
      width: 220,
      render: (_, record) => (
        <Space align="center" size="small">
          {getFileIcon(record.file?.mimeType)}
          <div>
            <Tag color={getDocTypeColor(record.documentType)} style={{ fontWeight: 600 }}>
              {record.documentType}
            </Tag>
            <div style={{ fontSize: 12, color: '#595959', marginTop: 3 }}>
              {record.file?.originalName}
            </div>
            <span style={{ fontSize: 11, color: '#8c8c8c' }}>
              {formatFileSize(record.file?.size)}
            </span>
          </div>
        </Space>
      ),
    },
    {
      title: 'Validity & Expiry',
      key: 'validity',
      width: 180,
      render: (_, record) => {
        const issue = record.issueDate ? dayjs(record.issueDate).format('DD MMM YYYY') : null;
        const expiry = record.expiryDate ? dayjs(record.expiryDate).format('DD MMM YYYY') : null;
        const status = record.expiryStatus || 'Valid';

        let badgeColor = 'green';
        if (status === 'Expired') badgeColor = 'red';
        else if (status === 'Expiring Soon') badgeColor = 'orange';

        return (
          <div style={{ fontSize: 12 }}>
            {issue && <div><strong>Issued:</strong> {issue}</div>}
            {expiry ? (
              <div>
                <strong>Expires:</strong> {expiry}
                <div style={{ marginTop: 2 }}>
                  <Tag color={badgeColor} style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>
                    {status}
                  </Tag>
                </div>
              </div>
            ) : (
              <span style={{ color: '#8c8c8c' }}>No expiration</span>
            )}
          </div>
        );
      },
    },
    {
      title: 'Verification',
      key: 'verificationStatus',
      width: 160,
      render: (_, record) => {
        const status = record.verificationStatus || 'Pending';
        let color = 'orange';
        let icon = <ClockCircleOutlined />;
        if (status === 'Verified') {
          color = 'green';
          icon = <CheckCircleOutlined />;
        } else if (status === 'Rejected') {
          color = 'red';
          icon = <CloseCircleOutlined />;
        }

        const tooltipContent = (
          <div>
            <div><strong>Status:</strong> {status}</div>
            {record.verifiedByName && <div><strong>Verifier:</strong> {record.verifiedByName}</div>}
            {record.verifiedAt && (
              <div><strong>Date:</strong> {dayjs(record.verifiedAt).format('DD MMM YYYY')}</div>
            )}
            {record.verificationRemarks && (
              <div><strong>Remarks:</strong> {record.verificationRemarks}</div>
            )}
          </div>
        );

        return (
          <Tooltip title={tooltipContent}>
            <Tag color={color} icon={icon} style={{ fontWeight: 600, padding: '3px 8px' }}>
              {status}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: 'Upload Details',
      key: 'uploadDetails',
      width: 160,
      render: (_, record) => (
        <div style={{ fontSize: 12, color: '#595959' }}>
          <div>{dayjs(record.uploadedAt).format('DD MMM YYYY')}</div>
          <span style={{ fontSize: 11, color: '#8c8c8c' }}>
            By: {record.uploadedByName || 'System'}
          </span>
          {record.remarks && (
            <div style={{ fontSize: 11, color: '#1677ff', fontStyle: 'italic', marginTop: 2 }}>
              "{record.remarks}"
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 140,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Secure View">
            <Button
              size="small"
              shape="circle"
              icon={<EyeOutlined />}
              onClick={() => handleDownload(record, 'inline')}
            />
          </Tooltip>
          <Tooltip title="Secure Download">
            <Button
              size="small"
              shape="circle"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(record, 'attachment')}
            />
          </Tooltip>
          {isPrivileged && (
            <>
              <Tooltip title="Verify / Review">
                <Button
                  size="small"
                  shape="circle"
                  icon={<FileProtectOutlined style={{ color: '#1677ff' }} />}
                  onClick={() => {
                    setVerifyingDoc(record);
                    verifyForm.setFieldsValue({
                      verificationStatus: record.verificationStatus || 'Verified',
                      verificationRemarks: record.verificationRemarks || '',
                    });
                    setVerifyModalVisible(true);
                  }}
                />
              </Tooltip>
              <Popconfirm
                title="Remove document from vault?"
                description="This marks the document record as deleted."
                okText="Delete"
                cancelText="Cancel"
                okButtonProps={{ danger: true }}
                onConfirm={() => handleDelete(record)}
              >
                <Button size="small" shape="circle" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ marginTop: 8 }}>
      {/* Vault KPI Summary Cards */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 6, backgroundColor: '#f0f5ff' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>Total Documents</Text>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1677ff' }}>
              {stats.total || documents.length}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 6, backgroundColor: '#f6ffed' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>Verified</Text>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#52c41a' }}>
              {stats.verified || 0}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 6, backgroundColor: '#fff7e6' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>Pending Review</Text>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fa8c16' }}>
              {stats.pending || 0}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 6, backgroundColor: '#fff1f0' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>Expiring / Expired</Text>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#f5222d' }}>
              {(stats.expired || 0) + (stats.expiringSoon || 0)}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Control Bar: Filters & Upload Button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <Space wrap>
          <Select
            size="small"
            style={{ width: 170 }}
            aria-label="Filter documents by type"
            value={filterType}
            onChange={setFilterType}
            placeholder="Document Type"
          >
            <Option value="all">All Document Types</Option>
            {DOCUMENT_TYPES.map((t) => (
              <Option key={t} value={t}>{t}</Option>
            ))}
          </Select>

          <Select
            size="small"
            style={{ width: 140 }}
            aria-label="Filter documents by verification status"
            value={filterStatus}
            onChange={setFilterStatus}
            placeholder="Verification"
          >
            <Option value="all">All Statuses</Option>
            <Option value="Verified">Verified</Option>
            <Option value="Pending">Pending</Option>
            <Option value="Rejected">Rejected</Option>
          </Select>
        </Space>

        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => {
            uploadForm.resetFields();
            setUploadFileList([]);
            setUploadModalVisible(true);
          }}
        >
          Upload Document
        </Button>
      </div>

      {/* Documents Table */}
      <Table
        rowKey="_id"
        size="small"
        columns={columns}
        dataSource={documents}
        loading={loading}
        scroll={{ x: 800 }}
        pagination={{ pageSize: 5, showSizeChanger: false }}
      />

      {/* Upload Document Modal */}
      <Modal
        title={`Upload Document to Vault • ${employeeRecord?.name || ''} (${employeeRecord?.employeeId || ''})`}
        open={uploadModalVisible}
        onCancel={() => setUploadModalVisible(false)}
        onOk={() => uploadForm.submit()}
        confirmLoading={uploadSubmitting}
        okText="Upload to Vault"
        destroyOnClose
        width={560}
      >
        <Form form={uploadForm} layout="vertical" onFinish={handleUploadSubmit} style={{ marginTop: 12 }}>
          <Form.Item
            name="documentType"
            label="Document Classification"
            rules={[{ required: true, message: 'Please select document type' }]}
          >
            <Select placeholder="Select Document Type" aria-label="Document type" showSearch>
              {DOCUMENT_TYPES.map((t) => (
                <Option key={t} value={t}>{t}</Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="issueDate" label="Issue Date">
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="expiryDate" label="Expiry Date (if applicable)">
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="remarks" label="Notes / Identification Number">
            <Input placeholder="e.g. Document serial or verification notes" />
          </Form.Item>

          <Form.Item
            label="Select Document File"
            required
            tooltip="Accepted formats: PDF, JPG, PNG, WEBP, DOCX (Max 10MB)"
          >
            <Upload
              beforeUpload={(file) => {
                setUploadFileList([file]);
                return false;
              }}
              fileList={uploadFileList}
              onRemove={() => setUploadFileList([])}
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>Choose File from Computer</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      {/* Verification Modal */}
      <Modal
        title={`Verify Document: ${verifyingDoc?.documentType || ''}`}
        open={verifyModalVisible}
        onCancel={() => setVerifyModalVisible(false)}
        onOk={() => verifyForm.submit()}
        confirmLoading={verifySubmitting}
        okText="Save Verification"
        destroyOnClose
      >
        <Form form={verifyForm} layout="vertical" onFinish={handleVerifySubmit} style={{ marginTop: 12 }}>
          <Form.Item
            name="verificationStatus"
            label="Verification Decision"
            rules={[{ required: true, message: 'Select verification status' }]}
          >
            <Select aria-label="Verification status">
              <Option value="Verified">Verified (Compliant)</Option>
              <Option value="Pending">Pending (Under Review)</Option>
              <Option value="Rejected">Rejected (Incomplete / Invalid)</Option>
            </Select>
          </Form.Item>

          <Form.Item name="verificationRemarks" label="Verification Remarks / Audit Notes">
            <TextArea
              rows={3}
              placeholder="e.g. Verified with original government registry, stamped and approved."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
