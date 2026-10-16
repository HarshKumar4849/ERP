require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

async function testCompanyCalendar() {
  console.log('====================================================');
  console.log('🧪 TESTING PHASE 9: COMPANY CALENDAR & CELEBRATIONS');
  console.log('====================================================\n');

  try {
    await mongoose.connect(process.env.DATABASE || 'mongodb://127.0.0.1:27017/tecmotiv-erp');
    console.log('✅ Connected to MongoDB');

    const Admin = require('../models/coreModels/Admin');
    const Employee = require('../models/appModels/Employee');
    const calendarController = require('../controllers/appControllers/calendarController');

    const mgmtUser = await Admin.findOne({ email: 'management@tecmotiv.com' });
    const emp1User = await Admin.findOne({ email: 'employee1@tecmotiv.com' });
    const emp1 = await Employee.findOne({ email: emp1User.email });

    // 1. Test Company Calendar Feed
    console.log('\n--- Test 1: Company Calendar Feed (HR / Management) ---');
    let companyEventsResult = null;
    await calendarController.events(
      {
        user: mgmtUser,
        userRole: 'MANAGEMENT',
        query: { scope: 'company', year: new Date().getFullYear() },
      },
      { status: () => ({ json: (d) => (companyEventsResult = d) }) }
    );

    if (!companyEventsResult || !companyEventsResult.success) {
      throw new Error('Failed to fetch company calendar events');
    }

    const eventsList = companyEventsResult.result;
    console.log(`✅ Total Company Calendar events returned: ${eventsList.length}`);

    const typesFound = [...new Set(eventsList.map((e) => e.eventType))];
    console.log('   Event categories present:', typesFound);

    // 2. Test My Calendar Feed (Employee)
    console.log('\n--- Test 2: My Calendar Feed (Employee) ---');
    let myEventsResult = null;
    await calendarController.events(
      {
        user: emp1User,
        userRole: 'EMPLOYEE',
        query: { scope: 'my', year: new Date().getFullYear() },
      },
      { status: () => ({ json: (d) => (myEventsResult = d) }) }
    );
    console.log(`✅ Employee My Calendar events: ${myEventsResult.result.length}`);

    // 3. Test Celebrations Calculation (Birthdays & Anniversaries)
    console.log('\n--- Test 3: Celebrations Auto-Calculation & 7-Day Reminders ---');
    let celebrationsResult = null;
    await calendarController.celebrations(
      { user: mgmtUser, userRole: 'MANAGEMENT', query: {} },
      { status: () => ({ json: (d) => (celebrationsResult = d) }) }
    );

    const { upcomingBirthdays, upcomingAnniversaries, defaultReminderDays } = celebrationsResult.result;
    console.log(`✅ Default reminder schedule: ${defaultReminderDays} days before occasion`);
    console.log(`   Upcoming Birthdays count: ${upcomingBirthdays.length}`);
    if (upcomingBirthdays.length > 0) {
      console.log(`   Next birthday: ${upcomingBirthdays[0].name} (in ${upcomingBirthdays[0].daysLeft} days) | Reminder Active: ${upcomingBirthdays[0].reminderActive}`);
    }

    console.log(`   Upcoming Work Anniversaries count: ${upcomingAnniversaries.length}`);
    if (upcomingAnniversaries.length > 0) {
      console.log(`   Next anniversary: ${upcomingAnniversaries[0].name} (${upcomingAnniversaries[0].yearsCompleted} yrs, in ${upcomingAnniversaries[0].daysLeft} days)`);
    }

    // 4. Test Posting a Wish on a Celebration
    console.log('\n--- Test 4: Post Celebration Wish ---');
    if (emp1) {
      let wishResult = null;
      await calendarController.addWish(
        {
          user: mgmtUser,
          userRole: 'MANAGEMENT',
          params: {},
          body: {
            employeeId: emp1._id,
            employeeName: `${emp1.name} ${emp1.surname}`,
            type: 'Work Anniversary',
            title: `${emp1.name}'s Work Anniversary`,
            message: 'Congratulations John on your outstanding contributions to TecMotiv!',
            yearsCompleted: 2,
          },
        },
        { status: () => ({ json: (d) => (wishResult = d) }) }
      );

      console.log(`✅ Wish posted successfully on celebration record ID: ${wishResult.result._id}`);
      console.log(`   Total wishes on record: ${wishResult.result.wishes.length}`);
    }

    // 5. Test Creating a Custom Calendar Event
    console.log('\n--- Test 5: Create Event with 7-Day Reminder ---');
    let createEventResult = null;
    const eventStart = new Date();
    eventStart.setDate(eventStart.getDate() + 5);

    await calendarController.createEvent(
      {
        user: mgmtUser,
        body: {
          title: 'TEST_CALENDAR_EVENT: Q4 Enterprise Planning',
          eventType: 'Company Activity',
          startDate: eventStart,
          location: 'Innovation Center Room 101',
          reminderDaysBefore: 7,
        },
      },
      { status: () => ({ json: (d) => (createEventResult = d) }) }
    );
    console.log(`✅ Event created: "${createEventResult.result.title}" (Reminder: ${createEventResult.result.reminderDaysBefore} days before)`);

    // Clean up test event
    const Event = require('../models/appModels/Event');
    await Event.deleteMany({ title: { $regex: /^TEST_CALENDAR_EVENT/i } });
    console.log('🧹 Cleaned up test event');

    console.log('\n====================================================');
    console.log('🎉 ALL PHASE 9 COMPANY CALENDAR TESTS PASSED!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

testCompanyCalendar();
