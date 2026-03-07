import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Heart, CalendarDays, Pill, FileText, Clock, Activity, TrendingUp,
    Star, Bell, X, Check, Thermometer, Droplets, Shield, User,
    CalendarCheck, MessageSquare, ChevronDown, ChevronRight, AlertTriangle,
    CheckCircle, Zap, Sparkles, Stethoscope, Eye, BedDouble, Send,
    Phone, ArrowRight, Bookmark, BarChart3
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getNotifications, markNotificationRead } from '../services/api';
import { exportPatientPDF } from '../utils/pdfExport';

export default function PatientDashboard() {
    const user = JSON.parse(sessionStorage.getItem('zi_user') || '{}');
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [appointments, setAppointments] = useState({ total: 0, attended: 0, missed: 0, appointments: [] });
    const [prescriptions, setPrescriptions] = useState([]);
    const [diagnoses, setDiagnoses] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [vitals, setVitals] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [showNotifPanel, setShowNotifPanel] = useState(false);
    const [activeSection, setActiveSection] = useState('overview');
    const [showFeedbackPanel, setShowFeedbackPanel] = useState(false);
    const [feedbackRating, setFeedbackRating] = useState(0);
    const [feedbackText, setFeedbackText] = useState('');
    const [feedbackSuccess, setFeedbackSuccess] = useState('');

    const unreadCount = notifications.filter(n => !n.read).length;

    // ── Data Fetching ──
    const fetchAll = useCallback(async () => {
        if (!user.email) return;
        try {
            const dept = user.department ? `?department=${encodeURIComponent(user.department)}` : '';
            const email = user.email ? `?patient_email=${encodeURIComponent(user.email)}` : '';
            const [appts, rx, dx, bk, vt] = await Promise.all([
                axios.get(`/api/patient/appointments${dept}`),
                axios.get(`/api/patient/my-prescriptions${email}`),
                axios.get(`/api/patient/my-diagnoses${email}`),
                axios.get(`/api/patient/bookings${email}`),
                axios.get(`/api/patient/my-vitals${email}`).catch(() => ({ data: { vitals: [] } })),
            ]);
            setAppointments(appts.data);
            setPrescriptions(rx.data.prescriptions || []);
            setDiagnoses(dx.data.diagnoses || []);
            setBookings(bk.data.bookings || []);
            setVitals(vt.data.vitals || []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }, [user.email, user.department]);

    const fetchNotifs = useCallback(async () => {
        if (!user.email) return;
        try { const r = await getNotifications(user.email); setNotifications(r.notifications || []); } catch { }
    }, [user.email]);

    useEffect(() => {
        fetchAll(); fetchNotifs();
        const iv = setInterval(() => { fetchAll(); fetchNotifs(); }, 45000);
        return () => clearInterval(iv);
    }, [fetchAll, fetchNotifs]);

    // ── Actions ──
    const submitFeedback = async (e) => {
        e.preventDefault();
        if (!feedbackRating || !feedbackText.trim()) return;
        try {
            await axios.post('/api/patient/feedback', {
                patient_email: user.email || '',
                patient_name: user.name || '',
                department: user.department || 'General',
                feedback_text: feedbackText,
                rating: feedbackRating,
            });
            setFeedbackSuccess('Thank you for your feedback!');
            setFeedbackRating(0);
            setFeedbackText('');
            setTimeout(() => { setFeedbackSuccess(''); setShowFeedbackPanel(false); }, 3000);
        } catch (e) { console.error(e); }
    };

    const handleMarkRead = async (id) => {
        try { await markNotificationRead(id); setNotifications(p => p.map(n => n.id === id ? { ...n, read: true } : n)); } catch { }
    };

    // ── Derived ──
    const upcomingBookings = bookings.filter(b => b.status === 'pending' || b.status === 'approve' || b.status === 'approved');
    const activePrescriptions = prescriptions.filter(rx => rx.status === 'active');
    const latestVitals = vitals.length > 0 ? vitals[0] : null;

    const healthScore = useMemo(() => {
        let score = 75; // base
        if (activePrescriptions.length > 0) score -= activePrescriptions.length * 2;
        if (diagnoses.length > 0) {
            const severe = diagnoses.filter(d => d.severity === 'Severe').length;
            score -= severe * 10;
            score -= (diagnoses.length - severe) * 3;
        }
        if (appointments.attended > appointments.missed) score += 5;
        if (upcomingBookings.length > 0) score += 3;
        return Math.min(100, Math.max(20, Math.round(score)));
    }, [activePrescriptions, diagnoses, appointments, upcomingBookings]);

    const scoreColor = healthScore >= 80 ? '#10B981' : healthScore >= 60 ? '#F59E0B' : '#EF4444';
    const scoreLabel = healthScore >= 80 ? 'Excellent' : healthScore >= 60 ? 'Good' : 'Needs Attention';

    const timeline = useMemo(() => {
        const items = [];
        bookings.forEach(b => items.push({
            type: 'appointment', date: b.preferred_date, time: b.preferred_time,
            title: `${b.department} Appointment`, status: b.status,
            icon: CalendarDays, color: '#3B82F6',
        }));
        diagnoses.forEach(d => items.push({
            type: 'diagnosis', date: d.created_at?.split('T')[0] || '',
            title: `Diagnosis: ${d.condition}`, status: d.severity,
            icon: FileText, color: '#8B5CF6',
        }));
        prescriptions.forEach(rx => items.push({
            type: 'prescription', date: rx.created_at?.split('T')[0] || '',
            title: `Prescribed: ${rx.medication}`, status: rx.status,
            icon: Pill, color: '#10B981',
        }));
        items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        return items.slice(0, 10);
    }, [bookings, diagnoses, prescriptions]);

    const timeAgo = (d) => { if (!d) return ''; const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); return m < 1 ? 'Now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`; };

    if (loading) return (
        <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center"><div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" /><p className="text-xs text-text-muted">Loading your health portal...</p></div>
        </div>
    );

    return (
        <div className="max-w-[1400px] mx-auto space-y-4">

            {/* ═══ HEADER ═══ */}
            <div className="flex items-center justify-between px-6 py-4 bg-surface-card rounded-2xl border border-border">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center">
                        <Shield size={22} className="text-amber-600" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-text-primary">My Health Portal</h1>
                        <p className="text-[11px] text-text-muted">
                            {user.name || 'Patient'} · {user.department || 'General'} · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => exportPatientPDF({ user, healthScore, appointments, prescriptions, diagnoses, bookings, vitals })} className="px-4 py-2 text-xs font-semibold bg-emerald-500/10 text-emerald-700 rounded-xl hover:bg-emerald-500/20 transition cursor-pointer flex items-center gap-2">
                        <FileText size={14} /> Download Report
                    </button>
                    <button onClick={() => setShowFeedbackPanel(true)} className="px-4 py-2 text-xs font-semibold bg-amber-500/10 text-amber-700 rounded-xl hover:bg-amber-500/20 transition cursor-pointer flex items-center gap-2">
                        <MessageSquare size={14} /> Give Feedback
                    </button>
                    <div className="relative">
                        <button onClick={() => setShowNotifPanel(!showNotifPanel)} className="relative w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center cursor-pointer hover:shadow-sm transition">
                            <Bell size={17} className="text-text-secondary" />
                            {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}
                        </button>
                        <AnimatePresence>
                            {showNotifPanel && (
                                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                                    className="absolute right-0 top-12 w-80 max-h-96 bg-surface-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col">
                                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                                        <span className="text-xs font-bold text-text-primary flex items-center gap-1.5"><Bell size={13} className="text-amber-500" /> Notifications</span>
                                        <button onClick={() => setShowNotifPanel(false)} className="cursor-pointer"><X size={14} className="text-text-muted" /></button>
                                    </div>
                                    <div className="overflow-y-auto flex-1">{notifications.length === 0 ? <p className="text-xs text-text-muted text-center py-10">No notifications</p> : notifications.slice(0, 12).map(n => (
                                        <div key={n.id} className={`px-4 py-2.5 border-b border-border/50 ${!n.read ? 'bg-amber-500/[0.03]' : ''}`}>
                                            <div className="flex justify-between items-start"><span className="text-[11px] font-semibold text-text-primary">{n.title}</span><span className="text-[9px] text-text-muted">{timeAgo(n.created_at)}</span></div>
                                            <p className="text-[10px] text-text-secondary mt-0.5">{n.message}</p>
                                            {!n.read && <button onClick={() => handleMarkRead(n.id)} className="text-amber-600 text-[10px] mt-1 cursor-pointer flex items-center gap-0.5"><Check size={10} /> Mark read</button>}
                                        </div>
                                    ))}</div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* ═══ HEALTH SCORE + QUICK STATS ═══ */}
            <div className="grid grid-cols-12 gap-3">
                {/* Health Score */}
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className="col-span-3 bg-surface-card rounded-xl border border-border p-5 flex flex-col items-center justify-center">
                    <div className="relative w-24 h-24 mb-3">
                        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="42" fill="none" stroke="#E5E7EB" strokeWidth="8" />
                            <circle cx="50" cy="50" r="42" fill="none" stroke={scoreColor} strokeWidth="8"
                                strokeDasharray={`${healthScore * 2.64} 264`} strokeLinecap="round"
                                className="transition-all duration-1000" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-bold text-text-primary">{healthScore}</span>
                            <span className="text-[8px] text-text-muted font-semibold">SCORE</span>
                        </div>
                    </div>
                    <p className="text-xs font-bold" style={{ color: scoreColor }}>{scoreLabel}</p>
                    <p className="text-[9px] text-text-muted mt-0.5">Health Wellness Index</p>
                </motion.div>

                {/* Quick Stats */}
                <div className="col-span-9 grid grid-cols-4 gap-3">
                    {[
                        { label: 'UPCOMING', val: upcomingBookings.length, icon: CalendarDays, color: '#3B82F6', sub: 'Appointments' },
                        { label: 'ACTIVE RX', val: activePrescriptions.length, icon: Pill, color: '#10B981', sub: 'Prescriptions' },
                        { label: 'DIAGNOSES', val: diagnoses.length, icon: FileText, color: '#8B5CF6', sub: 'On Record' },
                        { label: 'VISITS', val: appointments.total, icon: Activity, color: '#F59E0B', sub: 'Total' },
                    ].map((m, i) => (
                        <motion.div key={m.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                            className="bg-surface-card rounded-xl border border-border p-4">
                            <div className="flex items-center gap-2 mb-2"><div className="w-1 h-4 rounded-full" style={{ background: m.color }} /><m.icon size={14} style={{ color: m.color }} /></div>
                            <p className="text-2xl font-bold text-text-primary leading-none">{m.val}</p>
                            <p className="text-[9px] text-text-muted font-semibold tracking-wider mt-1">{m.label}</p>
                            <p className="text-[9px] text-text-muted mt-0.5">{m.sub}</p>
                        </motion.div>
                    ))}

                    {/* Attendance Bar */}
                    <div className="col-span-2 bg-surface-card rounded-xl border border-border px-5 py-3 flex items-center gap-4">
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">Attendance</span>
                        <div className="flex-1 h-2.5 bg-border rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{
                                width: `${appointments.total ? Math.round((appointments.attended / appointments.total) * 100) : 0}%`
                            }} />
                        </div>
                        <span className="text-xs font-bold text-emerald-600">{appointments.attended}/{appointments.total}</span>
                    </div>
                    <div className="col-span-2 bg-surface-card rounded-xl border border-border px-5 py-3 flex items-center gap-4">
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">Missed</span>
                        <div className="flex-1 h-2.5 bg-border rounded-full overflow-hidden">
                            <div className="h-full bg-red-400 rounded-full transition-all" style={{
                                width: `${appointments.total ? Math.round((appointments.missed / appointments.total) * 100) : 0}%`
                            }} />
                        </div>
                        <span className="text-xs font-bold text-red-500">{appointments.missed}</span>
                    </div>
                </div>
            </div>

            {/* ═══ QUICK ACTIONS ═══ */}
            <div className="grid grid-cols-4 gap-3">
                {[
                    { icon: CalendarCheck, label: 'Book Appointment', desc: 'Schedule a visit', color: '#3B82F6', bg: 'from-blue-500/10 to-blue-500/5', href: '/book-appointment' },
                    { icon: User, label: 'My Profile', desc: 'Update your info', color: '#8B5CF6', bg: 'from-purple-500/10 to-purple-500/5', href: '/profile' },
                    { icon: FileText, label: 'View Reports', desc: 'Medical records', color: '#10B981', bg: 'from-emerald-500/10 to-emerald-500/5', href: '/reports' },
                    { icon: MessageSquare, label: 'Give Feedback', desc: 'Rate your experience', color: '#F59E0B', bg: 'from-amber-500/10 to-amber-500/5', action: () => setShowFeedbackPanel(true) },
                ].map((a, i) => (
                    <motion.div key={a.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.04 }}
                        onClick={() => a.action ? a.action() : navigate(a.href)}
                        className={`p-4 rounded-xl bg-gradient-to-br ${a.bg} border border-border cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all group`}>
                        <div className="flex items-center justify-between mb-2">
                            <a.icon size={20} style={{ color: a.color }} />
                            <ArrowRight size={14} className="text-text-muted/30 group-hover:text-text-muted/60 transition" />
                        </div>
                        <p className="text-sm font-bold text-text-primary">{a.label}</p>
                        <p className="text-[10px] text-text-muted">{a.desc}</p>
                    </motion.div>
                ))}
            </div>

            {/* ═══ MAIN 3-PANEL LAYOUT ═══ */}
            <div className="grid grid-cols-12 gap-3" style={{ minHeight: 480 }}>

                {/* ── VITALS & HEALTH (5 cols) ── */}
                <div className="col-span-5 bg-surface-card rounded-xl border border-border flex flex-col overflow-hidden">
                    <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                        <Activity size={14} className="text-emerald-500" />
                        <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider">Health Snapshot</h2>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {/* Latest Vitals */}
                        <div className="px-5 py-4 border-b border-border">
                            <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-3">Latest Vitals</p>
                            {latestVitals ? (
                                <div className="grid grid-cols-2 gap-2.5">
                                    {latestVitals.bp_systolic && (
                                        <div className="px-3 py-3 bg-red-50 rounded-xl text-center">
                                            <Heart size={16} className="text-red-500 mx-auto mb-1" />
                                            <p className="text-lg font-bold text-text-primary">{latestVitals.bp_systolic}/{latestVitals.bp_diastolic}</p>
                                            <p className="text-[9px] text-text-muted font-medium">Blood Pressure</p>
                                            <p className="text-[8px] text-text-muted mt-0.5">mmHg</p>
                                        </div>
                                    )}
                                    {latestVitals.heart_rate && (
                                        <div className="px-3 py-3 bg-emerald-50 rounded-xl text-center">
                                            <Activity size={16} className="text-emerald-500 mx-auto mb-1" />
                                            <p className="text-lg font-bold text-text-primary">{latestVitals.heart_rate}</p>
                                            <p className="text-[9px] text-text-muted font-medium">Heart Rate</p>
                                            <p className="text-[8px] text-text-muted mt-0.5">bpm</p>
                                        </div>
                                    )}
                                    {latestVitals.temperature && (
                                        <div className="px-3 py-3 bg-orange-50 rounded-xl text-center">
                                            <Thermometer size={16} className="text-orange-500 mx-auto mb-1" />
                                            <p className="text-lg font-bold text-text-primary">{latestVitals.temperature}°F</p>
                                            <p className="text-[9px] text-text-muted font-medium">Temperature</p>
                                            <p className="text-[8px] text-text-muted mt-0.5">Fahrenheit</p>
                                        </div>
                                    )}
                                    {latestVitals.sugar_level && (
                                        <div className="px-3 py-3 bg-blue-50 rounded-xl text-center">
                                            <Droplets size={16} className="text-blue-500 mx-auto mb-1" />
                                            <p className="text-lg font-bold text-text-primary">{latestVitals.sugar_level}</p>
                                            <p className="text-[9px] text-text-muted font-medium">Sugar Level</p>
                                            <p className="text-[8px] text-text-muted mt-0.5">mg/dL</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-6">
                                    <ScanVitals />
                                    <p className="text-xs text-text-muted">No vitals recorded yet</p>
                                    <p className="text-[10px] text-text-muted mt-0.5">Your nurse will record vitals during visits</p>
                                </div>
                            )}
                            {latestVitals?.recorded_at && (
                                <p className="text-[9px] text-text-muted text-center mt-2">Last recorded: {new Date(latestVitals.recorded_at).toLocaleString()}</p>
                            )}
                        </div>

                        {/* Active Prescriptions */}
                        <div className="px-5 py-4 border-b border-border">
                            <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <Pill size={11} className="text-emerald-500" /> Active Medications ({activePrescriptions.length})
                            </p>
                            {activePrescriptions.length === 0 ? (
                                <p className="text-xs text-text-muted text-center py-3">No active medications</p>
                            ) : (
                                <div className="space-y-2">
                                    {activePrescriptions.slice(0, 4).map(rx => (
                                        <div key={rx.id} className="px-3 py-2.5 bg-emerald-50 rounded-xl border border-emerald-200/50">
                                            <div className="flex items-center justify-between">
                                                <p className="text-[11px] font-bold text-emerald-800">💊 {rx.medication}</p>
                                                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-md">Active</span>
                                            </div>
                                            <p className="text-[10px] text-emerald-600 mt-0.5">{rx.dosage} · {rx.frequency} · {rx.duration}</p>
                                            {rx.notes && <p className="text-[9px] text-emerald-500 mt-0.5">📝 {rx.notes}</p>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Medical History */}
                        <div className="px-5 py-4">
                            <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <Stethoscope size={11} className="text-purple-500" /> Medical History ({diagnoses.length})
                            </p>
                            {diagnoses.length === 0 ? (
                                <p className="text-xs text-text-muted text-center py-3">No diagnoses on record</p>
                            ) : (
                                <div className="space-y-2">
                                    {diagnoses.slice(0, 4).map(dx => (
                                        <div key={dx.id} className="px-3 py-2.5 bg-purple-50 rounded-xl border border-purple-200/50">
                                            <div className="flex items-center justify-between">
                                                <p className="text-[11px] font-bold text-purple-800">🩺 {dx.condition}</p>
                                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${dx.severity === 'Severe' ? 'bg-red-100 text-red-700' : dx.severity === 'Moderate' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{dx.severity}</span>
                                            </div>
                                            {dx.notes && <p className="text-[10px] text-purple-600 mt-0.5">{dx.notes}</p>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── APPOINTMENTS & TIMELINE (4 cols) ── */}
                <div className="col-span-4 bg-surface-card rounded-xl border border-border flex flex-col overflow-hidden">
                    <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                        <CalendarDays size={14} className="text-blue-500" />
                        <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider">Appointments & Timeline</h2>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {/* Upcoming Appointments */}
                        <div className="px-5 py-4 border-b border-border">
                            <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-2">Upcoming Appointments</p>
                            {upcomingBookings.length === 0 ? (
                                <div className="text-center py-4">
                                    <CalendarDays size={24} className="text-text-muted/20 mx-auto mb-1" />
                                    <p className="text-xs text-text-muted">No upcoming appointments</p>
                                    <button onClick={() => navigate('/book-appointment')} className="mt-2 text-[10px] font-semibold text-blue-600 hover:text-blue-700 cursor-pointer flex items-center gap-1 mx-auto">
                                        <CalendarCheck size={11} /> Book Now <ArrowRight size={10} />
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {upcomingBookings.slice(0, 3).map(b => (
                                        <div key={b.id} className="px-3 py-3 rounded-xl bg-blue-50 border border-blue-200/50">
                                            <div className="flex items-center justify-between mb-1">
                                                <p className="text-[11px] font-bold text-blue-800">{b.department}</p>
                                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${b.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                    {b.status === 'pending' ? '⏳ Pending' : '✓ Approved'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 text-[10px] text-blue-600">
                                                <span className="flex items-center gap-1"><CalendarDays size={10} /> {b.preferred_date}</span>
                                                <span className="flex items-center gap-1"><Clock size={10} /> {b.preferred_time}</span>
                                            </div>
                                            {b.doctor_name && <p className="text-[10px] text-blue-500 mt-0.5">Dr. {b.doctor_name}</p>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Activity Timeline */}
                        <div className="px-5 py-4">
                            <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-3">Health Timeline</p>
                            {timeline.length === 0 ? (
                                <p className="text-xs text-text-muted text-center py-4">No activity yet</p>
                            ) : (
                                <div className="relative">
                                    <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
                                    <div className="space-y-3">
                                        {timeline.slice(0, 8).map((item, i) => (
                                            <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                                                className="flex items-start gap-3 pl-1">
                                                <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 z-10" style={{ background: `${item.color}15` }}>
                                                    <item.icon size={12} style={{ color: item.color }} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[10px] font-semibold text-text-primary leading-tight">{item.title}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[9px] text-text-muted">{item.date}</span>
                                                        {item.status && (
                                                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${item.status === 'Severe' ? 'bg-red-100 text-red-700' : item.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{item.status}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── VISIT SUMMARY & TIPS (3 cols) ── */}
                <div className="col-span-3 flex flex-col gap-3">
                    {/* Visit Summary */}
                    <div className="bg-surface-card rounded-xl border border-border p-4 flex-1">
                        <h3 className="text-[10px] font-bold text-text-primary uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <BarChart3 size={12} className="text-amber-500" /> Visit Summary
                        </h3>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center p-2.5 rounded-lg bg-surface border border-border">
                                <span className="text-[11px] text-text-secondary">Total Visits</span>
                                <span className="text-sm font-bold text-text-primary">{appointments.total}</span>
                            </div>
                            <div className="flex justify-between items-center p-2.5 rounded-lg bg-emerald-50 border border-emerald-200/50">
                                <span className="text-[11px] text-emerald-700 flex items-center gap-1"><CheckCircle size={11} /> Attended</span>
                                <span className="text-sm font-bold text-emerald-600">{appointments.attended}</span>
                            </div>
                            <div className="flex justify-between items-center p-2.5 rounded-lg bg-red-50 border border-red-200/50">
                                <span className="text-[11px] text-red-700 flex items-center gap-1"><X size={11} /> Missed</span>
                                <span className="text-sm font-bold text-red-600">{appointments.missed}</span>
                            </div>
                            <div className="flex justify-between items-center p-2.5 rounded-lg bg-amber-50 border border-amber-200/50">
                                <span className="text-[11px] text-amber-700 flex items-center gap-1"><Clock size={11} /> Pending</span>
                                <span className="text-sm font-bold text-amber-600">{bookings.filter(b => b.status === 'pending').length}</span>
                            </div>
                        </div>
                    </div>

                    {/* Health Tips */}
                    <div className="bg-surface-card rounded-xl border border-border p-4">
                        <h3 className="text-[10px] font-bold text-text-primary uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <Sparkles size={12} className="text-amber-500" /> Care Reminders
                        </h3>
                        <div className="space-y-2">
                            {activePrescriptions.length > 0 && (
                                <div className="px-3 py-2 bg-emerald-50 rounded-lg border border-emerald-200/50">
                                    <p className="text-[10px] font-semibold text-emerald-800">💊 Take medications on time</p>
                                    <p className="text-[9px] text-emerald-600">You have {activePrescriptions.length} active prescription(s)</p>
                                </div>
                            )}
                            {upcomingBookings.length > 0 && (
                                <div className="px-3 py-2 bg-blue-50 rounded-lg border border-blue-200/50">
                                    <p className="text-[10px] font-semibold text-blue-800">📅 Appointment coming up</p>
                                    <p className="text-[9px] text-blue-600">{upcomingBookings[0].department} on {upcomingBookings[0].preferred_date}</p>
                                </div>
                            )}
                            <div className="px-3 py-2 bg-amber-50 rounded-lg border border-amber-200/50">
                                <p className="text-[10px] font-semibold text-amber-800">🥤 Stay hydrated</p>
                                <p className="text-[9px] text-amber-600">Drink at least 8 glasses of water daily</p>
                            </div>
                            <div className="px-3 py-2 bg-purple-50 rounded-lg border border-purple-200/50">
                                <p className="text-[10px] font-semibold text-purple-800">🏃 Keep active</p>
                                <p className="text-[9px] text-purple-600">30 mins of light exercise daily</p>
                            </div>
                            {appointments.missed > 0 && (
                                <div className="px-3 py-2 bg-red-50 rounded-lg border border-red-200/50">
                                    <p className="text-[10px] font-semibold text-red-700">⚠️ Don't miss appointments</p>
                                    <p className="text-[9px] text-red-600">You've missed {appointments.missed} appointment(s)</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ FEEDBACK PANEL ═══ */}
            <AnimatePresence>
                {showFeedbackPanel && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center" onClick={() => setShowFeedbackPanel(false)}>
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            onClick={e => e.stopPropagation()} className="w-[440px] bg-surface-card rounded-2xl border border-border shadow-2xl overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                                <h2 className="text-sm font-bold text-text-primary flex items-center gap-2"><MessageSquare size={16} className="text-amber-500" /> Rate Your Experience</h2>
                                <button onClick={() => setShowFeedbackPanel(false)} className="cursor-pointer w-8 h-8 rounded-lg hover:bg-surface flex items-center justify-center"><X size={16} className="text-text-muted" /></button>
                            </div>

                            {feedbackSuccess ? (
                                <div className="p-10 text-center">
                                    <CheckCircle size={48} className="text-emerald-500 mx-auto mb-3" />
                                    <p className="text-sm font-bold text-emerald-700">{feedbackSuccess}</p>
                                </div>
                            ) : (
                                <form onSubmit={submitFeedback} className="p-5 space-y-4">
                                    {/* Star Rating */}
                                    <div className="text-center">
                                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-3">How was your experience?</p>
                                        <div className="flex items-center justify-center gap-2">
                                            {[1, 2, 3, 4, 5].map(s => (
                                                <button key={s} type="button" onClick={() => setFeedbackRating(s)} className="cursor-pointer transition-transform hover:scale-110">
                                                    <Star size={32} className={`transition-colors ${s <= feedbackRating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-text-muted mt-1">
                                            {feedbackRating === 0 ? 'Tap to rate' : ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][feedbackRating]}
                                        </p>
                                    </div>

                                    {/* Department */}
                                    <div>
                                        <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">Department</label>
                                        <input value={user.department || 'General'} readOnly className="w-full px-3 py-2.5 text-xs bg-surface border border-border rounded-xl focus:outline-none" />
                                    </div>

                                    {/* Feedback Text */}
                                    <div>
                                        <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">Your Feedback</label>
                                        <textarea value={feedbackText} onChange={e => setFeedbackText(e.target.value)} rows={4}
                                            placeholder="Tell us about your experience..." required
                                            className="w-full px-3 py-2.5 text-xs bg-surface border border-border rounded-xl focus:outline-none resize-none" />
                                    </div>

                                    <button type="submit" disabled={!feedbackRating || !feedbackText.trim()}
                                        className="w-full py-3 text-xs font-semibold bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                                        <Send size={14} /> Submit Feedback
                                    </button>
                                </form>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Simple fallback component for missing vitals
function ScanVitals() {
    return (
        <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center mx-auto mb-2">
            <Activity size={18} className="text-text-muted/20" />
        </div>
    );
}
