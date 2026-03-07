import emailjs from '@emailjs/browser';

// ── EmailJS Configuration ──
const EMAILJS_SERVICE_ID = 'service_q8nz87h';
const EMAILJS_TEMPLATE_ID = 'template_axf2tp9';
const EMAILJS_PUBLIC_KEY = 'I3ljGz81XKibPuUjm';

// Initialize EmailJS
emailjs.init(EMAILJS_PUBLIC_KEY);

/**
 * Send a draft response email to a patient via EmailJS.
 * @param {Object} params
 * @param {string} params.patientName  - Patient's full name
 * @param {string} params.patientEmail - Patient's email address
 * @param {string} params.subject      - Original query subject
 * @param {string} params.category     - Query category (billing, appointment, etc.)
 * @param {string} params.responseText - The approved draft response text
 * @param {string} params.staffName    - Staff member who approved/sent
 * @param {string} params.priority     - Query priority level
 */
export async function sendDraftEmail({
  patientName,
  patientEmail,
  subject,
  category,
  responseText,
  staffName = 'Hospital Staff',
  priority = 'medium',
}) {
  const templateParams = {
    to_name: patientName,
    to_email: patientEmail,
    subject: `RE: ${subject}`,
    category: category,
    priority: priority,
    message: responseText,
    staff_name: staffName,
    hospital_name: 'Zero Intercept Hospital',
    reply_to: 'noreply@zerointercept.health',
  };

  const response = await emailjs.send(
    EMAILJS_SERVICE_ID,
    EMAILJS_TEMPLATE_ID,
    templateParams,
    EMAILJS_PUBLIC_KEY,
  );

  return response;
}
