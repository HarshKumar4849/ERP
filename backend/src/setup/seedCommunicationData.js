require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

async function seedCommunicationData() {
  try {
    await mongoose.connect(process.env.DATABASE || 'mongodb://127.0.0.1:27017/tecmotiv-erp');
    console.log('✅ Connected to MongoDB');

    const Admin = require('../models/coreModels/Admin');
    const Policy = require('../models/appModels/Policy');
    const Announcement = require('../models/appModels/Announcement');

    const mgmtUser = await Admin.findOne({ email: 'management@tecmotiv.com' });
    const hrUser = await Admin.findOne({ email: 'hr@tecmotiv.com' });
    const itUser = await Admin.findOne({ email: 'admin.user@tecmotiv.com' });

    // 1. SEED POLICY LIBRARY
    await Policy.deleteMany({});

    const policiesToSeed = [
      // --- HR CATEGORY ---
      {
        name: 'Employee Leave & Time-Off Policy',
        title: 'Employee Leave & Time-Off Policy',
        code: 'POL-HR-01',
        category: 'HR',
        subType: 'Leave Policy',
        version: '2.0',
        ownerName: 'Sarah Connor (Head of People)',
        content: 'Comprehensive rules governing casual leave, sick leave, earned leave quotas, and two-stage managerial approvals.',
        acknowledgementRequired: true,
        isMandatory: true,
      },
      {
        name: 'Workplace Attendance & Biometric Logging Policy',
        title: 'Workplace Attendance & Biometric Logging Policy',
        code: 'POL-HR-02',
        category: 'HR',
        subType: 'Attendance Policy',
        version: '1.5',
        ownerName: 'Human Resources',
        content: 'Daily check-in and check-out rules, grace period tolerances, and regularized attendance workflows.',
        acknowledgementRequired: true,
        isMandatory: true,
      },
      {
        name: 'Work From Home & Hybrid Work Agreement',
        title: 'Work From Home & Hybrid Work Agreement',
        code: 'POL-HR-03',
        category: 'HR',
        subType: 'WFH Policy',
        version: '3.1',
        ownerName: 'Human Resources',
        content: 'Guidelines on remote ergonomics, monthly quota allowances, and connectivity stipend eligibility.',
        acknowledgementRequired: true,
        isMandatory: true,
      },
      {
        name: 'Core Working Hours & Flexible Scheduling Policy',
        title: 'Core Working Hours & Flexible Scheduling Policy',
        code: 'POL-HR-04',
        category: 'HR',
        subType: 'Working Hours',
        version: '1.2',
        ownerName: 'Human Resources',
        content: 'Definition of 10:00 AM to 4:00 PM core collaboration window and flex-time logging rules.',
        acknowledgementRequired: false,
        isMandatory: false,
      },
      {
        name: 'Probation Period & Confirmation Framework',
        title: 'Probation Period & Confirmation Framework',
        code: 'POL-HR-05',
        category: 'HR',
        subType: 'Probation',
        version: '1.0',
        ownerName: 'Human Resources',
        content: 'Criteria for standard 90-day evaluation, interim appraisals, and confirmation criteria.',
        acknowledgementRequired: true,
        isMandatory: true,
      },
      {
        name: 'Quarterly & Annual Performance Review Guidelines',
        title: 'Quarterly & Annual Performance Review Guidelines',
        code: 'POL-HR-06',
        category: 'HR',
        subType: 'Performance Review',
        version: '2.0',
        ownerName: 'Human Resources',
        content: 'OKR goal alignment, self-assessment criteria, 360-degree feedback, and merit increment matrix.',
        acknowledgementRequired: false,
        isMandatory: true,
      },

      // --- IT SECURITY CATEGORY ---
      {
        name: 'Password Construction & MFA Authentication Policy',
        title: 'Password Construction & MFA Authentication Policy',
        code: 'POL-IT-01',
        category: 'IT',
        subType: 'Password Policy',
        version: '2.4',
        ownerName: 'Alex Mercer (Systems Administrator)',
        content: 'Mandatory 14-character passphrase entropy, 90-day rotation, and hardware key/TOTP enforcement.',
        acknowledgementRequired: true,
        isMandatory: true,
      },
      {
        name: 'Acceptable Corporate Email & Communication Usage',
        title: 'Acceptable Corporate Email & Communication Usage',
        code: 'POL-IT-02',
        category: 'IT',
        subType: 'Email Usage',
        version: '1.3',
        ownerName: 'IT & Infrastructure',
        content: 'Protocols for external communications, spam filtering, phishing drill obligations, and retention.',
        acknowledgementRequired: true,
        isMandatory: true,
      },
      {
        name: 'Information Classification & Data Security Standard',
        title: 'Information Classification & Data Security Standard',
        code: 'POL-IT-03',
        category: 'IT',
        subType: 'Data Security',
        version: '3.0',
        ownerName: 'IT & Infrastructure',
        content: 'Data tiering (Public, Internal, Confidential, Restricted) and AES-256 encryption at rest standards.',
        acknowledgementRequired: true,
        isMandatory: true,
      },
      {
        name: 'Corporate Laptop, Mobile & Device Usage Policy',
        title: 'Corporate Laptop, Mobile & Device Usage Policy',
        code: 'POL-IT-04',
        category: 'IT',
        subType: 'Device Usage',
        version: '2.1',
        ownerName: 'IT & Infrastructure',
        content: 'MDM agent installation, disk encryption (BitLocker/FileVault), and loss reporting within 2 hours.',
        acknowledgementRequired: true,
        isMandatory: true,
      },
      {
        name: 'Enterprise Cloud Storage & Document Sharing Protocols',
        title: 'Enterprise Cloud Storage & Document Sharing Protocols',
        code: 'POL-IT-05',
        category: 'IT',
        subType: 'Cloud Storage',
        version: '1.8',
        ownerName: 'IT & Infrastructure',
        content: 'Approved storage repositories, public link sharing restrictions, and confidential document retention.',
        acknowledgementRequired: true,
        isMandatory: true,
      },
      {
        name: 'Incident Response & Cybersecurity Defense Handbook',
        title: 'Incident Response & Cybersecurity Defense Handbook',
        code: 'POL-IT-06',
        category: 'IT',
        subType: 'Cybersecurity',
        version: '2.5',
        ownerName: 'IT & Infrastructure',
        content: 'Immediate escalation paths for anomalous network activity, ransomware protocols, and SOC alerting.',
        acknowledgementRequired: true,
        isMandatory: true,
      },

      // --- COMPANY GOVERNANCE CATEGORY ---
      {
        name: 'TecMotiv Global Code of Business Conduct & Ethics',
        title: 'TecMotiv Global Code of Business Conduct & Ethics',
        code: 'POL-CORP-01',
        category: 'COMPANY',
        subType: 'Code of Conduct',
        version: '4.0',
        ownerName: 'Marcus Vance (Managing Director)',
        content: 'Foundational ethical framework, equal opportunity commitment, anti-bribery, and whistleblowing protections.',
        acknowledgementRequired: true,
        isMandatory: true,
      },
      {
        name: 'Corporate Confidentiality & Intellectual Property Standard',
        title: 'Corporate Confidentiality & Intellectual Property Standard',
        code: 'POL-CORP-02',
        category: 'COMPANY',
        subType: 'Confidentiality',
        version: '3.2',
        ownerName: 'Legal & Compliance',
        content: 'Protection of proprietary algorithms, automotive engineering blueprints, customer databases, and IP assignment.',
        acknowledgementRequired: true,
        isMandatory: true,
      },
      {
        name: 'Proprietary Non-Disclosure Agreement (NDA) Master Policy',
        title: 'Proprietary Non-Disclosure Agreement (NDA) Master Policy',
        code: 'POL-CORP-03',
        category: 'COMPANY',
        subType: 'NDA',
        version: '2.0',
        ownerName: 'Legal & Compliance',
        content: 'Standard terms binding employees during tenure and 24 months post-departure concerning proprietary secrets.',
        acknowledgementRequired: true,
        isMandatory: true,
      },
      {
        name: 'Conflict of Interest Disclosure & Management Policy',
        title: 'Conflict of Interest Disclosure & Management Policy',
        code: 'POL-CORP-04',
        category: 'COMPANY',
        subType: 'Conflict of Interest',
        version: '1.5',
        ownerName: 'Legal & Compliance',
        content: 'Mandatory annual disclosures of outside board memberships, secondary employment, and supplier affiliations.',
        acknowledgementRequired: true,
        isMandatory: true,
      },
      {
        name: 'Corporate Travel, Lodging & Per Diem Policy',
        title: 'Corporate Travel, Lodging & Per Diem Policy',
        code: 'POL-CORP-05',
        category: 'COMPANY',
        subType: 'Travel Policy',
        version: '2.2',
        ownerName: 'Finance & Operations',
        content: 'Booking classes, preferred hotel chains, airport transit allowances, and international travel insurance.',
        acknowledgementRequired: false,
        isMandatory: false,
      },
      {
        name: 'Business Expense Reimbursement & Petty Cash Policy',
        title: 'Business Expense Reimbursement & Petty Cash Policy',
        code: 'POL-CORP-06',
        category: 'COMPANY',
        subType: 'Expense Policy',
        version: '2.0',
        ownerName: 'Finance & Operations',
        content: 'Eligible receipt categories, 30-day submission windows, and GST/VAT compliant invoice requirements.',
        acknowledgementRequired: true,
        isMandatory: true,
      },
      {
        name: 'Brand Representation & Public Social Media Policy',
        title: 'Brand Representation & Public Social Media Policy',
        code: 'POL-CORP-07',
        category: 'COMPANY',
        subType: 'Social Media Policy',
        version: '1.7',
        ownerName: 'Marketing & Brand',
        content: 'Rules for public LinkedIn posting, media commentary disclaimers, and non-disparagement guidelines.',
        acknowledgementRequired: true,
        isMandatory: true,
      },
    ];

    for (const p of policiesToSeed) {
      await new Policy(p).save();
    }
    console.log(`✅ Seeded ${policiesToSeed.length} Policies across HR, IT, and COMPANY`);

    // 2. SEED TECMOTIV BULLETIN ITEMS
    await Announcement.deleteMany({});

    const bulletinItems = [
      // --- COMPANY NEWS ---
      {
        title: 'Welcome John Doe & Jane Smith to TecMotiv Global Workforce',
        content: 'We are thrilled to welcome our newest team members across Engineering and Marketing. Please join us in wishing them success as they begin their onboarding journey.',
        section: 'COMPANY NEWS',
        subType: 'New Employee',
        priority: 'Normal',
        pinned: true,
        tags: ['Onboarding', 'Welcome', 'Team Growth'],
        authorName: 'Sarah Connor (Head of People)',
      },
      {
        title: 'TecMotiv Secures Enterprise Deal with Apex Automotive Systems',
        content: 'TecMotiv has executed a multi-year master services agreement to provide integrated telematics and fleet ERP management for Apex Automotive’s 25,000-vehicle fleet.',
        section: 'COMPANY NEWS',
        subType: 'New Client',
        priority: 'High',
        pinned: true,
        tags: ['Commercial Win', 'Automotive', 'Growth'],
        authorName: 'Marcus Vance (Managing Director)',
      },
      {
        title: 'Strategic Cloud Partnership Finalized with CloudScale Global',
        content: 'Our engineering infrastructure will now leverage CloudScale’s ultra-low latency nodes across North America and Europe, significantly accelerating analytics queries.',
        section: 'COMPANY NEWS',
        subType: 'New Partnership',
        priority: 'Normal',
        pinned: false,
        tags: ['Infrastructure', 'Partnership'],
        authorName: 'David Head (VP of Engineering)',
      },
      {
        title: 'TecMotiv Surpasses 10,000 Active Daily Logistics Deliverables',
        content: 'A major operational milestone! Our unified ERP and operations platform processed over 10,000 live deliverables in a single business day with 99.98% uptime.',
        section: 'COMPANY NEWS',
        subType: 'Company Milestone',
        priority: 'High',
        pinned: false,
        tags: ['Milestone', 'Scale', 'Record High'],
        authorName: 'Operations Lead',
      },

      // --- ANNOUNCEMENTS ---
      {
        title: 'Official 2026 Q4 Holiday Schedule & Office Closures',
        content: 'Please review the official holiday calendar for the upcoming quarter. All regional branches will observe Thanksgiving, Christmas, and New Year’s Day schedules.',
        section: 'ANNOUNCEMENTS',
        subType: 'Holidays',
        priority: 'Normal',
        pinned: true,
        tags: ['Holidays', 'Office Schedule'],
        authorName: 'Human Resources',
      },
      {
        title: 'New York Headquarters: Electric Vehicle Charging Station Launch',
        content: 'New Level-2 EV charging bays are now online in the basement parking lot. Free charging is available for all registered employees via the mobile access badge.',
        section: 'ANNOUNCEMENTS',
        subType: 'Office Updates',
        priority: 'Normal',
        pinned: false,
        tags: ['Facilities', 'Green Initiative'],
        authorName: 'Facilities & Admin',
      },
      {
        title: 'Updated Hybrid Work Guidelines & Flex Time Policy v3.1',
        content: 'The revised hybrid policy has been published in the Policy Library. Please read and acknowledge the document to ensure alignment on monthly remote quotas.',
        section: 'ANNOUNCEMENTS',
        subType: 'Policy Changes',
        priority: 'High',
        pinned: true,
        tags: ['Compliance', 'HR Policy'],
        authorName: 'Sarah Connor',
      },
      {
        title: 'Mandatory Submission Deadline: Q4 OKRs & Goals Lock',
        content: 'All department leads and employees must submit approved Q4 deliverables and OKR targets in the Daily Task Tracker by Friday 6:00 PM EST.',
        section: 'ANNOUNCEMENTS',
        subType: 'Important Deadlines',
        priority: 'Urgent',
        pinned: true,
        tags: ['Deadlines', 'OKRs'],
        authorName: 'Executive Office',
      },

      // --- EVENTS ---
      {
        title: 'Deep Dive: Event-Driven Enterprise Architecture with MongoDB',
        content: 'Join our principal software architects for an interactive workshop on building resilient streaming microservices with MongoDB Change Streams and Kafka.',
        section: 'EVENTS',
        subType: 'Webinars',
        priority: 'Normal',
        pinned: false,
        tags: ['Tech Talk', 'Engineering Guild'],
        authorName: 'David Head',
      },
      {
        title: 'TecMotiv Keynote at Global Automotive Tech Summit 2026',
        content: 'Our leadership team will be presenting a keynote on real-time vehicle telemetry at the Detroit Convention Center. Stream links available on the company calendar.',
        section: 'EVENTS',
        subType: 'Conferences',
        priority: 'High',
        pinned: false,
        tags: ['Conference', 'Public Keynote'],
        authorName: 'Marcus Vance',
      },
      {
        title: 'Annual TecMotiv Hackathon & People Cultural Social',
        content: 'Gear up for 48 hours of rapid prototyping, creative brainstorming, and fun prizes! Register your 3-person team on the events portal by next Wednesday.',
        section: 'EVENTS',
        subType: 'Internal Activities',
        priority: 'Normal',
        pinned: false,
        tags: ['Culture', 'Hackathon', 'Fun'],
        authorName: 'People & Culture Team',
      },

      // --- RECOGNITION ---
      {
        title: 'Employee of the Month — October 2026: Alex Mercer',
        content: 'Heartiest congratulations to Alex Mercer from Administration! Alex spearheaded our ISO security audit and maintained flawless infrastructure uptime.',
        section: 'RECOGNITION',
        subType: 'Employee of the Month',
        priority: 'High',
        pinned: true,
        tags: ['Star Performer', 'Employee of the Month', 'Excellence'],
        authorName: 'Management Committee',
      },
      {
        title: 'Team Achievement: Core Platform Team Delivers Migration Phase 9',
        content: 'Kudos to our platform engineers who transitioned our distributed scheduling and calendar engine without a single second of service disruption.',
        section: 'RECOGNITION',
        subType: 'Team Achievements',
        priority: 'Normal',
        pinned: false,
        tags: ['Engineering', 'Flawless Delivery'],
        authorName: 'VP of Engineering',
      },
      {
        title: 'Project Milestone Honor: Telematics Engine V2 Goes Live',
        content: 'Celebrating the cross-functional squad that completed the real-time telematics analytics engine two weeks ahead of schedule!',
        section: 'RECOGNITION',
        subType: 'Project Achievements',
        priority: 'Normal',
        pinned: false,
        tags: ['Milestone', 'Innovation'],
        authorName: 'Product Director',
      },
    ];

    for (const b of bulletinItems) {
      await new Announcement(b).save();
    }
    console.log(`✅ Seeded ${bulletinItems.length} Bulletin Posts across News, Announcements, Events, and Recognition`);

    console.log('\n🎉 ALL PHASE 10 COMMUNICATION DATA SEEDED SUCCESSFULLY!');
  } catch (err) {
    console.error('Error seeding communication data:', err);
  } finally {
    await mongoose.disconnect();
  }
}

seedCommunicationData();
