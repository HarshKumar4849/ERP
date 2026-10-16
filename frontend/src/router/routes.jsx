import { lazy } from 'react';
import { Navigate } from 'react-router-dom';
import RoleGuard from './RoleGuard';

const Logout = lazy(() => import('@/pages/Logout.jsx'));
const NotFound = lazy(() => import('@/pages/NotFound.jsx'));
const Profile = lazy(() => import('@/pages/Profile'));
const About = lazy(() => import('@/pages/About'));
const Settings = lazy(() => import('@/pages/Settings/Settings'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));

// TecMotiv ERP Modules
const Employees = lazy(() => import('@/pages/Employees'));
const Attendance = lazy(() => import('@/pages/Attendance'));
const Leave = lazy(() => import('@/pages/Leave'));
const Tasks = lazy(() => import('@/pages/Tasks'));
const Projects = lazy(() => import('@/pages/Projects'));
const Payroll = lazy(() => import('@/pages/Payroll'));
const Calendar = lazy(() => import('@/pages/Calendar'));
const Events = lazy(() => import('@/pages/Events'));
const Recognition = lazy(() => import('@/pages/Recognition'));
const Bulletin = lazy(() => import('@/pages/Bulletin'));
const Policies = lazy(() => import('@/pages/Policies'));
const Admin = lazy(() => import('@/pages/Admin'));
const Templates = lazy(() => import('@/pages/Templates'));
const ItAdmin = lazy(() => import('@/pages/ItAdmin'));
const Documents = lazy(() => import('@/pages/Documents'));

let routes = {
  default: [
    {
      path: '/login',
      element: <Navigate to="/" />,
    },
    {
      path: '/logout',
      element: <Logout />,
    },
    {
      path: '/',
      element: <Dashboard />,
    },
    {
      path: '/employees',
      element: (
        <RoleGuard moduleKey="employees">
          <Employees />
        </RoleGuard>
      ),
    },
    {
      path: '/attendance',
      element: (
        <RoleGuard moduleKey="attendance">
          <Attendance />
        </RoleGuard>
      ),
    },
    {
      path: '/leave',
      element: (
        <RoleGuard moduleKey="leave">
          <Leave />
        </RoleGuard>
      ),
    },
    {
      path: '/tasks',
      element: (
        <RoleGuard moduleKey="tasks">
          <Tasks />
        </RoleGuard>
      ),
    },
    {
      path: '/projects',
      element: (
        <RoleGuard moduleKey="projects">
          <Projects />
        </RoleGuard>
      ),
    },
    {
      path: '/payroll',
      element: (
        <RoleGuard moduleKey="payroll">
          <Payroll />
        </RoleGuard>
      ),
    },
    {
      path: '/documents',
      element: (
        <RoleGuard moduleKey="documents">
          <Documents />
        </RoleGuard>
      ),
    },
    {
      path: '/calendar',
      element: (
        <RoleGuard moduleKey="calendar">
          <Calendar />
        </RoleGuard>
      ),
    },
    {
      path: '/events',
      element: (
        <RoleGuard moduleKey="events">
          <Events />
        </RoleGuard>
      ),
    },
    {
      key: 'recognition',
      path: '/recognition',
      element: (
        <RoleGuard moduleKey="recognition">
          <Recognition />
        </RoleGuard>
      ),
    },
    {
      path: '/bulletin',
      element: (
        <RoleGuard moduleKey="bulletin">
          <Bulletin />
        </RoleGuard>
      ),
    },
    {
      path: '/policies',
      element: (
        <RoleGuard moduleKey="policies">
          <Policies />
        </RoleGuard>
      ),
    },
    {
      path: '/admin',
      element: (
        <RoleGuard moduleKey="admin">
          <Admin />
        </RoleGuard>
      ),
    },
    {
      path: '/templates',
      element: (
        <RoleGuard moduleKey="templates">
          <Templates />
        </RoleGuard>
      ),
    },
    {
      path: '/it-admin',
      element: (
        <RoleGuard moduleKey="digitalservice">
          <ItAdmin />
        </RoleGuard>
      ),
    },
    {
      path: '/settings',
      element: (
        <RoleGuard moduleKey="settings">
          <Settings />
        </RoleGuard>
      ),
    },
    {
      path: '/settings/edit/:settingsKey',
      element: (
        <RoleGuard moduleKey="settings">
          <Settings />
        </RoleGuard>
      ),
    },
    {
      path: '/profile',
      element: <Profile />,
    },
    {
      path: '/about',
      element: <About />,
    },
    {
      path: '*',
      element: <NotFound />,
    },
  ],
};

export default routes;
