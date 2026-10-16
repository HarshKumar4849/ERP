const express = require('express');

const { catchErrors } = require('../../handlers/errorHandlers');

const rbacMiddleware = require('../../middlewares/rbacMiddleware');

const router = express.Router();

const adminController = require('../../controllers/coreControllers/adminController');
const settingController = require('../../controllers/coreControllers/settingController');

const { singleStorageUpload } = require('../../middlewares/uploadMiddleware');

// //_______________________________ Admin management_______________________________

router.route('/admin/list').get(rbacMiddleware('admin', 'list'), catchErrors(adminController.list));

router.route('/admin/read/:id').get(rbacMiddleware('admin', 'read'), catchErrors(adminController.read));

router.route('/admin/password-update/:id').patch(rbacMiddleware('admin', 'update'), catchErrors(adminController.updatePassword));

//_______________________________ Admin Profile _______________________________

router.route('/admin/profile/password').patch(rbacMiddleware('admin', 'update'), catchErrors(adminController.updateProfilePassword));
router
  .route('/admin/profile/update')
  .patch(
    rbacMiddleware('admin', 'update'),
    singleStorageUpload({ entity: 'admin', fieldName: 'photo', fileType: 'image' }),
    catchErrors(adminController.updateProfile)
  );

// //____________________________________________ API for Global Setting _________________

router.route('/setting/create').post(rbacMiddleware('setting', 'create'), catchErrors(settingController.create));
router.route('/setting/read/:id').get(rbacMiddleware('setting', 'read'), catchErrors(settingController.read));
router.route('/setting/update/:id').patch(rbacMiddleware('setting', 'update'), catchErrors(settingController.update));
//router.route('/setting/delete/:id).delete(catchErrors(settingController.delete));
router.route('/setting/search').get(rbacMiddleware('setting', 'search'), catchErrors(settingController.search));
router.route('/setting/list').get(rbacMiddleware('setting', 'list'), catchErrors(settingController.list));
router.route('/setting/listAll').get(rbacMiddleware('setting', 'list'), catchErrors(settingController.listAll));
router.route('/setting/filter').get(rbacMiddleware('setting', 'filter'), catchErrors(settingController.filter));
router
  .route('/setting/readBySettingKey/:settingKey')
  .get(rbacMiddleware('setting', 'read'), catchErrors(settingController.readBySettingKey));
router.route('/setting/listBySettingKey').get(rbacMiddleware('setting', 'read'), catchErrors(settingController.listBySettingKey));
router
  .route('/setting/updateBySettingKey/:settingKey?')
  .patch(rbacMiddleware('setting', 'update'), catchErrors(settingController.updateBySettingKey));
router
  .route('/setting/upload/:settingKey?')
  .patch(
    rbacMiddleware('setting', 'update'),
    singleStorageUpload({ entity: 'setting', fieldName: 'settingValue', fileType: 'image' }),
    catchErrors(settingController.updateBySettingKey)
  );
router.route('/setting/updateManySetting').patch(rbacMiddleware('setting', 'update'), catchErrors(settingController.updateManySetting));
module.exports = router;
