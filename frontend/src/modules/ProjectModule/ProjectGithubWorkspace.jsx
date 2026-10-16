import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Tabs,
  Table,
  Tag,
  Button,
  Space,
  Input,
  Modal,
  Form,
  Avatar,
  Typography,
  Tooltip,
  Alert,
  Spin,
  Empty,
  Popconfirm,
  Select,
  message,
} from 'antd';
import {
  GithubOutlined,
  BranchesOutlined,
  PullRequestOutlined,
  BugOutlined,
  SyncOutlined,
  LinkOutlined,
  DisconnectOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { request } from '@/request';

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

export default function ProjectGithubWorkspace({ project, onRefresh }) {
  const [overview, setOverview] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [overviewError, setOverviewError] = useState(null);

  // Active sub-tab
  const [subTab, setSubTab] = useState('commits');

  // Commits
  const [commits, setCommits] = useState([]);
  const [loadingCommits, setLoadingCommits] = useState(false);
  const [commitPage, setCommitPage] = useState(1);
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [branches, setBranches] = useState([]);

  // Pull Requests
  const [pulls, setPulls] = useState([]);
  const [loadingPulls, setLoadingPulls] = useState(false);
  const [pullFilter, setPullFilter] = useState('all');

  // Issues
  const [issues, setIssues] = useState([]);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [issueFilter, setIssueFilter] = useState('all');

  // Activities (Webhook Stream)
  const [activities, setActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // Syncing state
  const [syncing, setSyncing] = useState(false);

  // Link Modal
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [linking, setLinking] = useState(false);
  const [form] = Form.useForm();

  // Load Overview
  const fetchOverview = useCallback(async () => {
    if (!project?._id) return;
    setLoadingOverview(true);
    setOverviewError(null);
    try {
      const res = await request.get({ entity: `github/project/${project._id}/overview` });
      if (res && res.success) {
        setOverview(res.result);
        if (res.result.defaultBranch) {
          setSelectedBranch(res.result.defaultBranch);
        }
      } else {
        setOverviewError(res?.message || 'Failed to load GitHub overview.');
      }
    } catch (err) {
      setOverviewError(err.message || 'Unable to connect to GitHub service.');
    } finally {
      setLoadingOverview(false);
    }
  }, [project?._id]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // Load Branches
  const fetchBranches = useCallback(async () => {
    if (!project?._id || !overview?.enabled) return;
    try {
      const res = await request.get({ entity: `github/project/${project._id}/branches` });
      if (res && res.success && Array.isArray(res.result)) {
        setBranches(res.result);
      }
    } catch (err) {
      // Non-fatal, fallback to default branch
    }
  }, [project?._id, overview?.enabled]);

  // Load Commits
  const fetchCommits = useCallback(async (page = 1, branch = selectedBranch) => {
    if (!project?._id || !overview?.enabled) return;
    setLoadingCommits(true);
    try {
      const res = await request.get({
        entity: `github/project/${project._id}/commits?page=${page}&limit=10&branch=${encodeURIComponent(branch)}`,
      });
      if (res && res.success) {
        setCommits(res.result || []);
        setCommitPage(page);
      }
    } catch (err) {
      message.error('Failed to load recent commits.');
    } finally {
      setLoadingCommits(false);
    }
  }, [project?._id, overview?.enabled, selectedBranch]);

  // Load Pull Requests
  const fetchPulls = useCallback(async (state = pullFilter) => {
    if (!project?._id || !overview?.enabled) return;
    setLoadingPulls(true);
    try {
      const res = await request.get({
        entity: `github/project/${project._id}/pulls?state=${state}&limit=15`,
      });
      if (res && res.success) {
        setPulls(res.result || []);
      }
    } catch (err) {
      message.error('Failed to load pull requests.');
    } finally {
      setLoadingPulls(false);
    }
  }, [project?._id, overview?.enabled, pullFilter]);

  // Load Issues
  const fetchIssues = useCallback(async (state = issueFilter) => {
    if (!project?._id || !overview?.enabled) return;
    setLoadingIssues(true);
    try {
      const res = await request.get({
        entity: `github/project/${project._id}/issues?state=${state}&limit=15`,
      });
      if (res && res.success) {
        setIssues(res.result || []);
      }
    } catch (err) {
      message.error('Failed to load issues.');
    } finally {
      setLoadingIssues(false);
    }
  }, [project?._id, overview?.enabled, issueFilter]);

  // Load Activity Stream
  const fetchActivities = useCallback(async () => {
    if (!project?._id || !overview?.enabled) return;
    setLoadingActivities(true);
    try {
      const res = await request.get({
        entity: `github/project/${project._id}/activity?limit=25`,
      });
      if (res && res.success) {
        setActivities(res.result || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingActivities(false);
    }
  }, [project?._id, overview?.enabled]);

  // Trigger loads when active subTab changes
  useEffect(() => {
    if (overview?.enabled) {
      fetchBranches();
      if (subTab === 'commits') fetchCommits(commitPage, selectedBranch);
      else if (subTab === 'pulls') fetchPulls(pullFilter);
      else if (subTab === 'issues') fetchIssues(issueFilter);
      else if (subTab === 'activity') fetchActivities();
    }
  }, [overview?.enabled, subTab, fetchBranches, fetchCommits, fetchPulls, fetchIssues, fetchActivities, commitPage, selectedBranch, pullFilter, issueFilter]);

  // Reconcile Sync Handler
  const handleReconcileSync = async () => {
    setSyncing(true);
    try {
      const res = await request.post({
        entity: `github/project/${project._id}/sync`,
        jsonData: {},
      });
      if (res && res.success) {
        message.success('GitHub repository synchronized successfully!');
        await fetchOverview();
        if (subTab === 'commits') fetchCommits(commitPage, selectedBranch);
        else if (subTab === 'pulls') fetchPulls(pullFilter);
        else if (subTab === 'issues') fetchIssues(issueFilter);
        else if (subTab === 'activity') fetchActivities();
      } else {
        message.error(res?.message || 'Synchronization failed.');
      }
    } catch (err) {
      message.error(err.message || 'Error communicating with server.');
    } finally {
      setSyncing(false);
    }
  };

  // Link Repository Handler
  const handleLink = async (values) => {
    setLinking(true);
    try {
      const res = await request.post({
        entity: `github/project/${project._id}/link`,
        jsonData: { repositoryUrl: values.repositoryUrl },
      });
      if (res && res.success) {
        message.success(res.message || 'Repository linked successfully!');
        setLinkModalVisible(false);
        form.resetFields();
        await fetchOverview();
        if (onRefresh) onRefresh();
      } else {
        message.error(res?.message || 'Failed to link repository.');
      }
    } catch (err) {
      message.error(err.message || 'Error communicating with server.');
    } finally {
      setLinking(false);
    }
  };

  // Unlink Repository Handler
  const handleUnlink = async () => {
    try {
      const res = await request.post({
        entity: `github/project/${project._id}/unlink`,
        jsonData: {},
      });
      if (res && res.success) {
        message.success('GitHub repository unlinked.');
        await fetchOverview();
        if (onRefresh) onRefresh();
      } else {
        message.error(res?.message || 'Failed to unlink repository.');
      }
    } catch (err) {
      message.error(err.message || 'Error communicating with server.');
    }
  };

  if (loadingOverview) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 0' }}>
        <Spin size="large" />
        <div style={{ marginTop: 12, color: '#8c8c8c' }}>Loading GitHub repository workspace...</div>
      </div>
    );
  }

  if (overviewError) {
    return (
      <Alert
        type="error"
        showIcon
        message="GitHub Workspace Error"
        description={overviewError}
        action={
          <Button size="small" type="primary" onClick={fetchOverview}>
            Retry
          </Button>
        }
        style={{ margin: '20px 0' }}
      />
    );
  }

  // UNLINKED STATE
  if (!overview || !overview.enabled) {
    return (
      <div style={{ padding: '30px 10px', textAlign: 'center' }}>
        <Empty
          image={<GithubOutlined style={{ fontSize: 64, color: '#8c8c8c' }} />}
          description={
            <div style={{ maxWidth: 440, margin: '12px auto' }}>
              <Title level={5} style={{ color: '#002244', marginBottom: 4 }}>
                No GitHub Repository Linked
              </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Connect this project to a repository in the{' '}
                <strong>Tecmotiv-Solutions</strong> GitHub organization to view live commits, pull
                requests, and development activity.
              </Text>
            </div>
          }
        >
          {overview?.canManage ? (
            <Button
              type="primary"
              icon={<LinkOutlined />}
              onClick={() => setLinkModalVisible(true)}
              style={{ backgroundColor: '#002244', borderColor: '#002244' }}
            >
              Link GitHub Repository
            </Button>
          ) : (
            <Text type="secondary" style={{ fontStyle: 'italic', display: 'block' }}>
              Contact your Project Manager or Administrator to link a GitHub repository.
            </Text>
          )}
        </Empty>

        {/* Modal for linking */}
        <Modal
          title={
            <Space>
              <GithubOutlined style={{ fontSize: 20, color: '#002244' }} />
              <span>Link GitHub Repository</span>
            </Space>
          }
          open={linkModalVisible}
          onCancel={() => setLinkModalVisible(false)}
          footer={null}
          destroyOnClose
        >
          <Paragraph type="secondary" style={{ fontSize: 12 }}>
            Enter the repository full name (e.g. <code>Tecmotiv-Solutions/erp-system</code>) or the
            full GitHub URL.
          </Paragraph>
          <Form form={form} layout="vertical" onFinish={handleLink}>
            <Form.Item
              name="repositoryUrl"
              label="Repository URL or Identifier"
              rules={[
                { required: true, message: 'Please input the GitHub repository URL or name!' },
              ]}
            >
              <Input
                placeholder="https://github.com/Tecmotiv-Solutions/your-repo"
                prefix={<GithubOutlined />}
              />
            </Form.Item>
            <div style={{ textAlign: 'right', marginTop: 16 }}>
              <Space>
                <Button onClick={() => setLinkModalVisible(false)}>Cancel</Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={linking}
                  style={{ backgroundColor: '#002244' }}
                >
                  Verify & Link
                </Button>
              </Space>
            </div>
          </Form>
        </Modal>
      </div>
    );
  }

  // LINKED STATE
  return (
    <div>
      {/* Repository Header Card */}
      <Card
        size="small"
        style={{
          marginBottom: 16,
          background: 'linear-gradient(135deg, #f6f9fc 0%, #eef3f8 100%)',
          borderColor: '#d9e2ec',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <Space size={8} align="center" style={{ marginBottom: 4 }}>
              <GithubOutlined style={{ fontSize: 22, color: '#002244' }} />
              <a
                href={overview.repoUrl}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 16, fontWeight: 700, color: '#002244' }}
              >
                {overview.fullName}
              </a>
              <Tag color="blue" icon={<BranchesOutlined />}>
                {overview.defaultBranch || 'main'}
              </Tag>
              <Tag color={overview.syncStatus === 'error' ? 'error' : 'success'} icon={<CheckCircleOutlined />}>
                {overview.syncStatus === 'syncing' ? 'Syncing...' : 'Connected'}
              </Tag>
            </Space>
            <div style={{ fontSize: 12, color: '#627d98' }}>
              <Space split="•">
                <span>Repository ID: {overview.repoId}</span>
                {overview.lastSyncAt && (
                  <span>Last synced: {dayjs(overview.lastSyncAt).fromNow()}</span>
                )}
              </Space>
            </div>
          </div>

          <Space size={8}>
            {overview.canManage && (
              <Button
                size="small"
                icon={<SyncOutlined spin={syncing} />}
                loading={syncing}
                onClick={handleReconcileSync}
              >
                Sync Now
              </Button>
            )}
            <Button
              size="small"
              icon={<SyncOutlined />}
              onClick={() => {
                fetchOverview();
                if (subTab === 'commits') fetchCommits(commitPage, selectedBranch);
                else if (subTab === 'pulls') fetchPulls(pullFilter);
                else if (subTab === 'issues') fetchIssues(issueFilter);
                else if (subTab === 'activity') fetchActivities();
              }}
            >
              Refresh
            </Button>
            <Button
              size="small"
              type="primary"
              href={overview.repoUrl}
              target="_blank"
              icon={<GithubOutlined />}
              style={{ backgroundColor: '#24292e', borderColor: '#24292e' }}
            >
              Open in GitHub
            </Button>
            {overview.canManage && (
              <Popconfirm
                title="Unlink GitHub repository?"
                description="This will disconnect the repository from this project."
                onConfirm={handleUnlink}
                okText="Yes, Unlink"
                cancelText="Cancel"
                okButtonProps={{ danger: true }}
              >
                <Button size="small" danger icon={<DisconnectOutlined />}>
                  Unlink
                </Button>
              </Popconfirm>
            )}
          </Space>
        </div>
      </Card>

      {/* Sub-tabs: Commits, Pull Requests, Issues */}
      <Tabs
        activeKey={subTab}
        onChange={setSubTab}
        type="card"
        size="small"
        items={[
          {
            key: 'commits',
            label: (
              <Space size={6}>
                <BranchesOutlined />
                <span>Recent Commits</span>
              </Space>
            ),
            children: (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Space>
                    <Text strong style={{ fontSize: 13 }}>Branch:</Text>
                    <Select
                      size="small"
                      value={selectedBranch}
                      onChange={(b) => {
                        setSelectedBranch(b);
                        fetchCommits(1, b);
                      }}
                      style={{ width: 180 }}
                    >
                      {branches.length > 0 ? (
                        branches.map((b) => (
                          <Option key={b.name} value={b.name}>
                            {b.name} {b.isProtected && '(protected)'}
                          </Option>
                        ))
                      ) : (
                        <Option value={overview.defaultBranch || 'main'}>
                          {overview.defaultBranch || 'main'}
                        </Option>
                      )}
                    </Select>
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Showing latest commits on <code>{selectedBranch}</code>
                  </Text>
                </div>

                <Table
                  dataSource={commits}
                  rowKey="sha"
                  loading={loadingCommits}
                  size="small"
                  scroll={{ x: 750 }}
                  pagination={{
                    current: commitPage,
                    pageSize: 10,
                    total: 50,
                    onChange: (p) => fetchCommits(p, selectedBranch),
                    showSizeChanger: false,
                  }}
                  locale={{ emptyText: 'No commits found on this branch.' }}
                  columns={[
                    {
                      title: 'Commit',
                      key: 'commit',
                      render: (_, c) => (
                        <div>
                          <div style={{ fontWeight: 600, color: '#102a43' }}>
                            <a href={c.url} target="_blank" rel="noreferrer">
                              {c.message}
                            </a>
                          </div>
                          <Space size={6} style={{ fontSize: 11, color: '#829ab1', marginTop: 2 }}>
                            <Avatar size={16} src={c.author?.avatar} icon={<UserOutlined />} />
                            <span>{c.author?.name || c.author?.username}</span>
                            <span>•</span>
                            <span>{dayjs(c.author?.date).fromNow()}</span>
                          </Space>
                        </div>
                      ),
                    },
                    {
                      title: 'SHA',
                      dataIndex: 'shortSha',
                      key: 'shortSha',
                      width: 100,
                      render: (sha, c) => (
                        <Tooltip title={c.sha}>
                          <a href={c.url} target="_blank" rel="noreferrer" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                            {sha}
                          </a>
                        </Tooltip>
                      ),
                    },
                  ]}
                />
              </div>
            ),
          },
          {
            key: 'pulls',
            label: (
              <Space size={6}>
                <PullRequestOutlined />
                <span>Pull Requests</span>
              </Space>
            ),
            children: (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Space>
                    <Text strong style={{ fontSize: 13 }}>State:</Text>
                    <Select
                      size="small"
                      value={pullFilter}
                      onChange={(st) => {
                        setPullFilter(st);
                        fetchPulls(st);
                      }}
                      style={{ width: 120 }}
                    >
                      <Option value="all">All</Option>
                      <Option value="open">Open</Option>
                      <Option value="closed">Closed</Option>
                    </Select>
                  </Space>
                  <Button size="small" type="link" href={`${overview.repoUrl}/pulls`} target="_blank">
                    View on GitHub →
                  </Button>
                </div>

                <Table
                  dataSource={pulls}
                  rowKey="id"
                  loading={loadingPulls}
                  size="small"
                  scroll={{ x: 750 }}
                  pagination={false}
                  locale={{ emptyText: 'No pull requests found.' }}
                  columns={[
                    {
                      title: 'Pull Request',
                      key: 'title',
                      render: (_, pr) => (
                        <div>
                          <Space size={6}>
                            <Tag color={pr.isMerged ? 'purple' : pr.state === 'open' ? 'success' : 'default'}>
                              {pr.isMerged ? 'Merged' : pr.state.toUpperCase()}
                            </Tag>
                            <a href={pr.url} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
                              #{pr.number} {pr.title}
                            </a>
                          </Space>
                          <div style={{ fontSize: 11, color: '#829ab1', marginTop: 4 }}>
                            <code>{pr.headBranch}</code> → <code>{pr.baseBranch}</code> by {pr.author?.username} • {dayjs(pr.createdAt).fromNow()}
                          </div>
                        </div>
                      ),
                    },
                  ]}
                />
              </div>
            ),
          },
          {
            key: 'issues',
            label: (
              <Space size={6}>
                <BugOutlined />
                <span>Issues</span>
              </Space>
            ),
            children: (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Space>
                    <Text strong style={{ fontSize: 13 }}>State:</Text>
                    <Select
                      size="small"
                      value={issueFilter}
                      onChange={(st) => {
                        setIssueFilter(st);
                        fetchIssues(st);
                      }}
                      style={{ width: 120 }}
                    >
                      <Option value="all">All</Option>
                      <Option value="open">Open</Option>
                      <Option value="closed">Closed</Option>
                    </Select>
                  </Space>
                  <Button size="small" type="link" href={`${overview.repoUrl}/issues`} target="_blank">
                    View on GitHub →
                  </Button>
                </div>

                <Table
                  dataSource={issues}
                  rowKey="id"
                  loading={loadingIssues}
                  size="small"
                  scroll={{ x: 750 }}
                  pagination={false}
                  locale={{ emptyText: 'No issues found.' }}
                  columns={[
                    {
                      title: 'Issue',
                      key: 'issue',
                      render: (_, issue) => (
                        <div>
                          <Space size={6} wrap>
                            <Tag color={issue.state === 'open' ? 'success' : 'purple'}>
                              {issue.state.toUpperCase()}
                            </Tag>
                            <a href={issue.url} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
                              #{issue.number} {issue.title}
                            </a>
                            {(issue.labels || []).map((lbl) => (
                              <Tag key={lbl} style={{ fontSize: 10 }}>{lbl}</Tag>
                            ))}
                          </Space>
                          <div style={{ fontSize: 11, color: '#829ab1', marginTop: 4 }}>
                            Opened by {issue.author?.username} • {dayjs(issue.createdAt).fromNow()}
                            {issue.assignee && <span> • Assigned to {issue.assignee}</span>}
                          </div>
                        </div>
                      ),
                    },
                  ]}
                />
              </div>
            ),
          },
          {
            key: 'activity',
            label: (
              <Space size={6}>
                <ClockCircleOutlined />
                <span>Activity Stream</span>
              </Space>
            ),
            children: (
              <div>
                <Table
                  dataSource={activities}
                  rowKey="_id"
                  loading={loadingActivities}
                  size="small"
                  scroll={{ x: 750 }}
                  pagination={{ pageSize: 10, showSizeChanger: false }}
                  locale={{ emptyText: 'No webhook activity events recorded yet.' }}
                  columns={[
                    {
                      title: 'Event',
                      key: 'event',
                      width: 130,
                      render: (_, item) => {
                        let color = 'blue';
                        if (item.event === 'push') color = 'geekblue';
                        if (item.event === 'pull_request') color = 'purple';
                        if (item.event === 'issues') color = 'orange';
                        return (
                          <Space direction="vertical" size={2}>
                            <Tag color={color} style={{ fontWeight: 600 }}>
                              {item.event.toUpperCase()}
                            </Tag>
                            {item.action && (
                              <span style={{ fontSize: 11, color: '#627d98' }}>{item.action}</span>
                            )}
                          </Space>
                        );
                      },
                    },
                    {
                      title: 'Activity',
                      key: 'summary',
                      render: (_, item) => (
                        <div>
                          <div style={{ fontWeight: 500, color: '#102a43' }}>
                            {item.summary || 'Webhook activity recorded'}
                          </div>
                          {item.sender?.login && (
                            <div style={{ fontSize: 11, color: '#829ab1', marginTop: 2 }}>
                              Triggered by <strong>{item.sender.login}</strong>
                              {item.deliveryId && (
                                <span> • delivery <code>{item.deliveryId.substring(0, 8)}</code></span>
                              )}
                            </div>
                          )}
                        </div>
                      ),
                    },
                    {
                      title: 'Recorded',
                      key: 'created',
                      width: 160,
                      render: (_, item) => (
                        <span style={{ fontSize: 12, color: '#627d98' }}>
                          {dayjs(item.created).fromNow()}
                        </span>
                      ),
                    },
                  ]}
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
