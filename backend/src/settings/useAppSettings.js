const useAppSettings = () => {
  let settings = {};
  settings['idurar_app_email'] = process.env.EMAIL_FROM || 'noreply@tecmotiv.com';
  settings['idurar_base_url'] = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
  return settings;
};

module.exports = useAppSettings;
