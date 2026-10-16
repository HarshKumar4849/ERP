const mongoose = require('mongoose');
const { ROLES, normalizeRole } = require('../rbac/roles');
const { isActionAllowed } = require('../rbac/permissions');

const rbacMiddleware = (resource, action) => async (req, res, next) => {
  try {
    req.body = req.body || {};
    req.query = req.query || {};
    req.params = req.params || {};

    const user = req.user || req.admin;

    if (!user) {
      return res.status(401).json({
        success: false,
        result: null,
        message: 'Authentication required. No valid user session found.',
      });
    }

    const role = normalizeRole(user.role || (user.department === 'HR' ? 'HR' : ''));
    req.userRole = role;

    const targetId = req.params.id || req.params.projectId;
    const userIdStr = user._id ? user._id.toString() : '';
    const userDept = user.department || '';

    // Self-owned resources: notifications & preferences may only be
    // accessed by their owner (enforced for every non-management role).
    if (resource === 'notification') {
      if (targetId && !mongoose.Types.ObjectId.isValid(targetId)) {
        return res.status(400).json({
          success: false,
          result: null,
          message: 'Invalid notification id.',
        });
      }
      if (action === 'read' || action === 'update' || action === 'delete') {
        if (targetId) {
          const NotificationModel = mongoose.model('Notification');
          const notifRecord = await NotificationModel.findOne({ _id: targetId, removed: false });
          if (notifRecord && notifRecord.recipient && notifRecord.recipient.toString() !== userIdStr) {
            return res.status(403).json({
              success: false,
              result: null,
              message: "Access denied: You cannot access another user's notifications.",
            });
          }
        }
      }
      if (action === 'list' || action === 'listAll' || action === 'filter' || action === 'search' || action === 'summary') {
        req.query.user = userIdStr;
      }
    }

    if (resource === 'notificationpreference') {
      if (targetId && !mongoose.Types.ObjectId.isValid(targetId)) {
        return res.status(400).json({
          success: false,
          result: null,
          message: 'Invalid notification preference id.',
        });
      }
      if (action === 'read' || action === 'update' || action === 'delete') {
        if (targetId) {
          const PrefModel = mongoose.model('NotificationPreference');
          const prefRecord = await PrefModel.findOne({ _id: targetId, removed: false });
          if (prefRecord && prefRecord.user && prefRecord.user.toString() !== userIdStr) {
            return res.status(403).json({
              success: false,
              result: null,
              message: "Access denied: You cannot access another user's notification preferences.",
            });
          }
        }
      }
      if (action === 'list' || action === 'listAll' || action === 'filter' || action === 'search' || action === 'summary') {
        req.query.user = userIdStr;
      }
    }

    // 1. Role-Level Matrix Permission Check
    const allowed = isActionAllowed(role, resource, action);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        result: null,
        message: `Access denied: Role '${role}' is not authorized to perform '${action}' on '${resource}'.`,
      });
    }

    // ADMIN has full access without restrictions
    if (role === ROLES.ADMIN) {
      return next();
    }

    // 2. Resource-Level Ownership & Confidentiality Enforcement for Private Document Vault
    // Invariant: Private employee documents are accessible to:
    // - ADMIN (full enterprise visibility for system management)
    // - The owning employee or the user who uploaded the document
    // (HR and other employees are denied access to another employee's private confidential documents)
    if (resource === 'document') {
      const isPrivileged = role === ROLES.ADMIN;

      if (!isPrivileged) {
        if (action === 'read' || action === 'download') {
          if (targetId) {
            if (!mongoose.Types.ObjectId.isValid(targetId)) {
              return res.status(400).json({
                success: false,
                result: null,
                message: 'Invalid document id.',
              });
            }
            const DocumentModel = mongoose.model('Document');
            const EmployeeModel = mongoose.model('Employee');
            const docRecord = await DocumentModel.findOne({ _id: targetId, removed: false }).populate('employee');
            if (docRecord) {
              const ownEmp = await EmployeeModel.findOne({
                $or: [{ user: user._id }, { email: user.email }, { personalEmail: user.email }],
                removed: false,
              });
              const ownEmpId = ownEmp ? ownEmp._id.toString() : '';
              const empUser = docRecord.employee?.user ? docRecord.employee.user.toString() : '';
              const empId = docRecord.employee?._id
                ? docRecord.employee._id.toString()
                : docRecord.employee
                ? docRecord.employee.toString()
                : '';
              const empEmail = docRecord.employee?.email ? docRecord.employee.email.toLowerCase() : '';
              const uploaderId = docRecord.uploadedBy ? docRecord.uploadedBy.toString() : '';

              const isOwner =
                empUser === userIdStr ||
                empId === userIdStr ||
                (ownEmpId && empId === ownEmpId) ||
                (empEmail && user.email && empEmail === user.email.toLowerCase()) ||
                uploaderId === userIdStr;

              if (!isOwner) {
                return res.status(403).json({
                  success: false,
                  result: null,
                  message: "Access denied: You cannot access another employee's confidential documents.",
                });
              }
            }
          }
        }
        if (action === 'list' || action === 'listAll' || action === 'filter' || action === 'search' || action === 'summary') {
          const EmployeeModel = mongoose.model('Employee');
          const empDoc = await EmployeeModel.findOne({
            $or: [{ user: user._id }, { email: user.email }, { personalEmail: user.email }],
            removed: false,
          });
          if (empDoc) {
            req.query.employee = empDoc._id.toString();
          } else {
            req.query.employee = user._id.toString();
          }
        }
        if (action === 'create') {
          const EmployeeModel = mongoose.model('Employee');
          const empDoc = await EmployeeModel.findOne({
            $or: [{ user: user._id }, { email: user.email }, { personalEmail: user.email }],
            removed: false,
          });
          if (empDoc) {
            req.body.employee = empDoc._id.toString();
          } else {
            req.body.employee = user._id.toString();
          }
          req.body.uploadedBy = user._id.toString();
        }
        if (action === 'update' || action === 'delete' || action === 'verify') {
          return res.status(403).json({
            success: false,
            result: null,
            message: 'Access denied: Only administrators can update, verify, or delete official private documents.',
          });
        }
      }
    }

    // Block administrative password reset for all non-ADMIN roles
    if (resource === 'admin' && (req.originalUrl || req.url || '').includes('password-update')) {
      if (role !== ROLES.ADMIN) {
        return res.status(403).json({
          success: false,
          result: null,
          message: 'Access denied: Only administrators can execute administrative password resets.',
        });
      }
    }

    // 3. Role-Specific Restrictions
    if (role === ROLES.EMPLOYEE) {
      // Rule: An employee must never access another employee's confidential profile
      if (resource === 'admin') {
        if (action === 'read' || action === 'update') {
          if (targetId && targetId !== userIdStr) {
            return res.status(403).json({
              success: false,
              result: null,
              message: "Access denied: You cannot access another employee's confidential profile.",
            });
          }
        }
        if (action === 'list' || action === 'listAll' || action === 'search') {
          return res.status(403).json({
            success: false,
            result: null,
            message: 'Access denied: Employees cannot view full administrative user directories.',
          });
        }
      }

      if (resource === 'employee') {
        if (action === 'read' || action === 'update') {
          if (targetId) {
            const EmployeeModel = mongoose.model('Employee');
            const empQuery = mongoose.Types.ObjectId.isValid(targetId)
              ? { $or: [{ _id: targetId }, { user: targetId }] }
              : { employeeId: String(targetId).toUpperCase() };
            const empRecord = await EmployeeModel.findOne({
              ...empQuery,
              removed: false,
            });
            if (empRecord) {
              // Resolve the requesting user's own employee record so the
              // ownership check also holds when empRecord.user is unset.
              let ownEmp = await EmployeeModel.findOne({ user: user._id, removed: false });
              if (!ownEmp && user.email) {
                ownEmp = await EmployeeModel.findOne({ email: user.email.toLowerCase(), removed: false });
              }
              const ownEmpIdStr = ownEmp ? ownEmp._id.toString() : '';
              const recUserStr = empRecord.user ? empRecord.user.toString() : '';
              const recIdStr = empRecord._id.toString();
              const isOwn =
                recUserStr === userIdStr ||
                recIdStr === ownEmpIdStr ||
                targetId === userIdStr;
              if (!isOwn) {
                return res.status(403).json({
                  success: false,
                  result: null,
                  message: "Access denied: You cannot access another employee's confidential profile.",
                });
              }
            }
          }
        }
        if (action === 'delete' || action === 'create') {
          return res.status(403).json({
            success: false,
            result: null,
            message: 'Access denied: Employees cannot create or delete employee records.',
          });
        }
      }

      // Rule: Salary slips are strictly confidential to the owner
      if (resource === 'salary') {
        const EmployeeModel = mongoose.model('Employee');
        let empDoc = await EmployeeModel.findOne({ user: user._id, removed: false });
        if (!empDoc && user.email) {
          empDoc = await EmployeeModel.findOne({ email: user.email.toLowerCase(), removed: false });
        }
        const empIdStr = empDoc ? empDoc._id.toString() : '';

        if (action === 'read') {
          if (targetId) {
            const SalaryModel = mongoose.model('Salary');
            const salRecord = await SalaryModel.findOne({ _id: targetId, removed: false });
            if (salRecord) {
              const recUserStr = salRecord.user ? salRecord.user.toString() : '';
              const recEmpStr = salRecord.employee ? salRecord.employee.toString() : '';
              if (recUserStr !== userIdStr && recEmpStr !== empIdStr) {
                return res.status(403).json({
                  success: false,
                  result: null,
                  message: "Access denied: You cannot access another employee's confidential salary data.",
                });
              }
            }
          }
        }
        if (action === 'list' || action === 'filter' || action === 'search') {
          if (empIdStr) {
            req.query.employee = empIdStr;
          }
          req.query.user = userIdStr;
        }
        if (action === 'create' || action === 'update' || action === 'delete') {
          return res.status(403).json({
            success: false,
            result: null,
            message: 'Access denied: Employees cannot create, modify, or delete salary records.',
          });
        }
      }

      // Rule: Leave requests ownership
      if (resource === 'leave' || resource === 'leavebalance') {
        const EmployeeModel = mongoose.model('Employee');
        let empDoc = await EmployeeModel.findOne({ user: user._id, removed: false });
        if (!empDoc && user.email) {
          empDoc = await EmployeeModel.findOne({ email: user.email.toLowerCase(), removed: false });
        }
        const empIdStr = empDoc ? empDoc._id.toString() : '';

        if (action === 'read') {
          if (targetId) {
            if (!mongoose.Types.ObjectId.isValid(targetId)) {
              return res.status(400).json({
                success: false,
                result: null,
                message: 'Invalid leave record id.',
              });
            }
            const Model = mongoose.model(resource === 'leavebalance' ? 'LeaveBalance' : 'Leave');
            const record = await Model.findOne({ _id: targetId, removed: false });
            if (record) {
              const recUserStr = record.user ? record.user.toString() : '';
              const recEmpStr = record.employee ? record.employee.toString() : '';
              if (recUserStr !== userIdStr && recEmpStr !== empIdStr) {
                return res.status(403).json({
                  success: false,
                  result: null,
                  message: "Access denied: You cannot access another employee's confidential leave records.",
                });
              }
            }
          }
        }
        if (action === 'list' || action === 'filter' || action === 'search' || action === 'summary') {
          if (empIdStr) {
            req.query.employee = empIdStr;
          }
          req.query.user = userIdStr;
        }
        if (action === 'create') {
          if (req.body.employee && empIdStr && req.body.employee.toString() !== empIdStr) {
            return res.status(403).json({
              success: false,
              result: null,
              message: 'Access denied: Employees cannot apply for leave on behalf of other employees.',
            });
          }
          if (empDoc) {
            req.body.employee = empDoc._id;
          }
          req.body.user = user._id;
          req.body.department = user.department;
        }
        if (action === 'update') {
          // Block non-authorized employees from hitting reviewer approval routes
          const reqPath = req.originalUrl || req.url || '';
          if (reqPath.includes('manager-approval') || reqPath.includes('hr-approval')) {
            return res.status(403).json({
              success: false,
              result: null,
              message: 'Access denied: Employees cannot approve or reject leave requests.',
            });
          }

          // Employee can cancel their own leave, but cannot approve/reject
          if (
            (req.body.status && ['Approved', 'Rejected', 'approved', 'rejected'].includes(req.body.status)) ||
            (req.body.action && ['Approve', 'Reject', 'approved', 'rejected'].includes(req.body.action))
          ) {
            return res.status(403).json({
              success: false,
              result: null,
              message: 'Access denied: Employees cannot approve or reject leave requests.',
            });
          }
          if (targetId) {
            if (!mongoose.Types.ObjectId.isValid(targetId)) {
              return res.status(400).json({
                success: false,
                result: null,
                message: 'Invalid leave record id.',
              });
            }
            const LeaveModel = mongoose.model('Leave');
            const leaveRecord = await LeaveModel.findOne({ _id: targetId, removed: false });
            if (leaveRecord) {
              const recUserStr = leaveRecord.user ? leaveRecord.user.toString() : '';
              const recEmpStr = leaveRecord.employee ? leaveRecord.employee.toString() : '';
              if (recUserStr !== userIdStr && recEmpStr !== empIdStr) {
                return res.status(403).json({
                  success: false,
                  result: null,
                  message: "Access denied: You cannot modify another employee's leave request.",
                });
              }
            }
          }
        }
        if (action === 'delete') {
          return res.status(403).json({
            success: false,
            result: null,
            message: 'Access denied: Employees cannot delete leave records.',
          });
        }
      }

      // Rule: Attendance records ownership
      if (resource === 'attendance') {
        const EmployeeModel = mongoose.model('Employee');
        let empDoc = await EmployeeModel.findOne({ user: user._id, removed: false });
        if (!empDoc && user.email) {
          empDoc = await EmployeeModel.findOne({ email: user.email.toLowerCase(), removed: false });
        }
        const empIdStr = empDoc ? empDoc._id.toString() : '';

        if (action === 'read') {
          if (targetId) {
            const AttendanceModel = mongoose.model('Attendance');
            const attRecord = await AttendanceModel.findOne({ _id: targetId, removed: false });
            if (attRecord) {
              const attUserStr = attRecord.user ? attRecord.user.toString() : '';
              const attEmpStr = attRecord.employee ? attRecord.employee.toString() : '';
              if (attUserStr !== userIdStr && attEmpStr !== empIdStr) {
                return res.status(403).json({
                  success: false,
                  result: null,
                  message: "Access denied: You cannot access another employee's attendance records.",
                });
              }
            }
          }
        }
        if (action === 'list' || action === 'filter' || action === 'search' || action === 'summary') {
          if (empIdStr) {
            req.query.employee = empIdStr;
          }
          req.query.user = userIdStr;
        }
        if (action === 'update' || action === 'delete') {
          return res.status(403).json({
            success: false,
            result: null,
            message: 'Access denied: Employees cannot manually update or delete attendance records.',
          });
        }
        if (action === 'create') {
          const reqPath = req.originalUrl || req.url || '';
          if (reqPath.includes('/attendance/create')) {
            return res.status(403).json({
              success: false,
              result: null,
              message: 'Access denied: Employees cannot manually create attendance records.',
            });
          }
          // If body specifies a different employee, reject immediately
          if (req.body.employee && empIdStr && req.body.employee.toString() !== empIdStr) {
            return res.status(403).json({
              success: false,
              result: null,
              message: "Access denied: Employees cannot manipulate another employee's attendance.",
            });
          }
          if (empIdStr) {
            req.body.employee = empDoc._id;
          }
          req.body.user = user._id;
          req.body.department = user.department;
        }
      }

      // Rule: Task ownership
      if (resource === 'task') {
        const EmployeeModel = mongoose.model('Employee');
        let empDoc = await EmployeeModel.findOne({ user: user._id, removed: false });
        if (!empDoc && user.email) {
          empDoc = await EmployeeModel.findOne({ email: user.email.toLowerCase(), removed: false });
        }
        const empIdStr = empDoc ? empDoc._id.toString() : '';
        req.userEmployee = empDoc;

        if (action === 'delete') {
          return res.status(403).json({
            success: false,
            result: null,
            message: 'Access denied: Employees cannot delete tasks.',
          });
        }

        if (action === 'read' || action === 'update') {
          if (targetId) {
            const TaskModel = mongoose.model('Task');
            const taskRecord = await TaskModel.findOne({ _id: targetId, removed: false });
            if (taskRecord) {
              const isOwner =
                (taskRecord.owner && empIdStr && taskRecord.owner.toString() === empIdStr) ||
                (taskRecord.assignedTo && taskRecord.assignedTo.toString() === userIdStr);
              const isReviewer =
                (taskRecord.reviewer && empIdStr && taskRecord.reviewer.toString() === empIdStr) ||
                (taskRecord.reviewerUser && taskRecord.reviewerUser.toString() === userIdStr);
              const isCreator = taskRecord.createdBy && taskRecord.createdBy.toString() === userIdStr;

              let isProjectMember = false;
              if (taskRecord.project && empIdStr) {
                const ProjectModel = mongoose.model('Project');
                const proj = await ProjectModel.findOne({ _id: taskRecord.project, removed: false });
                if (proj) {
                  const pmIdStr = proj.projectManager ? proj.projectManager.toString() : '';
                  isProjectMember =
                    pmIdStr === empIdStr ||
                    (Array.isArray(proj.teamMembers) && proj.teamMembers.some((m) => m.toString() === empIdStr));
                }
              }

              if (!isOwner && !isReviewer && !isCreator && !isProjectMember) {
                return res.status(403).json({
                  success: false,
                  result: null,
                  message: 'Access denied: You cannot access tasks assigned to other employees.',
                });
              }
            }
          }
        }
      }

      // Rule: Project authorization
      if (resource === 'project') {
        const EmployeeModel = mongoose.model('Employee');
        let empDoc = await EmployeeModel.findOne({ user: user._id, removed: false });
        if (!empDoc && user.email) {
          empDoc = await EmployeeModel.findOne({ email: user.email.toLowerCase(), removed: false });
        }
        const empIdStr = empDoc ? empDoc._id.toString() : '';

        if (action === 'delete') {
          return res.status(403).json({
            success: false,
            result: null,
            message: 'Access denied: Employees cannot delete projects.',
          });
        }
        if (action === 'create') {
          return res.status(403).json({
            success: false,
            result: null,
            message: 'Access denied: Employees cannot create projects.',
          });
        }
        if (action === 'read' || action === 'update') {
          if (targetId) {
            const ProjectModel = mongoose.model('Project');
            const projRecord = await ProjectModel.findOne({ _id: targetId, removed: false });
            if (projRecord) {
              const pmIdStr = projRecord.projectManager ? projRecord.projectManager.toString() : '';
              const isPM = pmIdStr === empIdStr;
              const isMember =
                Array.isArray(projRecord.teamMembers) &&
                projRecord.teamMembers.some((m) => m.toString() === empIdStr);

              if (action === 'update' && !isPM) {
                return res.status(403).json({
                  success: false,
                  result: null,
                  message: 'Access denied: Only Project Managers or Leadership can update projects.',
                });
              }
              if (action === 'read' && !isPM && !isMember) {
                return res.status(403).json({
                  success: false,
                  result: null,
                  message: 'Access denied: You are not authorized to view this project.',
                });
              }
            }
          }
        }
      }
      // Rule: Salary & Payroll ownership (Strict Self-Service)
      if (resource === 'salary' || resource === 'payroll') {
        const EmployeeModel = mongoose.model('Employee');
        const empDoc = await EmployeeModel.findOne({ user: user._id, removed: false });
        const empIdStr = empDoc ? empDoc._id.toString() : '';

        if (action === 'create' || action === 'update' || action === 'delete') {
          return res.status(403).json({
            success: false,
            result: null,
            message: 'Access denied: Employees cannot create or modify salary records.',
          });
        }

        if (action === 'list' || action === 'filter' || action === 'search' || action === 'summary') {
          if (empIdStr) {
            req.query.employee = empIdStr;
          } else {
            req.query.employee = '000000000000000000000000';
          }
        }

        if (action === 'read') {
          if (targetId) {
            const SalaryModel = mongoose.model('Salary');
            const salaryRecord = await SalaryModel.findOne({ _id: targetId, removed: false });
            if (salaryRecord) {
              const recordEmpStr = salaryRecord.employee ? salaryRecord.employee.toString() : '';
              const recordUserStr = salaryRecord.user ? salaryRecord.user.toString() : '';
              const isMatch = (empIdStr && recordEmpStr === empIdStr) || (userIdStr && recordUserStr === userIdStr);
              if (!isMatch) {
                return res.status(403).json({
                  success: false,
                  result: null,
                  message: 'Access denied: You cannot view salary details of other employees.',
                });
              }
            }
          }
        }
      }

      // Rule: Asset ownership (Employees only see their own assigned assets)
      if (resource === 'asset') {
        const EmployeeModel = mongoose.model('Employee');
        const empDoc = await EmployeeModel.findOne({ user: user._id, removed: false });
        const empIdStr = empDoc ? empDoc._id.toString() : '';

        if (action === 'create' || action === 'update' || action === 'delete') {
          return res.status(403).json({
            success: false,
            result: null,
            message: 'Access denied: Employees cannot manage company assets.',
          });
        }

        if (action === 'list' || action === 'filter' || action === 'search' || action === 'summary') {
          if (empIdStr) {
            req.query.employee = empIdStr;
          } else {
            req.query.employee = '000000000000000000000000';
          }
        }

        if (action === 'read') {
          if (targetId) {
            const AssetModel = mongoose.model('Asset');
            const assetRecord = await AssetModel.findOne({ _id: targetId, removed: false });
            if (assetRecord) {
              const assignedEmpStr = assetRecord.employee ? assetRecord.employee.toString() : '';
              if (assignedEmpStr !== empIdStr) {
                return res.status(403).json({
                  success: false,
                  result: null,
                  message: 'Access denied: You can only view assets assigned to yourself.',
                });
              }
            }
          }
        }
      }

      // Rule: Office Management (Administrative records strictly hidden from normal employees)
      if (resource === 'office' || resource === 'officeoperation') {
        return res.status(403).json({
          success: false,
          result: null,
          message: 'Access denied: Administrative records are restricted to administrators.',
        });
      }

      // Rule: Project authorization (Employees only see projects they are members of)
      if (resource === 'project') {
        const EmployeeModel = mongoose.model('Employee');
        const empDoc = await EmployeeModel.findOne({ user: user._id, removed: false });
        const empIdStr = empDoc ? empDoc._id.toString() : '';

        if (action === 'create' || action === 'delete') {
          return res.status(403).json({
            success: false,
            result: null,
            message: 'Access denied: Employees cannot create or delete projects.',
          });
        }

        if (action === 'list' || action === 'filter' || action === 'search' || action === 'summary') {
          if (empIdStr) {
            req.query.authorizedEmployee = empIdStr;
          } else {
            req.query.authorizedEmployee = '000000000000000000000000';
          }
        }

        if (action === 'read' || action === 'update') {
          if (targetId) {
            const ProjectModel = mongoose.model('Project');
            const projectRecord = await ProjectModel.findOne({ _id: targetId, removed: false });
            if (projectRecord) {
              const isPM = projectRecord.projectManager && projectRecord.projectManager.toString() === empIdStr;
              const isMember = Array.isArray(projectRecord.teamMembers) && projectRecord.teamMembers.some((m) => m && m.toString() === empIdStr);
              if (!isPM && !isMember) {
                return res.status(403).json({
                  success: false,
                  result: null,
                  message: 'Access denied: You are not authorized to access this project.',
                });
              }
            }
          }
        }
      }

      // Rule: Policy Library & Compliance Audit Isolation
      if (resource === 'policy') {
        const reqPath = req.originalUrl || req.url || '';
        if (action === 'update') {
          if (!reqPath.includes('/policy/acknowledge')) {
            return res.status(403).json({
              success: false,
              result: null,
              message: 'Access denied: Employees cannot modify policies.',
            });
          }
        }
        if (action === 'read') {
          if (reqPath.includes('/policy/acknowledgements')) {
            return res.status(403).json({
              success: false,
              result: null,
              message: 'Access denied: Only HR and Administrators can view compliance audit trails.',
            });
          }
        }
        if (action === 'create' || action === 'delete') {
          return res.status(403).json({
            success: false,
            result: null,
            message: 'Access denied: Employees cannot create or delete policies.',
          });
        }
      }

      // Rule: Bulletin Feed & Post Modification Isolation
      if (resource === 'bulletin') {
        const reqPath = req.originalUrl || req.url || '';
        if (action === 'update') {
          if (!reqPath.includes('/bulletin/like')) {
            return res.status(403).json({
              success: false,
              result: null,
              message: 'Access denied: Employees cannot modify bulletin posts.',
            });
          }
        }
        if (action === 'create' || action === 'delete') {
          return res.status(403).json({
            success: false,
            result: null,
            message: 'Access denied: Employees cannot create or delete bulletin posts.',
          });
        }
      }

      // Rule: Company Calendar & Celebrations
      if (resource === 'calendar') {
        const reqPath = req.originalUrl || req.url || '';
        if (action === 'create') {
          if (!reqPath.includes('/celebration') && !reqPath.includes('wish')) {
            return res.status(403).json({
              success: false,
              result: null,
              message: 'Access denied: Employees cannot create calendar events.',
            });
          }
        }
        if (action === 'update' || action === 'delete') {
          return res.status(403).json({
            success: false,
            result: null,
            message: 'Access denied: Employees cannot modify or delete calendar events.',
          });
        }
      }

      // Rule: Events & Media/Invitations Isolation
      if (resource === 'event') {
        if (action === 'create' || action === 'update' || action === 'delete') {
          return res.status(403).json({
            success: false,
            result: null,
            message: 'Access denied: Employees cannot create, modify, or delete company events.',
          });
        }
      }
    }

    // Rule: Organization Calendar Integrations (OAuth Connect / Disconnect / Reconnect)
    const reqUrl = req.originalUrl || req.url || '';
    if (
      (resource === 'calendar' || resource === 'outlook' || resource === 'google') &&
      (reqUrl.includes('/connect') || reqUrl.includes('/disconnect') || reqUrl.includes('/reconnect'))
    ) {
      if (role !== ROLES.ADMIN) {
        return res.status(403).json({
          success: false,
          result: null,
          message: 'Access denied: Only administrators can configure organization calendar integrations.',
        });
      }
    }

    // 3. HR Scope Enforcement (Cannot manage IT administration, digital services, office admin, or system settings)
    if (role === ROLES.HR) {
      if (resource === 'setting' || resource === 'digitalservice' || resource === 'office' || resource === 'officeoperation' || resource === 'itasset') {
        return res.status(403).json({
          success: false,
          result: null,
          message: 'Access denied: HR role cannot manage IT administration or core system settings.',
        });
      }
    }

    next();
  } catch (error) {
    console.error('RBAC middleware error:', error);
    return res.status(500).json({
      success: false,
      result: null,
      message: 'Internal authorization error.',
      controller: 'rbacMiddleware',
    });
  }
};

module.exports = rbacMiddleware;
