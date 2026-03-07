import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ═══════════════════════════════════════════════════════════
//  ZERO INTERCEPT — PREMIUM PDF REPORT DESIGN SYSTEM
// ═══════════════════════════════════════════════════════════

const C = {
    // Core palette
    teal:     [15, 118, 110],
    tealDk:   [4,  47,  46],
    tealLt:   [204, 251, 241],
    navy:     [15, 23,  42],
    slate:    [51, 65,  85],
    gray:     [100, 116, 139],
    grayLt:   [148, 163, 184],
    white:    [255, 255, 255],
    snow:     [248, 250, 252],
    cream:    [241, 245, 249],
    // Accents
    red:      [239, 68, 68],
    redLt:    [254, 226, 226],
    amber:    [245, 158, 11],
    amberLt:  [254, 243, 199],
    emerald:  [16, 185, 129],
    emeraldLt:[209, 250, 229],
    blue:     [59, 130, 246],
    blueLt:   [219, 234, 254],
    violet:   [139, 92, 246],
    violetLt: [237, 233, 254],
};

const PW = 210; // A4 width
const M = 14;   // margin
const CW = PW - M * 2; // content width

// ──────────────────────────────────────────────
//  DRAWING PRIMITIVES
// ──────────────────────────────────────────────

function drawCrosshairLogo(doc, x, y, size) {
    const s = size;
    doc.setDrawColor(...C.white);
    doc.setLineWidth(0.6);
    // Outer ring
    doc.circle(x, y, s, 'S');
    // Cross
    doc.line(x - s * 0.6, y, x + s * 0.6, y);
    doc.line(x, y - s * 0.6, x, y + s * 0.6);
    // Inner dot
    doc.setFillColor(...C.white);
    doc.circle(x, y, s * 0.15, 'F');
}

function drawProgressBar(doc, x, y, w, h, pct, fgColor, bgColor = C.cream) {
    doc.setFillColor(...bgColor);
    doc.roundedRect(x, y, w, h, h / 2, h / 2, 'F');
    if (pct > 0) {
        doc.setFillColor(...fgColor);
        doc.roundedRect(x, y, Math.max(h, w * (pct / 100)), h, h / 2, h / 2, 'F');
    }
}

function drawMetricCard(doc, x, y, w, h, { label, value, sub, barPct, barColor, accent }) {
    // Card bg
    doc.setFillColor(...C.white);
    doc.roundedRect(x, y, w, h, 2, 2, 'F');
    // Left accent strip
    doc.setFillColor(...(accent || C.teal));
    doc.roundedRect(x, y + 3, 1.2, h - 6, 0.6, 0.6, 'F');
    // Label
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.gray);
    doc.text(label.toUpperCase(), x + 5, y + 6);
    // Value
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.navy);
    doc.text(String(value), x + 5, y + 14);
    // Sub text
    if (sub) {
        doc.setFontSize(5.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C.grayLt);
        doc.text(sub, x + 5, y + 18);
    }
    // Progress bar
    if (barPct !== undefined) {
        drawProgressBar(doc, x + 5, y + h - 5, w - 10, 2.5, barPct, barColor || C.teal);
    }
}

function drawBadge(doc, x, y, text, fg, bg) {
    doc.setFontSize(5.5);
    const tw = doc.getTextWidth(text) + 4;
    doc.setFillColor(...bg);
    doc.roundedRect(x, y - 3, tw, 5, 2.5, 2.5, 'F');
    doc.setTextColor(...fg);
    doc.setFont('helvetica', 'bold');
    doc.text(text, x + 2, y);
}

// ──────────────────────────────────────────────
//  PREMIUM HEADER
// ──────────────────────────────────────────────

