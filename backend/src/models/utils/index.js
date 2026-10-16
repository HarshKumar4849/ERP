const { basename, extname, resolve } = require('path');
const { globSync } = require('glob');

const modelsBaseDir = resolve(__dirname, '..').replace(/\\/g, '/');
const appModelsFiles = globSync(`${modelsBaseDir}/appModels/**/*.js`);

const pattern = `${modelsBaseDir}/**/*.js`;

const defaultAppModels = [
  'Announcement',
  'Asset',
  'Attendance',
  'Celebration',
  'Department',
  'Designation',
  'DigitalService',
  'Document',
  'Employee',
  'Event',
  'GithubActivity',
  'Leave',
  'LeaveBalance',
  'Location',
  'Notification',
  'NotificationPreference',
  'OfficeOperation',
  'OutlookIntegration',
  'Policy',
  'PolicyAcknowledgement',
  'Project',
  'Recognition',
  'Salary',
  'SalaryAudit',
  'Task',
  'Template',
];

const defaultCoreModels = ['Admin', 'AdminPassword', 'Setting', 'Upload'];

let modelsFiles = globSync(pattern).map((filePath) => {
  const fileNameWithExtension = basename(filePath);
  return fileNameWithExtension.replace(extname(fileNameWithExtension), '');
});

if (!modelsFiles || modelsFiles.length === 0) {
  modelsFiles = [...defaultCoreModels, ...defaultAppModels];
}

const constrollersList = [];
const appModelsList = [];
const entityList = [];
const routesList = [];

const effectiveAppModelNames =
  appModelsFiles && appModelsFiles.length > 0
    ? appModelsFiles.map((filePath) => {
        const fileNameWithExtension = basename(filePath);
        return fileNameWithExtension.replace(extname(fileNameWithExtension), '');
      })
    : defaultAppModels;

for (const modelName of effectiveAppModelNames) {
  const firstChar = modelName.charAt(0);
  const normalizedModelName = modelName.replace(firstChar, firstChar.toUpperCase());
  const fileNameLowerCaseFirstChar = modelName.replace(firstChar, firstChar.toLowerCase());
  const entity = modelName.toLowerCase();

  const controllerName = fileNameLowerCaseFirstChar + 'Controller';
  constrollersList.push(controllerName);
  appModelsList.push(normalizedModelName);
  entityList.push(entity);

  const route = {
    entity: entity,
    modelName: normalizedModelName,
    controllerName: controllerName,
  };
  routesList.push(route);
}

module.exports = { constrollersList, appModelsList, modelsFiles, entityList, routesList };
