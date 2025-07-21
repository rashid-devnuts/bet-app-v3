import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Timezone utility functions for consistent 12-hour format date/time handling
 * Ensures all times are displayed in the user's local timezone in 12-hour format
 * Handles SportsMonks API format: "YYYY-MM-DD HH:MM:SS" (UTC)
 */

/**
 * Parse SportsMonks API time format and convert to proper Date object
 * @param {string} dateTime - Time from SportsMonks API (e.g., "2022-08-01 14:35:00")
 * @returns {Date} Date object in UTC
 */
const parseSportsMonksTime = (dateTime) => {
  if (!dateTime) return null;
  
  // Handle different formats
  if (typeof dateTime === 'string') {
    // SportsMonks format: "2022-08-01 14:35:00" (UTC)
    if (dateTime.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
      // Convert to ISO format by adding 'T' and 'Z'
      const isoString = dateTime.replace(' ', 'T') + 'Z';
      return new Date(isoString);
    }
    // ISO format: "2022-08-01T14:35:00Z" or "2022-08-01T14:35:00.000Z"
    else if (dateTime.includes('T')) {
      return new Date(dateTime);
    }
  }
  
  // Fallback to regular Date constructor
  return new Date(dateTime);
};

/**
 * Format a date/time string to the user's local timezone in 12-hour format
 * @param {string|Date} dateTime - ISO string or Date object
 * @param {Object} options - Formatting options
 * @returns {string} Formatted date/time string
 */
export const formatToLocalTime = (dateTime, options = {}) => {
  if (!dateTime) return 'TBD';
  
  try {
    const date = parseSportsMonksTime(dateTime);
    
    // Check if date is valid
    if (!date || isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    const {
      showDate = true,
      showTime = true,
      showYear = false,
      showSeconds = false,
      format = 'default'
    } = options;

    // Handle different format types
    switch (format) {
      case 'timeOnly':
        return date.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true,
          ...(showSeconds && { second: '2-digit' })
        });
      
      case 'dateOnly':
        return date.toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'short',
          ...(showYear && { year: 'numeric' })
        });
      
      case 'short':
        return date.toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'short'
        });
      
      case 'full':
        return date.toLocaleDateString('en-US', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
      
      case 'relative':
        return getRelativeTime(date);
      
      default:
        // Default format: "Today 2:30 PM" or "Tomorrow 2:30 PM" or "15 Dec 2:30 PM"
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        const isTomorrow = date.toDateString() === new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString();
        
        let dateStr = '';
        let timeStr = '';
        
        if (showDate) {
          if (isToday) {
            dateStr = 'Today';
          } else if (isTomorrow) {
            dateStr = 'Tomorrow';
          } else {
            dateStr = date.toLocaleDateString('en-US', {
              day: 'numeric',
              month: 'short',
              ...(showYear && { year: 'numeric' })
            });
          }
        }
        
        if (showTime) {
          timeStr = date.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true,
            ...(showSeconds && { second: '2-digit' })
          });
        }
        
        return [dateStr, timeStr].filter(Boolean).join(' ');
    }
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
};

/**
 * Get relative time string (e.g., "in 2 hours", "2 hours ago")
 * @param {Date} date - Date to compare
 * @returns {string} Relative time string
 */
const getRelativeTime = (date) => {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (diffMs < 0) {
    // Past time
    if (Math.abs(diffHours) >= 1) {
      return `${Math.abs(diffHours)} hour${Math.abs(diffHours) !== 1 ? 's' : ''} ago`;
    } else {
      return `${Math.abs(diffMinutes)} minute${Math.abs(diffMinutes) !== 1 ? 's' : ''} ago`;
    }
  } else {
    // Future time
    if (diffHours >= 1) {
      return `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
    } else {
      return `in ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
    }
  }
};

/**
 * Format match time for display in match cards (12-hour format)
 * @param {string|Date} dateTime - Match start time
 * @returns {Object} Object with date and time strings
 */
export const formatMatchTime = (dateTime) => {
  if (!dateTime) return { date: 'TBD', time: '', isToday: false, isTomorrow: false };
  
  try {
    const date = parseSportsMonksTime(dateTime);
    if (!date || isNaN(date.getTime())) {
      return { date: 'Invalid Date', time: '', isToday: false, isTomorrow: false };
    }
    
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isTomorrow = date.toDateString() === new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString();
    
    let dateStr = '';
    if (isToday) {
      dateStr = 'Today';
    } else if (isTomorrow) {
      dateStr = 'Tomorrow';
    } else {
      dateStr = date.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short'
      });
    }
    
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    return {
      date: dateStr,
      time: timeStr,
      isToday,
      isTomorrow
    };
  } catch (error) {
    return { date: 'Invalid Date', time: '', isToday: false, isTomorrow: false };
  }
};

