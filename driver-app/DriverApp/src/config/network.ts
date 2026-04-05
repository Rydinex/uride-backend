// Driver App – API Configuration

// Backend API domain (production)
const BACKEND_URL =
	process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.rydinex.com';

// Optional: Admin panel domain (for future use)
export const ADMIN_PANEL_URL = 'https://admin.rydinex.com';

// Export main backend URL
export { BACKEND_URL };

// API base URL for all REST endpoints
export const API_BASE_URL = `${BACKEND_URL}/api`;

// Socket server URL (same as backend)
export const SOCKET_URL = BACKEND_URL;