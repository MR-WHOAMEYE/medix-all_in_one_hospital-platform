import { useState, useEffect, useMemo } from 'react';
import { Activity, CheckCircle, Clock, ShieldCheck, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Area, AreaChart, ReferenceDot } from 'recharts';
import { getDashboardSummary, getDeptWorkload, getWeeklyTrend } from '../services/api';
import KPICard from '../components/KPICard';
import ChartCard from '../components/ChartCard';
import LoadingSpinner from '../components/LoadingSpinner';
import ExecutiveBanner from './Dashboard/ExecutiveBanner';
import QRScanner from '../components/QRScanner';

import HealthGauge from './Dashboard/HealthGauge';
import AIInsightPanel from './Dashboard/AIInsightPanel';
import AlertPreviewPanel from './Dashboard/AlertPreviewPanel';
import QuickActionsBar from './Dashboard/QuickActionsBar';

const COLORS = ['#0F766E', '#0284C7', '#10B981', '#D97706', '#DC2626', '#7C3AED'];
const SPACING = 'gap-4 mb-4';

export default function Dashboard() {
    const [summary, setSummary] = useState(null);
    const [deptWork, setDeptWork] = useState([]);
    const [weeklyData, setWeeklyData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([getDashboardSummary(), getDeptWorkload(), getWeeklyTrend()])
            .then(([s, d, w]) => { setSummary(s); setDeptWork(d); setWeeklyData(w); })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const enhancedDeptWork = useMemo(() => {
        if (!deptWork.length) return [];
        const maxCases = Math.max(...deptWork.map(d => d.total_cases));
        return deptWork.map(d => ({
            ...d,
            utilization: d.total_cases > 0 ? Math.round((d.active_cases / d.total_cases) * 100) : 0,
            isHighest: d.total_cases === maxCases,
        }));
    }, [deptWork]);

    const enhancedWeekly = useMemo(() => {
        if (!weeklyData.length) return [];
        const data = weeklyData.map(w => ({ ...w }));
        const avg = data.reduce((sum, d) => sum + d.cases, 0) / data.length;
        data.forEach(d => { d.isAnomaly = d.cases > avg * 1.3; });
        if (data.length >= 2) {
            const lastTwo = data.slice(-2);
            const trend = lastTwo[1].cases - lastTwo[0].cases;
            const lastWeek = parseInt(data[data.length - 1].week?.replace('W', '') || '0');
            for (let i = 1; i <= 2; i++) {
                data.push({
                    week: `W${lastWeek + i}`,
                    cases: null,
                    forecast: Math.max(0, Math.round(lastTwo[1].cases + trend * i * 0.6)),
                    isForecast: true,
                });
            }
            data[data.length - 3].forecast = data[data.length - 3].cases;
        }
        return data;
    }, [weeklyData]);

    if (loading) return <LoadingSpinner />;

    const highestDept = enhancedDeptWork.find(d => d.isHighest);

    const CustomBar = (props) => {
        const { x, y, width, height, payload } = props;
        return (
            <rect x={x} y={y} width={width} height={height} rx={4} ry={4}
                fill={payload?.isHighest ? '#DC2626' : props.fill} opacity={payload?.isHighest ? 0.85 : 0.75}
            />
        );
    };

    const DeptTooltip = ({ active, payload, label }) => {
        if (!active || !payload?.length) return null;
        const data = payload[0]?.payload;
        return (
            <div style={{ background: 'rgba(255,255,255,0.95)', borderRadius: '8px', border: '1px solid #E5E7EB', padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '11px' }}>
                <p style={{ fontWeight: 700, color: '#134E4A', marginBottom: '4px' }}>{label}</p>
                {payload.map((p, i) => <p key={i} style={{ color: p.color }}>{p.name}: <b>{p.value}</b></p>)}
                {data?.utilization !== undefined && (
                    <p style={{ color: '#94A3B8', marginTop: '3px', borderTop: '1px solid #F1F5F9', paddingTop: '3px', fontSize: '10px' }}>
                        Utilization: <b style={{ color: data.utilization > 70 ? '#EF4444' : '#10B981' }}>{data.utilization}%</b>
                    </p>
                )}
            </div>
        );
    };

    const WeeklyTooltip = ({ active, payload }) => {
        if (!active || !payload?.length) return null;
        const data = payload[0]?.payload;
        return (
            <div style={{ background: 'rgba(255,255,255,0.95)', borderRadius: '8px', border: '1px solid #E5E7EB', padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '11px' }}>
                <p style={{ fontWeight: 700, color: '#134E4A', marginBottom: '3px' }}>{data?.week}</p>
                {data?.cases != null && <p style={{ color: '#0F766E' }}>Cases: <b>{data.cases}</b></p>}
                {data?.forecast != null && data?.isForecast && <p style={{ color: '#8B5CF6' }}>Forecast: <b>{data.forecast}</b></p>}
                {data?.isAnomaly && <p style={{ color: '#EF4444', marginTop: '3px', fontSize: '10px' }}>⚠ Anomaly detected</p>}
            </div>
        );
    };

    return (
        <div>
            {/* Row 1 — Executive Intelligence Header */}
            <ExecutiveBanner summary={summary} />

            {/* QR Scanner */}
            <div className="flex justify-end mb-4">
                <QRScanner onScanSuccess={(data) => {
                    alert(`Patient Scanned:\n${data.name}\n${data.email}\n${data.department || 'N/A'}`);
                }} />
            </div>

            {/* Row 3 — Primary KPIs: 4 Equal Columns */}
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 ${SPACING}`}>
                <HealthGauge value={summary?.health_index || 0} />
                <KPICard title="SLA Compliance" value={summary?.sla_compliance_pct} unit="%" icon={ShieldCheck} color="secondary" trend={summary?.trends?.sla_trend} delay={1} />
                <KPICard title="Burnout Risk" value={summary?.burnout_risk_pct} unit="%" icon={AlertTriangle} color="warning" trend={summary?.trends?.burnout_trend} delay={2} />
                <KPICard title="Active Cases" value={summary?.active_cases} icon={Activity} color="primary" trend={summary?.trends?.cases_trend} delay={3} />
            </div>

            {/* Row 4 — Secondary KPIs: 3 Equal Columns */}
            <div className={`grid grid-cols-1 md:grid-cols-3 ${SPACING}`}>
                <KPICard title="Avg Resolution" value={summary?.avg_resolution_time_hrs} unit="hrs" icon={Clock} color="accent" delay={4} />
                <KPICard title="Resolved Cases" value={summary?.resolved_cases} icon={CheckCircle} color="green" delay={5} />
                <KPICard title="Resolution Rate" value={summary?.total_cases ? `${((summary.resolved_cases / summary.total_cases) * 100).toFixed(1)}` : '0'} unit="%" icon={CheckCircle} color="teal" delay={6} />
            </div>

            {/* Row 5 — AI Summary (8 cols) + Quick Actions (4 cols) */}
            <div className={`grid grid-cols-1 lg:grid-cols-12 ${SPACING}`}>
                <div className="lg:col-span-8">
                    <AIInsightPanel summary={summary} />
                </div>
                <div className="lg:col-span-4">
                    <QuickActionsBar />
                </div>
            </div>

            {/* Row 6A — Department Workload + Weekly Trend */}
            <div className={`grid grid-cols-1 lg:grid-cols-2 ${SPACING}`}>
                <ChartCard
                    title="Department Workload"
                    subtitle={highestDept ? `Highest: ${highestDept.department} (${highestDept.total_cases} cases)` : 'Active vs total by department'}
                    delay={1}
                >
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={enhancedDeptWork} barGap={3}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                            <XAxis dataKey="department" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                            <Tooltip content={<DeptTooltip />} />
                            <Bar dataKey="total_cases" fill="#0F766E" radius={[4, 4, 0, 0]} name="Total" shape={<CustomBar />} />
                            <Bar dataKey="active_cases" fill="#0EA5E9" radius={[4, 4, 0, 0]} name="Active" opacity={0.7} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Weekly Case Trend" subtitle="Case volume with forecast projection" delay={2}>
                    <ResponsiveContainer width="100%" height={260}>
                        <AreaChart data={enhancedWeekly}>
                            <defs>
                                <linearGradient id="caseGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#0F766E" stopOpacity={0.08} />
                                    <stop offset="95%" stopColor="#0F766E" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                            <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                            <Tooltip content={<WeeklyTooltip />} />
                            <Area type="monotone" dataKey="cases" stroke="#0F766E" strokeWidth={2} fill="url(#caseGrad)" dot={false} connectNulls={false} />
                            {weeklyData.length > 0 && (
                                <ReferenceDot x={weeklyData[weeklyData.length - 1]?.week} y={weeklyData[weeklyData.length - 1]?.cases} r={4} fill="#0F766E" stroke="white" strokeWidth={2} />
                            )}
                            <Line type="monotone" dataKey="forecast" stroke="#8B5CF6" strokeWidth={1.5} strokeDasharray="5 3" dot={false} connectNulls />
                            {enhancedWeekly.filter(d => d.isAnomaly).map((d, i) => (
                                <ReferenceDot key={i} x={d.week} y={d.cases} r={5} fill="#EF4444" stroke="white" strokeWidth={2} />
                            ))}
                        </AreaChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            {/* Row 6B — Case Distribution + Critical Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div
                    className="bg-white rounded-xl border border-gray-100"
                    style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)', padding: 0, overflow: 'hidden' }}
                >
                    {/* Header */}
                    <div style={{ padding: '20px 24px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: 0, fontFamily: 'var(--font-family-display)' }}>
                                    Cases by Department
                                </h3>
                                <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 3, margin: '3px 0 0' }}>Distribution of total cases</p>
                            </div>
                            <div style={{
                                padding: '4px 10px', borderRadius: 6,
                                background: '#F0FDFA', border: '1px solid #CCFBF1',
                                fontSize: 11, fontWeight: 600, color: '#0F766E',
                            }}>
                                {deptWork.length} Depts
                            </div>
                        </div>
                    </div>

                    {/* Chart + Legend Side by Side */}
                    <div style={{ display: 'flex', alignItems: 'center', padding: '16px 24px 24px', gap: 16 }}>
                        {/* Donut Chart with Center Stat */}
                        <div style={{ position: 'relative', flexShrink: 0, width: 200, height: 200 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={deptWork}
                                        dataKey="total_cases"
                                        nameKey="department"
                                        cx="50%" cy="50%"
                                        outerRadius={90}
                                        innerRadius={58}
                                        paddingAngle={2}
                                        stroke="rgba(255,255,255,0.8)"
                                        strokeWidth={2}
                                    >
                                        {deptWork.map((_, i) => (
                                            <Cell
                                                key={i}
                                                fill={COLORS[i % COLORS.length]}
                                                style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' }}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            borderRadius: 10, border: '1px solid #E2E8F0',
                                            fontSize: 11, boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                                            padding: '8px 12px',
                                        }}
                                        formatter={(value, name) => [`${value} cases`, name]}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            {/* Center KPI */}
                            <div style={{
                                position: 'absolute', top: '50%', left: '50%',
                                transform: 'translate(-50%, -50%)',
                                textAlign: 'center', pointerEvents: 'none',
                            }}>
                                <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', lineHeight: 1.1, fontFamily: 'var(--font-family-display)' }}>
                                    {deptWork.reduce((sum, d) => sum + d.total_cases, 0).toLocaleString()}
                                </div>
                                <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 500, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Total
                                </div>
                            </div>
                        </div>

                        {/* Legend with Stats */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {(() => {
                                const total = deptWork.reduce((sum, d) => sum + d.total_cases, 0);
                                const maxDept = Math.max(...deptWork.map(d => d.total_cases));
                                return deptWork.map((d, i) => {
                                    const pct = total > 0 ? ((d.total_cases / total) * 100).toFixed(1) : 0;
                                    const barWidth = maxDept > 0 ? ((d.total_cases / maxDept) * 100).toFixed(0) : 0;
                                    return (
                                        <div
                                            key={d.department}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 10,
                                                padding: '6px 10px', borderRadius: 8,
                                                transition: 'background 0.15s ease',
                                                cursor: 'default',
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.background = '#F8FAFC'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            <div style={{
                                                width: 10, height: 10, borderRadius: 3,
                                                background: COLORS[i % COLORS.length],
                                                flexShrink: 0,
                                                boxShadow: `0 1px 3px ${COLORS[i % COLORS.length]}40`,
                                            }} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                                                    <span style={{ fontSize: 12, fontWeight: 500, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {d.department}
                                                    </span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                                        <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{d.total_cases}</span>
                                                        <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 500 }}>{pct}%</span>
                                                    </div>
                                                </div>
                                                <div style={{ width: '100%', height: 3, borderRadius: 2, background: '#F1F5F9', overflow: 'hidden' }}>
                                                    <div style={{
                                                        width: `${barWidth}%`, height: '100%', borderRadius: 2,
                                                        background: COLORS[i % COLORS.length],
                                                        transition: 'width 0.6s ease',
                                                        opacity: 0.7,
                                                    }} />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    </div>
                </div>

                <AlertPreviewPanel summary={summary} deptWork={deptWork} />
            </div>
        </div>
    );
}
