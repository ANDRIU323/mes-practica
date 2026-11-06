import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';

// Documentación OpenAPI generada a partir de los esquemas Zod de las rutas.
// UI en /api/docs y JSON en /api/docs/json. Hay que registrarlo antes que las rutas:
// @fastify/swagger las recoge con un hook onRoute al registrarse.

// Las únicas que no piden token (ver app.ts)
const PUBLIC_ROUTES = ['/api/health', '/api/auth/login', '/api/auth/employee-login'];

export default fp(async (app) => {
  await app.register(swagger, {
    openapi: {
      info: { title: 'MES práctica API', version: '1.0.0' },
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      },
      security: [{ bearerAuth: [] }],
    },
    // Zod → JSON Schema, y cada ruta agrupada por su módulo (/api/<modulo>/...)
    transform: ({ schema, url }) => {
      const result = jsonSchemaTransform({ schema: schema ?? {}, url });
      if (result.schema.hide) return result;
      const tag = url.split('/')[2];
      return {
        url,
        schema: {
          tags: [tag],
          ...(PUBLIC_ROUTES.includes(url) && { security: [] }),
          ...result.schema,
        },
      };
    },
  });

  await app.register(swaggerUi, { routePrefix: '/api/docs' });
});
