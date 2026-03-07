import axios from 'axios';

// In production, set VITE_API_URL to your deployed backend (e.g. https://your-backend.onrender.com/api)
// In dev, defaults to '/api' which uses Vite proxy to localhost:8000
const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
    baseURL: API_BASE,
    timeout: 60000,
});

api.interceptors.response.use(
    response => response.data,
    error => {
        console.error('API Error:', error);
        return Promise.reject(error);
    }
);

// Dashboard
export const getDashboardSummary = () => api.get('/dashboard/summary');

// Workload
export const getDeptWorkload = () => api.get('/workload/department');
export const getStaffWorkload = () => api.get('/workload/staff');
export const getHourlyHeatmap = () => api.get('/workload/hourly-heatmap');
export const getWeeklyTrend = () => api.get('/workload/weekly-trend');

// SLA
export const getResolutionTrend = () => api.get('/sla/resolution-trend');
export const getDelayedPercentage = () => api.get('/sla/delayed-percentage');
export const getViolationRisk = () => api.get('/sla/violation-risk');
export const getDeptEfficiency = () => api.get('/sla/department-efficiency');

// Predictive
export const getWorkloadForecast = () => api.get('/predictive/forecast');
export const getBurnoutPrediction = () => api.get('/predictive/burnout');
export const getSurgeDetection = () => api.get('/predictive/surge');

// Root Cause
export const getRootCause = () => api.get('/root-cause/analysis');

// Digital Twin
export const getDigitalTwinState = () => api.get('/digital-twin/state');

// Simulation
export const runSimulation = (params) => api.post('/simulation/run', params);

// Optimization
export const getOptimization = () => api.get('/optimization/recommend');

// Sentiment
export const getSentiment = () => api.get('/sentiment/analysis');

// Alerts
export const getAlerts = () => api.get('/alerts/active');

// Strategic
export const simulateScenario = (params) => api.post('/strategic/simulate', params);

// Financial
export const getFinancialImpact = () => api.get('/financial/impact');
export const simulateROI = (params) => api.post('/financial/simulate-roi', params);

// Assistant
export const queryAssistant = (query, history = []) => api.post('/assistant/query', { query, history });

// Reports
export const getReport = () => api.get('/reports/generate');

// Auth
const authApi = axios.create({
    baseURL: API_BASE,
    timeout: 15000,
});

authApi.interceptors.response.use(
    response => response.data,
    error => {
        console.error('Auth API Error:', error);
        return Promise.reject(error);
    }
);

export const loginUser = (email, password) =>
    authApi.post('/auth/login', { email, password });

export const registerUser = (userData, token) =>
    authApi.post('/auth/register', userData, {
        headers: { Authorization: `Bearer ${token}` }
    });

export const getUsers = (token) =>
    authApi.get('/auth/users', {
        headers: { Authorization: `Bearer ${token}` }
    });

export const deleteUser = (userId, token) =>
    authApi.delete(`/auth/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
    });

export const getDoctors = (department) =>
    authApi.get('/auth/doctor-list', { params: department ? { department } : {} });

export const generateOTP = (email, name, token) =>
    authApi.post(`/auth/otp/generate?email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`, null, {
        headers: { Authorization: `Bearer ${token}` }
    });

export const verifyOTP = (email, otp, token) =>
    authApi.post('/auth/otp/verify', { email, otp }, {
        headers: { Authorization: `Bearer ${token}` }
    });

export const getNotifications = (doctorEmail, unreadOnly = false) =>
    authApi.get('/auth/notifications', { params: { doctor_email: doctorEmail, unread_only: unreadOnly } });

export const markNotificationRead = (notifId) =>
    authApi.put(`/auth/notifications/${notifId}/read`);

// Response Suggestions (AI-Based)
export const submitPatientQuery = (data) => api.post('/response-suggestions/queries', data);
export const getPatientQueries = (params = {}) => api.get('/response-suggestions/queries', { params });
export const getPatientQuery = (id) => api.get(`/response-suggestions/queries/${id}`);
export const generateDraft = (queryId) => api.post(`/response-suggestions/queries/${queryId}/generate-draft`);
export const getDrafts = (params = {}) => api.get('/response-suggestions/drafts', { params });
export const getDraft = (draftId) => api.get(`/response-suggestions/drafts/${draftId}`);
export const reviewDraft = (draftId, data) => api.put(`/response-suggestions/drafts/${draftId}/review`, data);
export const sendDraftResponse = (draftId, data = {}) => api.post(`/response-suggestions/drafts/${draftId}/send`, data);
export const getKnowledgeArticles = (params = {}) => api.get('/response-suggestions/knowledge', { params });
export const addKnowledgeArticle = (data) => api.post('/response-suggestions/knowledge', data);
export const getResponseStats = () => api.get('/response-suggestions/stats');

// Workflow Automation — AI-Powered Department Routing
export const submitWorkflowQuery = (data) => api.post('/workflow/submit_query', data);
export const getWorkflowRequests = (params = {}) => api.get('/workflow/requests', { params });
export const getWorkflowRequest = (id) => api.get(`/workflow/requests/${id}`);
export const updateWorkflowStatus = (id, data) => api.put(`/workflow/requests/${id}`, data);
export const assignWorkflowDoctor = (data) => api.post('/workflow/assign_doctor', data);
export const getDoctorWorkflowRequests = (params = {}) => api.get('/workflow/doctor/requests', { params });
export const doctorRespondWorkflow = (id, data) => api.post(`/workflow/doctor/respond/${id}`, data);
export const getWorkflowLogs = (requestId) => api.get(`/workflow/logs/${requestId}`);
export const getAllWorkflowLogs = (params = {}) => api.get('/workflow/logs', { params });
export const getWorkflowDepartments = () => api.get('/workflow/departments');
export const getWorkflowStats = () => api.get('/workflow/stats');

// Clinical Decision Support System (CDSS)
export const cdssUpsertPatient = (data) => api.post('/cdss/patient', data);
export const cdssSubmitVitals = (data) => api.post('/cdss/vitals', data);
export const cdssSubmitLabs = (data) => api.post('/cdss/labs', data);
export const cdssSubmitMedication = (data) => api.post('/cdss/medications', data);
export const cdssSubmitAllergy = (data) => api.post('/cdss/allergies', data);
export const cdssGetAlerts = (patientId, includeAi = true) => api.get(`/cdss/alerts/${patientId}`, { params: { include_ai: includeAi } });
export const cdssGetRisk = (patientId) => api.get(`/cdss/risk/${patientId}`);
export const cdssListPatients = (limit = 50) => api.get('/cdss/patients', { params: { limit } });
export const cdssGetPatient = (patientId) => api.get(`/cdss/patient/${patientId}`);
export const cdssGetHistory = (patientId, limit = 20) => api.get(`/cdss/history/${patientId}`, { params: { limit } });
export const cdssGetStats = () => api.get('/cdss/stats');

export default api;
