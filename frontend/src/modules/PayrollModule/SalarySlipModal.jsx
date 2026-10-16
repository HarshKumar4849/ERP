import React, { useRef } from 'react';
import {
  Modal,
  Button,
  Space,
  Tag,
  Divider,
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
import { request } from '@/request';

const { Title, Text } = Typography;

function formatCurrency(amount) {
  const val = Number(amount || 0);
  return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SalarySlipModal({ visible, onClose, salary }) {
  const printRef = useRef(null);

  if (!salary) return null;

  const empName = salary.employeeName || (salary.employee ? `${salary.employee.name} ${salary.employee.surname || ''}`.trim() : 'Employee');
  const empCode = salary.employeeCode || salary.employee?.employeeId || 'TM-EMP-001';
  const dept = salary.department || salary.employee?.departmentName || 'Engineering';
  const desig = salary.designation || salary.employee?.designationName || 'Specialist';
  const doj = salary.joiningDate ? dayjs(salary.joiningDate).format('DD MMM YYYY') : '15 Jan 2024';
  const pan = salary.panNumber || 'ABCDE1234F';
  const uan = salary.uanNumber || '101234567890';
  const bankName = salary.bankDetails?.bankName || 'HDFC Bank Ltd.';
  const accNo = salary.bankDetails?.accountNumber || '50100234567890';
  const ifsc = salary.bankDetails?.ifscCode || 'HDFC0001234';

  const payDate = salary.paymentDate ? dayjs(salary.paymentDate).format('DD MMMM YYYY') : dayjs().format('DD MMMM YYYY');
  const slipNo = salary.slipNumber || `TM-SLIP-${salary.year}-${salary.month}`;
  const netWords = salary.netSalaryWords || 'Rupees In Words';

  const handlePrint = () => {
    const printContent = document.getElementById('printable-salary-slip');
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Payslip - ${empName} - ${salary.month} ${salary.year}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #262626; margin: 0; padding: 24px; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; }
            .header-bar { border-bottom: 2px solid #002244; padding-bottom: 12px; margin-bottom: 16px; }
            .company-title { font-size: 20px; font-weight: 800; color: #002244; margin: 0; text-transform: uppercase; }
            .company-sub { font-size: 11px; color: #595959; margin: 4px 0 0 0; }
            .badge-title { background: #002244; color: #ffffff; padding: 6px; text-align: center; font-weight: 700; margin-bottom: 16px; font-size: 12px; }
            .info-table td { padding: 5px 8px; vertical-align: top; width: 25%; }
            .info-label { font-size: 10px; color: #8c8c8c; text-transform: uppercase; }
            .info-val { font-weight: 600; font-size: 12px; color: #000; }
            .breakdown-table th { background: #f0f5fa; padding: 8px; text-align: left; border-top: 1px solid #d9d9d9; border-bottom: 1px solid #d9d9d9; font-size: 11px; }
            .breakdown-table td { padding: 6px 8px; border-bottom: 1px solid #f0f0f0; }
            .text-right { text-align: right; }
            .total-row td { font-weight: 700; background: #fafafa; border-top: 1.5px solid #002244; border-bottom: 1.5px solid #002244; color: #002244; }
            .net-box { border: 2px solid #002244; background: #f8fbff; padding: 12px 16px; margin: 16px 0; }
            .net-amount { font-size: 18px; font-weight: 800; color: #002244; }
            .payment-bar { background: #fafafa; border: 1px solid #e8e8e8; padding: 8px 12px; margin-bottom: 24px; font-size: 11px; }
            .signatures { margin-top: 40px; }
            .sig-col { text-align: center; width: 50%; }
            .sig-line { border-top: 1px dashed #8c8c8c; padding-top: 6px; font-size: 11px; color: #595959; margin: 0 20px; }
            .note { text-align: center; font-size: 10px; color: #8c8c8c; margin-top: 24px; border-top: 1px solid #f0f0f0; padding-top: 8px; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  };

  const handleDownloadPdf = async () => {
    try {
      message.loading({ content: 'Generating official PDF salary slip...', key: 'slip-pdf' });
      // Call backend PDF download endpoint directly
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
          <SafetyCertificateOutlined style={{ color: '#002244', fontSize: 18 }} />
          <span style={{ fontWeight: 700, color: '#002244' }}>
            Official Salary Slip — {salary.month} {salary.year}
          </span>
          <Tag color="green" icon={<CheckCircleOutlined />}>
            {salary.status || 'Paid'}
          </Tag>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={780}
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
              style={{ backgroundColor: '#002244', borderColor: '#002244' }}
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
          padding: '16px',
          background: '#ffffff',
          color: '#262626',
          fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif',
        }}
      >
        {/* Header with Exact Requested Branding */}
        <div
          className="header-bar"
          style={{
            borderBottom: '2.5px solid #002244',
            paddingBottom: '12px',
            marginBottom: '16px',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td>
                  <h1
                    className="company-title"
                    style={{
                      margin: 0,
                      fontSize: '20px',
                      fontWeight: 800,
                      color: '#002244',
                      letterSpacing: '0.5px',
                    }}
                  >
                    TECMOTIV SOLUTIONS PVT. LTD.
                  </h1>
                  <p
                    className="company-sub"
                    style={{
                      margin: '4px 0 0 0',
                      fontSize: '11px',
                      color: '#595959',
                      lineHeight: 1.4,
                    }}
                  >
                    CIN: U72900KA2024PTC123456 • Silicon Tech Park, Outer Ring Road, Bangalore - 560100<br />
                    Payroll Desk: payroll@tecmotiv.com • Web: www.tecmotiv.com
                  </p>
                </td>
                <td style={{ textAlign: 'right', verticalAlign: 'top' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#002244' }}>
                    {slipNo}
                  </div>
                  <div style={{ fontSize: '11px', color: '#8c8c8c' }}>Disbursement Date: {payDate}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Payslip Month Banner */}
        <div
          className="badge-title"
          style={{
            background: '#002244',
            color: '#ffffff',
            padding: '6px 12px',
            fontWeight: 700,
            fontSize: '12px',
            textAlign: 'center',
            letterSpacing: '1px',
            marginBottom: '16px',
            borderRadius: '4px',
          }}
        >
          PAYSLIP FOR THE MONTH OF {String(salary.month).toUpperCase()} {salary.year}
        </div>

        {/* Employee Details Grid */}
        <table
          className="info-table"
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginBottom: '16px',
            background: '#fafafa',
            border: '1px solid #f0f0f0',
            borderRadius: '6px',
          }}
        >
          <tbody>
            <tr>
              <td style={{ padding: '6px 10px', width: '25%' }}>
                <div style={{ fontSize: '10px', color: '#8c8c8c', textTransform: 'uppercase' }}>Employee Code</div>
                <div style={{ fontWeight: 600, fontSize: '12px', color: '#000' }}>{empCode}</div>
              </td>
              <td style={{ padding: '6px 10px', width: '25%' }}>
                <div style={{ fontSize: '10px', color: '#8c8c8c', textTransform: 'uppercase' }}>Employee Name</div>
                <div style={{ fontWeight: 600, fontSize: '12px', color: '#000' }}>{empName}</div>
              </td>
              <td style={{ padding: '6px 10px', width: '25%' }}>
                <div style={{ fontSize: '10px', color: '#8c8c8c', textTransform: 'uppercase' }}>Designation</div>
                <div style={{ fontWeight: 600, fontSize: '12px', color: '#000' }}>{desig}</div>
              </td>
              <td style={{ padding: '6px 10px', width: '25%' }}>
                <div style={{ fontSize: '10px', color: '#8c8c8c', textTransform: 'uppercase' }}>Department</div>
                <div style={{ fontWeight: 600, fontSize: '12px', color: '#000' }}>{dept}</div>
              </td>
            </tr>
            <tr>
              <td style={{ padding: '6px 10px' }}>
                <div style={{ fontSize: '10px', color: '#8c8c8c', textTransform: 'uppercase' }}>Date of Joining</div>
                <div style={{ fontWeight: 600, fontSize: '12px', color: '#000' }}>{doj}</div>
              </td>
              <td style={{ padding: '6px 10px' }}>
                <div style={{ fontSize: '10px', color: '#8c8c8c', textTransform: 'uppercase' }}>PAN Number</div>
                <div style={{ fontWeight: 600, fontSize: '12px', color: '#000' }}>{pan}</div>
              </td>
              <td style={{ padding: '6px 10px' }}>
                <div style={{ fontSize: '10px', color: '#8c8c8c', textTransform: 'uppercase' }}>UAN Number</div>
                <div style={{ fontWeight: 600, fontSize: '12px', color: '#000' }}>{uan}</div>
              </td>
              <td style={{ padding: '6px 10px' }}>
                <div style={{ fontSize: '10px', color: '#8c8c8c', textTransform: 'uppercase' }}>Bank Name</div>
                <div style={{ fontWeight: 600, fontSize: '12px', color: '#000' }}>{bankName}</div>
              </td>
            </tr>
            <tr>
              <td style={{ padding: '6px 10px' }}>
                <div style={{ fontSize: '10px', color: '#8c8c8c', textTransform: 'uppercase' }}>Bank A/C No.</div>
                <div style={{ fontWeight: 600, fontSize: '12px', color: '#000' }}>{accNo}</div>
              </td>
              <td style={{ padding: '6px 10px' }}>
                <div style={{ fontSize: '10px', color: '#8c8c8c', textTransform: 'uppercase' }}>IFSC Code</div>
                <div style={{ fontWeight: 600, fontSize: '12px', color: '#000' }}>{ifsc}</div>
              </td>
              <td style={{ padding: '6px 10px' }}>
                <div style={{ fontSize: '10px', color: '#8c8c8c', textTransform: 'uppercase' }}>Working Days</div>
                <div style={{ fontWeight: 600, fontSize: '12px', color: '#000' }}>{salary.workingDays || 30} Days</div>
              </td>
              <td style={{ padding: '6px 10px' }}>
                <div style={{ fontSize: '10px', color: '#8c8c8c', textTransform: 'uppercase' }}>Paid / LOP Days</div>
                <div style={{ fontWeight: 600, fontSize: '12px', color: '#000' }}>
                  {salary.paidDays || 30} / {salary.lopDays || 0} Days
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Dual-Column Earnings and Deductions Table */}
        <table
          className="breakdown-table"
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginBottom: '16px',
            border: '1px solid #d9d9d9',
          }}
        >
          <thead>
            <tr style={{ background: '#f0f5fa' }}>
              <th style={{ padding: '8px 10px', width: '32%', color: '#002244', fontWeight: 700, borderBottom: '1px solid #d9d9d9' }}>
                EARNINGS
              </th>
              <th style={{ padding: '8px 10px', width: '18%', textAlign: 'right', color: '#002244', fontWeight: 700, borderBottom: '1px solid #d9d9d9' }}>
                AMOUNT (₹)
              </th>
              <th style={{ padding: '8px 10px', width: '32%', color: '#002244', fontWeight: 700, borderBottom: '1px solid #d9d9d9' }}>
                DEDUCTIONS
              </th>
              <th style={{ padding: '8px 10px', width: '18%', textAlign: 'right', color: '#002244', fontWeight: 700, borderBottom: '1px solid #d9d9d9' }}>
                AMOUNT (₹)
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '6px 10px', borderBottom: '1px solid #f0f0f0' }}>Basic Salary</td>
              <td style={{ padding: '6px 10px', textAlign: 'right', borderBottom: '1px solid #f0f0f0', fontWeight: 500 }}>
                {formatCurrency(salary.basic || salary.basicSalary)}
              </td>
              <td style={{ padding: '6px 10px', borderBottom: '1px solid #f0f0f0' }}>Professional Tax (PT)</td>
              <td style={{ padding: '6px 10px', textAlign: 'right', borderBottom: '1px solid #f0f0f0', fontWeight: 500 }}>
                {formatCurrency(salary.professionalTax)}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '6px 10px', borderBottom: '1px solid #f0f0f0' }}>House Rent Allowance (HRA)</td>
              <td style={{ padding: '6px 10px', textAlign: 'right', borderBottom: '1px solid #f0f0f0', fontWeight: 500 }}>
                {formatCurrency(salary.hra)}
              </td>
              <td style={{ padding: '6px 10px', borderBottom: '1px solid #f0f0f0' }}>TDS / Income Tax</td>
              <td style={{ padding: '6px 10px', textAlign: 'right', borderBottom: '1px solid #f0f0f0', fontWeight: 500 }}>
                {formatCurrency(salary.tds)}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '6px 10px', borderBottom: '1px solid #f0f0f0' }}>Special & Other Allowances</td>
              <td style={{ padding: '6px 10px', textAlign: 'right', borderBottom: '1px solid #f0f0f0', fontWeight: 500 }}>
                {formatCurrency(salary.allowances)}
              </td>
              <td style={{ padding: '6px 10px', borderBottom: '1px solid #f0f0f0' }}>Standard Deductions / PF</td>
              <td style={{ padding: '6px 10px', textAlign: 'right', borderBottom: '1px solid #f0f0f0', fontWeight: 500 }}>
                {formatCurrency(salary.deductions)}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '6px 10px', borderBottom: '1px solid #f0f0f0' }}>Performance Incentives</td>
              <td style={{ padding: '6px 10px', textAlign: 'right', borderBottom: '1px solid #f0f0f0', fontWeight: 500 }}>
                {formatCurrency(salary.incentives)}
              </td>
              <td style={{ padding: '6px 10px', borderBottom: '1px solid #f0f0f0' }}>Other Deductions / LOP</td>
              <td style={{ padding: '6px 10px', textAlign: 'right', borderBottom: '1px solid #f0f0f0', fontWeight: 500 }}>
                {formatCurrency(salary.otherDeductions)}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '6px 10px', borderBottom: '1px solid #f0f0f0' }}>Bonus & Ex-Gratia</td>
              <td style={{ padding: '6px 10px', textAlign: 'right', borderBottom: '1px solid #f0f0f0', fontWeight: 500 }}>
                {formatCurrency(salary.bonus)}
              </td>
              <td style={{ padding: '6px 10px', borderBottom: '1px solid #f0f0f0' }}>-</td>
              <td style={{ padding: '6px 10px', textAlign: 'right', borderBottom: '1px solid #f0f0f0', fontWeight: 500 }}>
                ₹0.00
              </td>
            </tr>
            <tr style={{ background: '#fafafa', borderTop: '2px solid #002244', borderBottom: '2px solid #002244' }}>
              <td style={{ padding: '8px 10px', fontWeight: 700, color: '#002244' }}>GROSS EARNINGS</td>
              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#002244' }}>
                {formatCurrency(salary.totalEarnings)}
              </td>
              <td style={{ padding: '8px 10px', fontWeight: 700, color: '#002244' }}>TOTAL DEDUCTIONS</td>
              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#002244' }}>
                {formatCurrency(salary.totalDeductions)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Net Salary Highlight Box */}
        <div
          className="net-box"
          style={{
            border: '2px solid #002244',
            background: '#f8fbff',
            padding: '12px 16px',
            marginBottom: '16px',
            borderRadius: '6px',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#595959', textTransform: 'uppercase' }}>
                    NET SALARY PAYABLE
                  </span>
                  <div style={{ fontSize: '11px', color: '#595959', fontStyle: 'italic', marginTop: '2px' }}>
                    {netWords}
                  </div>
                </td>
                <td style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                  <span style={{ fontSize: '20px', fontWeight: 800, color: '#002244' }}>
                    {formatCurrency(salary.netSalary)}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Payment Information */}
        <div
          className="payment-bar"
          style={{
            background: '#fafafa',
            border: '1px solid #e8e8e8',
            padding: '8px 12px',
            marginBottom: '24px',
            borderRadius: '6px',
            fontSize: '11px',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td><strong>Payment Mode:</strong> {salary.paymentMode || 'Bank Transfer'}</td>
                <td>
                  <strong>Status:</strong>{' '}
                  <span style={{ color: '#237804', fontWeight: 700 }}>{salary.status || 'PAID'}</span>
                </td>
                <td><strong>Disbursed On:</strong> {payDate}</td>
                <td><strong>UTR / Ref:</strong> {salary.transactionReference || 'UTR-TM-202610-0981'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Dual Signatures */}
        <table className="signatures" style={{ width: '100%', marginTop: '36px', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td className="sig-col" style={{ width: '50%', textAlign: 'center', padding: '0 20px' }}>
                <div style={{ height: '32px' }}></div>
                <div
                  className="sig-line"
                  style={{
                    borderTop: '1px dashed #8c8c8c',
                    paddingTop: '6px',
                    fontSize: '11px',
                    color: '#595959',
                  }}
                >
                  Authorized Signatory / Finance Department
                </div>
              </td>
              <td className="sig-col" style={{ width: '50%', textAlign: 'center', padding: '0 20px' }}>
                <div style={{ height: '32px' }}></div>
                <div
                  className="sig-line"
                  style={{
                    borderTop: '1px dashed #8c8c8c',
                    paddingTop: '6px',
                    fontSize: '11px',
                    color: '#595959',
                  }}
                >
                  Employee Digital Sign-off & Acknowledgment
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Computerized Note */}
        <div
          className="note"
          style={{
            textAlign: 'center',
            fontSize: '10px',
            color: '#8c8c8c',
            marginTop: '24px',
            borderTop: '1px solid #f0f0f0',
            paddingTop: '8px',
          }}
        >
          This is a computer-generated salary slip from TecMotiv ERP. No physical signature is required. For inquiries, please contact payroll@tecmotiv.com.
        </div>
      </div>
    </Modal>
  );
}