function drawHeader(doc, { title, subtitle, role, accentColor = C.teal }) {
    const hH = 44;
    // Dark background
    doc.setFillColor(...C.tealDk);
    doc.rect(0, 0, PW, hH, 'F');
    // Accent gradient band at bottom
    doc.setFillColor(...accentColor);
    doc.rect(0, hH - 3, PW, 3, 'F');
    // Decorative geometric elements
    doc.setFillColor(20, 60, 58);
    doc.triangle(PW - 80, 0, PW, 0, PW, hH, 'F');
    doc.setFillColor(25, 75, 72);
    doc.triangle(PW - 50, 0, PW, 0, PW, hH * 0.6, 'F');
    doc.setFillColor(10, 56, 53);
    doc.rect(0, hH - 12, 4, 12, 'F');
    // Crosshair logo
    drawCrosshairLogo(doc, 24, hH / 2, 7);
    // Hospital name
    doc.setTextColor(...C.white);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('ZERO INTERCEPT', 36, 16);
    // Subtitle: Healthcare System
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(153, 246, 228);
    doc.text('HEALTHCARE INTELLIGENCE SYSTEM', 36, 22);
    // Report title
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.white);
    doc.text(title, 36, 32);
    // Role badge
    if (role) {
        drawBadge(doc, 36, 38, role.toUpperCase(), C.tealDk, [153, 246, 228]);
    }
    // Right info block
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(153, 246, 228);
    doc.text(new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), PW - M, 14, { align: 'right' });
    doc.setFontSize(6);
    doc.setTextColor(153, 246, 228, 0.5);
    doc.text(`Generated ${new Date().toLocaleTimeString()}`, PW - M, 20, { align: 'right' });
    if (subtitle) {
        doc.setFontSize(7.5);
        doc.setTextColor(...C.white);
        doc.text(subtitle, PW - M, 32, { align: 'right' });
    }
    // Report ID
    const rid = `RPT-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    doc.setFontSize(5.5);
    doc.setTextColor(153, 246, 228);
    doc.text(`Report ID: ${rid}`, PW - M, 38, { align: 'right' });

    return hH + 6;
}

// ──────────────────────────────────────────────
//  SECTION HEADERS
// ──────────────────────────────────────────────

function drawSection(doc, y, title, { accent = C.teal, count } = {}) {
    // Accent dot
    doc.setFillColor(...accent);
    doc.circle(M + 2, y + 3, 1.5, 'F');
    // Title
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.navy);
    doc.text(title, M + 7, y + 4.5);
    // Count badge
    if (count !== undefined) {
        const tx = M + 7 + doc.getTextWidth(title) + 3;
        drawBadge(doc, tx, y + 4.5, String(count), C.white, accent);
    }
    // Underline
    doc.setDrawColor(...C.cream);
    doc.setLineWidth(0.4);
    doc.line(M, y + 8, PW - M, y + 8);
    return y + 12;
}

// ──────────────────────────────────────────────
//  PREMIUM TABLE STYLE
// ──────────────────────────────────────────────

function styledTable(doc, y, { head, body, headColor = C.teal }) {
    const result = autoTable(doc, {
        startY: y,
        head: [head],
        body,
        theme: 'plain',
        margin: { left: M, right: M },
        styles: {
            fontSize: 7.5,
            cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
            lineColor: C.cream,
            lineWidth: 0.3,
            textColor: C.slate,
        },
        headStyles: {
            fillColor: headColor,
            textColor: C.white,
            fontStyle: 'bold',
            fontSize: 7,
            cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
        },
        alternateRowStyles: { fillColor: C.snow },
        columnStyles: { 0: { fontStyle: 'bold' } },
        didDrawPage: () => {},
    });
    return (result?.finalY ?? doc.lastAutoTable?.finalY ?? y + 20) + 6;
}

function infoTable(doc, y, rows) {
    const result = autoTable(doc, {
        startY: y,
        body: rows,
        theme: 'plain',
        margin: { left: M + 2, right: M },
        styles: {
            fontSize: 8,
            cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
            textColor: C.slate,
        },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 50, textColor: C.gray, fontSize: 7 },
            1: { textColor: C.navy },
        },
    });
    return (result?.finalY ?? doc.lastAutoTable?.finalY ?? y + 16) + 4;
}

// ──────────────────────────────────────────────
//  FOOTER
// ──────────────────────────────────────────────

function drawFooter(doc) {
    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        const fY = 284;
        // Line
        doc.setDrawColor(...C.cream);
        doc.setLineWidth(0.3);
        doc.line(M, fY, PW - M, fY);
        // Left: confidential
        doc.setFontSize(5.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C.grayLt);
        doc.text('CONFIDENTIAL — Zero Intercept Healthcare Intelligence System', M, fY + 4);
        // Center: dot separator
        doc.setFillColor(...C.teal);
        doc.circle(PW / 2, fY + 3.5, 0.8, 'F');
        // Right: page
        doc.text(`${i} / ${pages}`, PW - M, fY + 4, { align: 'right' });
    }
}

// ── Page-break aware Y tracker ──
function checkPage(doc, y, needed = 40) {
    if (y + needed > 275) {
        doc.addPage();
        return 16;
    }
    return y;
}

// ══════════════════════════════════════════════════════════════
//  DOCTOR REPORT
// ══════════════════════════════════════════════════════════════

export function exportDoctorPDF({ user, metrics, myPatients, perf, selectedPatient, diagnoses, prescriptions }) {
    const doc = new jsPDF();
    let y = drawHeader(doc, {
        title: 'Clinical Command Report',
        subtitle: `Dr. ${user.name || 'Doctor'}`,
        role: `${user.department || 'General'} Department`,
    });

    // ── METRIC CARDS ROW ──
    const cards = [
        { label: 'Active Cases',   value: metrics.total,     sub: 'Total patients', barPct: metrics.workload, barColor: C.teal, accent: C.teal },
        { label: 'High Risk',      value: metrics.highRisk,  sub: 'Critical watch',  barPct: metrics.total ? (metrics.highRisk / metrics.total * 100) : 0, barColor: C.red, accent: C.red },
        { label: 'SLA at Risk',    value: metrics.slaRisk,   sub: 'Breaching soon',  barPct: metrics.total ? (metrics.slaRisk / metrics.total * 100) : 0, barColor: C.amber, accent: C.amber },
        { label: 'Avg TTT',        value: `${metrics.avgTTT}h`, sub: 'Time to treat', accent: C.blue },
        { label: 'Critical Today', value: metrics.critical,  sub: 'Immediate action', accent: C.red },
        { label: 'Workload',       value: `${metrics.workload}%`, sub: 'Capacity used', barPct: metrics.workload, barColor: C.violet, accent: C.violet },
    ];
    const cW = (CW - 10) / 3;
    cards.forEach((c, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        drawMetricCard(doc, M + col * (cW + 5), y + row * 26, cW, 23, c);
    });
    y += 56;

    // ── PERFORMANCE ──
    y = drawSection(doc, y, 'Performance Summary');
    const perfItems = [
        { label: 'SLA Compliance', val: `${perf.sla}%`, pct: perf.sla, color: perf.sla >= 80 ? C.emerald : C.amber },
        { label: 'Avg Resolution', val: `${perf.res} hrs`, pct: Math.min(100, perf.res * 3), color: C.blue },
        { label: 'Readmission', val: `${perf.readmit}%`, pct: perf.readmit * 3, color: C.violet },
        { label: 'Escalations', val: String(perf.esc), pct: perf.esc * 10, color: C.red },
    ];
    const pW = (CW - 9) / 2;
    perfItems.forEach((p, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const px = M + col * (pW + 9);
        const py = y + row * 14;
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...C.gray);
        doc.text(p.label.toUpperCase(), px, py + 3);
        doc.setFontSize(9);
        doc.setTextColor(...C.navy);
        doc.text(p.val, px + pW - 2, py + 3, { align: 'right' });
        drawProgressBar(doc, px, py + 5.5, pW, 2.5, p.pct, p.color);
    });
    y += 34;

    // ── PATIENT ROSTER ──
    if (myPatients.length > 0) {
        y = checkPage(doc, y, 50);
        y = drawSection(doc, y, 'Patient Roster', { count: myPatients.length });
        y = styledTable(doc, y, {
            head: ['PID', 'Patient Name', 'Age/Sex', 'Dept', 'Severity', 'Deterioration', 'SLA Risk', 'Ward'],
            body: myPatients.map(p => [
                p._pid || '—', p.name || '—',
                `${p._age || '—'}/${p._gender?.charAt(0) || '—'}`,
                p.department || '—', String(p._sev),
                `${p._det}%`, `${p._sla}%`, p._ward || '—',
            ]),
        });
    }

    // ── SELECTED PATIENT ──
    if (selectedPatient) {
        y = checkPage(doc, y, 60);
        y = drawSection(doc, y, `Patient Detail — ${selectedPatient.name}`, { accent: C.violet });

        // Patient info cards
        doc.setFillColor(...C.snow);
        doc.roundedRect(M, y, CW, 28, 2, 2, 'F');
        const fields = [
            ['ID', selectedPatient._pid], ['Case', selectedPatient._cid],
            ['Age', `${selectedPatient._age} yrs`], ['Gender', selectedPatient._gender],
            ['Blood', selectedPatient._blood], ['Ward/Bed', `${selectedPatient._ward} / ${selectedPatient._bed}`],
            ['Severity', String(selectedPatient._sev)], ['Complexity', String(selectedPatient._complex)],
        ];
        const fW = CW / 4;
        fields.forEach((f, i) => {
            const col = i % 4;
            const row = Math.floor(i / 4);
            const fx = M + 4 + col * fW;
            const fy = y + 4 + row * 13;
            doc.setFontSize(5.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...C.grayLt);
            doc.text(f[0].toUpperCase(), fx, fy);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...C.navy);
            doc.text(String(f[1] || '—'), fx, fy + 5);
        });
        y += 32;

        // Allergies warning
        if (selectedPatient._allergies?.length > 0) {
            doc.setFillColor(...C.redLt);
            doc.roundedRect(M, y, CW, 8, 1.5, 1.5, 'F');
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...C.red);
            doc.text(`ALLERGIES:  ${selectedPatient._allergies.join('  |  ')}`, M + 4, y + 5.2);
            y += 11;
        }
        // Chronic
        if (selectedPatient._chronic?.length > 0) {
            doc.setFillColor(...C.amberLt);
            doc.roundedRect(M, y, CW, 8, 1.5, 1.5, 'F');
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...C.amber);
            doc.text(`CHRONIC:  ${selectedPatient._chronic.join('  |  ')}`, M + 4, y + 5.2);
            y += 11;
        }

        // Diagnoses
        if (diagnoses?.length > 0) {
            y = checkPage(doc, y, 30);
            y = drawSection(doc, y, 'Diagnoses', { accent: C.violet, count: diagnoses.length });
            y = styledTable(doc, y, {
                head: ['Condition', 'Severity', 'Notes'],
                body: diagnoses.map(d => [d.condition, d.severity, d.notes || '—']),
                headColor: C.violet,
            });
        }

        // Prescriptions
        if (prescriptions?.length > 0) {
            y = checkPage(doc, y, 30);
            y = drawSection(doc, y, 'Prescriptions', { accent: C.emerald, count: prescriptions.length });
            y = styledTable(doc, y, {
                head: ['Medication', 'Dosage', 'Frequency', 'Duration', 'Status'],
                body: prescriptions.map(r => [r.medication, r.dosage, r.frequency, r.duration, r.status || 'active']),
                headColor: C.emerald,
            });
        }
    }

    drawFooter(doc);
    doc.save(`ZI_Doctor_Report_${(user.name || 'doctor').replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ══════════════════════════════════════════════════════════════
//  PATIENT REPORT
// ══════════════════════════════════════════════════════════════

export function exportPatientPDF({ user, healthScore, appointments, prescriptions, diagnoses, bookings, vitals }) {
    const doc = new jsPDF();
    let y = drawHeader(doc, {
        title: 'Personal Health Report',
        subtitle: user.name || 'Patient',
        role: `${user.department || 'General'} Department`,
        accentColor: C.amber,
    });

    // ── HEALTH SCORE HERO ──
    const scoreColor = healthScore >= 80 ? C.emerald : healthScore >= 60 ? C.amber : C.red;
    const scoreLabel = healthScore >= 80 ? 'Excellent' : healthScore >= 60 ? 'Good' : 'Needs Attention';

    // Score ring area
    doc.setFillColor(...C.snow);
    doc.roundedRect(M, y, CW, 32, 3, 3, 'F');
    // Big score
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...scoreColor);
    doc.text(String(healthScore), M + 20, y + 20, { align: 'center' });
    doc.setFontSize(7);
    doc.setTextColor(...C.grayLt);
    doc.text('/100', M + 28, y + 20);
    // Label
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...scoreColor);
    doc.text(scoreLabel, M + 20, y + 27, { align: 'center' });
    // Progress arc (simplified as bar)
    drawProgressBar(doc, M + 44, y + 14, 60, 4, healthScore, scoreColor);
    doc.setFontSize(6);
    doc.setTextColor(...C.gray);
    doc.text('HEALTH WELLNESS INDEX', M + 44, y + 12);
    // Mini stats on right
    const miniStats = [
        { l: 'Visits', v: String(appointments.total) },
        { l: 'Attended', v: String(appointments.attended) },
        { l: 'Missed', v: String(appointments.missed) },
        { l: 'Active Rx', v: String(prescriptions.filter(rx => rx.status === 'active').length) },
    ];
    miniStats.forEach((s, i) => {
        const sx = M + 120 + i * 17;
        doc.setFontSize(5);
        doc.setTextColor(...C.grayLt);
        doc.text(s.l.toUpperCase(), sx, y + 10);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...C.navy);
        doc.text(s.v, sx, y + 18);
    });
    y += 38;

    // ── VITALS ──
    const latestVitals = vitals?.length > 0 ? vitals[0] : null;
    if (latestVitals) {
        y = drawSection(doc, y, 'Latest Vitals', { accent: C.red });
        const vCards = [];
        if (latestVitals.bp_systolic) vCards.push({ l: 'Blood Pressure', v: `${latestVitals.bp_systolic}/${latestVitals.bp_diastolic}`, u: 'mmHg', c: C.red });
        if (latestVitals.heart_rate) vCards.push({ l: 'Heart Rate', v: String(latestVitals.heart_rate), u: 'bpm', c: C.emerald });
        if (latestVitals.temperature) vCards.push({ l: 'Temperature', v: String(latestVitals.temperature), u: '°F', c: C.amber });
        if (latestVitals.sugar_level) vCards.push({ l: 'Blood Sugar', v: String(latestVitals.sugar_level), u: 'mg/dL', c: C.blue });
        if (latestVitals.oxygen_level) vCards.push({ l: 'Oxygen', v: String(latestVitals.oxygen_level), u: '%', c: C.violet });

        const vW = vCards.length > 0 ? (CW - (vCards.length - 1) * 3) / vCards.length : 0;
        vCards.forEach((vc, i) => {
            const vx = M + i * (vW + 3);
            // Card
            doc.setFillColor(...C.white);
            doc.roundedRect(vx, y, vW, 20, 2, 2, 'F');
            doc.setFillColor(...vc.c);
            doc.roundedRect(vx, y, vW, 1.5, 0.75, 0.75, 'F');
            // Label
            doc.setFontSize(5.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...C.gray);
            doc.text(vc.l.toUpperCase(), vx + 4, y + 7);
            // Value
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...C.navy);
            doc.text(vc.v, vx + 4, y + 14.5);
            // Unit
            doc.setFontSize(6);
            doc.setTextColor(...C.grayLt);
            doc.text(vc.u, vx + 4 + doc.getTextWidth(vc.v) + 1.5, y + 14.5);
        });
        y += 26;
    }

    // ── DIAGNOSES ──
    if (diagnoses.length > 0) {
        y = checkPage(doc, y, 30);
        y = drawSection(doc, y, 'Diagnoses', { accent: C.violet, count: diagnoses.length });
        y = styledTable(doc, y, {
            head: ['Condition', 'Severity', 'Notes', 'Date'],
            body: diagnoses.map(d => [
                d.condition, d.severity || '—', d.notes || '—',
                d.created_at ? new Date(d.created_at).toLocaleDateString() : '—',
            ]),
            headColor: C.violet,
        });
    }

    // ── PRESCRIPTIONS ──
    if (prescriptions.length > 0) {
        y = checkPage(doc, y, 30);
        y = drawSection(doc, y, 'Prescriptions', { accent: C.emerald, count: prescriptions.length });
        y = styledTable(doc, y, {
            head: ['Medication', 'Dosage', 'Frequency', 'Duration', 'Status'],
            body: prescriptions.map(r => [
                r.medication, r.dosage || '—', r.frequency || '—', r.duration || '—', r.status || 'active',
            ]),
            headColor: C.emerald,
        });
    }

    // ── UPCOMING APPOINTMENTS ──
    const upcoming = bookings.filter(b => b.status === 'pending' || b.status === 'approve' || b.status === 'approved');
    if (upcoming.length > 0) {
        y = checkPage(doc, y, 30);
        y = drawSection(doc, y, 'Upcoming Appointments', { accent: C.blue, count: upcoming.length });
        y = styledTable(doc, y, {
            head: ['Department', 'Date', 'Time', 'Status'],
            body: upcoming.map(b => [
                b.department || '—', b.preferred_date || '—',
                b.preferred_time || '—', b.status || '—',
            ]),
            headColor: C.blue,
        });
    }

    drawFooter(doc);
    doc.save(`ZI_Patient_Report_${(user.name || 'patient').replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ══════════════════════════════════════════════════════════════
//  NURSE REPORT
// ══════════════════════════════════════════════════════════════

export function exportNursePDF({ user, data }) {
    const doc = new jsPDF();
    let y = drawHeader(doc, {
        title: 'Shift Operations Report',
        subtitle: user.name || 'Nurse',
        role: `${data.ward || 'General'} — ${data.assigned_shift || 'Day'} Shift`,
        accentColor: C.emerald,
    });

    // ── SHIFT OVERVIEW CARDS ──
    const wardInfo = data.ward_info;
    const occupancy = wardInfo?.capacity ? Math.round((wardInfo.current_patients / wardInfo.capacity) * 100) : 0;
    const overviewCards = [
        { label: 'Active Patients', value: data.total_patients || 0, sub: 'Under care', barPct: occupancy, barColor: C.teal, accent: C.teal },
        { label: 'Vitals Done',     value: data.vitals_recorded || 0, sub: 'This shift',  accent: C.emerald },
        { label: 'Pending Admits',  value: (data.pending_admissions || []).length, sub: 'Action needed', accent: C.amber },
        { label: 'Ward Occupancy',  value: `${occupancy}%`, sub: wardInfo ? `${wardInfo.current_patients}/${wardInfo.capacity} beds` : '—', barPct: occupancy, barColor: occupancy > 85 ? C.red : occupancy > 65 ? C.amber : C.emerald, accent: occupancy > 85 ? C.red : C.teal },
    ];
    const oW = (CW - 9) / 4;
    overviewCards.forEach((c, i) => {
        drawMetricCard(doc, M + i * (oW + 3), y, oW, 24, c);
    });
    y += 30;

    // Ward info row
    if (wardInfo) {
        doc.setFillColor(...C.snow);
        doc.roundedRect(M, y, CW, 10, 2, 2, 'F');
        const wInfo = [
            `Ward: ${wardInfo.ward_id || '—'}`,
            `Type: ${wardInfo.type || '—'}`,
            `Beds: ${wardInfo.capacity || 0}`,
            `Dept: ${data.ward || '—'}`,
            `Shift: ${data.assigned_shift || 'Day'}`,
        ];
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        wInfo.forEach((w, i) => {
            const wx = M + 4 + i * (CW / wInfo.length);
            doc.setTextColor(...C.gray);
            doc.text(w.split(':')[0] + ':', wx, y + 6);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...C.navy);
            doc.text(w.split(':')[1]?.trim() || '—', wx + doc.getTextWidth(w.split(':')[0] + ':  '), y + 6);
            doc.setFont('helvetica', 'normal');
        });
        y += 14;
    }

    // ── PENDING ADMISSIONS ──
    const pending = data.pending_admissions || [];
    if (pending.length > 0) {
        y = checkPage(doc, y, 30);
        y = drawSection(doc, y, 'Pending Admissions', { accent: C.amber, count: pending.length });
        y = styledTable(doc, y, {
            head: ['Patient', 'Ward', 'Type', 'Assigned By'],
            body: pending.map(a => [
                a.patient_name || '—', a.ward_id || '—',
                a.ward_type || '—', a.assigned_by_doctor || '—',
            ]),
            headColor: C.amber,
        });
    }

    // ── ADMITTED PATIENTS ──
    const admitted = data.admitted_patients || [];
    if (admitted.length > 0) {
        y = checkPage(doc, y, 30);
        y = drawSection(doc, y, 'Admitted Patients', { accent: C.emerald, count: admitted.length });
        y = styledTable(doc, y, {
            head: ['Patient', 'Ward', 'Admitted At'],
            body: admitted.map(a => [
                a.patient_name || '—', a.ward_id || '—',
                a.admitted_at ? new Date(a.admitted_at).toLocaleString() : '—',
            ]),
            headColor: C.emerald,
        });
    }

    // ── MEDICATION SCHEDULE ──
    const meds = data.medication_schedule || [];
    if (meds.length > 0) {
        y = checkPage(doc, y, 30);
        y = drawSection(doc, y, 'Medication Schedule', { accent: C.teal, count: meds.length });
        y = styledTable(doc, y, {
            head: ['Patient', 'Medication', 'Dosage', 'Frequency'],
            body: meds.map(m => [
                m.patient_name || '—', m.medication || '—',
                m.dosage || '—', m.frequency || '—',
            ]),
            headColor: C.teal,
        });
    }

    // ── ACTIVE CASES ──
    const cases = data.active_cases || [];
    if (cases.length > 0) {
        y = checkPage(doc, y, 30);
        y = drawSection(doc, y, 'Active Cases', { accent: C.red, count: cases.length });
        y = styledTable(doc, y, {
            head: ['Case ID', 'Department', 'Severity'],
            body: cases.slice(0, 20).map(c => [
                c.id?.slice(-8) || '—', c.department || '—', c.severity || '—',
            ]),
            headColor: C.red,
        });
    }

    drawFooter(doc);
    doc.save(`ZI_Nurse_Report_${(user.name || 'nurse').replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
