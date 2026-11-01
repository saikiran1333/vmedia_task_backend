import { cataloguePaths, catalogueComponents } from './swagger_catalogue.js';

// OpenAPI 3.0 specification definition for Vmedia backend services.
export const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Vmedia Enterprise Backend API',
    version: '1.0.0',
    description:
      'Production-grade RESTful API specification for the Vmedia task platform, built with Node.js, Express, and Neon Postgres.',
    contact: {
      name: 'Vmedia Engineering Team',
      email: 'dev@vmedia.app',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'Default API v1 Gateway',
    },
  ],
  paths: {
    ...cataloguePaths,
    '/hello': {
      get: {
        tags: ['Hello'],
        summary: 'Hello World greeting endpoint',
        description: 'Returns enterprise hello world greeting, runtime metrics, and server execution state.',
        responses: {
          '200': {
            description: 'Greeting payload returned successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HelloSuccessResponse',
                },
              },
            },
          },
          '500': {
            description: 'Internal server failure',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
        },
      },
    },
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'System health and subsystem diagnostics',
        description: 'Returns real-time server liveness, memory consumption, node metrics, and Neon Postgres database connectivity.',
        responses: {
          '200': {
            description: 'All backend subsystems are healthy and operational',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HealthSuccessResponse',
                },
              },
            },
          },
          '503': {
            description: 'One or more essential subsystems are unavailable',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: catalogueComponents.securitySchemes,
    schemas: {
      ...catalogueComponents.schemas,
      HelloSuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'integer', example: 200 },
          message: { type: 'string', example: 'Hello from Vmedia Enterprise Backend!' },
          data: {
            type: 'object',
            properties: {
              greeting: { type: 'string', example: 'Hello from Vmedia Enterprise Backend!' },
              platform: { type: 'string', example: 'Vmedia Medical Ecosystem' },
              environment: { type: 'string', example: 'development' },
              serverTime: { type: 'string', format: 'date-time' },
              uptimeSeconds: { type: 'number', example: 12.45 },
            },
          },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      HealthSuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'integer', example: 200 },
          message: { type: 'string', example: 'Vmedia backend service is healthy and operational.' },
          data: {
            type: 'object',
            properties: {
              status: { type: 'string', example: 'UP' },
              uptime: { type: 'number', example: 124.5 },
              timestamp: { type: 'string', format: 'date-time' },
              services: {
                type: 'object',
                properties: {
                  database: {
                    type: 'object',
                    properties: {
                      provider: { type: 'string', example: 'Neon Postgres' },
                      connected: { type: 'boolean', example: true },
                    },
                  },
                },
              },
              system: {
                type: 'object',
                properties: {
                  nodeVersion: { type: 'string', example: 'v25.8.1' },
                  platform: { type: 'string', example: 'win32' },
                  pid: { type: 'integer', example: 12345 },
                  memory: {
                    type: 'object',
                    properties: {
                      rssMb: { type: 'number', example: 45.2 },
                      heapUsedMb: { type: 'number', example: 22.1 },
                      heapTotalMb: { type: 'number', example: 35.8 },
                    },
                  },
                },
              },
            },
          },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          statusCode: { type: 'integer', example: 500 },
          message: { type: 'string', example: 'An unexpected internal server error occurred.' },
          errors: { type: 'object', nullable: true },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
};
