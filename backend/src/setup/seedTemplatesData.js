require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

async function seedTemplatesData() {
  try {
    const mongoUri = process.env.DATABASE || 'mongodb://127.0.0.1:27017/tecmotiv-erp';
    console.log('Connecting to MongoDB at:', mongoUri);
    await mongoose.connect(mongoUri);

    const Template = require('../models/appModels/Template');

    // Clean existing default templates
    await Template.deleteMany({ isDefault: true });

    const allTemplates = [
      // ==========================================
      // HR TEMPLATES (10 items)
      // ==========================================
      {
        title: 'Employee Joining & Onboarding Letter',
        category: 'HR Templates',
        type: 'Joining Letter',
        description: 'Formal onboarding letter issued to new hires on Day 1.',
        subject: 'Welcome to TecMotiv — Official Joining Letter for {{employeeName}}',
        content: `Date: {{currentDate}}

To,
{{employeeName}}
Employee ID: {{employeeId}}
Department: {{department}}

Dear {{employeeName}},

We are delighted to formally welcome you to TecMotiv Solutions Pvt. Ltd. This letter confirms your joining as {{designation}} in the {{department}} department, effective {{joiningDate}}.

Reporting Details:
- Designation: {{designation}}
- Department: {{department}}
- Work Location: {{companyAddress}}
- Reporting Manager: {{managerName}}

Please submit all required compliance credentials and signed policy acknowledgements to the Human Resources department within 48 hours of joining.

We wish you a long, rewarding, and impactful career with TecMotiv!

Sincerely,
Head of Human Resources
TecMotiv Solutions Pvt. Ltd.`,
        isDefault: true,
      },
      {
        title: 'Formal Appointment & Offer Letter',
        category: 'HR Templates',
        type: 'Appointment Letter',
        description: 'Official employment contract outlining terms, designation, and compensation.',
        subject: 'Letter of Appointment — {{employeeName}} ({{designation}})',
        content: `Date: {{currentDate}}

Dear {{employeeName}},

Sub: Letter of Appointment

With reference to your interview and discussions with us, TecMotiv Solutions Pvt. Ltd. is pleased to appoint you as {{designation}} in the {{department}} department effective {{joiningDate}}.

Key Terms of Employment:
1. Compensation: Your gross annual compensation package is {{salary}}, subject to statutory deductions.
2. Probation Period: You will be on probation for a period of six (6) months from {{joiningDate}}.
3. Code of Conduct: You agree to uphold all company policies, data security guidelines, and intellectual property standards.

Please sign and return the duplicate copy of this letter as an endorsement of your acceptance.

For TecMotiv Solutions Pvt. Ltd.,
Authorized Signatory — Director of People Operations`,
        isDefault: true,
      },
      {
        title: 'Employee Non-Disclosure Agreement (NDA)',
        category: 'HR Templates',
        type: 'NDA',
        description: 'Confidentiality agreement protecting proprietary code, trade secrets, and client data.',
        subject: 'Confidentiality and Proprietary Information Agreement — {{employeeName}}',
        content: `NON-DISCLOSURE AND PROPRIETARY INFORMATION AGREEMENT

This Agreement is entered into on {{currentDate}}, by and between:
TecMotiv Solutions Pvt. Ltd., located at {{companyAddress}} (hereinafter "Company"),
AND
{{employeeName}}, Employee ID: {{employeeId}}, residing as employee of {{department}} (hereinafter "Employee").

1. Confidential Information:
Employee acknowledges access to proprietary source code, architectural blueprints, client databases, and financial strategies.

2. Non-Disclosure Obligations:
Employee agrees not to disclose, duplicate, or transmit any Proprietary Information to any third party during or following tenure with the Company.

3. Term & Governing Law:
This covenant shall remain in perpetuity regarding trade secrets and governed by the laws of Bengaluru Jurisdiction.

Signed by Employee: {{employeeName}} (ID: {{employeeId}})
Date: {{currentDate}}`,
        isDefault: true,
      },
      {
        title: 'Student Internship Offer & Agreement',
        category: 'HR Templates',
        type: 'Internship Letter',
        description: 'Official appointment letter for engineering and management interns.',
        subject: 'Internship Offer Letter — {{employeeName}}',
        content: `Date: {{currentDate}}

Dear {{employeeName}},

TecMotiv Solutions Pvt. Ltd. is pleased to offer you an Internship as {{designation}} in our {{department}} team starting {{joiningDate}}.

Internship Highlights:
- Stipend: {{salary}}
- Mentorship Under: {{managerName}}
- Learning Scope: Production microservices, client deliveries, and enterprise system design.

Upon successful completion of the internship, outstanding performance will be considered for a Pre-Placement Offer (PPO) as full-time software engineer.

Welcome aboard to the TecMotiv Innovation Lab!

Sincerely,
University Relations & Talent Team`,
        isDefault: true,
      },
      {
        title: 'Official Work Experience Certificate',
        category: 'HR Templates',
        type: 'Experience Letter',
        description: 'Formal letter validating employment duration, responsibilities, and performance.',
        subject: 'Experience Certificate — {{employeeName}}',
        content: `TO WHOMSOEVER IT MAY CONCERN

Date: {{currentDate}}

This is to certify that {{employeeName}} (Employee ID: {{employeeId}}) was employed with TecMotiv Solutions Pvt. Ltd. from {{joiningDate}} to {{effectiveDate}}.

During their tenure with us, {{employeeName}} held the designation of {{designation}} in the {{department}} department.

Their responsibilities included core development, agile execution, and team mentorship. We found {{employeeName}} to be dedicated, innovative, and a collaborative team member.

We wish {{employeeName}} all the best in their future professional endeavors.

For TecMotiv Solutions Pvt. Ltd.,
Head of Talent Operations`,
        isDefault: true,
      },
      {
        title: 'Employee Relieving & Clearance Letter',
        category: 'HR Templates',
        type: 'Relieving Letter',
        description: 'Formal relieving letter upon completion of notice period and asset handovers.',
        subject: 'Relieving Letter — {{employeeName}} ({{employeeId}})',
        content: `Date: {{currentDate}}

To,
{{employeeName}}
Employee ID: {{employeeId}}
Designation: {{designation}}
Department: {{department}}

Dear {{employeeName}},

Sub: Relieving Letter

With reference to your resignation letter, we confirm that you have been relieved of your duties from TecMotiv Solutions Pvt. Ltd. at the close of business on {{effectiveDate}}.

All company hardware, access tokens, and administrative assets have been satisfactorily surrendered. Your full and final settlement (FnF) has been processed in accordance with company policy.

We thank you for your contributions during your tenure since {{joiningDate}} and wish you success ahead.

Yours sincerely,
Director of Human Resources
TecMotiv Solutions Pvt. Ltd.`,
        isDefault: true,
      },
      {
        title: 'Monthly Salary Slip Summary',
        category: 'HR Templates',
        type: 'Salary Slip',
        description: 'Standard pay advice and earnings-deductions breakdown notification.',
        subject: 'Salary Slip Advice — {{employeeName}} ({{employeeId}})',
        content: `TECMOTIV SOLUTIONS PVT. LTD.
{{companyAddress}}

SALARY STATEMENT FOR CURRENT PERIOD

Employee Name: {{employeeName}}
Employee ID: {{employeeId}}
Department: {{department}}
Designation: {{designation}}
Payment Date: {{currentDate}}

Earnings & Deductions Summary:
- Net Salary Credited: {{salary}}
- Payment Method: Direct Bank Transfer (NEFT/IMPS)

This is a system-generated salary slip. If you have any payroll inquiries, please submit a ticket to the Finance & Payroll Desk at payroll@tecmotiv.com.`,
        isDefault: true,
      },
      {
        title: 'Official Leave Approval Notice',
        category: 'HR Templates',
        type: 'Leave Approval',
        description: 'Confirmation notice for approved casual, paid, or medical leave requests.',
        subject: 'Leave Approved — {{employeeName}}',
        content: `Dear {{employeeName}},

Your recent leave application has been reviewed and approved by {{managerName}}.

Leave Details:
- Employee: {{employeeName}} ({{employeeId}})
- Department: {{department}}
- Status: Approved
- Effective Date: {{effectiveDate}}

Please ensure that your tasks and deliverables are delegated or scheduled ahead of time.

Enjoy your time off!

Human Resources & Leave Desk
TecMotiv Solutions Pvt. Ltd.`,
        isDefault: true,
      },
      {
        title: 'Formal Disciplinary Warning / Notice',
        category: 'HR Templates',
        type: 'Warning/Notice',
        description: 'Notice concerning policy non-compliance, attendance, or performance concerns.',
        subject: 'Formal Notice / Advisory — {{employeeName}} ({{employeeId}})',
        content: `STRICTLY CONFIDENTIAL

Date: {{currentDate}}

To: {{employeeName}}
Employee ID: {{employeeId}}
Department: {{department}}

Dear {{employeeName}},

This communication serves as a formal notice regarding adherence to TecMotiv company standards and expected professional obligations effective {{effectiveDate}}.

We request you to schedule an alignment review with your department head {{managerName}} within 3 business days. TecMotiv remains committed to supporting your professional development, provided necessary corrective steps are promptly enacted.

Regards,
Human Resources Grievance & Compliance Cell`,
        isDefault: true,
      },
      {
        title: 'Quarterly Performance Review Summary',
        category: 'HR Templates',
        type: 'Performance Review',
        description: 'Quarterly appraisal and milestones evaluation document.',
        subject: 'Performance Appraisal Summary — {{employeeName}}',
        content: `TECMOTIV PERFORMANCE REVIEW EVALUATION

Employee Name: {{employeeName}}
Employee ID: {{employeeId}}
Department: {{department}}
Designation: {{designation}}
Appraisal Period: {{currentDate}}
Reviewer: {{managerName}}

Evaluation Highlights:
1. Technical Competence: Meets & Exceeds Role Expectations
2. Project Delivery: Consistently achieves milestone deadlines
3. Collaboration & Cultural Fit: Positive engagement with cross-functional peers

Next Quarter Goals:
- Spearhead key engineering initiatives in {{department}}
- Mentor junior engineers and participate in technical workshops

Human Resources Performance & Rewards Team`,
        isDefault: true,
      },

      // ==========================================
      // COMMUNICATION TEMPLATES (9 items)
      // ==========================================
      {
        title: 'Colleague Birthday Wishes Card',
        category: 'Communication',
        type: 'Birthday Wishes',
        description: 'Celebratory note for celebrating an employee birthday.',
        subject: '🎂 Happy Birthday, {{employeeName}}! — TecMotiv Family',
        content: `Dear {{employeeName}},

Wishing you a very Happy Birthday from all of us at TecMotiv Solutions! 🎂🎉

May your day be filled with joy, laughter, and sweet moments. We are so lucky to have you as part of our {{department}} family, bringing positive energy and excellence every single day.

Have an unforgettable celebration!

Warm wishes,
The TecMotiv Family`,
        isDefault: true,
      },
      {
        title: 'Work Anniversary Congratulations',
        category: 'Communication',
        type: 'Anniversary Wishes',
        description: 'Milestone celebration note for work anniversaries.',
        subject: '🏆 Celebrating {{yearsCompleted}} Years at TecMotiv — Kudos {{employeeName}}!',
        content: `Dear {{employeeName}},

Happy {{yearsCompleted}}-Year Work Anniversary! 🏆✨

Since you joined us on {{joiningDate}}, your hard work, dedication, and ingenuity as {{designation}} in {{department}} have made an indelible mark on our team.

Thank you for your continuous dedication and loyalty. Here is to many more milestones together!

Warmest congratulations,
Executive Leadership & TecMotiv Colleagues`,
        isDefault: true,
      },
      {
        title: 'Welcome to TecMotiv Greeting',
        category: 'Communication',
        type: 'Welcome Message',
        description: 'Warm welcome message sent to new joiners on Day 1.',
        subject: 'A Warm Welcome to TecMotiv, {{employeeName}}!',
        content: `Hi {{employeeName}},

Welcome to the TecMotiv family! We are thrilled to have you join our {{department}} team as {{designation}}.

Our team is dedicated to engineering best-in-class enterprise systems and fostering an inclusive, vibrant culture. Your onboarding buddy will connect with you today for a walkthrough.

Don't hesitate to reach out if you have any questions. Let's build the future together!

Cheers,
TecMotiv People & Culture Team`,
        isDefault: true,
      },
      {
        title: 'New Team Member Company Announcement',
        category: 'Communication',
        type: 'New Employee Announcement',
        description: 'Broadcast email introducing new team members to the entire company.',
        subject: '👋 Welcoming {{employeeName}} to our {{department}} Team!',
        content: `Hello Team TecMotiv,

Please join us in giving a warm welcome to {{employeeName}}, who has joined us as {{designation}} in the {{department}} department!

{{employeeName}} brings rich experience in scalable systems and creative problem solving. They joined our Bengaluru office on {{joiningDate}}.

Feel free to stop by their desk, say hello on Slack, or drop a welcome note!

Welcome aboard, {{employeeName}}!`,
        isDefault: true,
      },
      {
        title: 'Employee of the Month / Star Recognition',
        category: 'Communication',
        type: 'Employee Recognition',
        description: 'Spotlight celebration for peer excellence and high-impact performers.',
        subject: '⭐ Recognition Spotlight: Honoring {{employeeName}} for {{awardTitle}}',
        content: `Dear Team,

We are proud to recognize {{employeeName}} ({{designation}}, {{department}}) for their outstanding performance and for receiving the {{awardTitle}}!

Their exceptional dedication, customer empathy, and innovation have set a high benchmark for all of us.

Please join us in celebrating and congratulating {{employeeName}} on this well-deserved recognition! 🌟👏

Leadership Team
TecMotiv Solutions Pvt. Ltd.`,
        isDefault: true,
      },
      {
        title: 'Role Promotion Announcement',
        category: 'Communication',
        type: 'Promotion Announcement',
        description: 'Official notice announcing colleague promotion.',
        subject: '🚀 Congratulations to {{employeeName}} on their Promotion to {{designation}}!',
        content: `Dear Colleagues,

We are thrilled to announce that {{employeeName}} has been promoted to {{designation}} in the {{department}} department effective {{effectiveDate}}!

Since joining us on {{joiningDate}}, {{employeeName}} has demonstrated outstanding technical leadership, cross-departmental collaboration, and ownership.

Please join us in congratulating {{employeeName}} and wishing them tremendous success in their new role! 🎉`,
        isDefault: true,
      },
      {
        title: 'Seasonal Festival Greeting',
        category: 'Communication',
        type: 'Festival Greeting',
        description: 'Warm holiday and festive greetings for Diwali, New Year, etc.',
        subject: '🪔 Happy {{festivalName}} from TecMotiv Solutions!',
        content: `Dear {{employeeName}} & Family,

On the auspicious occasion of {{festivalName}}, TecMotiv extends our warmest greetings and best wishes to you and your loved ones!

May this festive season bring boundless happiness, good health, peace, and prosperity to your home.

Enjoy the holiday festivities!

Warm regards,
Managing Director & TecMotiv Board`,
        isDefault: true,
      },
      {
        title: 'Internal Event & Celebration Invitation',
        category: 'Communication',
        type: 'Event Invitation',
        description: 'Company-wide invitation to social gatherings, festivals, and all-hands.',
        subject: 'You are Invited: {{eventName}} on {{eventDate}}',
        content: `Dear {{employeeName}},

You are cordially invited to attend our upcoming {{eventName}}!

Event Details:
- Date: {{eventDate}}
- Venue: {{venue}}
- Hosted By: {{companyName}}

Come join your colleagues for an engaging session, networking, and celebration. Refreshments and catering will be provided.

Please RSVP through your ERP portal by {{effectiveDate}}.`,
        isDefault: true,
      },
      {
        title: 'Post-Event Thank You Note',
        category: 'Communication',
        type: 'Event Thank-you',
        description: 'Appreciation note sent after major company events and workshops.',
        subject: 'Thank You for Joining {{eventName}}!',
        content: `Dear {{employeeName}},

Thank you so much for attending {{eventName}} at {{venue}}!

Your enthusiasm, active participation, and energy made the occasion truly memorable. We hope you enjoyed the interactions and key insights.

Photo memories and recap videos are now available in the ERP Events Gallery.

See you at the next celebration!

Warmly,
TecMotiv Events Committee`,
        isDefault: true,
      },

      // ==========================================
      // MARKETING / EVENT TEMPLATES (6 items)
      // ==========================================
      {
        title: 'LinkedIn Corporate Milestone Post',
        category: 'Marketing/Event',
        type: 'LinkedIn Announcement',
        description: 'Social post announcing corporate milestones, client partnerships, or team growth.',
        subject: 'LinkedIn Post: Milestone Announcement',
        content: `🚀 Exciting news from {{companyName}}!

We are thrilled to announce our latest milestone in scalable enterprise technology. A huge shoutout to our incredible engineering team in {{department}} led by innovators like {{employeeName}} for making this possible.

At {{companyName}}, our mission is empowering modern businesses with automated, resilient ERP architectures.

👉 Learn more about our journey and open roles: https://tecmotiv.com/careers

#EnterpriseSoftware #CloudEngineering #TecMotiv #TechInnovation #Milestones`,
        isDefault: true,
      },
      {
        title: 'VIP Client & Partner Email Invitation',
        category: 'Marketing/Event',
        type: 'Email Invitation',
        description: 'Executive invitation for clients and industry partners.',
        subject: 'Exclusive Invitation: {{eventName}} Hosted by {{companyName}}',
        content: `Dear Valued Partner,

On behalf of {{companyName}}, we have the honor of inviting you to {{eventName}}, our premier showcase on enterprise digital transformation.

Date: {{eventDate}}
Location: {{venue}}

This private executive gathering brings together technology leaders, architects, and industry pioneers for insightful discussions on AI in enterprise operations.

We look forward to welcoming you in person.

Warm regards,
Executive Partnerships Unit
{{companyName}}`,
        isDefault: true,
      },
      {
        title: '24-Hour Event Countdown Reminder',
        category: 'Marketing/Event',
        type: 'Event Reminder',
        description: 'Urgent reminder sent 24 hours prior to scheduled webinar or summit.',
        subject: 'Reminder: {{eventName}} Starts Tomorrow!',
        content: `Hi {{employeeName}},

Just a quick reminder that {{eventName}} is happening tomorrow, {{eventDate}}!

Location / Stream: {{venue}}

Please ensure you join 5 minutes early to secure your seat and test your audio. Looking forward to an engaging session!

The {{companyName}} Organizing Team`,
        isDefault: true,
      },
      {
        title: 'Featured Keynote Speaker Announcement',
        category: 'Marketing/Event',
        type: 'Speaker Announcement',
        description: 'Promotional bulletin introducing keynote speakers for webinars or summits.',
        subject: 'Introducing Our Keynote Speaker for {{eventName}}!',
        content: `🎙️ SPEAKER SPOTLIGHT!

We are excited to announce our featured keynote speaker for {{eventName}}:
{{employeeName}}, {{designation}} at {{department}}.

Session Topic: Architecting Resilient Real-Time Microservices for Tier-1 Enterprise Clients.

Join us on {{eventDate}} at {{venue}}. Registration is complimentary for all attendees.

Reserve your spot now: https://events.tecmotiv.com/register`,
        isDefault: true,
      },
      {
        title: 'Strategic Partner Announcement',
        category: 'Marketing/Event',
        type: 'Partner Announcement',
        description: 'Press release & marketing announcement for new alliances.',
        subject: 'Strategic Alliance: {{companyName}} Announces New Industry Partnership',
        content: `FOR IMMEDIATE RELEASE

Bengaluru, {{currentDate}} — {{companyName}}, located at {{companyAddress}}, is delighted to announce a strategic partnership with our enterprise solutions ecosystem.

This collaboration expands our ability to deliver end-to-end ERP automation, secure payroll vaults, and AI-enabled workflows to global enterprises.

"This alliance accelerates our product roadmap and creates immense value for our global customers." — Managing Director, {{companyName}}.

For media inquiries: press@tecmotiv.com`,
        isDefault: true,
      },
      {
        title: 'Webinar & Event Follow-Up Survey',
        category: 'Marketing/Event',
        type: 'Event Follow-up',
        description: 'Post-event survey, recording link, and presentation deck dispatch.',
        subject: 'Thank You for Attending {{eventName}} — Slide Decks & Recording Inside',
        content: `Hi {{employeeName}},

Thank you for participating in {{eventName}} yesterday!

As promised, here are the resources from the session:
1. Complete Keynote Recording: https://webinar.tecmotiv.com/recordings/latest
2. Presentation Decks & Architecture Diagrams
3. 2-Minute Feedback Form: https://tecmotiv.com/feedback

We value your feedback and would love to hear your thoughts on how we can improve future sessions.

Best regards,
Marketing & Community Team
{{companyName}}`,
        isDefault: true,
      },
    ];

    for (const tmpl of allTemplates) {
      await new Template(tmpl).save();
      console.log(`✓ Seeded template: "${tmpl.title}" [${tmpl.category} / ${tmpl.type}]`);
    }

    console.log(`\n✨ Successfully seeded ${allTemplates.length} default TecMotiv templates across all categories!\n`);
    process.exit(0);
  } catch (err) {
    console.error('Seed templates error:', err);
    process.exit(1);
  }
}

seedTemplatesData();
