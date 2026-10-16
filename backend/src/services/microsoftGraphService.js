const mongoose = require('mongoose');

/**
 * Microsoft Graph API & Identity Platform Service
 * 
 * Strict Security Rules:
 * 1. NEVER store Microsoft account passwords.
 * 2. Uses OAuth 2.0 Access/Refresh tokens for the Microsoft Identity Platform.
 * 3. Automatic token refresh before expiry.
 * 4. Deduplication engine to prevent duplicate calendar events.
 * 5. TECMOTIV Calendar configured as the default Source of Truth.
 */

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';
const DEFAULT_SCOPES = 'offline_access Calendars.ReadWrite User.Read';

// In-memory Sandbox Outlook Store (for dev/testing without live Azure tenant credentials)
const sandboxMailbox = {
  events: new Map(),
  userProfile: {
    displayName: 'TecMotiv Outlook Sync Account',
    mail: 'tecmotiv.calendar@outlook.com',
    userPrincipalName: 'tecmotiv.calendar@outlook.com',
    id: 'ms-graph-user-001',
  },
};

/**
 * Generate Microsoft OAuth 2.0 Authorization URL
 */
const getAuthUrl = ({ tenantId = 'common', clientId, redirectUri, state = 'tecmotiv_state' }) => {
  const effectiveClientId = clientId || process.env.MICROSOFT_CLIENT_ID || 'sandbox_client_id';
  const effectiveRedirect = redirectUri || process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3000/outlook/callback';
  const effectiveTenant = tenantId || process.env.MICROSOFT_TENANT_ID || 'common';

  const params = new URLSearchParams({
    client_id: effectiveClientId,
    response_type: 'code',
    redirect_uri: effectiveRedirect,
    response_mode: 'query',
    scope: DEFAULT_SCOPES,
    state,
  });

  return `https://login.microsoftonline.com/${effectiveTenant}/oauth2/v2.0/authorize?${params.toString()}`;
};

/**
 * Exchange Authorization Code for Access & Refresh Tokens
 */
