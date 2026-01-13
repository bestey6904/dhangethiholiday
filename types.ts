
export enum RoomType {
  TWIN = 'Twin Room',
  DOUBLE = 'Double Bed'
}

export enum RoomStatus {
  READY = 'Ready',
  CLEANING = 'Cleaning',
  OCCUPIED = 'Occupied',
  OUT_OF_ORDER = 'Out of Order'
}

export interface Staff {
  id: string;
  name: string;
  pin: string;
}

export interface Room {
  id: string;
  number: string;
  type: RoomType;
  status: RoomStatus;
  lastUpdated?: number;
}

export interface Booking {
  id: string;
  roomId: string;
  guestName: string;
  startDate: string; 
  endDate: string;   
  staffId: string;
  staffName: string;
  status: 'Booked' | 'CheckedIn' | 'Completed';
  notes?: string;
  updatedAt: number;
}

export interface CalendarDay {
  date: Date;
  isToday: boolean;
  isWeekend: boolean;
  dayLabel: string;
  dayNumber: number;
}

export interface Activity {
  id: string;
  message: string;
  timestamp: number;
  staffName: string;
  type: 'booking' | 'status' | 'system';
}

export interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning';
}

export type SyncMessage = 
  | { type: 'SYNC_BOOKINGS'; data: Booking[]; staffName: string }
  | { type: 'SYNC_ROOMS'; data: Room[]; staffName: string };
