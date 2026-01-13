
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  User, 
  LogOut, 
  Plus, 
  Search, 
  Settings, 
  Info,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  Loader2,
  Database,
  Trash2,
  Bell,
  Wifi,
  WifiOff
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { Room, Staff, Booking, RoomStatus, RoomType, Toast, SyncMessage } from './types';
import { STAFF_LIST, ROOMS, YEARS, MONTHS, STATUS_COLORS } from './constants';

const STORAGE_KEYS = {
  BOOKINGS: 'luxeroom_bookings_v1',
  ROOMS: 'luxeroom_rooms_v1',
  STAFF: 'luxeroom_logged_in_staff_v1'
};

const App: React.FC = () => {
  // Persistence Initialization
  const initialBookings = () => {
    const saved = localStorage.getItem(STORAGE_KEYS.BOOKINGS);
    return saved ? JSON.parse(saved) : [];
  };

  const initialRooms = () => {
    const saved = localStorage.getItem(STORAGE_KEYS.ROOMS);
    return saved ? JSON.parse(saved) : ROOMS;
  };

  const initialStaff = () => {
    const saved = localStorage.getItem(STORAGE_KEYS.STAFF);
    if (saved) {
      const staffData = JSON.parse(saved);
      return STAFF_LIST.find(s => s.id === staffData.id) || null;
    }
    return null;
  };

  // State
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [loggedInStaff, setLoggedInStaff] = useState<Staff | null>(initialStaff);
  const [rooms, setRooms] = useState<Room[]>(initialRooms);
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ roomId: string, date: Date } | null>(null);
  const [bookingFormData, setBookingFormData] = useState({ guestName: '', days: 1, notes: '' });
  const [pin, setPin] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(true);

  // Sync Channel Reference
  const syncChannel = useRef<BroadcastChannel | null>(null);

  // Persistence and Sync Effects
  useEffect(() => {
    // Initialize BroadcastChannel
    syncChannel.current = new BroadcastChannel('luxeroom_sync');
    
    syncChannel.current.onmessage = (event: MessageEvent<SyncMessage>) => {
      const { type, staffName } = event.data;
      if (type === 'BOOKING_UPDATE') {
        setBookings(event.data.bookings);
        addToast(`New booking activity by ${staffName}`, 'info');
      } else if (type === 'ROOM_UPDATE') {
        setRooms(event.data.rooms);
        addToast(`Room status updated by ${staffName}`, 'info');
      }
    };

    // Listen for storage changes from other tabs as backup
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.BOOKINGS && e.newValue) setBookings(JSON.parse(e.newValue));
      if (e.key === STORAGE_KEYS.ROOMS && e.newValue) setRooms(JSON.parse(e.newValue));
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      syncChannel.current?.close();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
  }, [bookings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ROOMS, JSON.stringify(rooms));
  }, [rooms]);

  useEffect(() => {
    if (loggedInStaff) {
      localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(loggedInStaff));
    } else {
      localStorage.removeItem(STORAGE_KEYS.STAFF);
    }
  }, [loggedInStaff]);

  // Derived Calendar Days
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(currentYear, currentMonth, i);
      days.push({
        date,
        isToday: date.getTime() === today.getTime(),
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        dayLabel: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: i
      });
    }
    return days;
  }, [currentYear, currentMonth]);

  // Toast Helper
  const addToast = (message: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [{ id, message, type }, ...prev].slice(0, 5));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  // AI Generator
  const generateSmartNote = async () => {
    if (!bookingFormData.guestName) {
      alert("Please enter a guest name first.");
      return;
    }

    setIsAiGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const room = rooms.find(r => r.id === selectedCell?.roomId);
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Create a short, professional welcome note for a guest named ${bookingFormData.guestName} staying for ${bookingFormData.days} night(s) in Room ${room?.number} (${room?.type}). Keep it under 40 words.`,
      });

      const text = response.text;
      if (text) {
        setBookingFormData(prev => ({ ...prev, notes: text.trim() }));
      }
    } catch (error) {
      console.error("AI Generation Error:", error);
      addToast("AI service temporarily unavailable.", "warning");
    } finally {
      setIsAiGenerating(false);
    }
  };

  // Auth Handlers
  const handleLogin = () => {
    const staff = STAFF_LIST.find(s => s.pin === pin);
    if (staff) {
      setLoggedInStaff(staff);
      setIsAuthModalOpen(false);
      setPin('');
      addToast(`Welcome back, ${staff.name}!`, 'success');
    } else {
      alert('Invalid PIN');
      setPin('');
    }
  };

  const handleLogout = () => {
    setLoggedInStaff(null);
    addToast("Logged out successfully", "info");
  };

  // Booking Handlers
  const openBookingModal = (roomId: string, date: Date) => {
    if (!loggedInStaff) {
      setIsAuthModalOpen(true);
      return;
    }
    setSelectedCell({ roomId, date });
    setIsBookingModalOpen(true);
  };

  const handleAddBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCell || !loggedInStaff) return;

    const endDate = new Date(selectedCell.date);
    endDate.setDate(endDate.getDate() + bookingFormData.days);

    const newBooking: Booking = {
      id: Math.random().toString(36).substr(2, 9),
      roomId: selectedCell.roomId,
      guestName: bookingFormData.guestName,
      startDate: selectedCell.date.toISOString(),
      endDate: endDate.toISOString(),
      staffId: loggedInStaff.id,
      status: 'Booked',
      notes: bookingFormData.notes
    };

    const updatedBookings = [...bookings, newBooking];
    setBookings(updatedBookings);
    
    // Broadcast change
    syncChannel.current?.postMessage({
      type: 'BOOKING_UPDATE',
      bookings: updatedBookings,
      staffName: loggedInStaff.name
    });

    setIsBookingModalOpen(false);
    setBookingFormData({ guestName: '', days: 1, notes: '' });
    setSelectedCell(null);
    addToast(`Booking added for ${newBooking.guestName}`, 'success');
  };

  const updateRoomStatus = (roomId: string, status: RoomStatus) => {
    if (!loggedInStaff) {
      setIsAuthModalOpen(true);
      return;
    }
    const updatedRooms = rooms.map(r => r.id === roomId ? { ...r, status } : r);
    setRooms(updatedRooms);

    // Broadcast change
    syncChannel.current?.postMessage({
      type: 'ROOM_UPDATE',
      rooms: updatedRooms,
      staffName: loggedInStaff.name
    });

    addToast(`Room ${rooms.find(r => r.id === roomId)?.number} is now ${status}`, 'info');
  };

  const clearAllData = () => {
    if (confirm("Reset ALL data?")) {
      setBookings([]);
      setRooms(ROOMS);
      syncChannel.current?.postMessage({ type: 'BOOKING_UPDATE', bookings: [], staffName: loggedInStaff?.name || 'System' });
      syncChannel.current?.postMessage({ type: 'ROOM_UPDATE', rooms: ROOMS, staffName: loggedInStaff?.name || 'System' });
      setIsSettingsOpen(false);
      addToast("All data has been reset", "warning");
    }
  };

  // Navigation
  const prevMonth = () => {
    if (currentMonth === 0) {
      if (currentYear > 2026) {
        setCurrentYear(currentYear - 1);
        setCurrentMonth(11);
      }
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      if (currentYear < 2028) {
        setCurrentYear(currentYear + 1);
        setCurrentMonth(0);
      }
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Toast Notifications */}
      <div className="fixed top-24 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        {toasts.map(toast => (
          <div 
            key={toast.id} 
            className={`pointer-events-auto min-w-[280px] p-4 rounded-xl shadow-2xl border-l-4 flex items-start gap-3 animate-in slide-in-from-right duration-300 ${
              toast.type === 'success' ? 'bg-emerald-50 border-emerald-500 text-emerald-800' :
              toast.type === 'warning' ? 'bg-amber-50 border-amber-500 text-amber-800' :
              'bg-white border-indigo-500 text-slate-800'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-500 mt-0.5" /> :
             toast.type === 'warning' ? <AlertTriangle size={18} className="text-amber-500 mt-0.5" /> :
             <Bell size={18} className="text-indigo-500 mt-0.5" />}
            <div>
              <p className="text-sm font-bold leading-tight">{toast.message}</p>
              <p className="text-[10px] mt-1 opacity-60">Just now</p>
            </div>
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-2 rounded-lg text-white">
            <CalendarIcon size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">LuxeRoom Booking</h1>
            <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">Hotel Management Suite</p>
          </div>
        </div>

        <div className="flex-1 max-w-md mx-12">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={18} />
            <input 
              type="text"
              placeholder="Quick search guest or room..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100 border-none focus:ring-2 focus:ring-indigo-600 focus:bg-white rounded-xl py-2 pl-10 pr-4 text-sm transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <button onClick={prevMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-600"><ChevronLeft size={20} /></button>
            <div className="px-4 font-semibold text-slate-700 min-w-[160px] text-center">{MONTHS[currentMonth]} {currentYear}</div>
            <button onClick={nextMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-600"><ChevronRight size={20} /></button>
          </div>

          <div className="h-8 w-[1px] bg-slate-200" />

          {loggedInStaff ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold border-2 border-indigo-200 uppercase">
                  {loggedInStaff.name.charAt(0)}
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{loggedInStaff.name}</p>
                  <p className="text-xs text-slate-500">Staff Member</p>
                </div>
              </div>
              <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-all" title="Logout"><LogOut size={20} /></button>
            </div>
          ) : (
            <button onClick={() => setIsAuthModalOpen(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-medium transition-all shadow-md shadow-indigo-100">
              <User size={18} /> Staff Login
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-slate-50 relative">
        <div className="inline-block min-w-full">
          <div className="flex sticky top-0 z-20 bg-white border-b border-slate-200">
            <div className="w-64 flex-shrink-0 bg-white border-r border-slate-200 p-4 font-bold text-slate-500 text-sm uppercase tracking-wider flex items-center justify-between">
              Rooms List
              <button onClick={() => setIsSettingsOpen(true)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"><Settings size={16} className="text-slate-400" /></button>
            </div>
            <div className="flex">
              {calendarDays.map((day) => (
                <div key={day.date.toISOString()} className={`w-20 flex-shrink-0 border-r border-slate-100 p-2 flex flex-col items-center justify-center ${day.isWeekend ? 'bg-slate-50' : ''} ${day.isToday ? 'bg-indigo-50' : ''}`}>
                  <span className={`text-[10px] uppercase font-bold ${day.isWeekend ? 'text-slate-400' : 'text-slate-500'}`}>{day.dayLabel}</span>
                  <span className={`text-lg font-bold mt-0.5 ${day.isToday ? 'text-indigo-600' : 'text-slate-700'}`}>{day.dayNumber}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col">
            <div className="bg-slate-100 px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span> Twin Rooms
            </div>
            {rooms.filter(r => r.type === RoomType.TWIN).map((room) => (
              <RoomRow 
                key={room.id} 
                room={room} 
                days={calendarDays} 
                bookings={bookings.filter(b => b.roomId === room.id)}
                onCellClick={openBookingModal}
                onStatusChange={updateRoomStatus}
                searchQuery={searchQuery}
              />
            ))}

            <div className="bg-slate-100 px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 border-t border-slate-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span> Double Bed Rooms
            </div>
            {rooms.filter(r => r.type === RoomType.DOUBLE).map((room) => (
              <RoomRow 
                key={room.id} 
                room={room} 
                days={calendarDays} 
                bookings={bookings.filter(b => b.roomId === room.id)}
                onCellClick={openBookingModal}
                onStatusChange={updateRoomStatus}
                searchQuery={searchQuery}
              />
            ))}
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between text-xs text-slate-400 font-medium">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> Ready</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-500"></span> Cleaning</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-rose-500"></span> Occupied</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-slate-300"></span> Out of Order</div>
        </div>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${isSyncing ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {isSyncing ? <Wifi size={12} /> : <WifiOff size={12} />}
            {isSyncing ? 'Live Sync Active' : 'Offline Mode'}
          </div>
          <div className="flex items-center gap-2"><Info size={14} /> Built for 2026-2028 Performance</div>
        </div>
      </footer>

      {/* Modals remain the same as previous implementation */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">System Settings</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-slate-600"><XCircle size={24} /></button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-2">Data Persistence</h4>
                <p className="text-xs text-slate-500 mb-4">Your bookings are synchronized across all open browser tabs in real-time.</p>
                <button onClick={clearAllData} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 transition-all font-semibold">
                  <Trash2 size={18} /> Reset System Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal (Pincode) */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-in fade-in duration-200">
            <div className="bg-indigo-600 p-8 text-white flex flex-col items-center">
              <div className="bg-white/20 p-4 rounded-full mb-4"><User size={40} /></div>
              <h2 className="text-2xl font-bold">Staff Access</h2>
              <p className="text-indigo-100 text-sm mt-1">Please enter your 4-digit PIN</p>
            </div>
            <div className="p-8">
              <div className="flex justify-center gap-4 mb-8">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className={`w-12 h-16 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all ${pin.length > i ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-300'}`}>
                    {pin.length > i ? '•' : ''}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3 mb-8">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, 'OK'].map((num) => (
                  <button
                    key={num}
                    onClick={() => {
                      if (num === 'C') setPin('');
                      else if (num === 'OK') handleLogin();
                      else if (pin.length < 4) setPin(pin + num);
                    }}
                    className={`h-14 rounded-xl font-bold text-xl transition-all ${num === 'OK' || num === 'C' ? 'bg-slate-100 text-slate-600 text-sm' : 'bg-slate-50 text-slate-800 hover:bg-indigo-600 hover:text-white'}`}
                  >
                    {num}
                  </button>
                ))}
              </div>
              <button onClick={() => { setIsAuthModalOpen(false); setPin(''); }} className="w-full text-slate-400 hover:text-slate-600 font-medium py-2">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Booking Modal */}
      {isBookingModalOpen && selectedCell && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-bold text-slate-900">New Reservation</h3>
                <p className="text-sm text-slate-500">Room {rooms.find(r => r.id === selectedCell.roomId)?.number} • {selectedCell.date.toLocaleDateString()}</p>
              </div>
              <button onClick={() => setIsBookingModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100"><XCircle size={24} /></button>
            </div>
            
            <form onSubmit={handleAddBooking} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Guest Full Name</label>
                  <input type="text" required value={bookingFormData.guestName} onChange={(e) => setBookingFormData({...bookingFormData, guestName: e.target.value})} placeholder="Enter guest name" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Check-in Date</label>
                    <div className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 flex items-center gap-2"><Clock size={16} />{selectedCell.date.toLocaleDateString()}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Stay Duration</label>
                    <select value={bookingFormData.days} onChange={(e) => setBookingFormData({...bookingFormData, days: parseInt(e.target.value)})} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 14, 21].map(n => <option key={n} value={n}>{n} {n === 1 ? 'Night' : 'Nights'}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-semibold text-slate-700">Special Requests & Notes</label>
                    <button type="button" onClick={generateSmartNote} disabled={isAiGenerating} className="text-[10px] font-bold uppercase flex items-center gap-1.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md transition-all disabled:opacity-50">
                      {isAiGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} AI Suggest Note
                    </button>
                  </div>
                  <textarea rows={3} value={bookingFormData.notes} onChange={(e) => setBookingFormData({...bookingFormData, notes: e.target.value})} placeholder="Any allergies, late arrival..." className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-sm"></textarea>
                </div>
              </div>
              <div className="mt-8 flex gap-3">
                <button type="button" onClick={() => setIsBookingModalOpen(false)} className="flex-1 py-3 rounded-xl font-semibold text-slate-600 bg-slate-100">Cancel</button>
                <button type="submit" className="flex-[2] py-3 rounded-xl font-semibold text-white bg-indigo-600 shadow-lg shadow-indigo-100 flex items-center justify-center gap-2">
                  <CheckCircle2 size={18} /> Confirm Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-component: RoomRow
interface RoomRowProps {
  room: Room;
  days: { date: Date, isWeekend: boolean, isToday: boolean }[];
  bookings: Booking[];
  onCellClick: (roomId: string, date: Date) => void;
  onStatusChange: (roomId: string, status: RoomStatus) => void;
  searchQuery: string;
}

const RoomRow: React.FC<RoomRowProps> = ({ room, days, bookings, onCellClick, onStatusChange, searchQuery }) => {
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const matchesSearch = useMemo(() => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const matchesRoom = room.number.toLowerCase().includes(query);
    const matchesBooking = bookings.some(b => b.guestName.toLowerCase().includes(query));
    return matchesRoom || matchesBooking;
  }, [searchQuery, room.number, bookings]);

  const getBookingAtDate = (date: Date) => {
    return bookings.find(b => {
      const start = new Date(b.startDate);
      const end = new Date(b.endDate);
      const d = new Date(date);
      start.setHours(0, 0, 0, 0); end.setHours(0, 0, 0, 0); d.setHours(0, 0, 0, 0);
      return d >= start && d < end;
    });
  };

  const isCheckInDay = (booking: Booking, date: Date) => {
    const start = new Date(booking.startDate);
    start.setHours(0, 0, 0, 0);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return start.getTime() === d.getTime();
  };

  return (
    <div className={`flex border-b border-slate-200 group transition-all duration-300 ${!matchesSearch ? 'opacity-20 grayscale' : 'opacity-100'}`}>
      <div className="w-64 flex-shrink-0 bg-white border-r border-slate-200 px-4 py-4 flex items-center justify-between group-hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-bold border border-slate-200">{room.number}</div>
          <div>
            <h4 className="text-sm font-bold text-slate-800 leading-tight">Room {room.number}</h4>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{room.type}</p>
          </div>
        </div>
        
        <div className="relative">
          <button onClick={() => setShowStatusMenu(!showStatusMenu)} className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border transition-all ${STATUS_COLORS[room.status]}`}>{room.status}</button>
          {showStatusMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowStatusMenu(false)} />
              <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-xl border border-slate-100 z-50 py-2">
                {Object.values(RoomStatus).map((status) => (
                  <button key={status} onClick={() => { onStatusChange(room.id, status); setShowStatusMenu(false); }} className={`w-full px-4 py-2 text-left text-xs font-semibold flex items-center gap-2 hover:bg-slate-50 ${room.status === status ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600'}`}>
                    <div className={`w-2 h-2 rounded-full ${status === RoomStatus.READY ? 'bg-emerald-500' : status === RoomStatus.CLEANING ? 'bg-amber-500' : status === RoomStatus.OCCUPIED ? 'bg-rose-500' : 'bg-slate-400'}`} />
                    {status}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex">
        {days.map((day) => {
          const booking = getBookingAtDate(day.date);
          const isStart = booking && isCheckInDay(booking, day.date);
          const isHighlighted = searchQuery && booking?.guestName.toLowerCase().includes(searchQuery.toLowerCase());

          return (
            <div key={day.date.toISOString()} onClick={() => !booking && onCellClick(room.id, day.date)} className={`w-20 h-full border-r border-slate-100 flex-shrink-0 relative group/cell cursor-pointer transition-colors ${day.isWeekend ? 'bg-slate-50' : 'bg-white'} ${day.isToday ? 'bg-indigo-50/30' : ''} ${!booking ? 'hover:bg-indigo-50' : ''}`}>
              {booking ? (
                <div className={`absolute top-2 left-0 right-0 bottom-2 z-10 flex flex-col justify-center px-2 transition-all shadow-sm ${
                  booking.status === 'Booked' ? 'bg-indigo-600 text-white rounded-md mx-1' : 'bg-rose-500 text-white'
                } ${isHighlighted ? 'ring-4 ring-yellow-400 ring-offset-1' : ''}`}>
                  {isStart && (
                    <div className="flex flex-col overflow-hidden">
                      <p className="text-[10px] font-bold truncate leading-tight uppercase opacity-80">Guest</p>
                      <p className="text-xs font-bold truncate leading-tight">{booking.guestName}</p>
                    </div>
                  )}
                  {!isStart && <div className="h-1 bg-white/20 rounded-full w-full" />}
                </div>
              ) : (
                <div className="opacity-0 group-hover/cell:opacity-100 absolute inset-0 flex items-center justify-center transition-opacity"><Plus size={20} className="text-indigo-400" /></div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default App;
