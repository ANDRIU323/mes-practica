import { describe, expect, it } from 'vitest';
import { useTestApp } from './helpers.js';

describe('Documentación OpenAPI', () => {
  const ctx = useTestApp();

  it('sirve el spec sin token, con los esquemas Zod convertidos', async () => {
    const res = await ctx.app.inject({ url: '/api/docs/json' });
    expect(res.statusCode).toBe(200);
    const spec = res.json();

    const createOrder = spec.paths['/api/orders/'].post;
    expect(createOrder.tags).toEqual(['orders']);
    expect(createOrder.requestBody.content['application/json'].schema.required).toEqual(
      expect.arrayContaining(['code', 'product', 'quantity']),
    );
    expect(spec.paths['/api/orders/'].get.parameters.map((p: { name: string }) => p.name)).toEqual(
      expect.arrayContaining(['status', 'machineId']),
    );
  });

  it('marca como públicas solo las rutas sin token', async () => {
    const spec = (await ctx.app.inject({ url: '/api/docs/json' })).json();
    expect(spec.paths['/api/auth/login'].post.security).toEqual([]);
    expect(spec.paths['/api/auth/me'].get.security).toBeUndefined();
    expect(spec.security).toEqual([{ bearerAuth: [] }]);
  });

  it('no documenta las rutas de la propia UI', async () => {
    const spec = (await ctx.app.inject({ url: '/api/docs/json' })).json();
    expect(Object.keys(spec.paths).some((p) => p.startsWith('/api/docs'))).toBe(false);
  });
});
