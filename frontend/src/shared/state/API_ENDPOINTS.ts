const DEV_API = 'http://localhost:6970/api';
const PROD_API = '/api';
const API_URL = process.env.NODE_ENV === 'production' ? PROD_API : DEV_API;

export const PULL_STRUCTURE_URL = API_URL + '/debugger/pull_structure';
export const PUSH_STRUCTURE_URL = API_URL + '/debugger/push_structure';
export const RESET_COLOR_URL = API_URL + '/debugger/reset_color';
export const RESET_EMOJI_URL = API_URL + '/debugger/reset_emoji';
export const EVENTS_URL = API_URL + '/debugger/events';

export const DEPGRAPH_SCAN_URL = API_URL + '/depgraph/scan';
