// Ensure all Mongoose models are registered before initializing controllers
require('../../models/loadAllModels.js');

const createCRUDController = require('../middlewaresControllers/createCRUDController');
const { routesList } = require('../../models/utils');

// Explicit static imports for serverless bundlers (Vercel, Rolldown, esbuild)
const customControllerMap = {
  assetController: require('./assetController'),
  attendanceController: require('./attendanceController'),
  bulletinController: require('./bulletinController'),
  calendarController: require('./calendarController'),
  dashboardController: require('./dashboardController'),
  digitalServiceController: require('./digitalServiceController'),
  documentController: require('./documentController'),
  employeeController: require('./employeeController'),
  eventController: require('./eventController'),
  githubController: require('./githubController'),
  googleCalendarController: require('./googleCalendarController'),
  leaveController: require('./leaveController'),
  notificationController: require('./notificationController'),
  officeController: require('./officeController'),
  outlookController: require('./outlookController'),
  policyController: require('./policyController'),
  projectController: require('./projectController'),
  salaryController: require('./salaryController'),
  taskController: require('./taskController'),
  templateController: require('./templateController'),
};

const appControllers = () => {
  const controllers = {};

  // First attach all custom controllers
  for (const [name, controller] of Object.entries(customControllerMap)) {
    controllers[name] = { ...controller };
  }

  // Merge CRUD operations for models in routesList
  routesList.forEach(({ modelName, controllerName }) => {
    const crudMethods = createCRUDController(modelName);
    if (controllers[controllerName]) {
      controllers[controllerName] = { ...crudMethods, ...controllers[controllerName] };
    } else {
      controllers[controllerName] = crudMethods;
    }
  });

  return controllers;
};

module.exports = appControllers();
