
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
  History,
  Activity as ActivityIcon
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
// Fix: Added missing CalendarDay to the imports from types.ts
import { Room, Staff, Booking, RoomStatus, RoomType, Toast, SyncMessage, Activity, CalendarDay } from './types';
import { STAFF_LIST, ROOMS, YEARS, MONTHS, STATUS_COLORS } from './constants';

const STORAGE_KEYS = {
  BOOKINGS: 'luxeroom_db_bookings_v2',
  ROOMS: 'luxeroom_db_rooms_v2',
  ACTIVITY: 'luxeroom_db_activity_v2'
};

const App: React.FC = () => {
  // Sync Engine State
  const [rooms, setRooms] = useState<Room[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ROOMS);
    return saved ? JSON.parse(saved) : ROOMS;
  });
  
  const [bookings, setBookings] = useState<Booking[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.BOOKINGS);
    return saved ? JSON.parse(saved) : [];
  });

  const [activities, setActivities] = useState<Activity[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVITY);
    return saved ? JSON.parse(saved) : [];
  });

  // UI State
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [loggedInStaff, setLoggedInStaff] = useState<Staff | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ roomId: string, date: Date } | null>(null);
  const [bookingFormData, setBookingFormData] = useState({ guestName: '', days: 1, notes: '' });
  const [pin, setPin] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isRemoteSyncing, setIsRemoteSyncing] = useState(false);

  const syncChannel = useRef<BroadcastChannel | null>(null);

  // Synchronization Engine Initialization
  useEffect(() => {
    syncChannel.current = new BroadcastChannel('luxeroom_realtime_engine');
    
    syncChannel.current.onmessage = (event: MessageEvent<SyncMessage>) => {
      setIsRemoteSyncing(true);
      const { type, data, staffName } = event.data;
      
      if (type === 'SYNC_BOOKINGS') {
        setBookings(data as Booking[]);
        addToast(`Bookings updated by ${staffName}`, 'info');
      } else if (type === 'SYNC_ROOMS') {
        setRooms(data as Room[]);
        addToast(`Room statuses updated by ${staffName}`, 'info');
      }
      
      setTimeout(() => setIsRemoteSyncing(false), 1000);
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.BOOKINGS && e.newValue) setBookings(JSON.parse(e.newValue));
      if (e.key === STORAGE_KEYS.ROOMS && e.newValue) setRooms(JSON.parse(e.newValue));
      if (e.key === STORAGE_KEYS.ACTIVITY && e.newValue) setActivities(JSON.parse(e.newValue));
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      syncChannel.current?.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Persistent Side Effects
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
  }, [bookings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ROOMS, JSON.stringify(rooms));
  }, [rooms]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ACTIVITY, JSON.stringify(activities));
  }, [activities]);

  // Derived Calendar Data
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const days = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(currentYear, currentMonth, i);
      days.push({
        date,
        isToday: date.toDateString() === new Date().toDateString(),
        isWeekend: [0, 6].includes(date.getDay()),
        dayLabel: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: i
      });
    }
    return days;
  }, [currentYear, currentMonth]);

  // Actions
  const addToast = (message: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [{ id, message, type }, ...prev].slice(0, 3));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const logActivity = (message: string, type: Activity['type'], staffName: string) => {
    const newActivity: Activity = {
      id: Math.random().toString(36).substr(2, 9),
      message,
      timestamp: Date.now(),
      staffName,
      type
    };
    setActivities(prev => [newActivity, ...prev].slice(0, 50));
  };

  const handleBooking = (e: React.FormEvent) => {
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
      staffName: loggedInStaff.name,
      status: 'Booked',
      notes: bookingFormData.notes,
      updatedAt: Date.now()
    };

    const nextBookings = [...bookings, newBooking];
    setBookings(nextBookings);
    
    // Engine Broadcast
    syncChannel.current?.postMessage({
      type: 'SYNC_BOOKINGS',
      data: nextBookings,
      staffName: loggedInStaff.name
    });

    logActivity(`Created booking for ${newBooking.guestName}`, 'booking', loggedInStaff.name);
    setIsBookingModalOpen(false);
    setBookingFormData({ guestName: '', days: 1, notes: '' });
    addToast(`Booking confirmed for ${newBooking.guestName}`, 'success');
  };

  const updateStatus = (roomId: string, status: RoomStatus) => {
    if (!loggedInStaff) return setIsAuthModalOpen(true);
    
    const nextRooms = rooms.map(r => r.id === roomId ? { ...r, status, lastUpdated: Date.now() } : r);
    setRooms(nextRooms);

    // Engine Broadcast
    syncChannel.current?.postMessage({
      type: 'SYNC_ROOMS',
      data: nextRooms,
      staffName: loggedInStaff.name
    });

    const roomNum = rooms.find(r => r.id === roomId)?.number;
    logActivity(`Updated Room ${roomNum} to ${status}`, 'status', loggedInStaff.name);
    addToast(`Room ${roomNum} is now ${status}`, 'info');
  };

  const generateAiNote = async () => {
    if (!bookingFormData.guestName) return addToast("Guest name required for AI", "warning");
    setIsAiGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const room = rooms.find(r => r.id === selectedCell?.roomId);
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Write a one-sentence professional hotel note for guest ${bookingFormData.guestName} staying in ${room?.type} ${room?.number}.`,
      });
      setBookingFormData(p => ({ ...p, notes: response.text?.trim() || '' }));
    } catch (e) {
      addToast("AI Service Error", "warning");
    } finally {
      setIsAiGenerating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans selection:bg-indigo-100">
      {/* Toast Overlay */}
      <div className="fixed top-6 right-6 z-[100] space-y-3 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto bg-white border border-slate-200 shadow-xl rounded-xl p-4 flex items-center gap-3 animate-in slide-in-from-right-full">
            <div className={`w-2 h-8 rounded-full ${t.type === 'success' ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
            <p className="text-sm font-bold text-slate-800">{t.message}</p>
          </div>
        ))}
      </div>

      {/* Main Header */}
      <header className="bg-white border-b border-slate-200 h-20 px-8 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <CalendarIcon size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">LUXEROOM <span className="text-indigo-600">PRO</span></h1>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isRemoteSyncing ? 'bg-emerald-400 animate-ping' : 'bg-emerald-500'}`} />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Sync Engine Active</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search guests or rooms..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-slate-100 border-none rounded-xl py-2.5 pl-10 pr-4 w-64 text-sm focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all outline-none" 
            />
          </div>

          <div className="flex items-center bg-slate-100 rounded-xl p-1">
            <button onClick={() => currentMonth === 0 ? (setCurrentYear(y => y-1), setCurrentMonth(11)) : setCurrentMonth(m => m-1)} className="p-2 hover:bg-white rounded-lg transition-all"><ChevronLeft size={18} /></button>
            <div className="px-4 font-bold text-slate-700 text-sm min-w-[140px] text-center">{MONTHS[currentMonth]} {currentYear}</div>
            <button onClick={() => currentMonth === 11 ? (setCurrentYear(y => y+1), setCurrentMonth(0)) : setCurrentMonth(m => m+1)} className="p-2 hover:bg-white rounded-lg transition-all"><ChevronRight size={18} /></button>
          </div>

          <button onClick={() => setIsHistoryOpen(true)} className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all relative">
            <ActivityIcon size={20} />
            {activities.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-indigo-600 rounded-full border-2 border-white" />}
          </button>

          <div className="h-10 w-[1px] bg-slate-200 mx-2" />

          {loggedInStaff ? (
            <div className="flex items-center gap-3 bg-indigo-50 pl-2 pr-4 py-1.5 rounded-xl border border-indigo-100">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">{loggedInStaff.name.charAt(0)}</div>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-900 leading-none">{loggedInStaff.name}</p>
                <button onClick={() => setLoggedInStaff(null)} className="text-[10px] text-indigo-600 hover:underline">Logout</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setIsAuthModalOpen(true)} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">Staff Login</button>
          )}
        </div>
      </header>

      {/* Calendar Grid */}
      <main className="flex-1 overflow-auto relative custom-scrollbar">
        <div className="inline-block min-w-full">
          {/* Grid Header */}
          <div className="flex sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
            <div className="w-64 flex-shrink-0 p-5 border-r border-slate-200 bg-white font-black text-slate-400 text-[10px] uppercase tracking-[0.2em]">Inventory Dashboard</div>
            <div className="flex">
              {calendarDays.map(day => (
                <div key={day.date.toISOString()} className={`w-20 flex-shrink-0 border-r border-slate-100 p-3 flex flex-col items-center justify-center ${day.isWeekend ? 'bg-slate-50' : 'bg-white'} ${day.isToday ? 'bg-indigo-50' : ''}`}>
                  <span className={`text-[10px] font-black uppercase ${day.isWeekend ? 'text-slate-300' : 'text-slate-400'}`}>{day.dayLabel}</span>
                  <span className={`text-lg font-black mt-1 ${day.isToday ? 'text-indigo-600' : 'text-slate-800'}`}>{day.dayNumber}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Rows */}
          <div className="flex flex-col">
            {['Twin Rooms', 'Double Bed Rooms'].map(type => (
              <React.Fragment key={type}>
                <div className="bg-slate-100/80 backdrop-blur-sm px-6 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 sticky left-0 z-20 flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${type.includes('Twin') ? 'bg-blue-500' : 'bg-purple-500'}`} />
                  {type}
                </div>
                {rooms.filter(r => r.type === (type.includes('Twin') ? RoomType.TWIN : RoomType.DOUBLE)).map(room => (
                  <RoomRow 
                    key={room.id} 
                    room={room} 
                    days={calendarDays} 
                    bookings={bookings.filter(b => b.roomId === room.id)} 
                    onCellClick={(d) => { setSelectedCell({ roomId: room.id, date: d }); setIsBookingModalOpen(true); }}
                    onStatusUpdate={updateStatus}
                    searchQuery={searchQuery}
                  />
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </main>

      {/* Activity Drawer */}
      {isHistoryOpen && (
        <>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50" onClick={() => setIsHistoryOpen(false)} />
          <div className="fixed top-0 right-0 h-full w-96 bg-white z-[60] shadow-2xl p-8 animate-in slide-in-from-right duration-300 flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-3"><History className="text-indigo-600" /> LIVE ACTIVITY</h3>
              <button onClick={() => setIsHistoryOpen(false)} className="text-slate-400 hover:text-slate-600"><XCircle size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
              {activities.length === 0 ? (
                <div className="text-center py-20 text-slate-400 italic text-sm">No recent activity detected</div>
              ) : activities.map(act => (
                <div key={act.id} className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${act.type === 'booking' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>{act.type}</span>
                    <span className="text-[10px] font-medium text-slate-400">{new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-xs font-bold text-slate-800 leading-relaxed">{act.message}</p>
                  <p className="text-[10px] mt-2 text-slate-400 font-medium italic">— {act.staffName}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Booking Form (Shared logic from previous iteration) */}
      {isBookingModalOpen && selectedCell && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="bg-indigo-600 p-8 text-white relative">
               <h2 className="text-2xl font-black italic tracking-tight">NEW RESERVATION</h2>
               <p className="text-indigo-100 text-sm mt-1 font-medium">Room {rooms.find(r => r.id === selectedCell.roomId)?.number} • {selectedCell.date.toLocaleDateString('en-US', { dateStyle: 'full' })}</p>
               <button onClick={() => setIsBookingModalOpen(false)} className="absolute top-6 right-6 text-white/60 hover:text-white"><XCircle size={24} /></button>
             </div>
             <form onSubmit={handleBooking} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Guest Identity</label>
                  <input required value={bookingFormData.guestName} onChange={e => setBookingFormData(p => ({ ...p, guestName: e.target.value }))} type="text" placeholder="Full Legal Name" className="w-full px-5 py-3.5 rounded-2xl bg-slate-100 border-none text-slate-900 font-bold focus:ring-2 focus:ring-indigo-600 transition-all outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Duration</label>
                    <select value={bookingFormData.days} onChange={e => setBookingFormData(p => ({ ...p, days: parseInt(e.target.value) }))} className="w-full px-5 py-3.5 rounded-2xl bg-slate-100 border-none text-slate-900 font-bold focus:ring-2 focus:ring-indigo-600 outline-none">
                      {[1,2,3,4,5,6,7,10,14,21].map(n => <option key={n} value={n}>{n} {n===1?'Night':'Nights'}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                     <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center justify-between">Smart Note <button type="button" onClick={generateAiNote} className="text-indigo-600 hover:text-indigo-800 disabled:opacity-30" disabled={isAiGenerating}>{isAiGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}</button></label>
                     <textarea rows={1} value={bookingFormData.notes} onChange={e => setBookingFormData(p => ({ ...p, notes: e.target.value }))} placeholder="Any requests?" className="w-full px-5 py-3.5 rounded-2xl bg-slate-100 border-none text-slate-900 font-bold focus:ring-2 focus:ring-indigo-600 outline-none resize-none" />
                  </div>
                </div>
                <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 uppercase flex items-center justify-center gap-3">
                  <CheckCircle2 size={20} /> Complete Booking
                </button>
             </form>
          </div>
        </div>
      )}

      {/* PIN Login (Shared logic) */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-sm overflow-hidden p-10 text-center animate-in fade-in zoom-in-90 duration-200">
             <div className="w-20 h-20 bg-indigo-100 rounded-3xl flex items-center justify-center text-indigo-600 mx-auto mb-6"><User size={40} /></div>
             <h2 className="text-2xl font-black text-slate-900 mb-2">STAFF ACCESS</h2>
             <p className="text-slate-400 font-medium mb-10">Secure 4-Digit Identity PIN</p>
             <div className="flex justify-center gap-4 mb-10">
               {[...Array(4)].map((_, i) => (
                 <div key={i} className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center text-2xl font-black ${pin.length > i ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-slate-100 text-slate-200'}`}>{pin.length > i ? '●' : ''}</div>
               ))}
             </div>
             <div className="grid grid-cols-3 gap-4">
               {[1,2,3,4,5,6,7,8,9,'C',0,'OK'].map(v => (
                 <button key={v} onClick={() => {
                   if (v === 'C') setPin('');
                   else if (v === 'OK') {
                     const s = STAFF_LIST.find(x => x.pin === pin);
                     if (s) { setLoggedInStaff(s); setIsAuthModalOpen(false); setPin(''); addToast(`Identity verified: ${s.name}`, 'success'); }
                     else { setPin(''); alert("Invalid PIN"); }
                   } else if (pin.length < 4) setPin(pin + v);
                 }} className="h-14 rounded-2xl bg-slate-50 text-slate-800 font-black text-lg hover:bg-indigo-600 hover:text-white transition-all">{v}</button>
               ))}
             </div>
             <button onClick={() => setIsAuthModalOpen(false)} className="mt-8 text-slate-400 font-bold hover:text-slate-600">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

// Subcomponent: RoomRow
interface RoomRowProps {
  room: Room;
  // Fix: Line below now correctly references the imported CalendarDay type
  days: CalendarDay[];
  bookings: Booking[];
  onCellClick: (d: Date) => void;
  onStatusUpdate: (id: string, s: RoomStatus) => void;
  searchQuery: string;
}

const RoomRow: React.FC<RoomRowProps> = ({ room, days, bookings, onCellClick, onStatusUpdate, searchQuery }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  
  const isVisible = useMemo(() => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return room.number.includes(q) || bookings.some(b => b.guestName.toLowerCase().includes(q));
  }, [searchQuery, room.number, bookings]);

  const getBooking = (date: Date) => {
    return bookings.find(b => {
      const s = new Date(b.startDate); const e = new Date(b.endDate); const d = new Date(date);
      s.setHours(0,0,0,0); e.setHours(0,0,0,0); d.setHours(0,0,0,0);
      return d >= s && d < e;
    });
  };

  return (
    <div className={`flex border-b border-slate-200 transition-all duration-300 ${!isVisible ? 'opacity-20 grayscale h-8 overflow-hidden pointer-events-none' : 'h-24'}`}>
      <div className="w-64 flex-shrink-0 bg-white border-r border-slate-200 p-5 flex items-center justify-between sticky left-0 z-10 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700 font-black text-sm border border-slate-200">{room.number}</div>
          <div>
            <h4 className="text-xs font-black text-slate-800 tracking-tight uppercase">{room.type}</h4>
            <div className="relative inline-block mt-1">
               <button onClick={() => setMenuOpen(!menuOpen)} className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border border-slate-200/50 ${STATUS_COLORS[room.status]}`}>{room.status}</button>
               {menuOpen && (
                 <>
                   <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                   <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-slate-100 shadow-2xl rounded-2xl z-50 py-2 overflow-hidden">
                      {Object.values(RoomStatus).map(s => (
                        <button key={s} onClick={() => { onStatusUpdate(room.id, s); setMenuOpen(false); }} className="w-full px-4 py-2 text-left text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${s === RoomStatus.READY ? 'bg-emerald-500' : s === RoomStatus.CLEANING ? 'bg-amber-500' : 'bg-rose-500'}`} /> {s}
                        </button>
                      ))}
                   </div>
                 </>
               )}
            </div>
          </div>
        </div>
      </div>
      <div className="flex">
        {days.map(day => {
          const b = getBooking(day.date);
          const isStart = b && new Date(b.startDate).toDateString() === day.date.toDateString();
          return (
            <div key={day.date.toISOString()} onClick={() => !b && onCellClick(day.date)} className={`w-20 border-r border-slate-100 relative group/cell cursor-pointer transition-colors ${day.isWeekend ? 'bg-slate-50/50' : 'bg-white'} ${day.isToday ? 'bg-indigo-50/20' : ''}`}>
              {b ? (
                <div className={`absolute inset-y-3 left-0.5 right-0.5 rounded-lg z-10 p-2 flex flex-col justify-center overflow-hidden transition-all shadow-sm ${b.status === 'Booked' ? 'bg-indigo-600 text-white' : 'bg-rose-500 text-white'}`}>
                  {isStart && (
                    <div className="animate-in fade-in slide-in-from-left-2">
                       <p className="text-[8px] font-black uppercase opacity-60 leading-none mb-1">GUEST</p>
                       <p className="text-[10px] font-black truncate leading-none uppercase">{b.guestName}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity"><Plus size={16} className="text-indigo-300" /></div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default App;