const exchangeCodeForTokens = async ({ code, tenantId = 'common', clientId, clientSecret, redirectUri }) => {
  const effectiveClientId = clientId || process.env.MICROSOFT_CLIENT_ID;
  const effectiveSecret = clientSecret || process.env.MICROSOFT_CLIENT_SECRET;
  const effectiveRedirect = redirectUri || process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3000/outlook/callback';
  const effectiveTenant = tenantId || process.env.MICROSOFT_TENANT_ID || 'common';

  // If no live client credentials provided or testing sandbox code, use safe sandbox mock tokens
  if (!effectiveClientId || !effectiveSecret || code?.startsWith('sandbox_')) {
    const now = Date.now();
    return {
      accessToken: `mock_access_token_${now}_${Math.random().toString(36).substring(2, 9)}`,
      refreshToken: `mock_refresh_token_${now}_${Math.random().toString(36).substring(2, 9)}`,
      expiresIn: 3600,
      tokenExpiresAt: new Date(now + 3600 * 1000),
      scope: DEFAULT_SCOPES,
      tokenType: 'Bearer',
      email: sandboxMailbox.userProfile.mail,
      displayName: sandboxMailbox.userProfile.displayName,
      isSandbox: true,
    };
  }

  const tokenUrl = `https://login.microsoftonline.com/${effectiveTenant}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: effectiveClientId,
    client_secret: effectiveSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: effectiveRedirect,
    scope: DEFAULT_SCOPES,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Failed to exchange Microsoft OAuth code');
  }

  const tokenExpiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);

  // Fetch connected profile details
  let profile = { mail: '', displayName: '' };
  try {
    const profileRes = await fetch(`${GRAPH_BASE_URL}/me`, {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    if (profileRes.ok) {
      profile = await profileRes.json();
    }
  } catch (err) {
    console.warn('Could not fetch Microsoft profile:', err.message);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    tokenExpiresAt,
    scope: data.scope,
    tokenType: data.token_type,
    email: profile.mail || profile.userPrincipalName || '',
    displayName: profile.displayName || '',
    isSandbox: false,
  };
};

/**
 * Refresh Access Token using Refresh Token
 */
const refreshTokens = async (integration) => {
  if (!integration || !integration.refreshToken) {
    throw new Error('No refresh token available to refresh Microsoft session.');
  }

  // Handle sandbox mode refresh
  if (integration.isSandbox || integration.refreshToken.startsWith('mock_refresh_')) {
    const now = Date.now();
    integration.accessToken = `mock_access_token_${now}_${Math.random().toString(36).substring(2, 9)}`;
    integration.refreshToken = `mock_refresh_token_${now}_${Math.random().toString(36).substring(2, 9)}`;
    integration.tokenExpiresAt = new Date(now + 3600 * 1000);
    integration.status = 'connected';
    await integration.save();
    return integration.accessToken;
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenant = integration.tenantId || process.env.MICROSOFT_TENANT_ID || 'common';

  const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: integration.refreshToken,
    grant_type: 'refresh_token',
    scope: integration.tokenScope || DEFAULT_SCOPES,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = await response.json();
  if (!response.ok) {
    integration.status = 'token_expired';
    integration.lastError = data.error_description || 'Refresh token expired or revoked. Please reconnect.';
    await integration.save();
    throw new Error(integration.lastError);
  }

  integration.accessToken = data.access_token;
  if (data.refresh_token) {
    integration.refreshToken = data.refresh_token;
  }
  integration.tokenExpiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);
  integration.status = 'connected';
  await integration.save();

  return data.access_token;
};

/**
 * Ensure a valid active access token (auto-refresh if within 5 min of expiry)
 */
const getValidAccessToken = async (integration) => {
  if (!integration) throw new Error('Microsoft integration record is missing.');
  if (!integration.isConnected) throw new Error('Microsoft 365 is disconnected. Please connect first.');

  const now = new Date();
  const bufferMs = 5 * 60 * 1000; // 5 minute buffer

  if (!integration.accessToken || !integration.tokenExpiresAt || integration.tokenExpiresAt.getTime() - now.getTime() < bufferMs) {
    return await refreshTokens(integration);
  }

  return integration.accessToken;
};

/**
 * Format internal Event into Microsoft Graph Event payload
 */
const mapToGraphEvent = (event) => {
  const start = new Date(event.startDate || event.date || Date.now());
  const end = new Date(event.endDate || event.startDate || event.date || Date.now());

  // Ensure end is >= start
  if (end <= start) {
    end.setHours(start.getHours() + 1);
  }

  return {
    subject: event.title || event.eventName || 'TecMotiv Event',
    body: {
      contentType: 'HTML',
      content: `<p>${(event.description || '').replace(/\n/g, '<br/>')}</p><p><em>Synced via TecMotiv ERP</em></p>`,
    },
    start: {
      dateTime: start.toISOString(),
      timeZone: 'UTC',
    },
    end: {
      dateTime: end.toISOString(),
      timeZone: 'UTC',
    },
    location: {
      displayName: event.location || event.venue || 'TecMotiv Corporate Auditorium',
    },
    isOnlineMeeting: Boolean(event.isVirtual || event.meetingLink),
    onlineMeetingUrl: event.meetingLink || undefined,
  };
};

/**
 * READ EVENTS FROM OUTLOOK
 */
const listOutlookEvents = async (integration) => {
  const accessToken = await getValidAccessToken(integration);

  // Sandbox Mode: Return in-memory mailbox events
  if (integration.isSandbox || accessToken.startsWith('mock_access_')) {
    return Array.from(sandboxMailbox.events.values());
  }

  const url = `${GRAPH_BASE_URL}/me/events?$select=id,subject,bodyPreview,start,end,location,isOnlineMeeting,onlineMeeting,changeKey&$top=100`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to fetch events from Microsoft Graph API');
  }

  return data.value || [];
};

/**
 * CREATE EVENT IN OUTLOOK
 */
const createOutlookEvent = async (integration, eventData) => {
  const accessToken = await getValidAccessToken(integration);
  const payload = mapToGraphEvent(eventData);

  // Sandbox Mode
  if (integration.isSandbox || accessToken.startsWith('mock_access_')) {
    const id = `ms_evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const mockCreated = {
      id,
      changeKey: `ck_${Date.now()}`,
      subject: payload.subject,
      bodyPreview: eventData.description || '',
      start: payload.start,
      end: payload.end,
      location: payload.location,
      isOnlineMeeting: payload.isOnlineMeeting,
      onlineMeetingUrl: payload.onlineMeetingUrl,
      createdDateTime: new Date().toISOString(),
      lastModifiedDateTime: new Date().toISOString(),
    };
    sandboxMailbox.events.set(id, mockCreated);
    return mockCreated;
  }

  const response = await fetch(`${GRAPH_BASE_URL}/me/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to create event in Microsoft Outlook');
  }

  return data;
};

/**
 * UPDATE EVENT IN OUTLOOK
 */
const updateOutlookEvent = async (integration, outlookEventId, eventData) => {
  if (!outlookEventId) throw new Error('Outlook Event ID is required for update.');
  const accessToken = await getValidAccessToken(integration);
  const payload = mapToGraphEvent(eventData);

  // Sandbox Mode
  if (integration.isSandbox || accessToken.startsWith('mock_access_')) {
    const existing = sandboxMailbox.events.get(outlookEventId) || {};
    const updated = {
      ...existing,
      id: outlookEventId,
      changeKey: `ck_${Date.now()}`,
      subject: payload.subject,
      bodyPreview: eventData.description || existing.bodyPreview || '',
      start: payload.start,
      end: payload.end,
      location: payload.location,
      isOnlineMeeting: payload.isOnlineMeeting,
      lastModifiedDateTime: new Date().toISOString(),
    };
    sandboxMailbox.events.set(outlookEventId, updated);
    return updated;
  }

  const response = await fetch(`${GRAPH_BASE_URL}/me/events/${outlookEventId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || `Failed to update Outlook event ${outlookEventId}`);
  }

  return data;
};

