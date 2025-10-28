import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle common errors
    if (error.response?.status === 401) {
      // Unauthorized - redirect to login
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    } else if (error.response?.status === 403) {
      // Forbidden
      console.error('Access forbidden');
    } else if (error.response?.status >= 500) {
      // Server error
      console.error('Server error:', error.response.data);
    }
    
    return Promise.reject(error);
  }
);

// API endpoints
export const endpoints = {
  // Test Plans
  plans: {
    list: '/plans',
    create: '/generate_test_plan',
    get: (id: string) => `/plans/${id}`,
    update: (id: string) => `/plans/${id}`,
    delete: (id: string) => `/plans/${id}`,
  },
  
  // Test Suites
  suites: {
    list: '/suites',
    create: '/create_tests',
    get: (id: string) => `/suites/${id}`,
    update: (id: string) => `/suites/${id}`,
    delete: (id: string) => `/suites/${id}`,
  },
  
  // Test Runs
  runs: {
    list: '/runs',
    create: '/run_tests',
    get: (id: string) => `/runs/${id}`,
    update: (id: string) => `/runs/${id}`,
    delete: (id: string) => `/runs/${id}`,
  },
  
  // Triage
  triage: {
    create: '/triage_failures',
    get: (runId: string) => `/triage/${runId}`,
  },
  
  // Patches
  patches: {
    create: '/update_tests',
    apply: (id: string) => `/patches/${id}/apply`,
  },
  
  // Reports
  reports: {
    get: '/reports',
  },
  
  // Health
  health: '/health',
};

// Utility functions
export const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString();
};

export const formatDuration = (seconds: number) => {
  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
};

export const getStatusColor = (status: string) => {
  const colors = {
    draft: 'gray',
    active: 'blue',
    running: 'yellow',
    passed: 'green',
    failed: 'red',
    error: 'red',
    pending: 'yellow',
    applied: 'green',
    rejected: 'red',
  };
  
  return colors[status.toLowerCase() as keyof typeof colors] || 'gray';
};

export const getStatusIcon = (status: string) => {
  const icons = {
    draft: '📝',
    active: '▶️',
    running: '⏳',
    passed: '✅',
    failed: '❌',
    error: '💥',
    pending: '⏳',
    applied: '✅',
    rejected: '❌',
  };
  
  return icons[status.toLowerCase() as keyof typeof icons] || '❓';
};
