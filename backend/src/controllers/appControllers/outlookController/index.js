const mongoose = require('mongoose');
const microsoftGraphService = require('../../../services/microsoftGraphService');

// Helper to get or create organization-level or user-level OutlookIntegration record
const getIntegrationDoc = async (user) => {
  const OutlookIntegration = mongoose.models.OutlookIntegration || require('../../../models/appModels/OutlookIntegration');
  let integration = await OutlookIntegration.findOne({ scopeType: 'organization', removed: false });

  if (!integration) {
    integration = new OutlookIntegration({
      scopeType: 'organization',
      user: user?._id,
      isConnected: false,
      status: 'disconnected',
      sourceOfTruth: 'TECMOTIV',
      syncDirection: 'two-way',
    });
    await integration.save();
  }

  return integration;
};

// =============================================================================
// 1. GET CONNECTION & SYNC STATUS
// =============================================================================
const getStatus = async (req, res) => {
  try {
    const user = req.user;
    const integration = await getIntegrationDoc(user);

    // Check if token is nearing expiry or expired
    let isTokenExpired = false;
    if (integration.isConnected && integration.tokenExpiresAt) {
      isTokenExpired = new Date() > new Date(integration.tokenExpiresAt);
      if (isTokenExpired && integration.status !== 'token_expired') {
        integration.status = 'token_expired';
        await integration.save();
      }
    }

    return res.status(200).json({
      success: true,
      result: {
        isConnected: integration.isConnected,
        status: integration.status,
        outlookEmail: integration.outlookEmail,
        displayName: integration.displayName,
        tenantId: integration.tenantId,
        isTokenExpired,
        tokenExpiresAt: integration.tokenExpiresAt,
        tokenScope: integration.tokenScope,
        sourceOfTruth: integration.sourceOfTruth,
        syncDirection: integration.syncDirection,
        lastSyncAt: integration.lastSyncAt,
        lastSyncStatus: integration.lastSyncStatus,
        syncedCount: integration.syncedCount,
        lastError: integration.lastError,
        isSandbox: integration.isSandbox,
        recentLogs: (integration.syncLogs || []).slice(0, 10),
      },
    });
  } catch (error) {
    console.error('Outlook getStatus error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================================
// 2. GET OAUTH AUTHORIZATION URL
// =============================================================================
const getAuthUrl = async (req, res) => {
  try {
    const { tenantId, redirectUri } = req.query;
    const authUrl = microsoftGraphService.getAuthUrl({ tenantId, redirectUri });
    return res.status(200).json({
      success: true,
      result: { authUrl },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================================
// 3. CONNECT / AUTHORIZE (EXCHANGE CODE FOR TOKENS)
// =============================================================================
const connect = async (req, res) => {
  try {
    const user = req.user;
    const { code, tenantId, redirectUri, isSandbox = false } = req.body;

    const integration = await getIntegrationDoc(user);

    // If sandbox mode is explicitly requested or code starts with sandbox
    const effectiveCode = isSandbox || !code ? `sandbox_code_${Date.now()}` : code;

    const tokenData = await microsoftGraphService.exchangeCodeForTokens({
      code: effectiveCode,
      tenantId: tenantId || integration.tenantId,
      redirectUri,
    });

    integration.isConnected = true;
    integration.status = 'connected';
    integration.accessToken = tokenData.accessToken;
    integration.refreshToken = tokenData.refreshToken;
    integration.tokenExpiresAt = tokenData.tokenExpiresAt;
    integration.tokenScope = tokenData.scope;
    integration.outlookEmail = tokenData.email || 'tecmotiv.calendar@outlook.com';
    integration.displayName = tokenData.displayName || 'TecMotiv Outlook Sync';
    integration.isSandbox = Boolean(tokenData.isSandbox);
    integration.lastError = '';
    integration.user = user?._id || integration.user;

    integration.syncLogs.unshift({
      timestamp: new Date(),
      action: 'connect',
      details: `Successfully connected Microsoft account: ${integration.outlookEmail}`,
      status: 'success',
      count: 0,
    });

    await integration.save();

    return res.status(200).json({
      success: true,
      result: {
        isConnected: true,
        status: 'connected',
        outlookEmail: integration.outlookEmail,
        displayName: integration.displayName,
        isSandbox: integration.isSandbox,
        tokenExpiresAt: integration.tokenExpiresAt,
      },
      message: 'Microsoft 365 Outlook connected successfully.',
    });
  } catch (error) {
    console.error('Outlook connect error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================================
// 4. RECONNECT (REFRESH TOKEN & VERIFY CONNECTIVITY)
// =============================================================================
const reconnect = async (req, res) => {
  try {
    const user = req.user;
    const integration = await getIntegrationDoc(user);

    if (!integration.refreshToken && !integration.isSandbox) {
      return res.status(400).json({
        success: false,
        message: 'No previous session found. Please perform full OAuth connect.',
      });
    }

    try {
      await microsoftGraphService.refreshTokens(integration);
      integration.isConnected = true;
      integration.status = 'connected';
      integration.lastError = '';

      integration.syncLogs.unshift({
        timestamp: new Date(),
        action: 'reconnect',
        details: 'Successfully refreshed Microsoft 365 tokens and reconnected session.',
        status: 'success',
        count: 0,
      });

      await integration.save();

      return res.status(200).json({
        success: true,
        result: {
          isConnected: true,
          status: 'connected',
          tokenExpiresAt: integration.tokenExpiresAt,
        },
        message: 'Microsoft 365 session reconnected and refreshed successfully.',
      });
    } catch (refreshErr) {
      integration.status = 'token_expired';
      integration.lastError = refreshErr.message;
      await integration.save();
      return res.status(401).json({
        success: false,
        message: `Failed to reconnect: ${refreshErr.message}. Please authorize again.`,
      });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================================
// 5. DISCONNECT (REVOKE & CLEAR TOKENS)
// =============================================================================
const disconnect = async (req, res) => {
  try {
    const user = req.user;
    const integration = await getIntegrationDoc(user);

    integration.isConnected = false;
    integration.status = 'disconnected';
    integration.accessToken = '';
    integration.refreshToken = '';
    integration.tokenExpiresAt = null;

    integration.syncLogs.unshift({
      timestamp: new Date(),
      action: 'disconnect',
      details: `Disconnected Microsoft 365 account: ${integration.outlookEmail}`,
      status: 'success',
      count: 0,
    });

    await integration.save();

    return res.status(200).json({
      success: true,
      result: { isConnected: false, status: 'disconnected' },
      message: 'Microsoft 365 / Outlook integration disconnected.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================================
// 6. SYNC COMPANY EVENTS WITH OUTLOOK
// =============================================================================
const syncEvents = async (req, res) => {
  try {
    const user = req.user;
    const { direction, sourceOfTruth } = req.body;

    const integration = await getIntegrationDoc(user);

    if (!integration.isConnected) {
      return res.status(400).json({
        success: false,
        message: 'Microsoft 365 is not connected. Please connect before synchronizing.',
      });
    }

    if (direction) integration.syncDirection = direction;
    if (sourceOfTruth) integration.sourceOfTruth = sourceOfTruth;

    const syncResult = await microsoftGraphService.syncEventsWithOutlook(integration, {
      direction,
      sourceOfTruth,
    });

    return res.status(200).json({
      success: true,
      result: syncResult,
      message: `Sync completed successfully. ${syncResult.stats.pushedToOutlook + syncResult.stats.updatedInOutlook + syncResult.stats.pulledFromOutlook + syncResult.stats.updatedInTecmotiv} event(s) processed.`,
    });
  } catch (error) {
    console.error('Outlook sync error:', error);
    return res.status(500).json({
      success: false,
      message: `Sync failed: ${error.message}`,
    });
  }
};

// =============================================================================
// 7. READ OUTLOOK EVENTS DIRECTLY
// =============================================================================
const getEvents = async (req, res) => {
  try {
    const user = req.user;
    const integration = await getIntegrationDoc(user);

    if (!integration.isConnected) {
      return res.status(400).json({
        success: false,
        message: 'Microsoft 365 is not connected.',
      });
    }

    const events = await microsoftGraphService.listOutlookEvents(integration);
    return res.status(200).json({
      success: true,
      result: events,
      count: events.length,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================================
// 8. CREATE EVENT IN OUTLOOK
// =============================================================================
const createEvent = async (req, res) => {
  try {
    const user = req.user;
    const { title, description, startDate, endDate, location, isVirtual, meetingLink } = req.body;

    if (!title || !startDate) {
      return res.status(400).json({ success: false, message: 'Title and startDate are required.' });
    }

    const integration = await getIntegrationDoc(user);
    if (!integration.isConnected) {
      return res.status(400).json({ success: false, message: 'Microsoft 365 is not connected.' });
    }

    const createdOutlookEvent = await microsoftGraphService.createOutlookEvent(integration, {
      title,
      description,
      startDate,
      endDate,
      location,
      isVirtual,
      meetingLink,
    });

    return res.status(201).json({
      success: true,
      result: createdOutlookEvent,
      message: 'Event created in Microsoft Outlook successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================================
// 9. UPDATE EVENT IN OUTLOOK
// =============================================================================
const updateEvent = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params; // Outlook event ID
    const eventData = req.body;

    const integration = await getIntegrationDoc(user);
    if (!integration.isConnected) {
      return res.status(400).json({ success: false, message: 'Microsoft 365 is not connected.' });
    }

    const updatedOutlookEvent = await microsoftGraphService.updateOutlookEvent(integration, id, eventData);

    return res.status(200).json({
      success: true,
      result: updatedOutlookEvent,
      message: 'Event updated in Microsoft Outlook successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================================
// 10. DELETE EVENT IN OUTLOOK
// =============================================================================
const deleteEvent = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params; // Outlook event ID

    const integration = await getIntegrationDoc(user);
    if (!integration.isConnected) {
      return res.status(400).json({ success: false, message: 'Microsoft 365 is not connected.' });
    }

    const deleteResult = await microsoftGraphService.deleteOutlookEvent(integration, id);

    return res.status(200).json({
      success: true,
      result: deleteResult,
      message: 'Event removed from Microsoft Outlook successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getStatus,
  getAuthUrl,
  connect,
  reconnect,
  disconnect,
  syncEvents,
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
};
