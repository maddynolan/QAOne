/**
 * Constants for the Playwright Recorder module.
 * Device categories, network presets, and other static configuration.
 *
 * Extracted from PlaywrightRecorderPage.tsx.
 */

export interface DeviceProfile {
  id: string;
  name: string;
}

/** Mobile device categories for the device emulation dropdown */
export const DEVICE_CATEGORIES: Record<string, DeviceProfile[]> = {
  'Popular': [
    { id: 'iPhone 15 Pro Max', name: 'iPhone 15 Pro Max' },
    { id: 'iPhone 14 Pro', name: 'iPhone 14 Pro' },
    { id: 'Pixel 8', name: 'Pixel 8' },
    { id: 'Galaxy S24', name: 'Galaxy S24' },
    { id: 'iPad Pro 11', name: 'iPad Pro 11"' },
  ],
  'iOS - iPhone': [
    { id: 'iPhone 15 Pro Max', name: 'iPhone 15 Pro Max' },
    { id: 'iPhone 15 Pro', name: 'iPhone 15 Pro' },
    { id: 'iPhone 15', name: 'iPhone 15' },
    { id: 'iPhone 14 Pro Max', name: 'iPhone 14 Pro Max' },
    { id: 'iPhone 14 Pro', name: 'iPhone 14 Pro' },
    { id: 'iPhone 14', name: 'iPhone 14' },
    { id: 'iPhone 13 Pro Max', name: 'iPhone 13 Pro Max' },
    { id: 'iPhone 13 Pro', name: 'iPhone 13 Pro' },
    { id: 'iPhone 13', name: 'iPhone 13' },
    { id: 'iPhone 13 Mini', name: 'iPhone 13 Mini' },
    { id: 'iPhone 12 Pro Max', name: 'iPhone 12 Pro Max' },
    { id: 'iPhone 12 Pro', name: 'iPhone 12 Pro' },
    { id: 'iPhone 12', name: 'iPhone 12' },
    { id: 'iPhone SE (3rd Gen)', name: 'iPhone SE (3rd Gen)' },
    { id: 'iPhone SE', name: 'iPhone SE' },
    { id: 'iPhone 11', name: 'iPhone 11' },
  ],
  'iOS - iPad': [
    { id: 'iPad Pro 12.9', name: 'iPad Pro 12.9"' },
    { id: 'iPad Pro 11', name: 'iPad Pro 11"' },
    { id: 'iPad Air', name: 'iPad Air' },
    { id: 'iPad Mini', name: 'iPad Mini' },
    { id: 'iPad', name: 'iPad (10th Gen)' },
  ],
  'Android - Google Pixel': [
    { id: 'Pixel 8 Pro', name: 'Pixel 8 Pro' },
    { id: 'Pixel 8', name: 'Pixel 8' },
    { id: 'Pixel 7 Pro', name: 'Pixel 7 Pro' },
    { id: 'Pixel 7', name: 'Pixel 7' },
    { id: 'Pixel 6 Pro', name: 'Pixel 6 Pro' },
    { id: 'Pixel 6', name: 'Pixel 6' },
    { id: 'Pixel 5', name: 'Pixel 5' },
  ],
  'Android - Samsung Galaxy': [
    { id: 'Galaxy S24 Ultra', name: 'Galaxy S24 Ultra' },
    { id: 'Galaxy S24+', name: 'Galaxy S24+' },
    { id: 'Galaxy S24', name: 'Galaxy S24' },
    { id: 'Galaxy S23 Ultra', name: 'Galaxy S23 Ultra' },
    { id: 'Galaxy S23', name: 'Galaxy S23' },
    { id: 'Galaxy S22 Ultra', name: 'Galaxy S22 Ultra' },
    { id: 'Galaxy S21', name: 'Galaxy S21' },
    { id: 'Galaxy A54', name: 'Galaxy A54' },
    { id: 'Galaxy A34', name: 'Galaxy A34' },
    { id: 'Galaxy Tab S9', name: 'Galaxy Tab S9' },
    { id: 'Galaxy Tab S8', name: 'Galaxy Tab S8' },
  ],
  'Android - Other Brands': [
    { id: 'OnePlus 12', name: 'OnePlus 12' },
    { id: 'OnePlus 11', name: 'OnePlus 11' },
    { id: 'Xiaomi 14 Pro', name: 'Xiaomi 14 Pro' },
    { id: 'Redmi Note 13 Pro', name: 'Redmi Note 13 Pro' },
  ],
};

/** Network throttling presets */
export const NETWORK_PRESETS = [
  { id: 'none', name: 'No Throttling' },
  { id: '5G', name: '5G' },
  { id: '4G LTE', name: '4G LTE' },
  { id: '4G', name: '4G' },
  { id: '3G', name: '3G' },
  { id: 'Slow 3G', name: 'Slow 3G' },
  { id: '2G', name: '2G' },
];

/** Get display name for a device ID */
export const getDeviceName = (deviceId: string): string => {
  if (deviceId === 'desktop') return 'Desktop';
  for (const category of Object.values(DEVICE_CATEGORIES)) {
    const device = category.find(d => d.id === deviceId);
    if (device) return device.name;
  }
  return deviceId;
};

/** Number of test cases per page in the test picker */
export const TESTS_PER_PAGE = 50;

/** Manual action ID prefixes (for distinguishing manual from recorded actions) */
export const MANUAL_ACTION_PREFIXES = [
  'action_', 'assert_', 'nav_', 'create_', 'soqlnav_', 'gsearch_',
  'search_', 'util_', 'rec_', 'tab_', 'flow_', 'test_helper_', 'sf_'
];

/** Check if an action ID belongs to a manually added action */
export const isManualActionId = (id: string): boolean => {
  return MANUAL_ACTION_PREFIXES.some(prefix => id.startsWith(prefix));
};

/** Salesforce record ID prefix map */
export const SF_RECORD_PREFIX_MAP: Record<string, string> = {
  '001': 'Account', '003': 'Contact', '00Q': 'Lead', '006': 'Opportunity',
  '500': 'Case', '00T': 'Task', '00U': 'Event', '005': 'User'
};

/** Map qword to Builder step type */
export const qwordToStepType = (qword: string): string => {
  if (!qword) return 'click';
  const q = qword.toLowerCase();
  if (q === 'goto' || q === 'navigate') return 'navigate';
  if (q === 'fill' || q === 'type' || q === 'input') return 'input';
  if (q === 'click' || q === 'clicktext' || q === 'clickelement') return 'click';
  if (q === 'select') return 'select';
  if (q === 'hover') return 'hover';
  if (q === 'wait' || q === 'waitforelement' || q === 'waitfortext') return 'wait';
  if (q === 'asserttext' || q === 'assert' || q === 'assertelement') return 'assert';
  if (q === 'screenshot') return 'screenshot';
  if (q === 'press' || q === 'keyboard') return 'press';
  if (q === 'scroll') return 'scroll';
  return 'click';
};

/** Field name normalizations for deduplication during export */
export const FIELD_NAME_NORMALIZATIONS: Record<string, string> = {
  'pw': 'password', 'pwd': 'password', 'passwd': 'password', 'pass': 'password',
  'user': 'username', 'uname': 'username', 'usr': 'username',
  'mail': 'email', 'e-mail': 'email',
  'phone': 'phone', 'tel': 'phone', 'mobile': 'phone', 'cell': 'phone',
};
