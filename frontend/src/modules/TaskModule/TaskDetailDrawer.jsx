import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Typography,
  Tag,
  Space,
  Button,
  Divider,
  Checkbox,
  Input,
  List,
  Avatar,
  Progress,
  Upload,
  message,
  Popconfirm,
  Select,
  Tooltip,
  Modal,
} from 'antd';
import {
  CalendarOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  AlertOutlined,
  PlusOutlined,
  DeleteOutlined,
  SendOutlined,
  PaperClipOutlined,
  FileTextOutlined,
  ProjectOutlined,
  EditOutlined,
  UploadOutlined,
  CommentOutlined,
  GithubOutlined,
  BranchesOutlined,
  LinkOutlined,
  DisconnectOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { request } from '@/request';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const priorityColors = {
  Critical: '#ff4d4f',
  High: '#fa8c16',
  Medium: '#1890ff',
  Low: '#52c41a',
};

const statusColors = {
  'Not Started': 'default',
  'In Progress': 'processing',
  Waiting: 'warning',
  Completed: 'success',
  Overdue: 'error',
  Cancelled: 'default',
};

export default function TaskDetailDrawer({
  visible,
  onClose,
  taskId,
  onTaskUpdated,
  onEditTask,
}) {
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(false);

  // Subtask local input
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [submittingSubtask, setSubmittingSubtask] = useState(false);

  // Comment local input
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // File upload state
  const [uploadingFile, setUploadingFile] = useState(false);

  // GitHub Link state
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [linkType, setLinkType] = useState('commit');
  const [linkIdentifier, setLinkIdentifier] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkingGithub, setLinkingGithub] = useState(false);

  const fetchTaskDetails = async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const response = await request.read({ entity: 'task', id: taskId });
      if (response && response.result) {
        setTask(response.result);
      }
    } catch (err) {
      message.error('Failed to load task details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && taskId) {
      fetchTaskDetails();
    } else {
      setTask(null);
    }
  }, [visible, taskId]);

  // Status Change Handler
  const handleStatusChange = async (newStatus) => {
    try {
      const response = await request.patch({
        entity: `task/status/${taskId}`,
        jsonData: { status: newStatus },
      });
      if (response && response.result) {
        setTask(response.result);
        message.success(`Status updated to ${newStatus}`);
        if (onTaskUpdated) onTaskUpdated();
      }
    } catch (err) {
      message.error('Failed to update status');
    }
  };

  // Subtask Toggle Handler
  const handleToggleSubtask = async (subtaskId, completed) => {
    try {
      const response = await request.patch({
        entity: `task/${taskId}/subtask/${subtaskId}`,
        jsonData: { completed },
      });
      if (response && response.success) {
        setTask((prev) => ({
          ...prev,
          subtasks: response.result,
        }));
        if (onTaskUpdated) onTaskUpdated();
      }
    } catch (err) {
      message.error('Failed to update subtask');
    }
  };

  // Add Subtask Handler
  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim()) return;
    setSubmittingSubtask(true);
    try {
      const response = await request.post({
        entity: `task/${taskId}/subtask`,
        jsonData: { title: newSubtaskTitle.trim() },
      });
      if (response && response.success) {
        setTask((prev) => ({
          ...prev,
          subtasks: response.result,
        }));
        setNewSubtaskTitle('');
        message.success('Subtask added');
        if (onTaskUpdated) onTaskUpdated();
      }
    } catch (err) {
      message.error('Failed to add subtask');
    } finally {
      setSubmittingSubtask(false);
    }
  };

  // Delete Subtask Handler
  const handleDeleteSubtask = async (subtaskId) => {
    try {
      const response = await request.delete({
        entity: `task/${taskId}/subtask/${subtaskId}`,
      });
      if (response && response.success) {
        setTask((prev) => ({
          ...prev,
          subtasks: response.result,
        }));
        message.success('Subtask removed');
        if (onTaskUpdated) onTaskUpdated();
      }
    } catch (err) {
      message.error('Failed to delete subtask');
    }
  };

  // Add Comment Handler
  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setSubmittingComment(true);
    try {
      const response = await request.post({
        entity: `task/${taskId}/comment`,
        jsonData: { comment: newComment.trim() },
      });
      if (response && response.success) {
        setTask((prev) => ({
          ...prev,
          comments: response.result,
        }));
        setNewComment('');
        message.success('Comment posted');
      }
    } catch (err) {
      message.error('Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  // File Upload Handler
  const handleFileUpload = async (options) => {
    const { file, onSuccess, onError } = options;
    setUploadingFile(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', file.name);

    try {
      const response = await request.post({
        entity: `task/${taskId}/attachment`,
        jsonData: formData,
      });
      if (response && response.success) {
        setTask((prev) => ({
          ...prev,
          attachments: response.result,
        }));
        message.success(`${file.name} uploaded successfully`);
        onSuccess('Ok');
        if (onTaskUpdated) onTaskUpdated();
      } else {
        onError('Upload failed');
      }
    } catch (err) {
      message.error('Failed to upload file');
      onError(err);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleLinkGithub = async () => {
    if (!linkIdentifier.trim()) {
      message.error('Please provide an identifier (SHA, PR #, or Branch name)');
      return;
    }
    setLinkingGithub(true);
    try {
      let item = {};
      if (linkType === 'commit') {
        item = {
          sha: linkIdentifier.trim(),
          shortSha: linkIdentifier.trim().substring(0, 7),
          message: linkTitle.trim() || 'Manual commit link',
        };
      } else if (linkType === 'pullRequest') {
        item = {
          number: parseInt(linkIdentifier.trim(), 10),
          title: linkTitle.trim() || `PR #${linkIdentifier.trim()}`,
          state: 'open',
        };
      } else if (linkType === 'branch') {
        item = {
          name: linkIdentifier.trim(),
        };
      }

      const res = await request.post({
        entity: `task/${taskId}/github/link`,
        jsonData: { type: linkType, item },
      });

      if (res && res.success) {
        message.success('GitHub artifact linked successfully!');
        setLinkModalVisible(false);
        setLinkIdentifier('');
        setLinkTitle('');
        await fetchTaskDetails();
      } else {
        message.error(res?.message || 'Failed to link item.');
      }
    } catch (err) {
      message.error(err.message || 'Error communicating with server.');
    } finally {
      setLinkingGithub(false);
    }
  };

  const handleUnlinkGithub = async (type, identifier) => {
    try {
      const res = await request.post({
        entity: `task/${taskId}/github/unlink`,
        jsonData: { type, identifier },
      });
      if (res && res.success) {
        message.success('GitHub item unlinked.');
        await fetchTaskDetails();
      } else {
        message.error(res?.message || 'Failed to unlink item.');
      }
    } catch (err) {
      message.error(err.message || 'Error communicating with server.');
    }
  };

  if (!task) return null;

  const isOverdue =
    task.isOverdue ||
    (task.status !== 'Completed' &&
      task.status !== 'Cancelled' &&
      new Date(task.dueDate) < new Date());

  const subtasks = task.subtasks || [];
  const completedSubtasks = subtasks.filter((s) => s.completed).length;
  const subtaskProgress =
    subtasks.length > 0 ? Math.round((completedSubtasks / subtasks.length) * 100) : 0;

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Tag color={priorityColors[task.priority]} style={{ fontWeight: 600 }}>
              {task.priority?.toUpperCase()} PRIORITY
            </Tag>
            {isOverdue && <Tag color="error">OVERDUE</Tag>}
          </Space>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => {
              if (onEditTask) onEditTask(task);
            }}
          >
            Edit Task
          </Button>
        </div>
      }
      placement="right"
      width={640}
      onClose={onClose}
      open={visible}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Title & Status */}
        <div>
          <Title level={4} style={{ margin: 0 }}>
            {task.task || task.title}
          </Title>
          <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Status:
            </Text>
            <Select
              value={task.status}
              style={{ width: 160 }}
              onChange={handleStatusChange}
              options={[
                { value: 'Not Started', label: 'Not Started' },
                { value: 'In Progress', label: 'In Progress' },
                { value: 'Waiting', label: 'Waiting' },
                { value: 'Completed', label: 'Completed' },
                { value: 'Overdue', label: 'Overdue' },
                { value: 'Cancelled', label: 'Cancelled' },
              ]}
            />
          </div>
        </div>

        {/* Metadata Grid */}
        <div
          style={{
            padding: 16,
            borderRadius: 8,
            background: '#fafafa',
            border: '1px solid #f0f0f0',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 14,
          }}
        >
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Owner / Assignee:
            </Text>
            <div style={{ marginTop: 4 }}>
              <Space>
                <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
                <Text strong>{task.ownerName || 'Unassigned'}</Text>
              </Space>
            </div>
          </div>

          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Reviewer:
            </Text>
            <div style={{ marginTop: 4 }}>
              <Space>
                <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: '#722ed1' }} />
                <Text strong>{task.reviewerName || 'None'}</Text>
              </Space>
            </div>
          </div>

          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Department:
            </Text>
            <div style={{ marginTop: 4 }}>
              <Tag color="cyan">{task.department || 'General'}</Tag>
            </div>
          </div>

          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Project:
            </Text>
            <div style={{ marginTop: 4 }}>
              {task.projectName ? (
                <Tag color="purple">
                  <ProjectOutlined style={{ marginRight: 4 }} />
                  {task.projectName}
                </Tag>
              ) : (
                <Text type="secondary">N/A</Text>
              )}
            </div>
          </div>

          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Due Date:
            </Text>
            <div style={{ marginTop: 4 }}>
              <Space>
                <CalendarOutlined style={{ color: isOverdue ? '#ff4d4f' : '#595959' }} />
                <Text strong style={{ color: isOverdue ? '#cf1322' : 'inherit' }}>
                  {task.dueDate ? dayjs(task.dueDate).format('MMM DD, YYYY') : 'Not set'}
                </Text>
              </Space>
            </div>
          </div>

          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Created By:
            </Text>
            <div style={{ marginTop: 4 }}>
              <Text type="secondary">{task.createdByName || 'System'}</Text>
            </div>
          </div>
        </div>

        {/* Description */}
        {task.description && (
          <div>
            <Text strong style={{ fontSize: 14 }}>
              Description
            </Text>
            <Paragraph
              style={{
                marginTop: 8,
                padding: 12,
                borderRadius: 8,
                background: '#fff',
                border: '1px solid #f0f0f0',
                whiteSpace: 'pre-line',
              }}
            >
              {task.description}
            </Paragraph>
          </div>
        )}

        <Divider style={{ margin: '8px 0' }} />

        {/* Interactive Subtasks Checklist */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <Text strong style={{ fontSize: 15 }}>
                Subtasks ({completedSubtasks}/{subtasks.length})
              </Text>
            </Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {subtaskProgress}% Completed
            </Text>
          </div>

          {subtasks.length > 0 && (
            <div style={{ margin: '10px 0 16px' }}>
              <Progress
                percent={subtaskProgress}
                strokeColor="#52c41a"
                size="small"
                showInfo={false}
              />
            </div>
          )}

          {/* Subtask items list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {subtasks.map((st) => (
              <div
                key={st._id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  borderRadius: 6,
                  background: st.completed ? '#f6ffed' : '#fafafa',
                  border: `1px solid ${st.completed ? '#b7eb8f' : '#f0f0f0'}`,
                }}
              >
                <Checkbox
                  checked={st.completed}
                  onChange={(e) => handleToggleSubtask(st._id, e.target.checked)}
                >
                  <span
                    style={{
                      textDecoration: st.completed ? 'line-through' : 'none',
                      color: st.completed ? '#8c8c8c' : 'inherit',
                    }}
                  >
                    {st.title}
                  </span>
                </Checkbox>
                <Popconfirm
                  title="Remove this subtask?"
                  onConfirm={() => handleDeleteSubtask(st._id)}
                  okText="Yes"
                  cancelText="No"
                >
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                  />
                </Popconfirm>
              </div>
            ))}
          </div>

          {/* Add Subtask Input */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Input
              placeholder="Add a new subtask..."
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              onPressEnter={handleAddSubtask}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddSubtask}
              loading={submittingSubtask}
            >
              Add
            </Button>
          </div>
        </div>

        <Divider style={{ margin: '8px 0' }} />

        {/* Attachments Section */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Space>
              <PaperClipOutlined style={{ color: '#1890ff' }} />
              <Text strong style={{ fontSize: 15 }}>
                Attachments ({task.attachments?.length || 0})
              </Text>
            </Space>
            <Upload customRequest={handleFileUpload} showUploadList={false}>
              <Button icon={<UploadOutlined />} size="small" loading={uploadingFile}>
                Attach File
              </Button>
            </Upload>
          </div>

          {task.attachments && task.attachments.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {task.attachments.map((att) => (
                <div
                  key={att._id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: '#fafafa',
                    border: '1px solid #f0f0f0',
                  }}
                >
                  <Space>
                    <FileTextOutlined style={{ color: '#1890ff', fontSize: 18 }} />
                    <div>
                      <a
                        href={att.file?.startsWith('http') ? att.file : `/${att.file}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontWeight: 500 }}
                      >
                        {att.name}
                      </a>
                      <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                        Uploaded by {att.uploadedByName || 'User'} on{' '}
                        {dayjs(att.uploadedAt).format('MMM DD, YYYY')}
                      </div>
                    </div>
                  </Space>
                </div>
              ))}
            </div>
          ) : (
            <Text type="secondary" style={{ fontSize: 13, fontStyle: 'italic' }}>
              No files attached to this task.
            </Text>
          )}
        </div>

        <Divider style={{ margin: '8px 0' }} />

        {/* Linked GitHub Engineering Activity */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Space>
              <GithubOutlined style={{ color: '#002244', fontSize: 16 }} />
              <Text strong style={{ fontSize: 15 }}>
                GitHub Activity
              </Text>
            </Space>
            <Button
              size="small"
              icon={<LinkOutlined />}
              onClick={() => setLinkModalVisible(true)}
            >
              Link GitHub Item
            </Button>
          </div>

          {/* Commits */}
          {task.githubLinks?.commits && task.githubLinks.commits.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ fontSize: 12, color: '#627d98', display: 'block', marginBottom: 6 }}>
                COMMITS ({task.githubLinks.commits.length})
              </Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {task.githubLinks.commits.map((c) => (
                  <div
                    key={c.sha}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '6px 10px',
                      borderRadius: 6,
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <Space size={8} style={{ overflow: 'hidden' }}>
                      <Tag color="geekblue" style={{ fontFamily: 'monospace', margin: 0 }}>
                        {c.shortSha || (c.sha || '').substring(0, 7)}
                      </Tag>
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 13, color: '#102a43', fontWeight: 500 }}
                      >
                        {c.message || 'Commit'}
                      </a>
                    </Space>
                    <Popconfirm
                      title="Unlink commit?"
                      onConfirm={() => handleUnlinkGithub('commit', c.sha)}
                    >
                      <Button size="small" type="text" danger icon={<DisconnectOutlined />} />
                    </Popconfirm>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pull Requests */}
          {task.githubLinks?.pullRequests && task.githubLinks.pullRequests.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ fontSize: 12, color: '#627d98', display: 'block', marginBottom: 6 }}>
                PULL REQUESTS ({task.githubLinks.pullRequests.length})
              </Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {task.githubLinks.pullRequests.map((pr) => (
                  <div
                    key={pr.number}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '6px 10px',
                      borderRadius: 6,
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <Space size={8}>
                      <Tag
                        color={pr.isMerged ? 'purple' : pr.state === 'open' ? 'success' : 'default'}
                        style={{ margin: 0 }}
                      >
                        {pr.isMerged ? 'MERGED' : pr.state?.toUpperCase()}
                      </Tag>
                      <a
                        href={pr.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 13, color: '#102a43', fontWeight: 500 }}
                      >
                        #{pr.number} {pr.title}
                      </a>
                    </Space>
                    <Popconfirm
                      title="Unlink pull request?"
                      onConfirm={() => handleUnlinkGithub('pullRequest', pr.number)}
                    >
                      <Button size="small" type="text" danger icon={<DisconnectOutlined />} />
                    </Popconfirm>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Branches */}
          {task.githubLinks?.branches && task.githubLinks.branches.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ fontSize: 12, color: '#627d98', display: 'block', marginBottom: 6 }}>
                BRANCHES ({task.githubLinks.branches.length})
              </Text>
              <Space wrap>
                {task.githubLinks.branches.map((b) => (
                  <Tag
                    key={b.name}
                    icon={<BranchesOutlined />}
                    color="blue"
                    closable
                    onClose={(e) => {
                      e.preventDefault();
                      handleUnlinkGithub('branch', b.name);
                    }}
                  >
                    {b.name}
                  </Tag>
                ))}
              </Space>
            </div>
          )}

          {(!task.githubLinks ||
            (!task.githubLinks.commits?.length &&
              !task.githubLinks.pullRequests?.length &&
              !task.githubLinks.branches?.length)) && (
            <Text type="secondary" style={{ fontSize: 13, fontStyle: 'italic' }}>
              No GitHub commits, branches, or pull requests linked yet. Mention <code>[TASK-{task._id ? task._id.toString().substring(18) : 'ID'}]</code> in commit messages or link manually above.
            </Text>
          )}
        </div>

        <Divider style={{ margin: '8px 0' }} />

        {/* Comments Thread Section */}
        <div>
          <Space style={{ marginBottom: 12 }}>
            <CommentOutlined style={{ color: '#722ed1' }} />
            <Text strong style={{ fontSize: 15 }}>
              Comments & Discussion ({task.comments?.length || 0})
            </Text>
          </Space>

          {task.comments && task.comments.length > 0 && (
            <List
              itemLayout="horizontal"
              dataSource={task.comments}
              renderItem={(cmt) => (
                <List.Item style={{ padding: '10px 0', borderBottom: '1px solid #f5f5f5' }}>
                  <List.Item.Meta
                    avatar={
                      <Avatar style={{ backgroundColor: '#1890ff' }}>
                        {cmt.authorName?.[0] || 'U'}
                      </Avatar>
                    }
                    title={
                      <Space>
                        <Text strong style={{ fontSize: 13 }}>
                          {cmt.authorName}
                        </Text>
                        <Tag color="blue" style={{ fontSize: 10 }}>
                          {cmt.authorRole}
                        </Tag>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {dayjs(cmt.createdAt).format('MMM DD, hh:mm A')}
                        </Text>
                      </Space>
                    }
                    description={
                      <div style={{ color: '#262626', marginTop: 4, whiteSpace: 'pre-line' }}>
                        {cmt.comment}
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          )}

          {/* Post Comment Input */}
          <div style={{ marginTop: 12 }}>
            <TextArea
              rows={3}
              placeholder="Write a comment or status update..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
            />
            <div style={{ marginTop: 8, textAlign: 'right' }}>
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleAddComment}
                loading={submittingComment}
                disabled={!newComment.trim()}
              >
                Post Comment
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Modal
        title={
          <Space>
            <GithubOutlined />
            <span>Link GitHub Artifact to Task</span>
          </Space>
        }
        open={linkModalVisible}
        onCancel={() => setLinkModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setLinkModalVisible(false)}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={linkingGithub}
            onClick={handleLinkGithub}
            style={{ backgroundColor: '#002244' }}
          >
            Link to Task
          </Button>,
        ]}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 10 }}>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Artifact Type</Text>
            <Select
              value={linkType}
              onChange={setLinkType}
              style={{ width: '100%' }}
              options={[
                { value: 'commit', label: 'Commit SHA' },
                { value: 'pullRequest', label: 'Pull Request' },
                { value: 'branch', label: 'Branch Name' },
              ]}
            />
          </div>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>
              {linkType === 'commit'
                ? 'Commit SHA (40 or 7-character hash)'
                : linkType === 'pullRequest'
                ? 'PR Number (e.g. 42)'
                : 'Branch Name (e.g. feature/auth)'}
            </Text>
            <Input
              value={linkIdentifier}
              onChange={(e) => setLinkIdentifier(e.target.value)}
              placeholder={
                linkType === 'commit'
                  ? '7a8b9c0d1e...'
                  : linkType === 'pullRequest'
                  ? '42'
                  : 'feature/my-task'
              }
            />
          </div>
          {linkType !== 'branch' && (
            <div>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>Description / Title (Optional)</Text>
              <Input
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
                placeholder="Brief summary of change"
              />
            </div>
          )}
        </div>
      </Modal>
    </Drawer>
  );
}
