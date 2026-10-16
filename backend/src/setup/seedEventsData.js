require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

async function seedEventsData() {
  try {
    const mongoUri = process.env.DATABASE || 'mongodb://127.0.0.1:27017/tecmotiv-erp';
    console.log('Connecting to MongoDB at:', mongoUri);
    await mongoose.connect(mongoUri);

    const Event = require('../models/appModels/Event');
    const Employee = require('../models/appModels/Employee');
    require('../models/coreModels/Admin');

    const employees = await Employee.find({ removed: false });
    const empIds = employees.map(e => e._id);
    console.log(`Found ${employees.length} employees for seed participants.`);

    // Remove previously seeded TecMotiv demo events
    await Event.deleteMany({ title: { $regex: /^\[TecMotiv\]/ } });

    const now = new Date();
    const currentYear = now.getFullYear();

    const sampleEvents = [
      {
        title: '[TecMotiv] Diwali Cultural Gala & Grand Feast 2026',
        eventName: '[TecMotiv] Diwali Cultural Gala & Grand Feast 2026',
        eventType: 'Festival',
        description: 'Annual Festival of Lights celebration featuring traditional dance, gourmet catering, gift hampers, and employee talent showcase.',
        startDate: new Date(currentYear, 10, 12, 17, 30),
        endDate: new Date(currentYear, 10, 12, 22, 0),
        time: '05:30 PM',
        startTime: '05:30 PM',
        endTime: '10:00 PM',
        venue: 'The Grand Ballroom, Hotel Leela Palace, Bengaluru',
        department: 'All',
        isVirtual: false,
        poster: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
        organizerName: 'TecMotiv People & Engagement Council',
        participants: empIds.slice(0, 15).map(id => ({ employee: id, status: 'Accepted' })),
        invitation: {
          subject: 'You are Invited: TecMotiv Grand Diwali Gala 2026',
          message: 'Join us with your families for an evening of light, music, and festive celebration.',
          sent: true,
          sentAt: new Date(),
          sentBy: 'Director of Human Resources',
          recipientCount: Math.min(15, empIds.length),
        },
        status: 'Scheduled',
      },
      {
        title: '[TecMotiv] Q4 All-Hands Town Hall & Corporate Milestones',
        eventName: '[TecMotiv] Q4 All-Hands Town Hall & Corporate Milestones',
        eventType: 'Company Event',
        description: 'Quarterly executive review by leadership, product roadmaps presentation, and major client expansion announcements.',
        startDate: new Date(currentYear, now.getMonth(), now.getDate() + 5, 10, 0),
        endDate: new Date(currentYear, now.getMonth(), now.getDate() + 5, 12, 30),
        time: '10:00 AM',
        startTime: '10:00 AM',
        endTime: '12:30 PM',
        venue: 'TecMotiv Corporate Auditorium, 5th Floor & Live Stream',
        department: 'All',
        isVirtual: true,
        meetingLink: 'https://meet.google.com/tec-motiv-townhall',
        poster: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
        organizerName: 'Executive Operations Office',
        participants: empIds.map(id => ({ employee: id, status: 'Invited' })),
        invitation: {
          subject: 'Town Hall Meeting: TecMotiv Vision & Q4 Strategy',
          message: 'All employees are required to participate. Interactive Q&A session will follow.',
          sent: true,
          sentAt: new Date(),
          sentBy: 'Management Executive Office',
          recipientCount: empIds.length,
        },
        status: 'Scheduled',
      },
      {
        title: '[TecMotiv] Annual Star Excellence & Recognition Awards',
        eventName: '[TecMotiv] Annual Star Excellence & Recognition Awards',
        eventType: 'Recognition',
        description: 'Honoring top innovators, project leaders, outstanding mentors, and rising talent across all business units.',
        startDate: new Date(currentYear, now.getMonth(), now.getDate() + 14, 18, 0),
        endDate: new Date(currentYear, now.getMonth(), now.getDate() + 14, 21, 30),
        time: '06:00 PM',
        startTime: '06:00 PM',
        endTime: '09:30 PM',
        venue: 'JW Marriott Banquets, Tech Enclave',
        department: 'All',
        isVirtual: false,
        poster: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80',
        organizerName: 'Employee Recognition Committee',
        participants: empIds.slice(0, 12).map(id => ({ employee: id, status: 'Accepted' })),
        invitation: {
          subject: 'Invitation: Annual Star Excellence Awards Ceremony',
          message: 'Celebrate peer achievements and celebrate the innovators shaping TecMotiv.',
          sent: true,
          sentAt: new Date(),
          sentBy: 'People Operations',
          recipientCount: Math.min(12, empIds.length),
        },
        status: 'Scheduled',
      },
      {
        title: '[TecMotiv] Next-Gen AI & Cloud Architecture Masterclass',
        eventName: '[TecMotiv] Next-Gen AI & Cloud Architecture Masterclass',
        eventType: 'Training',
        description: 'Hands-on architectural bootcamp on building resilient microservices and deploying LLM pipelines in enterprise setups.',
        startDate: new Date(currentYear, now.getMonth(), now.getDate() + 8, 14, 0),
        endDate: new Date(currentYear, now.getMonth(), now.getDate() + 8, 17, 0),
        time: '02:00 PM',
        startTime: '02:00 PM',
        endTime: '05:00 PM',
        venue: 'Innovation Lab 2B / Remote Workstation',
        department: 'Engineering',
        isVirtual: true,
        meetingLink: 'https://meet.google.com/tec-ai-masterclass',
        poster: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1200&q=80',
        organizerName: 'TecMotiv Engineering Academy',
        participants: empIds.slice(0, 8).map(id => ({ employee: id, status: 'Accepted' })),
        invitation: {
          subject: 'Technical Upskilling: AI & Microservices Masterclass',
          message: 'Elevate your cloud software engineering capabilities with our lead architect.',
          sent: true,
          sentAt: new Date(),
          sentBy: 'Academy Dean',
          recipientCount: Math.min(8, empIds.length),
        },
        status: 'Scheduled',
      },
      {
        title: '[TecMotiv] Community Green Drive & Tree Plantation 2026',
        eventName: '[TecMotiv] Community Green Drive & Tree Plantation 2026',
        eventType: 'CSR Activity',
        description: 'Volunteering initiative planting 500 saplings in urban green belts in collaboration with Bangalore Eco Trust.',
        startDate: new Date(currentYear, now.getMonth(), now.getDate() + 20, 8, 0),
        endDate: new Date(currentYear, now.getMonth(), now.getDate() + 20, 13, 0),
        time: '08:00 AM',
        startTime: '08:00 AM',
        endTime: '01:00 PM',
        venue: 'Turahalli Forest Eco Reserve & Urban Park',
        department: 'All',
        isVirtual: false,
        poster: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=80',
        organizerName: 'TecMotiv CSR & Sustainability Foundation',
        participants: empIds.slice(0, 10).map(id => ({ employee: id, status: 'Accepted' })),
        invitation: {
          subject: 'Join Us: TecMotiv Tree Plantation CSR Initiative',
          message: 'Make a lasting environmental impact. Transport and refreshments provided.',
          sent: true,
          sentAt: new Date(),
          sentBy: 'CSR Foundation Team',
          recipientCount: Math.min(10, empIds.length),
        },
        status: 'Scheduled',
      },
      {
        title: '[TecMotiv] Enterprise SaaS Digital Transformation Summit',
        eventName: '[TecMotiv] Enterprise SaaS Digital Transformation Summit',
        eventType: 'Webinar',
        description: 'Industry thought leadership webinar discussing the future of AI-driven enterprise management and client automation.',
        startDate: new Date(currentYear, now.getMonth(), now.getDate() + 25, 15, 0),
        endDate: new Date(currentYear, now.getMonth(), now.getDate() + 25, 16, 30),
        time: '03:00 PM',
        startTime: '03:00 PM',
        endTime: '04:30 PM',
        venue: 'Live Global Broadcast',
        department: 'Marketing',
        isVirtual: true,
        meetingLink: 'https://webinar.tecmotiv.com/saas-summit-2026',
        poster: 'https://images.unsplash.com/photo-1591115765373-5207764f72e7?auto=format&fit=crop&w=1200&q=80',
        organizerName: 'TecMotiv Marketing & Brand Growth',
        participants: empIds.slice(0, 10).map(id => ({ employee: id, status: 'Invited' })),
        invitation: {
          subject: 'Exclusive Webinar: Enterprise SaaS Digital Transformation',
          message: 'Global practitioners sharing insights on scaling modern enterprise workflows.',
          sent: true,
          sentAt: new Date(),
          sentBy: 'VP Marketing',
          recipientCount: Math.min(10, empIds.length),
        },
        status: 'Scheduled',
      },
      {
        title: '[TecMotiv] Strategic Enterprise Client Showcase & Networking',
        eventName: '[TecMotiv] Strategic Enterprise Client Showcase & Networking',
        eventType: 'Client Event',
        description: 'Executive cocktail and demo lounge showcasing TecMotiv solutions for our Tier-1 enterprise partners.',
        startDate: new Date(currentYear, now.getMonth(), now.getDate() + 30, 17, 0),
        endDate: new Date(currentYear, now.getMonth(), now.getDate() + 30, 20, 0),
        time: '05:00 PM',
        startTime: '05:00 PM',
        endTime: '08:00 PM',
        venue: 'Rooftop Lounge, Ritz-Carlton',
        department: 'Consulting',
        isVirtual: false,
        poster: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1200&q=80',
        organizerName: 'Enterprise Client Success Unit',
        participants: empIds.slice(0, 6).map(id => ({ employee: id, status: 'Accepted' })),
        invitation: {
          subject: 'Client VIP Evening: TecMotiv Future Frontiers',
          message: 'An intimate networking session with key clients and leadership.',
          sent: true,
          sentAt: new Date(),
          sentBy: 'Client Success Lead',
          recipientCount: Math.min(6, empIds.length),
        },
        status: 'Scheduled',
      },
      // Completed Past Events with rich reports and photo/video archives
      {
        title: '[TecMotiv] Founder Day & Corporate 5-Year Milestone Celebration',
        eventName: '[TecMotiv] Founder Day & Corporate 5-Year Milestone Celebration',
        eventType: 'Anniversary',
        description: 'Reflecting on 5 years of remarkable growth, engineering breakthroughs, and honoring early team members.',
        startDate: new Date(currentYear, now.getMonth() - 1, 15, 16, 0),
        endDate: new Date(currentYear, now.getMonth() - 1, 15, 21, 0),
        time: '04:00 PM',
        startTime: '04:00 PM',
        endTime: '09:00 PM',
        venue: 'TecMotiv Central Amphitheatre',
        department: 'All',
        isVirtual: false,
        poster: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80',
        organizerName: 'Executive Leadership Committee',
        participants: empIds.map(id => ({ employee: id, status: 'Attended' })),
        invitation: {
          subject: 'Celebrating 5 Golden Years of TecMotiv',
          message: 'A memorable milestone journey commemorated with all employees.',
          sent: true,
          sentAt: new Date(currentYear, now.getMonth() - 1, 5),
          sentBy: 'Managing Director',
          recipientCount: empIds.length,
        },
        photos: [
          { url: 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=800&q=80', caption: 'Milestone Trophy & Cake Unveiling' },
          { url: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=800&q=80', caption: 'Team Group Photo 2026' },
          { url: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=800&q=80', caption: 'Evening Gala & Dinner' },
        ],
        videos: [
          { url: 'https://www.youtube.com/watch?v=tecmotiv5years', title: '5-Year Journey Video Highlights', platform: 'YouTube' },
        ],
        eventReport: {
          summary: 'A resounding success celebrating TecMotiv 5-Year anniversary with over 150 team members and alumni.',
          attendanceCount: 152,
          highlights: 'Founder address, distribution of 5-year loyalty equity tokens, musical performance by employees.',
          outcomes: 'Strengthened organizational unity and reinforced 2026 expansion goals.',
          submittedBy: 'Head of People Operations',
          submittedAt: new Date(currentYear, now.getMonth() - 1, 16),
        },
        status: 'Completed',
      },
      {
        title: '[TecMotiv] Mega Monthly Birthday Bash — Team Celebration',
        eventName: '[TecMotiv] Mega Monthly Birthday Bash — Team Celebration',
        eventType: 'Birthday',
        description: 'Celebrating all colleagues born this month with customized cakes, team games, and fun awards.',
        startDate: new Date(currentYear, now.getMonth() - 1, 28, 16, 30),
        endDate: new Date(currentYear, now.getMonth() - 1, 28, 18, 0),
        time: '04:30 PM',
        startTime: '04:30 PM',
        endTime: '06:00 PM',
        venue: 'TecMotiv Cafeteria & Lounge Hub',
        department: 'All',
        isVirtual: false,
        poster: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=1200&q=80',
        organizerName: 'Cultural Committee',
        participants: empIds.slice(0, 10).map(id => ({ employee: id, status: 'Attended' })),
        invitation: {
          subject: 'Birthday Bash & Cake Time!',
          message: 'Come take a sweet break and wish our birthday rockstars.',
          sent: true,
          sentAt: new Date(currentYear, now.getMonth() - 1, 25),
          sentBy: 'Events Coordinator',
          recipientCount: 10,
        },
        photos: [
          { url: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?auto=format&fit=crop&w=800&q=80', caption: 'Birthday cake and gifts' },
          { url: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=800&q=80', caption: 'Celebration moments' },
        ],
        eventReport: {
          summary: 'Joyful monthly birthday gathering celebrating colleagues with games and cupcakes.',
          attendanceCount: 45,
          highlights: 'Trivia quiz, personalized gifts, custom song dedications.',
          outcomes: 'High energy and bonding across remote and office teams.',
          submittedBy: 'Events Coordinator',
          submittedAt: new Date(currentYear, now.getMonth() - 1, 29),
        },
        status: 'Completed',
      },
    ];

    for (const ev of sampleEvents) {
      await new Event(ev).save();
      console.log(`✓ Seeded event: "${ev.title}" [${ev.eventType}]`);
    }

    console.log('\n✨ TECMOTIV EVENTS DATA SEEDED SUCCESSFULLY!\n');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seedEventsData();
