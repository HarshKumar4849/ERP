import React, { useRef } from 'react';
import {
  Modal,
  Button,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  PrinterOutlined,
  DownloadOutlined,
  SafetyCertificateOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import logoIcon from '@/style/images/logo-icon.svg';

const { Text } = Typography;

function formatCurrency(amount) {
  const val = Number(amount || 0);
  return '₹ ' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(date) {
  if (!date) return '—';
  const d = dayjs(date);
  return d.isValid() ? d.format('DD/MM/YYYY') : '—';
}

function calculateLeaveBalanceTotal(snapshot, fallback) {
  if (snapshot && typeof snapshot === 'object') {
    if (typeof snapshot.totalBalance === 'number') {
      return snapshot.totalBalance;
    }
    let total = 0;
    let found = false;
    for (const key of Object.keys(snapshot)) {
      const item = snapshot[key];
      if (item && typeof item === 'object' && typeof item.allocated === 'number') {
        found = true;
        total += Math.max(0, (item.allocated || 0) - (item.used || 0));
      }
    }
    if (found) return total;
  }
  if (fallback !== undefined && fallback !== null && !isNaN(Number(fallback))) {
    return Number(fallback);
  }
  return '—';
}

export default function SalarySlipModal({ visible, onClose, salary }) {
  const printRef = useRef(null);

  if (!salary) return null;

  // 1. Employee Details (Strict Dynamic Mapping & Safe Muted Fallbacks)
  const empName = salary.employeeName || (salary.employee ? `${salary.employee.name || ''} ${salary.employee.surname || ''}`.trim() : '') || '—';
  const empCode = salary.employeeCode || salary.employee?.employeeId || '—';
  const dept = salary.department || salary.employee?.departmentName || '—';
  const desig = salary.designation || salary.employee?.designationName || '—';
  const location = salary.workLocationName || salary.workLocation || salary.employee?.workLocationName || salary.employee?.workLocation?.name || '—';
  const doj = formatDate(salary.joiningDate || salary.employee?.joiningDate);

  // 2. Attendance & Leave
  const workingDays = salary.workingDays !== undefined ? salary.workingDays : '—';
  const paidDays = salary.paidDays !== undefined ? salary.paidDays : (typeof workingDays === 'number' ? workingDays : '—');
  const leaveCount = salary.approvedLeaveDays ?? salary.leaveCount ?? salary.leaveDays ?? 0;
  const lopDays = salary.lopDays !== undefined ? salary.lopDays : 0;
  const leaveDetails = salary.leaveDetails || (lopDays > 0 && leaveCount > 0 ? `${leaveCount} Days Approved / ${lopDays} Days LOP` : (lopDays > 0 ? `${lopDays} Days LOP` : (leaveCount > 0 ? `${leaveCount} Days Approved` : 'NIL')));
  const leaveBalance = calculateLeaveBalanceTotal(salary.leaveBalanceSnapshot, salary.leaveBalance);

  // 3. Earnings
  const basic = salary.basic || salary.basicSalary || 0;
  const hra = salary.hra || 0;
  const specialAllowance = salary.specialAllowance !== undefined ? salary.specialAllowance : (salary.allowances || 0);
  const otherAllowances = salary.otherAllowances !== undefined ? salary.otherAllowances : ((salary.incentives || 0) + (salary.bonus || 0));
  const totalEarnings = salary.totalEarnings !== undefined ? salary.totalEarnings : (basic + hra + specialAllowance + otherAllowances);

  // 4. Deductions
  const pt = salary.professionalTax || 0;
  const pf = salary.deductions || salary.pf || 0;
  const tds = salary.tds || 0;
  const lopDed = salary.lopDeduction || 0;
  const otherDed = salary.otherDeductions || 0;
  const totalDeductions = salary.totalDeductions !== undefined ? salary.totalDeductions : (pt + pf + tds + lopDed + otherDed);

  // 5. Net Pay & Words
  const netSalary = salary.netSalary !== undefined ? salary.netSalary : (totalEarnings - totalDeductions);
  const rawWords = salary.netSalaryWords || 'Rupees In Words';
  const netWords = rawWords.replace(/^Rupees\s+/i, '').replace(/\s+Only$/i, '').trim();

  // 6. Meta
  const monthYearLabel = `[${salary.month} ${salary.year}]`;
  const slipNo = salary.slipNumber || `TM-SLIP-${salary.year}-${salary.month}`;
  const isPaid = String(salary.status || '').toLowerCase() === 'paid';
  const isPending = String(salary.status || '').toLowerCase() === 'pending';
  const status = salary.status || 'Draft';
  const statusColor = isPaid ? 'green' : (isPending ? 'orange' : 'default');
  let payDate = 'Pending Disbursement';
  if (salary.paymentDate) {
    payDate = dayjs(salary.paymentDate).format('DD MMMM YYYY');
  } else if (isPaid) {
    payDate = 'Disbursed';
  }
  const paymentMode = salary.paymentMode || 'Bank Transfer';
  const refNo = salary.transactionReference || (isPaid ? 'N/A' : 'Pending Disbursement');

  const handlePrint = () => {
    const printContent = document.getElementById('printable-salary-slip');
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <base href="${window.location.origin}/" />
          <meta charset="utf-8" />
          <title>Salary Slip - ${empName} - ${salary.month} ${salary.year}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              color: #0f172a;
              margin: 0;
              padding: 24px;
              font-size: 11.5px;
              line-height: 1.4;
              background: #ffffff;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            @page {
              size: A4 portrait;
              margin: 8mm 10mm;
            }
            .slip-container {
              max-width: 780px;
              margin: 0 auto;
            }
            .header-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 12px;
            }
            .brand-col {
              vertical-align: middle;
            }
            .company-logo {
              height: 44px;
              width: auto;
              vertical-align: middle;
            }
            .company-name {
              font-size: 24px;
              font-weight: 800;
              color: #1e293b;
              letter-spacing: -0.5px;
              line-height: 1.1;
              margin: 0;
            }
            .company-sub {
              font-size: 13px;
              font-weight: 600;
              color: #334155;
              line-height: 1.2;
              margin: 2px 0 0 0;
            }
            .title-col {
              text-align: right;
              vertical-align: middle;
            }
            .slip-subtitle {
              font-size: 11px;
              font-weight: 600;
              color: #64748b;
              letter-spacing: 2px;
              text-transform: uppercase;
              margin-bottom: 4px;
            }
            .slip-month {
              font-size: 24px;
              font-weight: 800;
              color: #006884;
              margin: 0;
              line-height: 1.1;
            }
            .address-banner {
              background: #006884 !important;
              padding: 8px 14px;
              border-radius: 2px;
              margin-bottom: 20px;
              color: #ffffff;
            }
            .address-table {
              width: 100%;
              border-collapse: collapse;
            }
            .address-text {
              color: #ffffff;
              font-size: 10px;
              font-weight: 500;
              line-height: 1.35;
              text-align: left;
              vertical-align: middle;
            }
            .cin-text {
              color: #ffffff;
              font-size: 10.5px;
              font-weight: 600;
              text-align: right;
              vertical-align: middle;
              white-space: nowrap;
              padding-left: 12px;
            }
            .columns-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            .section-header {
              color: #006884;
              font-size: 11.5px;
              font-weight: 700;
              letter-spacing: 0.8px;
              text-transform: uppercase;
              border-bottom: 1.5px solid #006884;
              padding-bottom: 6px;
              margin-bottom: 8px;
            }
            .info-table {
              width: 100%;
              border-collapse: collapse;
            }
            .info-table td {
              padding: 5px 2px;
              font-size: 11.5px;
              border-bottom: 1px solid #f1f5f9;
            }
            .info-label {
              color: #64748b;
              font-weight: 500;
              text-align: left;
              width: 48%;
            }
            .info-val {
              color: #0f172a;
              font-weight: 700;
              text-align: right;
              width: 52%;
            }
            .breakdown-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 16px;
            }
            .table-box {
              width: 100%;
              border-collapse: collapse;
              border: 1px solid #e2e8f0;
            }
            .th-teal {
              background: #006884 !important;
              color: #ffffff !important;
              font-size: 12.5px;
              font-weight: 700;
              padding: 8px 14px;
              text-align: left;
              letter-spacing: 0.3px;
            }
            .table-box td {
              padding: 7px 14px;
              font-size: 11.5px;
              border-bottom: 1px solid #f1f5f9;
            }
            .item-label {
              color: #334155;
              font-weight: 500;
              text-align: left;
            }
            .item-amount {
              color: #0f172a;
              font-weight: 600;
              text-align: right;
              white-space: nowrap;
            }
            .total-row td {
              background: #f1f5f9 !important;
              border-top: 1px solid #e2e8f0;
              border-bottom: none;
              padding: 9px 14px;
            }
            .total-label {
              color: #0f172a;
              font-weight: 700;
              font-size: 12px;
              text-align: left;
            }
            .total-amount {
              color: #0f172a;
              font-weight: 700;
              font-size: 12px;
              text-align: right;
              white-space: nowrap;
            }
            .net-box {
              background: #f0f4f8 !important;
              border-radius: 4px;
              padding: 16px 20px;
              margin-bottom: 16px;
            }
            .net-table {
              width: 100%;
              border-collapse: collapse;
            }
            .net-title {
              color: #475569;
              font-size: 12px;
              font-weight: 600;
            }
            .net-words {
              color: #64748b;
              font-size: 11.5px;
              font-weight: 500;
              margin-top: 4px;
            }
            .net-amount {
              color: #0f172a;
              font-size: 26px;
              font-weight: 800;
              text-align: right;
              letter-spacing: -0.5px;
              white-space: nowrap;
            }
            .payment-bar {
              background: #fafafa !important;
              border: 1px solid #e2e8f0;
              border-radius: 4px;
              padding: 7px 12px;
              margin-bottom: 12px;
              font-size: 10.5px;
              color: #475569;
            }
            .payment-bar table {
              width: 100%;
              border-collapse: collapse;
            }
            .note {
              text-align: center;
              font-size: 9.5px;
              color: #94a3b8;
              margin-top: 16px;
              padding-top: 6px;
            }
          </style>
        </head>
        <body>
          <div class="slip-container">
            ${printContent.innerHTML}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 350);
  };

  const handleDownloadPdf = async () => {
    try {
      message.loading({ content: 'Generating official corporate PDF salary slip...', key: 'slip-pdf' });
      window.open(`/api/salary/slip/pdf/${salary._id}`, '_blank');
      message.success({ content: 'Salary slip PDF opened successfully.', key: 'slip-pdf' });
    } catch (err) {
      message.error({ content: 'Failed to download salary slip PDF.', key: 'slip-pdf' });
    }
  };

  return (
    <Modal
      title={
        <Space align="center">
          <SafetyCertificateOutlined style={{ color: '#006884', fontSize: 18 }} />
          <span style={{ fontWeight: 700, color: '#006884' }}>
            Official Salary Slip — {salary.month} {salary.year}
          </span>
          <Tag color={statusColor} icon={isPaid ? <CheckCircleOutlined /> : undefined}>
            {status}
          </Tag>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={820}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Slip #: {slipNo}
          </Text>
          <Space>
            <Button icon={<PrinterOutlined />} onClick={handlePrint}>
              Print Slip
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleDownloadPdf}
              style={{ backgroundColor: '#006884', borderColor: '#006884' }}
            >
              Download PDF Slip
            </Button>
          </Space>
        </div>
      }
      destroyOnClose
    >
      <div
        id="printable-salary-slip"
        ref={printRef}
        style={{
          padding: '16px 20px',
          background: '#ffffff',
          color: '#0f172a',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          fontSize: '11.5px',
          lineHeight: 1.4,
        }}
      >
        {/* ================================================================= */}
        {/* HEADER: BRANDING (LEFT) & SALARY SLIP [MONTH YYYY] (RIGHT)         */}
        {/* ================================================================= */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px' }}>
          <tbody>
            <tr>
              <td style={{ verticalAlign: 'middle' }}>
                <table style={{ borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ verticalAlign: 'middle', paddingRight: '12px' }}>
                        <img
                          src={logoIcon}
                          alt="Tecmotiv"
                          style={{ height: '44px', width: 'auto', display: 'block' }}
                        />
                      </td>
                      <td style={{ verticalAlign: 'middle' }}>
                        <div style={{ fontSize: '24px', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.5px', lineHeight: 1.1 }}>
                          Tecmotiv
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', lineHeight: 1.2, marginTop: '2px' }}>
                          Solutions Pvt Ltd
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
              <td style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>
                  SALARY SLIP
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#006884', lineHeight: 1.1 }}>
                  {monthYearLabel}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ================================================================= */}
        {/* SOLID TEAL BANNER: OFFICE ADDRESS & CIN                           */}
        {/* ================================================================= */}
        <div
          style={{
            background: '#006884',
            padding: '8px 14px',
            borderRadius: '2px',
            marginBottom: '20px',
            color: '#ffffff',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ color: '#ffffff', fontSize: '10px', fontWeight: 500, lineHeight: 1.35, textAlign: 'left', verticalAlign: 'middle' }}>
                  <strong>Office Address:</strong> Level-5, Vatika Business Centre Block C, Tech Park One, Loop Rd, Shastrinagar, Yerawada, Pune 411 006, India
                </td>
                <td style={{ color: '#ffffff', fontSize: '10.5px', fontWeight: 600, textAlign: 'right', verticalAlign: 'middle', whiteSpace: 'nowrap', paddingLeft: '12px' }}>
                  CIN: U74909PN2023PTC222092
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ================================================================= */}
        {/* 2-COLUMN SECTION: EMPLOYEE DETAILS & ATTENDANCE / LEAVE            */}
        {/* ================================================================= */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
          <tbody>
            <tr>
              {/* Left Column: EMPLOYEE DETAILS */}
              <td style={{ width: '48%', verticalAlign: 'top', paddingRight: '12px' }}>
                <div
                  style={{
                    color: '#006884',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    letterSpacing: '0.8px',
                    textTransform: 'uppercase',
                    borderBottom: '1.5px solid #006884',
                    paddingBottom: '6px',
                    marginBottom: '8px',
                  }}
                >
                  EMPLOYEE DETAILS
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '5px 2px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#64748b', fontWeight: 500, width: '44%' }}>
                        Employee Name
                      </td>
                      <td style={{ padding: '5px 2px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#0f172a', fontWeight: 700, textAlign: 'right', width: '56%' }}>
                        {empName}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '5px 2px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#64748b', fontWeight: 500 }}>
                        Employee ID
                      </td>
                      <td style={{ padding: '5px 2px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#0f172a', fontWeight: 700, textAlign: 'right' }}>
                        {empCode}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '5px 2px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#64748b', fontWeight: 500 }}>
                        Department
                      </td>
                      <td style={{ padding: '5px 2px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#0f172a', fontWeight: 700, textAlign: 'right' }}>
                        {dept}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '5px 2px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#64748b', fontWeight: 500 }}>
                        Designation
                      </td>
                      <td style={{ padding: '5px 2px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#0f172a', fontWeight: 700, textAlign: 'right' }}>
                        {desig}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '5px 2px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#64748b', fontWeight: 500 }}>
                        Location
                      </td>
                      <td style={{ padding: '5px 2px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#0f172a', fontWeight: 700, textAlign: 'right' }}>
                        {location}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '5px 2px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#64748b', fontWeight: 500 }}>
                        Date of Joining
                      </td>
                      <td style={{ padding: '5px 2px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#0f172a', fontWeight: 700, textAlign: 'right' }}>
                        {doj}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>

              {/* Spacer Column */}
              <td style={{ width: '4%' }}>&nbsp;</td>

              {/* Right Column: ATTENDANCE & LEAVE */}
              <td style={{ width: '48%', verticalAlign: 'top', paddingLeft: '12px' }}>
                <div
                  style={{
                    color: '#006884',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    letterSpacing: '0.8px',
                    textTransform: 'uppercase',
                    borderBottom: '1.5px solid #006884',
                    paddingBottom: '6px',
                    marginBottom: '8px',
                  }}
                >
                  ATTENDANCE & LEAVE
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '5px 2px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#64748b', fontWeight: 500, width: '56%' }}>
                        Total Working Days
                      </td>
                      <td style={{ padding: '5px 2px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#0f172a', fontWeight: 700, textAlign: 'right', width: '44%' }}>
                        {typeof workingDays === 'number' ? String(workingDays).padStart(2, '0') : workingDays}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '5px 2px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#64748b', fontWeight: 500 }}>
                        Days Paid
                      </td>
                      <td style={{ padding: '5px 2px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#0f172a', fontWeight: 700, textAlign: 'right' }}>
                        {typeof paidDays === 'number' ? String(paidDays).padStart(2, '0') : paidDays}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '5px 2px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#64748b', fontWeight: 500 }}>
                        Number of Leaves
                      </td>
                      <td style={{ padding: '5px 2px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#0f172a', fontWeight: 700, textAlign: 'right' }}>
                        {typeof leaveCount === 'number' ? String(leaveCount).padStart(2, '0') : leaveCount}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '5px 2px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#64748b', fontWeight: 500 }}>
                        Leave Details (if any)
                      </td>
                      <td style={{ padding: '5px 2px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#0f172a', fontWeight: 700, textAlign: 'right' }}>
                        {leaveDetails}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '5px 2px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#64748b', fontWeight: 500 }}>
                        Loss of Pay Days
                      </td>
                      <td style={{ padding: '5px 2px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#0f172a', fontWeight: 700, textAlign: 'right' }}>
                        {typeof lopDays === 'number' ? String(lopDays).padStart(2, '0') : lopDays}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '5px 2px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#64748b', fontWeight: 500 }}>
                        Leave Balance
                      </td>
                      <td style={{ padding: '5px 2px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#0f172a', fontWeight: 700, textAlign: 'right' }}>
                        {typeof leaveBalance === 'number' ? String(leaveBalance).padStart(2, '0') : leaveBalance}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ================================================================= */}
        {/* SIDE-BY-SIDE TABLES: EARNINGS & DEDUCTIONS                        */}
        {/* ================================================================= */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
          <tbody>
            <tr>
              {/* Left Table: Earnings */}
              <td style={{ width: '48%', verticalAlign: 'top', paddingRight: '10px' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <thead>
                    <tr>
                      <th
                        colSpan={2}
                        style={{
                          background: '#006884',
                          color: '#ffffff',
                          fontSize: '12.5px',
                          fontWeight: 700,
                          padding: '8px 14px',
                          textAlign: 'left',
                          letterSpacing: '0.3px',
                        }}
                      >
                        Earnings
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '7px 14px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#334155', fontWeight: 500 }}>
                        Basic Salary
                      </td>
                      <td style={{ padding: '7px 14px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#0f172a', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {formatCurrency(basic)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '7px 14px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#334155', fontWeight: 500 }}>
                        House Rent Allowance
                      </td>
                      <td style={{ padding: '7px 14px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#0f172a', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {formatCurrency(hra)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '7px 14px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#334155', fontWeight: 500 }}>
                        Special Allowance
                      </td>
                      <td style={{ padding: '7px 14px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#0f172a', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {formatCurrency(specialAllowance)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '7px 14px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#334155', fontWeight: 500 }}>
                        Other Allowances
                      </td>
                      <td style={{ padding: '7px 14px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#0f172a', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {formatCurrency(otherAllowances)}
                      </td>
                    </tr>
                    <tr>
                      <td
                        style={{
                          background: '#f1f5f9',
                          borderTop: '1px solid #e2e8f0',
                          padding: '9px 14px',
                          color: '#0f172a',
                          fontWeight: 700,
                          fontSize: '12px',
                          textAlign: 'left',
                        }}
                      >
                        Total Earnings
                      </td>
                      <td
                        style={{
                          background: '#f1f5f9',
                          borderTop: '1px solid #e2e8f0',
                          padding: '9px 14px',
                          color: '#0f172a',
                          fontWeight: 700,
                          fontSize: '12px',
                          textAlign: 'right',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatCurrency(totalEarnings)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>

              {/* Spacer Column */}
              <td style={{ width: '4%' }}>&nbsp;</td>

              {/* Right Table: Deductions */}
              <td style={{ width: '48%', verticalAlign: 'top', paddingLeft: '10px' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <thead>
                    <tr>
                      <th
                        colSpan={2}
                        style={{
                          background: '#006884',
                          color: '#ffffff',
                          fontSize: '12.5px',
                          fontWeight: 700,
                          padding: '8px 14px',
                          textAlign: 'left',
                          letterSpacing: '0.3px',
                        }}
                      >
                        Deductions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '7px 14px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#334155', fontWeight: 500 }}>
                        Professional Tax
                      </td>
                      <td style={{ padding: '7px 14px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#0f172a', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {formatCurrency(pt)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '7px 14px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#334155', fontWeight: 500 }}>
                        Provident Fund
                      </td>
                      <td style={{ padding: '7px 14px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#0f172a', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {formatCurrency(pf)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '7px 14px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#334155', fontWeight: 500 }}>
                        Income Tax (TDS)
                      </td>
                      <td style={{ padding: '7px 14px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#0f172a', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {formatCurrency(tds)}
                      </td>
                    </tr>
                    {otherDed > 0 && lopDed > 0 ? (
                      <>
                        <tr>
                          <td style={{ padding: '7px 14px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#334155', fontWeight: 500 }}>
                            Leave Deduction (LOP)
                          </td>
                          <td style={{ padding: '7px 14px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#cf1322', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {formatCurrency(lopDed)}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ padding: '7px 14px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#334155', fontWeight: 500 }}>
                            Other Deductions
                          </td>
                          <td style={{ padding: '7px 14px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#cf1322', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {formatCurrency(otherDed)}
                          </td>
                        </tr>
                      </>
                    ) : (
                      <tr>
                        <td style={{ padding: '7px 14px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: '#334155', fontWeight: 500 }}>
                          {otherDed > 0 && lopDed === 0 ? 'Other Deductions' : 'Leave Deduction (LOP)'}
                        </td>
                        <td style={{ padding: '7px 14px', fontSize: '11.5px', borderBottom: '1px solid #f1f5f9', color: (lopDed > 0 || otherDed > 0) ? '#cf1322' : '#0f172a', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {formatCurrency(lopDed > 0 ? lopDed : otherDed)}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td
                        style={{
                          background: '#f1f5f9',
                          borderTop: '1px solid #e2e8f0',
                          padding: '9px 14px',
                          color: '#0f172a',
                          fontWeight: 700,
                          fontSize: '12px',
                          textAlign: 'left',
                        }}
                      >
                        Total Deductions
                      </td>
                      <td
                        style={{
                          background: '#f1f5f9',
                          borderTop: '1px solid #e2e8f0',
                          padding: '9px 14px',
                          color: '#0f172a',
                          fontWeight: 700,
                          fontSize: '12px',
                          textAlign: 'right',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatCurrency(totalDeductions)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ================================================================= */}
        {/* PROMINENT NET PAY CARD (SOFT ICE-BLUE BACKGROUND)                 */}
        {/* ================================================================= */}
        <div
          style={{
            background: '#f0f4f8',
            borderRadius: '4px',
            padding: '16px 20px',
            marginBottom: '16px',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ textAlign: 'left', verticalAlign: 'middle' }}>
                  <div style={{ color: '#475569', fontSize: '12px', fontWeight: 600 }}>
                    Net Pay (Earnings - Deductions)
                  </div>
                  <div style={{ color: '#64748b', fontSize: '11.5px', fontWeight: 500, marginTop: '4px' }}>
                    In words: {netWords} only
                  </div>
                </td>
                <td style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                  <div style={{ color: '#0f172a', fontSize: '26px', fontWeight: 800, letterSpacing: '-0.5px', whiteSpace: 'nowrap' }}>
                    {formatCurrency(netSalary)}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ================================================================= */}
        {/* PAYMENT & DISBURSEMENT VERIFICATION SUMMARY                       */}
        {/* ================================================================= */}
        <div
          style={{
            background: '#fafafa',
            border: '1px solid #e2e8f0',
            borderRadius: '4px',
            padding: '7px 12px',
            marginBottom: '12px',
            fontSize: '10.5px',
            color: '#475569',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td><strong>Payment Mode:</strong> {paymentMode}</td>
                <td><strong>Status:</strong> <span style={{ color: isPaid ? '#0d9488' : '#d97706', fontWeight: 700 }}>{status}</span></td>
                <td><strong>Disbursed On:</strong> {payDate}</td>
                <td><strong>UTR / Ref:</strong> {refNo}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ================================================================= */}
        {/* DIGITAL ACKNOWLEDGMENT & COMPUTERIZED NOTE                         */}
        {/* ================================================================= */}
        <div
          style={{
            textAlign: 'center',
            fontSize: '9.5px',
            color: '#94a3b8',
            marginTop: '16px',
            paddingTop: '6px',
          }}
        >
          This is a computer-generated salary slip from Tecmotiv ERP. No physical signature is required. For inquiries, please contact payroll@tecmotiv.com.
        </div>
      </div>
    </Modal>
  );
}
