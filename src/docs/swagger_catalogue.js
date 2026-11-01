const errorSchema = { $ref: '#/components/schemas/ErrorResponse' };
const successSchema = { $ref: '#/components/schemas/SuccessResponse' };

const json = (schema) => ({
  'application/json': { schema },
});

export const cataloguePaths = {
  '/products': {
    get: {
      tags: ['Products'],
      summary: 'List active products',
      parameters: [
        { name: 'q', in: 'query', schema: { type: 'string', maxLength: 80 } },
        { name: 'category', in: 'query', schema: { type: 'string' } },
        { name: 'occasion', in: 'query', schema: { type: 'string' } },
        { name: 'budget', in: 'query', schema: { type: 'string' } },
        { name: 'justIn', in: 'query', schema: { type: 'string', enum: ['true'] } },
        { name: 'fastSelling', in: 'query', schema: { type: 'string', enum: ['true'] } },
        { name: 'sort', in: 'query', schema: { type: 'string', enum: ['name', 'price', 'newest', 'updated'] } },
        { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
        { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
        { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
      ],
      responses: {
        200: { description: 'Active products, or an empty list when nothing matches', content: json(successSchema) },
        400: { description: 'Invalid filter', content: json(errorSchema) },
      },
    },
  },
  '/products/{id}': {
    get: {
      tags: ['Products'],
      summary: 'Product detail',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: { description: 'Product', content: json(successSchema) },
        400: { description: 'Invalid id', content: json(errorSchema) },
        404: { description: 'Missing or inactive product', content: json(errorSchema) },
      },
    },
  },
  '/categories': {
    get: {
      tags: ['Catalogue'],
      summary: 'Assignment categories',
      responses: { 200: { description: 'Categories', content: json(successSchema) } },
    },
  },
  '/occasions': {
    get: {
      tags: ['Catalogue'],
      summary: 'Occasions',
      responses: { 200: { description: 'Occasions', content: json(successSchema) } },
    },
  },
  '/customisation-options': {
    get: {
      tags: ['Catalogue'],
      summary: 'Customisation options',
      responses: { 200: { description: 'Customisation options', content: json(successSchema) } },
    },
  },
  '/enquiries': {
    post: {
      tags: ['Enquiries'],
      summary: 'Create an enquiry',
      parameters: [{ name: 'Idempotency-Key', in: 'header', schema: { type: 'string' } }],
      requestBody: { required: true, content: json({ $ref: '#/components/schemas/EnquiryRequest' }) },
      responses: {
        201: { description: 'Created', content: json(successSchema) },
        200: { description: 'Idempotent replay', content: json(successSchema) },
        400: { description: 'Validation error', content: json(errorSchema) },
        409: { description: 'Idempotency key reused for a different body', content: json(errorSchema) },
        503: { description: 'Database unavailable', content: json(errorSchema) },
      },
    },
  },
  '/admin/auth/login': {
    post: {
      tags: ['Admin'],
      summary: 'Admin login',
      requestBody: { required: true, content: json({ $ref: '#/components/schemas/LoginRequest' }) },
      responses: {
        200: { description: 'Signed in', content: json(successSchema) },
        401: { description: 'Incorrect email or password', content: json(errorSchema) },
        403: { description: 'Disabled account', content: json(errorSchema) },
      },
    },
  },
  '/admin/auth/me': {
    get: {
      tags: ['Admin'],
      summary: 'Current admin',
      security: [{ bearerAuth: [] }],
      responses: {
        200: { description: 'Current admin', content: json(successSchema) },
        401: { description: 'Sign in required', content: json(errorSchema) },
        403: { description: 'Disabled account', content: json(errorSchema) },
      },
    },
  },
  '/admin/enquiries': {
    get: {
      tags: ['Admin'],
      summary: 'List enquiries',
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: 'q', in: 'query', schema: { type: 'string' } },
        { name: 'status', in: 'query', schema: { type: 'string' } },
        { name: 'source', in: 'query', schema: { type: 'string' } },
        { name: 'occasion', in: 'query', schema: { type: 'string' } },
        { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
        { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
        { name: 'sort', in: 'query', schema: { type: 'string' } },
        { name: 'order', in: 'query', schema: { type: 'string' } },
        { name: 'page', in: 'query', schema: { type: 'integer' } },
        { name: 'pageSize', in: 'query', schema: { type: 'integer' } },
      ],
      responses: {
        200: { description: 'Enquiry page', content: json(successSchema) },
        401: { description: 'Sign in required', content: json(errorSchema) },
      },
    },
  },
  '/admin/enquiries/export': {
    get: {
      tags: ['Admin'],
      summary: 'Export enquiries as CSV',
      security: [{ bearerAuth: [] }],
      responses: {
        200: { description: 'CSV file', content: { 'text/csv': { schema: { type: 'string' } } } },
        401: { description: 'Sign in required', content: json(errorSchema) },
      },
    },
  },
  '/admin/enquiries/{id}': {
    get: {
      tags: ['Admin'],
      summary: 'Enquiry detail',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      responses: {
        200: { description: 'Enquiry', content: json(successSchema) },
        404: { description: 'Not found', content: json(errorSchema) },
      },
    },
  },
  '/admin/enquiries/{id}/status': {
    patch: {
      tags: ['Admin'],
      summary: 'Update enquiry status',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      requestBody: { required: true, content: json({ $ref: '#/components/schemas/StatusRequest' }) },
      responses: {
        200: { description: 'Updated enquiry', content: json(successSchema) },
        400: { description: 'Invalid status', content: json(errorSchema) },
        404: { description: 'Not found', content: json(errorSchema) },
      },
    },
  },
};

export const catalogueComponents = {
  securitySchemes: {
    bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
  },
  schemas: {
    SuccessResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        statusCode: { type: 'integer' },
        message: { type: 'string' },
        data: {},
        meta: { nullable: true },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
    EnquiryRequest: {
      type: 'object',
      required: ['name', 'email', 'phone', 'city', 'occasion', 'budget', 'message', 'source'],
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        city: { type: 'string' },
        companyName: { type: 'string' },
        occasion: { type: 'string' },
        budget: { type: 'string' },
        message: { type: 'string' },
        source: { type: 'string', enum: ['WEBSITE', 'MOBILE'] },
        units: { type: 'integer' },
        deliveryDate: { type: 'string', format: 'date' },
        customisationRequirements: { type: 'string' },
        customisationOptions: { type: 'array', items: { type: 'string' } },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'string' },
              quantity: { type: 'integer' },
            },
          },
        },
      },
    },
    LoginRequest: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string' },
        password: { type: 'string' },
      },
    },
    StatusRequest: {
      type: 'object',
      required: ['status'],
      properties: {
        status: { type: 'string', enum: ['NEW', 'CONTACTED', 'CONVERTED', 'LOST'] },
      },
    },
  },
};
