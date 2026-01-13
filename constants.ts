
import { RoomType, RoomStatus, Staff, Room } from './types';

export const STAFF_LIST: Staff[] = [
  { id: 's1', name: 'Bestey', pin: '8291' },
  { id: 's2', name: 'Faari', pin: '4712' },
  { id: 's3', name: 'Fazaal', pin: '9305' },
  { id: 's4', name: 'Sliver', pin: '2184' },
  { id: 's5', name: 'Aisha', pin: '6593' },
  { id: 's6', name: 'Fathu', pin: '1047' },
  { id: 's7', name: 'Bulky', pin: '3826' },
  { id: 's8', name: 'Zayan', pin: '7450' },
  { id: 's9', name: 'Mari', pin: '5918' },
  { id: 's10', name: 'Ibbe', pin: '0632' }
];

export const ROOMS: Room[] = [
  // Twin Rooms
  { id: 'r101', number: '101', type: RoomType.TWIN, status: RoomStatus.READY },
  { id: 'r102', number: '102', type: RoomType.TWIN, status: RoomStatus.READY },
  { id: 'r103', number: '103', type: RoomType.TWIN, status: RoomStatus.READY },
  { id: 'r202', number: '202', type: RoomType.TWIN, status: RoomStatus.READY },
  { id: 'r203', number: '203', type: RoomType.TWIN, status: RoomStatus.READY },
  { id: 'r204', number: '204', type: RoomType.TWIN, status: RoomStatus.READY },
  // Double Rooms
  { id: 'r104', number: '104', type: RoomType.DOUBLE, status: RoomStatus.READY },
  { id: 'r105', number: '105', type: RoomType.DOUBLE, status: RoomStatus.READY },
  { id: 'r106', number: '106', type: RoomType.DOUBLE, status: RoomStatus.READY },
  { id: 'r201', number: '201', type: RoomType.DOUBLE, status: RoomStatus.READY },
  { id: 'r205', number: '205', type: RoomType.DOUBLE, status: RoomStatus.READY },
  { id: 'r206', number: '206', type: RoomType.DOUBLE, status: RoomStatus.READY },
  { id: 'r301', number: '301', type: RoomType.DOUBLE, status: RoomStatus.READY }
];

export const YEARS = [2026, 2027, 2028];
export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const STATUS_COLORS = {
  [RoomStatus.READY]: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  [RoomStatus.CLEANING]: 'bg-amber-100 text-amber-800 border-amber-200',
  [RoomStatus.OCCUPIED]: 'bg-rose-100 text-rose-800 border-rose-200',
  [RoomStatus.OUT_OF_ORDER]: 'bg-slate-200 text-slate-800 border-slate-300'
};
