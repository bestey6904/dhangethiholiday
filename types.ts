
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
}

export interface Booking {
  id: string;
  roomId: string;
  guestName: string;
  startDate: string; // ISO format
  endDate: string;   // ISO format
  staffId: string;
  status: 'Booked' | 'CheckedIn' | 'Completed';
  notes?: string;
}

export interface CalendarDay {
  date: Date;
  isToday: boolean;
  isWeekend: boolean;
  dayLabel: string;
  dayNumber: number;
}

export interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning';
  staffName?: string;
}

export type SyncMessage = 
  | { type: 'BOOKING_UPDATE'; bookings: Booking[]; staffName: string }
  | { type: 'ROOM_UPDATE'; rooms: Room[]; staffName: string };
