const mongoose = require('mongoose');

// Ensure models are registered for population
try {
  if (!mongoose.models.Admin) {
    try { require('../../../models/coreModels/Admin'); } catch (e) { require('../../../models/coreModels/Admin'); }
  }
} catch (e) {}

try {
  if (!mongoose.models.Employee) {
    try { require('../../../models/appModels/Employee'); } catch (e) { require('../../../models/appModels/Employee'); }
  }
} catch (e) {}

// Helper to resolve Employee document from current user
const resolveEmployee = async (user) => {
  if (!user) return null;
  const Employee = mongoose.models.Employee;
  let employee = await Employee.findOne({ user: user._id, removed: false });
  if (!employee && user.email) {
    employee = await Employee.findOne({ email: user.email.toLowerCase(), removed: false });
  }
  return employee;
};

// =========================================================================
// 1. CREATE EVENT
// =========================================================================
const create = async (req, res) => {
  try {
    const Event = mongoose.models.Event || require('../../../models/appModels/Event');
    const user = req.user;

    const {
      title,
      eventName,
      description,
      eventType,
      date,
      startDate,
      endDate,
      time,
      startTime,
      endTime,
      venue,
      location,
      department,
      project,
      organizerName,
      participants,
      attendees,
      isVirtual,
      meetingLink,
      invitation,
      poster,
      photos,
      videos,
      eventReport,
      reminderDaysBefore,
    } = req.body;

    const resolvedTitle = (title || eventName || '').trim();
    if (!resolvedTitle) {
      return res.status(400).json({ success: false, message: 'Event Name is required.' });
    }

    const resolvedStartDate = startDate ? new Date(startDate) : (date ? new Date(date) : new Date());
    const resolvedEndDate = endDate ? new Date(endDate) : resolvedStartDate;

    // Normalize participants list
    let normalizedParticipants = [];
    let attendeeIds = [];

    if (Array.isArray(participants) && participants.length > 0) {
      normalizedParticipants = participants.map((p) => {
        if (typeof p === 'string' || (p && p._id && !p.employee)) {
          const empId = p._id || p;
          attendeeIds.push(empId);
          return {
            employee: empId,
            name: p.name || '',
            email: p.email || '',
            status: 'Invited',
          };
        }
        if (p && p.employee) {
          attendeeIds.push(p.employee._id || p.employee);
          return {
            employee: p.employee._id || p.employee,
            name: p.name || '',
            email: p.email || '',
            status: p.status || 'Invited',
            respondedAt: p.respondedAt,
          };
        }
        return p;
      });
    } else if (Array.isArray(attendees) && attendees.length > 0) {
      attendeeIds = [...attendees];
      normalizedParticipants = attendees.map((empId) => ({
        employee: empId,
        status: 'Invited',
      }));
    }

    const newEvent = new Event({
      title: resolvedTitle,
      eventName: resolvedTitle,
      description: (description || '').trim(),
      eventType: eventType || 'Company Event',
      date: resolvedStartDate,
      startDate: resolvedStartDate,
      endDate: resolvedEndDate,
      time: time || startTime || '10:00 AM',
      startTime: startTime || time || '10:00 AM',
      endTime: endTime || '12:00 PM',
      venue: venue || location || 'TecMotiv Corporate Auditorium',
      location: location || venue || 'TecMotiv Corporate Auditorium',
      department: department || 'All',
      project: project || undefined,
      organizer: user?._id,
      organizerName: organizerName || `${user?.name || ''} ${user?.surname || ''}`.trim() || 'TecMotiv Events Team',
      participants: normalizedParticipants,
      attendees: attendeeIds,
      isVirtual: Boolean(isVirtual),
      meetingLink: meetingLink || '',
      poster: poster || '',
      photos: Array.isArray(photos) ? photos : [],
      videos: Array.isArray(videos) ? videos : [],
      eventReport: eventReport || undefined,
      reminderDaysBefore: reminderDaysBefore !== undefined ? reminderDaysBefore : 7,
      reminderScheduled: true,
      status: 'Scheduled',
    });

    if (invitation) {
      newEvent.invitation = {
        subject: invitation.subject || `Invitation: ${resolvedTitle}`,
        message: invitation.message || '',
        sent: Boolean(invitation.sent),
        sentAt: invitation.sent ? new Date() : undefined,
        sentBy: invitation.sent ? (`${user?.name || ''} ${user?.surname || ''}`.trim() || user?.email) : '',
        recipientCount: invitation.sent ? normalizedParticipants.length : 0,
      };
    }

    const savedEvent = await newEvent.save();

    return res.status(201).json({
      success: true,
      result: savedEvent,
      message: 'Event created successfully.',
    });
  } catch (error) {
    console.error('Error creating event:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 2. READ EVENT (POPULATED DETAILS)
// =========================================================================
const read = async (req, res) => {
  try {
    const Event = mongoose.models.Event || require('../../../models/appModels/Event');
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid Event ID' });
    }

    const event = await Event.findOne({ _id: id, removed: false })
      .populate('participants.employee', 'name surname email photo departmentName designationName phone employeeId')
      .populate('attendees', 'name surname email photo departmentName designationName phone employeeId')
      .populate('organizer', 'name surname email photo')
      .populate('project', 'name code department');

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    return res.status(200).json({
      success: true,
      result: event,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 3. UPDATE EVENT
// =========================================================================
const update = async (req, res) => {
  try {
    const Event = mongoose.models.Event || require('../../../models/appModels/Event');
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid Event ID' });
    }

    const event = await Event.findOne({ _id: id, removed: false });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    const updatableFields = [
      'title',
      'eventName',
      'description',
      'eventType',
      'date',
      'startDate',
      'endDate',
      'time',
      'startTime',
      'endTime',
      'venue',
      'location',
      'department',
      'project',
      'organizerName',
      'isVirtual',
      'meetingLink',
      'poster',
      'reminderDaysBefore',
      'reminderScheduled',
      'status',
    ];

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        event[field] = req.body[field];
      }
    });

    // Handle Title alias
    if (req.body.eventName && !req.body.title) {
      event.title = req.body.eventName;
    }

    // Handle participants if provided
    if (req.body.participants !== undefined && Array.isArray(req.body.participants)) {
      const attendeeIds = [];
      const normalized = req.body.participants.map((p) => {
        if (typeof p === 'string' || (p && p._id && !p.employee)) {
          const empId = p._id || p;
          attendeeIds.push(empId);
          return { employee: empId, status: 'Invited' };
        }
        if (p && p.employee) {
          attendeeIds.push(p.employee._id || p.employee);
          return {
            employee: p.employee._id || p.employee,
            name: p.name || '',
            email: p.email || '',
            status: p.status || 'Invited',
            respondedAt: p.respondedAt,
          };
        }
        return p;
      });
      event.participants = normalized;
      event.attendees = attendeeIds;
    }

    // Handle photos if provided
    if (Array.isArray(req.body.photos)) {
      event.photos = req.body.photos;
    }

    // Handle videos if provided
    if (Array.isArray(req.body.videos)) {
      event.videos = req.body.videos;
    }

    // Handle eventReport
    if (req.body.eventReport !== undefined) {
      event.eventReport = {
        ...event.eventReport?.toObject?.(),
        ...req.body.eventReport,
      };
    }

    // Handle invitation
    if (req.body.invitation !== undefined) {
      event.invitation = {
        ...event.invitation?.toObject?.(),
        ...req.body.invitation,
      };
    }

    event.updated = Date.now();
    await event.save();

    const updatedEvent = await Event.findById(id)
      .populate('participants.employee', 'name surname email photo departmentName designationName')
      .populate('organizer', 'name surname email');

    return res.status(200).json({
      success: true,
      result: updatedEvent,
      message: 'Event updated successfully.',
    });
  } catch (error) {
    console.error('Error updating event:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 4. DELETE EVENT (SOFT DELETE)
// =========================================================================
const deleteEvent = async (req, res) => {
  try {
    const Event = mongoose.models.Event || require('../../../models/appModels/Event');
    const { id } = req.params;

    const event = await Event.findOne({ _id: id, removed: false });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    event.removed = true;
    event.updated = Date.now();
    await event.save();

    return res.status(200).json({
      success: true,
      message: 'Event deleted successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 5. LIST EVENTS (UPCOMING, HISTORY, FILTER BY EVENT TYPE, SEARCH)
// =========================================================================
const list = async (req, res) => {
  try {
    const Event = mongoose.models.Event || require('../../../models/appModels/Event');

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.items, 10) || 50;
    const skip = (page - 1) * limit;

    const scope = req.query.scope || 'all'; // 'all', 'upcoming', 'history'
    const eventType = req.query.eventType;
    const department = req.query.department;
    const search = req.query.search;

    const query = { removed: false };

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    if (scope === 'upcoming') {
      query.$or = [
        { startDate: { $gte: todayStart } },
        { status: { $in: ['Scheduled', 'In Progress'] } },
      ];
    } else if (scope === 'history') {
      query.$or = [
        { status: 'Completed' },
        { endDate: { $lt: todayStart } },
        { startDate: { $lt: todayStart }, status: { $ne: 'In Progress' } },
      ];
    }

    if (eventType && eventType !== 'All') {
      query.eventType = eventType;
    }

    if (department && department !== 'All') {
      query.department = new RegExp(department, 'i');
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { title: searchRegex },
          { eventName: searchRegex },
          { description: searchRegex },
          { venue: searchRegex },
          { location: searchRegex },
          { organizerName: searchRegex },
        ],
      });
    }

    const sortOrder = scope === 'history' ? { startDate: -1 } : { startDate: 1 };

    const [eventsList, total] = await Promise.all([
      Event.find(query)
        .sort(sortOrder)
        .skip(skip)
        .limit(limit)
        .populate('participants.employee', 'name surname email photo departmentName designationName')
        .populate('organizer', 'name surname email')
        .lean(),
      Event.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      result: eventsList,
      pagination: {
        page,
        pages: Math.ceil(total / limit) || 1,
        count: total,
      },
    });
  } catch (error) {
    console.error('Error listing events:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 6. SEND / DISPATCH INVITATIONS
// =========================================================================
const sendInvitation = async (req, res) => {
  try {
    const Event = mongoose.models.Event || require('../../../models/appModels/Event');
    const user = req.user;
    const { id } = req.params;
    const { subject, message: inviteMessage } = req.body;

    const event = await Event.findOne({ _id: id, removed: false })
      .populate('participants.employee', 'name surname email');

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    const senderName = `${user?.name || ''} ${user?.surname || ''}`.trim() || user?.email || 'TecMotiv Operations';
    const recipientCount = event.participants?.length || event.attendees?.length || 0;

    event.invitation = {
      subject: subject || event.invitation?.subject || `Invitation: ${event.title}`,
      message: inviteMessage || event.invitation?.message || `You are cordially invited to attend ${event.title}.`,
      sent: true,
      sentAt: new Date(),
      sentBy: senderName,
      recipientCount: recipientCount,
    };

    // Mark participants status as 'Invited'
    if (event.participants && event.participants.length > 0) {
      event.participants.forEach((p) => {
        if (!p.status || p.status === 'Invited') {
          p.status = 'Invited';
        }
      });
    }

    event.updated = Date.now();
    await event.save();

    return res.status(200).json({
      success: true,
      result: event,
      message: `Invitations successfully dispatched to ${recipientCount} participants.`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 7. ATTACH MEDIA (POSTER, PHOTOS, VIDEOS)
// =========================================================================
const addMedia = async (req, res) => {
  try {
    const Event = mongoose.models.Event || require('../../../models/appModels/Event');
    const { id } = req.params;
    const { poster, photos, videos } = req.body;

    const event = await Event.findOne({ _id: id, removed: false });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    if (poster) {
      event.poster = poster;
    }

    if (Array.isArray(photos) && photos.length > 0) {
      event.photos = event.photos.concat(photos);
    }

    if (Array.isArray(videos) && videos.length > 0) {
      event.videos = event.videos.concat(videos);
    }

    event.updated = Date.now();
    await event.save();

    return res.status(200).json({
      success: true,
      result: event,
      message: 'Media attachments updated successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 8. SUBMIT EVENT POST-REPORT (MARK COMPLETED & RECORD OUTCOMES)
// =========================================================================
const submitReport = async (req, res) => {
  try {
    const Event = mongoose.models.Event || require('../../../models/appModels/Event');
    const user = req.user;
    const { id } = req.params;
    const { summary, attendanceCount, highlights, outcomes } = req.body;

    const event = await Event.findOne({ _id: id, removed: false });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    const reporterName = `${user?.name || ''} ${user?.surname || ''}`.trim() || user?.email || 'TecMotiv HR';

    event.eventReport = {
      summary: summary || '',
      attendanceCount: attendanceCount !== undefined ? Number(attendanceCount) : (event.participants?.length || 0),
      highlights: highlights || '',
      outcomes: outcomes || '',
      submittedBy: reporterName,
      submittedAt: new Date(),
    };

    // Auto mark event as Completed
    event.status = 'Completed';
    event.updated = Date.now();
    await event.save();

    return res.status(200).json({
      success: true,
      result: event,
      message: 'Event report submitted and event marked as Completed.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 9. EVENT HISTORY ARCHIVE
// =========================================================================
const history = async (req, res) => {
  try {
    const Event = mongoose.models.Event || require('../../../models/appModels/Event');
    const now = new Date();

    const pastEvents = await Event.find({
      removed: false,
      $or: [
        { status: 'Completed' },
        { endDate: { $lt: now } },
      ],
    })
      .sort({ startDate: -1 })
      .populate('participants.employee', 'name surname email photo departmentName')
      .populate('organizer', 'name surname')
      .lean();

    return res.status(200).json({
      success: true,
      result: pastEvents,
      count: pastEvents.length,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 10. SUMMARY STATS
// =========================================================================
const summary = async (req, res) => {
  try {
    const Event = mongoose.models.Event || require('../../../models/appModels/Event');
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    const [totalEvents, upcomingCount, completedCount, eventsByType] = await Promise.all([
      Event.countDocuments({ removed: false }),
      Event.countDocuments({
        removed: false,
        $or: [{ startDate: { $gte: todayStart } }, { status: 'Scheduled' }],
      }),
      Event.countDocuments({
        removed: false,
        $or: [{ status: 'Completed' }, { endDate: { $lt: todayStart } }],
      }),
      Event.aggregate([
        { $match: { removed: false } },
        { $group: { _id: '$eventType', count: { $sum: 1 } } },
      ]),
    ]);

    return res.status(200).json({
      success: true,
      result: {
        totalEvents,
        upcomingCount,
        completedCount,
        eventsByType,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  create,
  read,
  update,
  delete: deleteEvent,
  list,
  filter: list,
  search: list,
  sendInvitation,
  addMedia,
  submitReport,
  history,
  summary,
};
