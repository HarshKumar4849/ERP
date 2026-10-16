require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

async function seedDigitalServices() {
  try {
    const mongoUri = process.env.DATABASE || 'mongodb://127.0.0.1:27017/tecmotiv-erp';
    console.log('Connecting to MongoDB at:', mongoUri);
    await mongoose.connect(mongoUri);

    const DigitalService = require('../models/appModels/DigitalService');
    const Employee = require('../models/appModels/Employee');

    const employees = await Employee.find({ removed: false }).limit(5);
    console.log(`Found ${employees.length} employees to assign as account owners.`);

    // Clear previous seeded demo services
    await DigitalService.deleteMany({ loginEmail: { $regex: /@tecmotiv\.com$/ } });

    const now = new Date();
    const currentYear = now.getFullYear();

    const sampleServices = [
      {
        serviceName: 'Microsoft 365 Business Premium',
        serviceType: 'Microsoft 365',
        accountOwner: employees[0]?._id,
        accountOwnerName: employees[0] ? `${employees[0].name} ${employees[0].surname || ''}` : 'IT Admin Lead',
        loginEmail: 'admin@tecmotiv.com',
        renewalDate: new Date(currentYear, now.getMonth() + 1, 15),
        billingCycle: 'Yearly',
        cost: 285000,
        currency: 'INR',
        paymentMethod: 'Corporate Credit Card',
        paymentMethodDetails: 'HDFC Corporate Card ending 4092',
        status: 'Active',
        reminderDaysBefore: 15,
        serviceUrl: 'https://admin.microsoft.com',
        notes: 'Covers 50 user licenses for Office apps, Exchange Online, Intune MDM, and Azure AD.',
      },
      {
        serviceName: 'Google Workspace Enterprise Mail',
        serviceType: 'Email Accounts',
        accountOwner: employees[1]?._id,
        accountOwnerName: employees[1] ? `${employees[1].name} ${employees[1].surname || ''}` : 'Systems Architect',
        loginEmail: 'postmaster@tecmotiv.com',
        renewalDate: new Date(currentYear, now.getMonth(), now.getDate() + 10), // Expiring soon!
        billingCycle: 'Monthly',
        cost: 32000,
        currency: 'INR',
        paymentMethod: 'Auto-Debit / Standing Instruction',
        paymentMethodDetails: 'ICICI Bank Standing Instruction',
        status: 'Expiring Soon',
        reminderDaysBefore: 15,
        serviceUrl: 'https://admin.google.com',
        notes: 'Primary MX routing, dual-delivery backup, and 30 TB shared company Drive pool.',
      },
      {
        serviceName: 'TecMotiv.com & Brand Portals Domain Portfolio',
        serviceType: 'Domain',
        accountOwner: employees[0]?._id,
        accountOwnerName: employees[0] ? `${employees[0].name} ${employees[0].surname || ''}` : 'IT Admin Lead',
        loginEmail: 'domains@tecmotiv.com',
        renewalDate: new Date(currentYear, now.getMonth() + 4, 1),
        billingCycle: 'Yearly',
        cost: 8500,
        currency: 'INR',
        paymentMethod: 'Corporate Credit Card',
        paymentMethodDetails: 'Axis Bank Corp Master',
        status: 'Active',
        reminderDaysBefore: 30,
        serviceUrl: 'https://manage.godaddy.com',
        notes: 'Registered with WHOIS privacy protection, DNSSEC enabled, auto-renewal flagged.',
      },
      {
        serviceName: 'Hostinger Cloud VPS & Staging Cluster',
        serviceType: 'Hostinger',
        accountOwner: employees[2]?._id,
        accountOwnerName: employees[2] ? `${employees[2].name} ${employees[2].surname || ''}` : 'DevOps Specialist',
        loginEmail: 'devops@tecmotiv.com',
        renewalDate: new Date(currentYear, now.getMonth() + 2, 20),
        billingCycle: 'Yearly',
        cost: 45000,
        currency: 'INR',
        paymentMethod: 'PayPal',
        paymentMethodDetails: 'corporate-billing@tecmotiv.com PayPal',
        status: 'Active',
        reminderDaysBefore: 15,
        serviceUrl: 'https://hpanel.hostinger.com',
        notes: 'Hosts staging QA environments, mock API sandboxes, and documentation wikis.',
      },
      {
        serviceName: 'Amazon Web Services (AWS) Production Infra',
        serviceType: 'AWS',
        accountOwner: employees[1]?._id,
        accountOwnerName: employees[1] ? `${employees[1].name} ${employees[1].surname || ''}` : 'Cloud Architect',
        loginEmail: 'aws-root@tecmotiv.com',
        renewalDate: new Date(currentYear, now.getMonth(), now.getDate() + 25),
        billingCycle: 'Monthly',
        cost: 145000,
        currency: 'INR',
        paymentMethod: 'Bank Wire / NEFT',
        paymentMethodDetails: 'AWS India Invoicing NEFT Direct',
        status: 'Active',
        reminderDaysBefore: 7,
        serviceUrl: 'https://console.aws.amazon.com',
        notes: 'EC2 instances, Aurora PostgreSQL multi-AZ, S3 asset vaults, and CloudFront distribution.',
      },
      {
        serviceName: 'Anthropic Claude AI Team Enterprise',
        serviceType: 'Claude',
        accountOwner: employees[0]?._id,
        accountOwnerName: employees[0] ? `${employees[0].name} ${employees[0].surname || ''}` : 'CTO / Lead Architect',
        loginEmail: 'ai-lead@tecmotiv.com',
        renewalDate: new Date(currentYear, now.getMonth() + 1, 5),
        billingCycle: 'Monthly',
        cost: 48000,
        currency: 'INR',
        paymentMethod: 'Corporate Credit Card',
        paymentMethodDetails: 'HDFC Corporate Card ending 4092',
        status: 'Active',
        reminderDaysBefore: 10,
        serviceUrl: 'https://claude.ai/team',
        notes: '20 Claude Enterprise seats for engineering pairing, documentation synthesis, and code analysis.',
      },
      {
        serviceName: 'Google Cloud Platform (GCP) BigQuery & AI',
        serviceType: 'Google Cloud',
        accountOwner: employees[2]?._id,
        accountOwnerName: employees[2] ? `${employees[2].name} ${employees[2].surname || ''}` : 'Data Engineer',
        loginEmail: 'gcp-billing@tecmotiv.com',
        renewalDate: new Date(currentYear, now.getMonth(), now.getDate() + 5), // Expiring soon!
        billingCycle: 'Monthly',
        cost: 72000,
        currency: 'INR',
        paymentMethod: 'Corporate Credit Card',
        paymentMethodDetails: 'Corporate Visa Card',
        status: 'Expiring Soon',
        reminderDaysBefore: 15,
        serviceUrl: 'https://console.cloud.google.com',
        notes: 'BigQuery data warehouse for ERP analytics and Cloud Run containers.',
      },
      {
        serviceName: 'Canva Pro for Enterprise Marketing',
        serviceType: 'Canva',
        accountOwner: employees[3]?._id,
        accountOwnerName: employees[3] ? `${employees[3].name} ${employees[3].surname || ''}` : 'Marketing Lead',
        loginEmail: 'design@tecmotiv.com',
        renewalDate: new Date(currentYear, now.getMonth() + 6, 18),
        billingCycle: 'Yearly',
        cost: 16500,
        currency: 'INR',
        paymentMethod: 'UPI / Net Banking',
        paymentMethodDetails: 'ICICI Corporate UPI',
        status: 'Active',
        reminderDaysBefore: 15,
        serviceUrl: 'https://www.canva.com',
        notes: 'Brand kits, social media templates, pitch deck assets, and design team access.',
      },
      {
        serviceName: 'HubSpot Enterprise CRM & Sales Hub',
        serviceType: 'CRM',
        accountOwner: employees[4]?._id,
        accountOwnerName: employees[4] ? `${employees[4].name} ${employees[4].surname || ''}` : 'Head of Sales',
        loginEmail: 'crm-admin@tecmotiv.com',
        renewalDate: new Date(currentYear, now.getMonth() + 3, 10),
        billingCycle: 'Yearly',
        cost: 420000,
        currency: 'INR',
        paymentMethod: 'Bank Wire / NEFT',
        paymentMethodDetails: 'Quarterly Commercial PO',
        status: 'Active',
        reminderDaysBefore: 30,
        serviceUrl: 'https://app.hubspot.com',
        notes: 'Lead capture pipelines, automated sequences, B2B deal tracking, and marketing attribution.',
      },
      {
        serviceName: 'Figma Enterprise Design System',
        serviceType: 'Other SaaS',
        customServiceName: 'Figma Enterprise',
        accountOwner: employees[3]?._id,
        accountOwnerName: employees[3] ? `${employees[3].name} ${employees[3].surname || ''}` : 'UI/UX Director',
        loginEmail: 'figma-admin@tecmotiv.com',
        renewalDate: new Date(currentYear, now.getMonth() - 1, 10), // Expired!
        billingCycle: 'Yearly',
        cost: 95000,
        currency: 'INR',
        paymentMethod: 'Corporate Credit Card',
        paymentMethodDetails: 'HDFC Corporate Card ending 4092',
        status: 'Expired',
        reminderDaysBefore: 15,
        serviceUrl: 'https://www.figma.com',
        notes: 'UI kits, prototype libraries, design-system tokens, and 8 full editor seats.',
      },
    ];

    for (const s of sampleServices) {
      await new DigitalService(s).save();
      console.log(`✓ Seeded digital service: "${s.serviceName}" [${s.serviceType}] - Status: ${s.status}`);
    }

    console.log(`\n✨ Successfully seeded ${sampleServices.length} digital services across all 10 types!\n`);
    process.exit(0);
  } catch (err) {
    console.error('Seed digital services error:', err);
    process.exit(1);
  }
}

seedDigitalServices();
