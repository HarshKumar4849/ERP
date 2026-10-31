import React, { useMemo } from 'react';
import { Tooltip } from 'antd';
import dayjs from 'dayjs';

/**
 * Palette matching TecMotiv design system & Ant Design 5 standards
 */
const STATUS_CONFIG = {
  present: {
    color: '#52c41a', // Green
    border: '#389e0d',
    shadow: '0 0 0 1.5px rgba(82, 196, 26, 0.2)',
    defaultLabel: 'Present',
  },
  on_leave: {
    color: '#ff4d4f', // Red
    border: '#cf1322',
    shadow: '0 0 0 1.5px rgba(255, 77, 79, 0.2)',
    defaultLabel: 'On Leave',
  },
  partial_day: {
    color: '#faad14', // Amber
    border: '#d48806',
    shadow: '0 0 0 1.5px rgba(250, 173, 20, 0.2)',
    defaultLabel: 'Half Day',
  },
  weekend: {
    color: '#bfbfbf', // Grey
    border: '#8c8c8c',
    shadow: '0 0 0 1.5px rgba(191, 191, 191, 0.2)',
    defaultLabel: 'Weekend',
  },
  holiday: {
    color: '#bfbfbf', // Grey
    border: '#8c8c8c',
    shadow: '0 0 0 1.5px rgba(191, 191, 191, 0.2)',
    defaultLabel: 'Company Holiday',
  },
  not_checked_in: {
    color: '#bfbfbf', // Grey
    border: '#8c8c8c',
    shadow: '0 0 0 1.5px rgba(191, 191, 191, 0.2)',
    defaultLabel: 'Not Checked In',
  },
  unknown: {
    color: '#bfbfbf', // Grey
    border: '#8c8c8c',
    shadow: '0 0 0 1.5px rgba(191, 191, 191, 0.2)',
    defaultLabel: 'Status Unknown',
  },
};

export default function AvailabilityBadge({
  availability,
  size = 8,
  showLabel = false,
  style = {},
}) {
  const statusKey = availability?.status || 'not_checked_in';
  const cfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.not_checked_in;

  const color =
    availability?.dotColor === 'green'
      ? '#52c41a'
      : availability?.dotColor === 'red'
      ? '#ff4d4f'
      : availability?.dotColor === 'amber'
      ? '#faad14'
      : cfg.color;

  const label = availability?.label || cfg.defaultLabel;

  // Build descriptive, accessible tooltip content
  const tooltipText = useMemo(() => {
    let text = label;
    if (availability?.conflict) {
      text = `${label} (Notice: Employee has an approved leave application today but clocked in)`;
    } else if (availability?.loginTime && availability?.status === 'present') {
      const timeStr = dayjs(availability.loginTime).format('hh:mm A');
      const modeStr = availability.workMode ? ` (${availability.workMode})` : '';
      text = `Present • Clocked in at ${timeStr}${modeStr}`;
      if (availability?.logoutTime) {
        const outStr = dayjs(availability.logoutTime).format('hh:mm A');
        text = `Checked Out • In: ${timeStr} | Out: ${outStr}${modeStr}`;
      }
    } else if (availability?.loginTime && availability?.status === 'partial_day') {
      const timeStr = dayjs(availability.loginTime).format('hh:mm A');
      text = `${label} • Clocked in at ${timeStr}`;
    }
    return text;
  }, [availability, label]);

  return (
    <Tooltip title={tooltipText} placement="top" mouseEnterDelay={0.15}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          verticalAlign: 'middle',
          lineHeight: 1,
          ...style,
        }}
        role="status"
        aria-label={`Availability: ${tooltipText}`}
      >
        <span
          style={{
            width: size,
            height: size,
            minWidth: size,
            minHeight: size,
            borderRadius: '50%',
            backgroundColor: color,
            border: `1px solid ${cfg.border}`,
            boxShadow: cfg.shadow,
            display: 'inline-block',
            transition: 'background-color 0.25s ease, border-color 0.25s ease',
          }}
        />
        {showLabel && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: '#595959',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </span>
        )}
      </span>
    </Tooltip>
  );
}

