export const MEASUREMENTS_QUEUE = 'measurements';

/** La cola solo se habilita si hay REDIS_URL configurado (Upstash, local, etc.) */
export const isQueueEnabled = (): boolean => !!process.env.REDIS_URL;