/**
 * Get time until match starts
 * @param {string|Date} dateTime - Match start time
 * @returns {Object} Object with hours, minutes, seconds until match
 */
export const getTimeUntilMatch = (dateTime) => {
  if (!dateTime) return { hours: 0, minutes: 0, seconds: 0 };
  
  try {
    const matchDate = parseSportsMonksTime(dateTime);
    if (!matchDate || isNaN(matchDate.getTime())) {
      return { hours: 0, minutes: 0, seconds: 0 };
    }
    
    const now = new Date();
    const diffMs = matchDate.getTime() - now.getTime();
    
    if (diffMs <= 0) {
      return { hours: 0, minutes: 0, seconds: 0 };
    }
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    return { hours, minutes, seconds };
  } catch (error) {
    return { hours: 0, minutes: 0, seconds: 0 };
  }
};

/**
 * Check if a match is happening today
 * @param {string|Date} dateTime - Match start time
 * @returns {boolean} True if match is today
 */
export const isMatchToday = (dateTime) => {
  if (!dateTime) return false;
  
  try {
    const matchDate = parseSportsMonksTime(dateTime);
    if (!matchDate || isNaN(matchDate.getTime())) {
      return false;
    }
    
    const today = new Date();
    return matchDate.toDateString() === today.toDateString();
  } catch (error) {
    return false;
  }
};

/**
 * Check if a match is happening tomorrow
 * @param {string|Date} dateTime - Match start time
 * @returns {boolean} True if match is tomorrow
 */
export const isMatchTomorrow = (dateTime) => {
  if (!dateTime) return false;
  
  try {
    const matchDate = parseSportsMonksTime(dateTime);
    if (!matchDate || isNaN(matchDate.getTime())) {
      return false;
    }
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return matchDate.toDateString() === tomorrow.toDateString();
  } catch (error) {
    return false;
  }
};

/**
 * Get user's timezone
 * @returns {string} User's timezone (e.g., "America/New_York")
 */
export const getUserTimezone = () => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

/**
 * Convert UTC time to user's local timezone
 * @param {string|Date} utcTime - UTC time string or Date
 * @returns {Date} Date in user's local timezone
 */
export const convertUTCToLocal = (utcTime) => {
  if (!utcTime) return null;
  
  try {
    const date = parseSportsMonksTime(utcTime);
    if (!date || isNaN(date.getTime())) {
      return null;
    }
    
    return date;
  } catch (error) {
    return null;
  }
};

/**
 * Debug utility to verify timezone conversion
 * @param {string|Date} dateTime - Date to debug
 * @returns {Object} Debug information
 */
export const debugTimezone = (dateTime) => {
  if (!dateTime) return { error: 'No date provided' };
  
  try {
    const parsedDate = parseSportsMonksTime(dateTime);
    if (!parsedDate || isNaN(parsedDate.getTime())) {
      return { error: 'Invalid date format' };
    }
    
    const now = new Date();
    
    return {
      original: dateTime,
      parsed: parsedDate.toISOString(),
      localTime: parsedDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true,
        timeZoneName: 'short'
      }),
      userTimezone: getUserTimezone(),
      isToday: parsedDate.toDateString() === now.toDateString(),
      isTomorrow: parsedDate.toDateString() === new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString(),
      formatted: formatToLocalTime(dateTime, { format: 'default' })
    };
  } catch (error) {
    return { error: error.message };
  }
};

/**
 * Get countdown to kickoff (hours, minutes, seconds) from a match object using starting_at
 * @param {Object} match - Match object with starting_at field
 * @returns {Object} { hours, minutes, seconds } until kickoff, or zeros if started or invalid
 */
export const getCountdownToKickoff = (match) => {
  if (!match || !match.starting_at) return { hours: 0, minutes: 0, seconds: 0 };
  let kickoff;
  if (match.starting_at.includes('T')) {
    kickoff = new Date(match.starting_at.endsWith('Z') ? match.starting_at : match.starting_at + 'Z');
  } else {
    kickoff = new Date(match.starting_at.replace(' ', 'T') + 'Z');
  }
  const now = new Date();
  let diff = Math.max(0, kickoff.getTime() - now.getTime());
  if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0 };
  const hours = Math.floor(diff / (1000 * 60 * 60));
  diff -= hours * 1000 * 60 * 60;
  const minutes = Math.floor(diff / (1000 * 60));
  diff -= minutes * 1000 * 60;
  const seconds = Math.floor(diff / 1000);
  return { hours, minutes, seconds };
};
