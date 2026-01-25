/**
 * Leads Service - Capture leads for sales tracking
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface LeadData {
  email: string;
  name?: string;
  company?: string;
  phone?: string;
  source: 'signup' | 'contact' | 'demo' | 'pricing' | 'download';
  message?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  page_url?: string;
}

export interface LeadResponse {
  success: boolean;
  message: string;
  lead_id?: string;
  notification_sent?: boolean;
}

/**
 * Capture a lead - call this on signup, contact form, demo request, etc.
 */
export async function captureLead(data: LeadData): Promise<LeadResponse> {
  try {
    // Add current page URL if not provided
    if (!data.page_url) {
      data.page_url = window.location.href;
    }
    
    // Extract UTM parameters from URL if not provided
    const urlParams = new URLSearchParams(window.location.search);
    if (!data.utm_source) data.utm_source = urlParams.get('utm_source') || undefined;
    if (!data.utm_medium) data.utm_medium = urlParams.get('utm_medium') || undefined;
    if (!data.utm_campaign) data.utm_campaign = urlParams.get('utm_campaign') || undefined;
    
    const response = await fetch(`${API_BASE}/api/leads/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to capture lead: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('[Leads] Failed to capture lead:', error);
    // Return success even if API fails - don't block user signup
    return {
      success: false,
      message: 'Lead capture failed (non-blocking)',
    };
  }
}

/**
 * Helper to capture signup leads
 */
export function captureSignupLead(email: string, name?: string, company?: string) {
  return captureLead({
    email,
    name,
    company,
    source: 'signup',
  });
}

/**
 * Helper to capture contact form leads
 */
export function captureContactLead(
  email: string, 
  name?: string, 
  company?: string,
  message?: string,
  subject?: string
) {
  return captureLead({
    email,
    name,
    company,
    message: subject ? `[${subject}] ${message}` : message,
    source: 'contact',
  });
}

/**
 * Helper to capture demo request leads
 */
export function captureDemoLead(email: string, name?: string, company?: string) {
  return captureLead({
    email,
    name,
    company,
    source: 'demo',
  });
}

/**
 * Helper to capture pricing page leads (e.g., "Contact Sales" clicks)
 */
export function capturePricingLead(email: string, name?: string, company?: string) {
  return captureLead({
    email,
    name,
    company,
    source: 'pricing',
  });
}

export default {
  captureLead,
  captureSignupLead,
  captureContactLead,
  captureDemoLead,
  capturePricingLead,
};
