import { http, HttpResponse } from 'msw';
import { config } from '../config/env';

/**
 * MSW handler for the OOMSmartPot sensor API.
 *
 * IMPORTANT: this handler targets the *absolute* live URL and is used ONLY by
 * the MSW **node server** in tests (see mocks/server.ts). The running app has no
 * browser-side MSW at all, so it hits the real sensor endpoint and shows live data.
 */
export const sensorHandlers = [
  http.get(`${config.SENSORS_BASE_URL}/sensors/current`, () =>
    HttpResponse.json({
      timestamp: new Date().toISOString(),
      temperature_celsius: 24.5,
      atmosphere_hpa: 1012.3,
      soil_moisture_percent: 42.8,
    }),
  ),
];