/**
 * DELETE EVENT IN OUTLOOK
 */
const deleteOutlookEvent = async (integration, outlookEventId) => {
  if (!outlookEventId) throw new Error('Outlook Event ID is required for deletion.');
  const accessToken = await getValidAccessToken(integration);

  // Sandbox Mode
  if (integration.isSandbox || accessToken.startsWith('mock_access_')) {
    sandboxMailbox.events.delete(outlookEventId);
    return { success: true, deletedId: outlookEventId };
  }

  const response = await fetch(`${GRAPH_BASE_URL}/me/events/${outlookEventId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok && response.status !== 404) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error?.message || `Failed to delete Outlook event ${outlookEventId}`);
  }

  return { success: true, deletedId: outlookEventId };
};

/**
 * SYNCHRONIZATION & DEDUPLICATION ENGINE
 * 
 * Rules:
 * 1. Checks existing mappings by `outlookEventId` first to prevent duplicates.
 * 2. Checks by title/subject and ISO start time as secondary deduplication key.
 * 3. Keeps TECMOTIV calendar as Source of Truth when configured (`sourceOfTruth === 'TECMOTIV'`).
 * 4. Handles direction: 'to-outlook', 'from-outlook', or 'two-way'.
 */
const syncEventsWithOutlook = async (integration, options = {}) => {
  const Event = mongoose.models.Event || require('../models/appModels/Event');

  const direction = options.direction || integration.syncDirection || 'two-way';
  const sourceOfTruth = options.sourceOfTruth || integration.sourceOfTruth || 'TECMOTIV';

  integration.status = 'syncing';
  await integration.save();

  const syncStats = {
    pushedToOutlook: 0,
    updatedInOutlook: 0,
    pulledFromOutlook: 0,
    updatedInTecmotiv: 0,
    skippedDuplicates: 0,
    errors: [],
  };

  try {
    // 1. Fetch live events from Outlook
    const outlookEvents = await listOutlookEvents(integration);

    // Build lookup maps for fast deduplication
    const outlookById = new Map();
    const outlookByTitleAndDate = new Map();

    outlookEvents.forEach((ev) => {
      outlookById.set(ev.id, ev);
      const titleKey = (ev.subject || '').trim().toLowerCase();
      const dateKey = ev.start?.dateTime ? ev.start.dateTime.split('T')[0] : '';
      if (titleKey && dateKey) {
        outlookByTitleAndDate.set(`${titleKey}|${dateKey}`, ev);
      }
    });

    // 2. Fetch active events from internal TECMOTIV Calendar
    const tecmotivEvents = await Event.find({
      removed: false,
      status: { $ne: 'Cancelled' },
    });

    // -------------------------------------------------------------------------
    // DIRECTION: PUSH TO OUTLOOK (TECMOTIV -> Outlook)
    // -------------------------------------------------------------------------
    if (direction === 'to-outlook' || direction === 'two-way') {
      for (const tEvent of tecmotivEvents) {
        const titleKey = (tEvent.title || tEvent.eventName || '').trim().toLowerCase();
        const dateKey = tEvent.startDate ? tEvent.startDate.toISOString().split('T')[0] : '';
        const matchKey = `${titleKey}|${dateKey}`;

        // Case A: Event already has an Outlook ID linked
        if (tEvent.outlookEventId && outlookById.has(tEvent.outlookEventId)) {
          if (sourceOfTruth === 'TECMOTIV') {
            await updateOutlookEvent(integration, tEvent.outlookEventId, tEvent);
            tEvent.lastSyncedToOutlook = new Date();
            await tEvent.save();
            syncStats.updatedInOutlook++;
          } else {
            syncStats.skippedDuplicates++;
          }
          continue;
        }

        // Case B: Event matches existing Outlook event by title & date (Prevent duplicate creation!)
        const matchingOutlookEvt = outlookByTitleAndDate.get(matchKey);
        if (matchingOutlookEvt) {
          tEvent.outlookEventId = matchingOutlookEvt.id;
          tEvent.outlookChangeKey = matchingOutlookEvt.changeKey;
          tEvent.lastSyncedToOutlook = new Date();
          await tEvent.save();

          if (sourceOfTruth === 'TECMOTIV') {
            await updateOutlookEvent(integration, matchingOutlookEvt.id, tEvent);
            syncStats.updatedInOutlook++;
          } else {
            syncStats.skippedDuplicates++;
          }
          continue;
        }

        // Case C: New event not in Outlook -> Create in Outlook
        try {
          const created = await createOutlookEvent(integration, tEvent);
          tEvent.outlookEventId = created.id;
          tEvent.outlookChangeKey = created.changeKey;
          tEvent.lastSyncedToOutlook = new Date();
          await tEvent.save();

          // Add to local lookup so further processing in this run knows it exists
          outlookById.set(created.id, created);
          outlookByTitleAndDate.set(matchKey, created);

          syncStats.pushedToOutlook++;
        } catch (err) {
          syncStats.errors.push(`Failed to push event "${tEvent.title}": ${err.message}`);
        }
      }
    }

    // -------------------------------------------------------------------------
    // DIRECTION: PULL FROM OUTLOOK (Outlook -> TECMOTIV)
    // -------------------------------------------------------------------------
    if (direction === 'from-outlook' || direction === 'two-way') {
      for (const oEvent of outlookEvents) {
        // Find if TecMotiv already has this event
        let existingTecmotivEvent = tecmotivEvents.find(
          (t) => t.outlookEventId === oEvent.id
        );

        if (!existingTecmotivEvent) {
          const oTitleKey = (oEvent.subject || '').trim().toLowerCase();
          const oDateKey = oEvent.start?.dateTime ? oEvent.start.dateTime.split('T')[0] : '';
          existingTecmotivEvent = tecmotivEvents.find((t) => {
            const tTitle = (t.title || t.eventName || '').trim().toLowerCase();
            const tDate = t.startDate ? t.startDate.toISOString().split('T')[0] : '';
            return tTitle === oTitleKey && tDate === oDateKey;
          });
        }

        if (existingTecmotivEvent) {
          // If TecMotiv already has it
          if (!existingTecmotivEvent.outlookEventId) {
            existingTecmotivEvent.outlookEventId = oEvent.id;
            existingTecmotivEvent.lastSyncedToOutlook = new Date();
            await existingTecmotivEvent.save();
          }

          if (sourceOfTruth === 'OUTLOOK') {
            existingTecmotivEvent.title = oEvent.subject || existingTecmotivEvent.title;
            existingTecmotivEvent.eventName = oEvent.subject || existingTecmotivEvent.eventName;
            if (oEvent.bodyPreview) existingTecmotivEvent.description = oEvent.bodyPreview;
            if (oEvent.location?.displayName) existingTecmotivEvent.location = oEvent.location.displayName;
            existingTecmotivEvent.lastSyncedToOutlook = new Date();
            await existingTecmotivEvent.save();
            syncStats.updatedInTecmotiv++;
          } else {
            // TECMOTIV is Source of Truth: keep TecMotiv values
            syncStats.skippedDuplicates++;
          }
        } else {
          // Outlook event does not exist in TecMotiv -> Create in TecMotiv
          try {
            const startDateTime = oEvent.start?.dateTime ? new Date(oEvent.start.dateTime) : new Date();
            const endDateTime = oEvent.end?.dateTime ? new Date(oEvent.end.dateTime) : startDateTime;

            const newEvent = new Event({
              title: oEvent.subject || 'Outlook Calendar Event',
              eventName: oEvent.subject || 'Outlook Calendar Event',
              description: oEvent.bodyPreview || 'Synchronized from Microsoft 365 / Outlook',
              eventType: 'Company Event',
              startDate: startDateTime,
              endDate: endDateTime,
              date: startDateTime,
              time: '10:00 AM',
              location: oEvent.location?.displayName || 'TecMotiv Corporate Auditorium',
              venue: oEvent.location?.displayName || 'TecMotiv Corporate Auditorium',
              department: 'All',
              isVirtual: Boolean(oEvent.isOnlineMeeting),
              meetingLink: oEvent.onlineMeetingUrl || '',
              outlookEventId: oEvent.id,
              outlookChangeKey: oEvent.changeKey,
              syncSource: 'OUTLOOK',
              lastSyncedToOutlook: new Date(),
              status: 'Scheduled',
            });
            await newEvent.save();
            syncStats.pulledFromOutlook++;
          } catch (err) {
            syncStats.errors.push(`Failed to import Outlook event "${oEvent.subject}": ${err.message}`);
          }
        }
      }
    }

    // Update integration record with sync outcome
    const totalProcessed =
      syncStats.pushedToOutlook +
      syncStats.updatedInOutlook +
      syncStats.pulledFromOutlook +
      syncStats.updatedInTecmotiv;

    integration.status = 'connected';
    integration.lastSyncAt = new Date();
    integration.lastSyncStatus = syncStats.errors.length > 0 ? (totalProcessed > 0 ? 'partial' : 'failed') : 'success';
    integration.syncedCount = (integration.syncedCount || 0) + totalProcessed;
    integration.lastError = syncStats.errors.join('; ');

    integration.syncLogs.unshift({
      timestamp: new Date(),
      action: `Sync (${direction}) - Source of Truth: ${sourceOfTruth}`,
      details: `Pushed: ${syncStats.pushedToOutlook}, Updated in Outlook: ${syncStats.updatedInOutlook}, Pulled: ${syncStats.pulledFromOutlook}, Updated in ERP: ${syncStats.updatedInTecmotiv}, Deduplicated: ${syncStats.skippedDuplicates}`,
      status: integration.lastSyncStatus,
      count: totalProcessed,
    });

    if (integration.syncLogs.length > 30) {
      integration.syncLogs = integration.syncLogs.slice(0, 30);
    }

    await integration.save();

    return {
      success: true,
      stats: syncStats,
      lastSyncAt: integration.lastSyncAt,
      lastSyncStatus: integration.lastSyncStatus,
      sourceOfTruth,
      direction,
    };
  } catch (error) {
    integration.status = 'error';
    integration.lastError = error.message;
    integration.lastSyncStatus = 'failed';
    integration.syncLogs.unshift({
      timestamp: new Date(),
      action: `Sync failed`,
      details: error.message,
      status: 'failed',
      count: 0,
    });
    await integration.save();
    throw error;
  }
};

module.exports = {
  DEFAULT_SCOPES,
  sandboxMailbox,
  getAuthUrl,
  exchangeCodeForTokens,
  refreshTokens,
  getValidAccessToken,
  listOutlookEvents,
  createOutlookEvent,
  updateOutlookEvent,
  deleteOutlookEvent,
  syncEventsWithOutlook,
};
