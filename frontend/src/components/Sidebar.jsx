import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    // Admin
    Activity, ClipboardList, Brain, Microscope, Target, FileText, Settings, Users,
    // Doctor
    Stethoscope, CalendarDays,
    // Nurse
    Heart, UserPlus,
    // Patient
    CalendarCheck, User,
    // AI Response Suggestions
    MessageSquareText, Sparkles,
    // Workflow
    GitBranch,
    // CDSS
    ShieldCheck,
    // Shared
    LogOut
} from 'lucide-react';

const allNavItems = [
    // ═══ ADMIN ═══
    { path: '/', icon: Activity, label: 'Dashboard', color: '#14B8A6', roles: ['admin'] },
    { path: '/operations', icon: ClipboardList, label: 'Operations', color: '#0EA5E9', roles: ['admin'] },
    { path: '/intelligence', icon: Brain, label: 'Intelligence', color: '#A78BFA', roles: ['admin'] },
    { path: '/simulation', icon: Microscope, label: 'Simulation', color: '#F59E0B', roles: ['admin'] },
    { path: '/strategy', icon: Target, label: 'Strategy', color: '#EC4899', roles: ['admin'] },
    { path: '/reports', icon: FileText, label: 'Reports', color: '#10B981', roles: ['admin'] },
    { path: '/settings', icon: Settings, label: 'Settings', color: '#6B7280', roles: ['admin'] },
    { path: '/admin/users', icon: Users, label: 'Users', color: '#F97316', roles: ['admin'] },

    // ═══ DOCTOR ═══
    { path: '/', icon: Stethoscope, label: 'Dashboard', color: '#3B82F6', roles: ['doctor'] },
    { path: '/patient-management', icon: Users, label: 'Patients', color: '#8B5CF6', roles: ['doctor'] },
    { path: '/appointment-management', icon: CalendarDays, label: 'Appts', color: '#F59E0B', roles: ['doctor'] },
    { path: '/reports', icon: FileText, label: 'Reports', color: '#10B981', roles: ['doctor'] },

    // ═══ NURSE ═══
    { path: '/', icon: Heart, label: 'Dashboard', color: '#10B981', roles: ['nurse'] },
    { path: '/patient-vitals', icon: Activity, label: 'Vitals', color: '#EF4444', roles: ['nurse'] },
    { path: '/register-patient', icon: UserPlus, label: 'Register', color: '#3B82F6', roles: ['nurse'] },
    { path: '/reports', icon: FileText, label: 'Reports', color: '#10B981', roles: ['nurse'] },

    // ═══ PATIENT ═══
    { path: '/', icon: Heart, label: 'My Health', color: '#F59E0B', roles: ['patient'] },
    { path: '/book-appointment', icon: CalendarCheck, label: 'Book', color: '#3B82F6', roles: ['patient'] },
    { path: '/patient-queries', icon: MessageSquareText, label: 'Queries', color: '#14B8A6', roles: ['patient'] },
    { path: '/profile', icon: User, label: 'Profile', color: '#8B5CF6', roles: ['patient'] },
    { path: '/reports', icon: FileText, label: 'Reports', color: '#10B981', roles: ['patient'] },

    // ═══ AI RESPONSE SUGGESTIONS (Staff) ═══
    { path: '/response-suggestions', icon: Sparkles, label: 'AI Resp', color: '#8B5CF6', roles: ['admin', 'doctor', 'nurse'] },

    // ═══ WORKFLOW AUTOMATION (Staff) ═══
    { path: '/workflow', icon: GitBranch, label: 'Workflow', color: '#14B8A6', roles: ['admin', 'doctor', 'nurse'] },

    // ═══ CLINICAL DECISION SUPPORT (Staff) ═══
    { path: '/cdss', icon: ShieldCheck, label: 'CDSS', color: '#EF4444', roles: ['admin', 'doctor', 'nurse'] },
];

export default function Sidebar({ user, onLogout }) {
    const location = useLocation();
    const role = user?.role || 'patient';
    const navItems = allNavItems.filter(item => item.roles.includes(role));

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-[100] px-4 pb-4 pointer-events-none">
            <motion.div
                initial={{ y: 60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="pointer-events-auto mx-auto max-w-2xl rounded-3xl px-3 py-2.5
                    flex items-center justify-between relative overflow-hidden"
                style={{
                    background: 'linear-gradient(135deg, rgba(4,47,46,0.92) 0%, rgba(10,61,60,0.95) 50%, rgba(13,79,77,0.92) 100%)',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 8px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.06)',
                }}
            >
                {/* Subtle top shine */}
                <div className="absolute top-0 left-[10%] right-[10%] h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent" />

                {navItems.map((item, idx) => {
                    const isActive = item.path === '/'
                        ? location.pathname === '/'
                        : location.pathname.startsWith(item.path);

                    return (
                        <NavLink
                            key={item.path + item.label + idx}
                            to={item.path}
                            end={item.path === '/'}
                            className="relative flex flex-col items-center justify-center flex-1 py-1.5 cursor-pointer group"
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="nav-pill"
                                    className="absolute inset-0.5 rounded-2xl"
                                    style={{
                                        background: `radial-gradient(ellipse at center, ${item.color}15 0%, transparent 70%)`,
                                        boxShadow: `inset 0 0 20px ${item.color}08`,
                                    }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                                />
                            )}

                            {isActive && (
                                <motion.div
                                    layoutId="nav-dot"
                                    className="absolute -top-0.5 w-6 h-[3px] rounded-full"
                                    style={{
                                        background: `linear-gradient(90deg, transparent, ${item.color}, transparent)`,
                                        boxShadow: `0 0 8px ${item.color}60`,
                                    }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                                />
                            )}

                            <motion.div
                                animate={isActive ? { y: -1, scale: 1.1 } : { y: 0, scale: 1 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                            >
                                <item.icon size={20}
                                    className="relative z-10 transition-colors duration-300"
                                    style={{ color: isActive ? item.color : 'rgba(255,255,255,0.3)' }}
                                />
                            </motion.div>

                            <motion.span
                                animate={isActive ? { opacity: 1 } : { opacity: 0.35 }}
                                transition={{ duration: 0.25 }}
                                className="relative z-10 text-[9px] mt-0.5 font-semibold tracking-tight"
                                style={{ color: isActive ? item.color : 'rgba(255,255,255,0.25)' }}
                            >
                                {item.label}
                            </motion.span>

                            {!isActive && (
                                <div className="absolute inset-1 rounded-2xl bg-white/0 group-hover:bg-white/5 transition-colors duration-200" />
                            )}
                        </NavLink>
                    );
                })}

                {/* Logout */}
                <button onClick={onLogout}
                    className="relative flex flex-col items-center justify-center flex-shrink-0 px-2.5 py-1.5 cursor-pointer group"
                    title={`Logout (${user?.name || 'User'})`}>
                    <LogOut size={18}
                        className="relative z-10 text-white/25 group-hover:text-rose-400 transition-colors duration-300" />
                    <span className="relative z-10 text-[9px] mt-0.5 font-semibold tracking-tight text-white/20 group-hover:text-rose-400 transition-colors">
                        Logout
                    </span>
                </button>
            </motion.div>
        </nav>
    );
}
