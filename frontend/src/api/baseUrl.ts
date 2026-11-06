// Aparte de client.ts: los tests mockean client.ts y realtime.ts necesita la URL igualmente
export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';
