require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

async function seedProjectData() {
  try {
    await mongoose.connect(process.env.DATABASE || 'mongodb://127.0.0.1:27017/tecmotiv-erp');
    console.log('✅ Connected to MongoDB');

    const Admin = require('../models/coreModels/Admin');
    const Employee = require('../models/appModels/Employee');
    const Project = require('../models/appModels/Project');
    const Task = require('../models/appModels/Task');
    const Event = require('../models/appModels/Event');

    const adminUser = await Admin.findOne({ role: 'ADMIN' }) || await Admin.findOne();
    const employees = await Employee.find({ removed: false }).limit(6);

    if (employees.length < 2) {
      console.log('⚠️ Need at least 2 employees to seed projects.');
      process.exit(0);
    }

    // Clear existing projects
    await Project.deleteMany({});

    console.log('🚀 Seeding Projects across all 5 categories (MDS, B2B, B2G, Consulting, Events)...');

    const projectsToSeed = [
      // 1. MDS Category
      {
        name: 'MDS Core Engine & Telematics Pipeline',
        code: 'TM-MDS-2026-001',
        client: 'TecMotiv Internal Core Platforms',
        category: 'MDS',
        department: 'Engineering',
        projectManager: employees[0]._id,
        projectManagerName: `${employees[0].name} ${employees[0].surname || ''}`.trim(),
        teamMembers: [employees[0]._id, employees[1]._id],
        startDate: new Date('2026-01-10'),
        targetDate: new Date('2026-11-30'),
        budget: 4500000,
        status: 'In Progress',
        progress: 65,
        description: 'Next-generation Master Data Services stream processing pipeline for high-throughput telematics.',
        notes: 'Sprint 14 in progress. Core Kafka ingest architecture locked.',
        deliverables: [
          { title: 'Schema Registry & Ingestion Gateway', status: 'Completed', dueDate: new Date('2026-04-15') },
          { title: 'Stream De-duplication Engine', status: 'Completed', dueDate: new Date('2026-07-20') },
          { title: 'High-Throughput Timeseries Aggregator', status: 'In Progress', dueDate: new Date('2026-10-30') },
          { title: 'Enterprise Failover Benchmarking', status: 'Pending', dueDate: new Date('2026-11-25') },
        ],
        meetings: [
          {
            title: 'Bi-Weekly Architecture Alignment',
            date: new Date('2026-10-15T10:00:00Z'),
            meetingLink: 'https://meet.google.com/mds-core-sync',
            agenda: 'Review timeseries indexing benchmarks and memory footprint under stress test.',
          },
        ],
        documents: [
          {
            title: 'MDS System Architecture Blueprint v3.2',
            fileName: 'MDS_Architecture_v3.2.pdf',
            fileUrl: '/uploads/MDS_Architecture_v3.2.pdf',
            fileType: 'PDF',
          },
        ],
        createdBy: adminUser._id,
      },

      // 2. B2B Category
      {
        name: 'Apex Automotive Enterprise Logistics Portal',
        code: 'TM-B2B-2026-002',
        client: 'Apex Automotive Systems',
        category: 'B2B',
        department: 'Operations',
        projectManager: employees[1]._id,
        projectManagerName: `${employees[1].name} ${employees[1].surname || ''}`.trim(),
        teamMembers: [employees[1]._id, employees[0]._id],
        startDate: new Date('2026-03-01'),
        targetDate: new Date('2026-12-15'),
        budget: 7200000,
        status: 'In Progress',
        progress: 50,
        description: 'Custom B2B fleet logistics and dispatch visibility suite for global automotive supplier.',
        notes: 'Milestone 2 acceptance criteria signed off. UI components finalized.',
        deliverables: [
          { title: 'Fleet Tracking API & Webhooks', status: 'Completed', dueDate: new Date('2026-05-30') },
          { title: 'Executive KPI Reporting Dashboard', status: 'Completed', dueDate: new Date('2026-08-15') },
          { title: 'Driver Mobile App Integration', status: 'In Progress', dueDate: new Date('2026-11-10') },
          { title: 'Security & Penetration Audit Sign-off', status: 'Pending', dueDate: new Date('2026-12-05') },
        ],
        meetings: [
          {
            title: 'Apex Client Steering Committee Review',
            date: new Date('2026-10-22T14:00:00Z'),
            meetingLink: 'https://teams.microsoft.com/apex-logistics-review',
            agenda: 'Review driver app beta feedback and Q4 deployment timelines.',
          },
        ],
        documents: [
          {
            title: 'Apex Enterprise Service Level Agreement (SLA)',
            fileName: 'Apex_SLA_Agreement.pdf',
            fileUrl: '/uploads/Apex_SLA.pdf',
            fileType: 'PDF',
          },
        ],
        createdBy: adminUser._id,
      },

      // 3. B2G Category
      {
        name: 'Municipal Smart Transit Fleet Monitoring Gateway',
        code: 'TM-B2G-2026-003',
        client: 'Department of Public Transportation',
        category: 'B2G',
        department: 'Engineering',
        projectManager: employees[0]._id,
        projectManagerName: `${employees[0].name} ${employees[0].surname || ''}`.trim(),
        teamMembers: [employees[0]._id, employees[1]._id],
        startDate: new Date('2026-04-15'),
        targetDate: new Date('2027-01-31'),
        budget: 9500000,
        status: 'In Progress',
        progress: 40,
        description: 'Government municipal contract for tracking 2,500 public buses and EV rapid charging stations.',
        notes: 'Statutory compliance audit completed. Phase 1 field testing running on Route 18.',
        deliverables: [
          { title: 'Smart Sensor OBD-II Integration', status: 'Completed', dueDate: new Date('2026-06-30') },
          { title: 'Government Data Security Standard ISO27001 Compliance', status: 'Completed', dueDate: new Date('2026-09-10') },
          { title: 'Emergency Dispatch SOS Dispatch Protocol', status: 'In Progress', dueDate: new Date('2026-11-30') },
          { title: 'Full Citywide Grid Go-Live', status: 'Pending', dueDate: new Date('2027-01-20') },
        ],
        meetings: [
          {
            title: 'Ministry Field Review & Station Inspection',
            date: new Date('2026-11-05T09:30:00Z'),
            agenda: 'On-site hardware inspection at Central Bus Terminal.',
          },
        ],
        documents: [
          {
            title: 'Municipal Tender Award & Technical RFP',
            fileName: 'Municipal_Transit_RFP.pdf',
            fileUrl: '/uploads/Municipal_RFP.pdf',
            fileType: 'PDF',
          },
        ],
        createdBy: adminUser._id,
      },

      // 4. Consulting Category
      {
        name: 'Cloud Infrastructure & Microservices Architecture Review',
        code: 'TM-CNS-2026-004',
        client: 'Global Logistics Alliance',
        category: 'Consulting',
        department: 'Engineering',
        projectManager: employees[1]._id,
        projectManagerName: `${employees[1].name} ${employees[1].surname || ''}`.trim(),
        teamMembers: [employees[1]._id],
        startDate: new Date('2026-07-01'),
        targetDate: new Date('2026-10-31'),
        budget: 1800000,
        status: 'In Progress',
        progress: 85,
        description: 'Comprehensive technical due-diligence, cloud cost optimization, and multi-region resilience strategy.',
        notes: 'Final recommendations deliverable deck undergoing leadership QA.',
        deliverables: [
          { title: 'Current State Cloud Architecture Audit', status: 'Completed', dueDate: new Date('2026-08-01') },
          { title: 'Cost Optimization & FinOps Roadmap', status: 'Completed', dueDate: new Date('2026-09-15') },
          { title: 'Target Kubernetes Multi-Region Blueprint', status: 'Completed', dueDate: new Date('2026-10-10') },
          { title: 'Executive Briefing & Transition Playbook', status: 'In Progress', dueDate: new Date('2026-10-28') },
        ],
        meetings: [
          {
            title: 'Executive Board Presentation of Findings',
            date: new Date('2026-10-27T16:00:00Z'),
            meetingLink: 'https://meet.google.com/consulting-exec-debrief',
            agenda: 'Deliver final recommendations to C-suite.',
          },
        ],
        documents: [
          {
            title: 'FinOps Optimization Audit Report',
            fileName: 'FinOps_Report_2026.pdf',
            fileUrl: '/uploads/FinOps_Report.pdf',
            fileType: 'PDF',
          },
        ],
        createdBy: adminUser._id,
      },

      // 5. Events Category
      {
        name: 'TecMotiv Annual Automotive Tech Summit & Hackathon',
        code: 'TM-EVT-2026-005',
        client: 'TecMotiv People & Culture Board',
        category: 'Events',
        department: 'HR',
        projectManager: employees[0]._id,
        projectManagerName: `${employees[0].name} ${employees[0].surname || ''}`.trim(),
        teamMembers: [employees[0]._id, employees[1]._id],
        startDate: new Date('2026-08-15'),
        targetDate: new Date('2026-12-20'),
        budget: 2500000,
        status: 'In Progress',
        progress: 45,
        description: 'Organizing 2-day flagship tech summit featuring external keynote speakers, hackathon prizes, and workshops.',
        notes: 'Auditorium booked at Bangalore International Centre. 14 partner sponsors onboarded.',
        deliverables: [
          { title: 'Venue Booking & AV Production Contracting', status: 'Completed', dueDate: new Date('2026-09-20') },
          { title: 'Keynote Speaker Lineup Lock', status: 'Completed', dueDate: new Date('2026-10-15') },
          { title: 'Hackathon Problem Statement Definition', status: 'In Progress', dueDate: new Date('2026-11-15') },
          { title: 'Catering, Swag & Registration Badge Distribution', status: 'Pending', dueDate: new Date('2026-12-10') },
        ],
        meetings: [
          {
            title: 'Event Organizing Committee Status Check',
            date: new Date('2026-10-18T11:00:00Z'),
            meetingLink: 'https://meet.google.com/tecmotiv-summit-sync',
            agenda: 'Finalize hackathon jury panel and sponsor booth floorplan.',
          },
        ],
        documents: [
          {
            title: 'Tech Summit Event Program Schedule & Sponsor Kit',
            fileName: 'Summit_Program_Schedule.pdf',
            fileUrl: '/uploads/Summit_Program.pdf',
            fileType: 'PDF',
          },
        ],
        createdBy: adminUser._id,
      },
    ];

    const insertedProjects = await Project.insertMany(projectsToSeed);
    console.log(`✅ Seeded ${insertedProjects.length} projects across all 5 categories.`);

    // 2. CONNECT WITH TASKS (Ensure Task collection references these projects)
    console.log('🔗 Connecting real tasks to seeded projects...');
    for (const prj of insertedProjects) {
      // Create linked task
      await new Task({
        task: `[${prj.code}] Implement Milestone Phase Architecture`,
        title: `[${prj.code}] Implement Milestone Phase Architecture`,
        description: `Deliver core technical tasks for ${prj.name}`,
        owner: prj.projectManager,
        project: prj._id,
        projectName: prj.name,
        department: prj.department,
        priority: 'High',
        dueDate: prj.targetDate,
        status: 'In Progress',
      }).save();

      // Create linked calendar event
      await new Event({
        title: `[Milestone] ${prj.name}`,
        description: `Major delivery target milestone for project ${prj.code}`,
        eventType: 'Project Milestone',
        startDate: prj.targetDate,
        department: prj.department,
        project: prj._id,
        organizer: adminUser._id,
        attendees: prj.teamMembers,
      }).save();
    }

    console.log('✅ Successfully connected projects with Tasks and Calendar Events!');
    process.exit(0);
  } catch (err) {
    console.error('Seed project error:', err);
    process.exit(1);
  }
}

seedProjectData();
