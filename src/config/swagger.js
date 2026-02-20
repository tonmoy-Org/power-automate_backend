const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Power Automate API',
      version: '1.0.0',
      description: 'REST API documentation for Power Automate Backend',
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server',
      },
      {
        url: 'https://your-production-url.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        // ── Auth ──────────────────────────────────────────────
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'user@example.com' },
            password: { type: 'string', example: 'secret123' },
          },
        },
        ForgotPasswordRequest: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' },
          },
        },
        ResetPasswordRequest: {
          type: 'object',
          required: ['token', 'password'],
          properties: {
            token: { type: 'string' },
            password: { type: 'string', minLength: 6 },
          },
        },
        ChangePasswordRequest: {
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: { type: 'string' },
            newPassword: { type: 'string', minLength: 6 },
          },
        },
        UpdateProfileRequest: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
          },
        },
        // ── User ─────────────────────────────────────────────
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['superadmin', 'member', 'client'] },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateUserRequest: {
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            name: { type: 'string', minLength: 2, maxLength: 50 },
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 6 },
            role: { type: 'string', enum: ['superadmin', 'member', 'client'] },
          },
        },
        // ── Phone Number ──────────────────────────────────────
        PhoneNumber: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            number: { type: 'string' },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        PhoneNumberRequest: {
          type: 'object',
          required: ['number'],
          properties: {
            number: { type: 'string', example: '+1234567890' },
            isActive: { type: 'boolean', default: false },
          },
        },
        // ── Password Formatter ────────────────────────────────
        PasswordFormatter: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            pattern: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        PasswordFormatterRequest: {
          type: 'object',
          required: ['name', 'pattern'],
          properties: {
            name: { type: 'string' },
            pattern: { type: 'string' },
          },
        },
        // ── Phone Credential ──────────────────────────────────
        PhoneCredential: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            phoneNumber: { type: 'string' },
            username: { type: 'string' },
            password: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        PhoneCredentialRequest: {
          type: 'object',
          required: ['phoneNumber', 'username', 'password'],
          properties: {
            phoneNumber: { type: 'string' },
            username: { type: 'string' },
            password: { type: 'string' },
          },
        },
        // ── Generic ───────────────────────────────────────────
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
            data: { type: 'object' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      // ═══════════════════════════════════════════════
      // HEALTH
      // ═══════════════════════════════════════════════
      '/api/health': {
        get: {
          tags: ['Health'],
          summary: 'Server health check',
          security: [],
          responses: {
            200: {
              description: 'Server is running',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
            },
          },
        },
      },

      // ═══════════════════════════════════════════════
      // AUTH
      // ═══════════════════════════════════════════════
      '/api/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Login user',
          security: [],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
          },
          responses: {
            200: { description: 'Login successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
            401: { description: 'Invalid credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },
      '/api/auth/forgot-password': {
        post: {
          tags: ['Auth'],
          summary: 'Send password reset email',
          security: [],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ForgotPasswordRequest' } } },
          },
          responses: {
            200: { description: 'Reset email sent' },
            404: { description: 'User not found' },
          },
        },
      },
      '/api/auth/reset-password': {
        post: {
          tags: ['Auth'],
          summary: 'Reset password using token',
          security: [],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ResetPasswordRequest' } } },
          },
          responses: {
            200: { description: 'Password reset successful' },
            400: { description: 'Invalid or expired token' },
          },
        },
      },
      '/api/auth/validate-reset-token/{token}': {
        get: {
          tags: ['Auth'],
          summary: 'Validate password reset token',
          security: [],
          parameters: [
            { name: 'token', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            200: { description: 'Token is valid' },
            400: { description: 'Token is invalid or expired' },
          },
        },
      },
      '/api/auth/me': {
        get: {
          tags: ['Auth'],
          summary: 'Get current authenticated user',
          responses: {
            200: { description: 'Current user data', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
            401: { description: 'Unauthorized' },
          },
        },
      },
      '/api/auth/profile': {
        put: {
          tags: ['Auth'],
          summary: 'Update user profile',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateProfileRequest' } } },
          },
          responses: {
            200: { description: 'Profile updated' },
            401: { description: 'Unauthorized' },
          },
        },
      },
      '/api/auth/change-password': {
        put: {
          tags: ['Auth'],
          summary: 'Change password (authenticated)',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ChangePasswordRequest' } } },
          },
          responses: {
            200: { description: 'Password changed successfully' },
            400: { description: 'Current password incorrect' },
            401: { description: 'Unauthorized' },
          },
        },
      },

      // ═══════════════════════════════════════════════
      // USERS
      // ═══════════════════════════════════════════════
      '/api/users': {
        get: {
          tags: ['Users'],
          summary: 'Get all users (superadmin only)',
          responses: {
            200: { description: 'List of users' },
            403: { description: 'Forbidden' },
          },
        },
      },
      '/api/users/register': {
        post: {
          tags: ['Users'],
          summary: 'Create a new user (superadmin only)',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateUserRequest' } } },
          },
          responses: {
            201: { description: 'User created' },
            400: { description: 'Validation error' },
            403: { description: 'Forbidden' },
          },
        },
      },
      '/api/users/{id}': {
        get: {
          tags: ['Users'],
          summary: 'Get user by ID (superadmin only)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'User found' },
            404: { description: 'User not found' },
          },
        },
        put: {
          tags: ['Users'],
          summary: 'Update user (superadmin only)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateUserRequest' } } },
          },
          responses: {
            200: { description: 'User updated' },
            404: { description: 'User not found' },
          },
        },
        delete: {
          tags: ['Users'],
          summary: 'Delete user (superadmin only)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'User deleted' },
            404: { description: 'User not found' },
          },
        },
      },
      '/api/users/{id}/toggle-status': {
        patch: {
          tags: ['Users'],
          summary: 'Toggle user active/inactive status (superadmin only)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Status toggled' },
            404: { description: 'User not found' },
          },
        },
      },

      // ═══════════════════════════════════════════════
      // PHONE NUMBERS
      // ═══════════════════════════════════════════════
      '/api/phone-numbers': {
        get: {
          tags: ['Phone Numbers'],
          summary: 'Get all phone numbers',
          responses: { 200: { description: 'List of phone numbers' } },
        },
        post: {
          tags: ['Phone Numbers'],
          summary: 'Create a phone number',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PhoneNumberRequest' } } },
          },
          responses: {
            201: { description: 'Phone number created' },
            400: { description: 'Validation error' },
          },
        },
      },
      '/api/phone-numbers/inactive/random': {
        get: {
          tags: ['Phone Numbers'],
          summary: 'Get a random inactive phone number',
          responses: {
            200: { description: 'Random inactive phone number' },
            404: { description: 'No inactive phone numbers found' },
          },
        },
      },
      '/api/phone-numbers/{id}': {
        get: {
          tags: ['Phone Numbers'],
          summary: 'Get phone number by ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Phone number found' }, 404: { description: 'Not found' } },
        },
        put: {
          tags: ['Phone Numbers'],
          summary: 'Update phone number',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PhoneNumberRequest' } } },
          },
          responses: { 200: { description: 'Updated' }, 404: { description: 'Not found' } },
        },
        delete: {
          tags: ['Phone Numbers'],
          summary: 'Delete phone number',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Deleted' }, 404: { description: 'Not found' } },
        },
      },

      // ═══════════════════════════════════════════════
      // PASSWORD FORMATTERS
      // ═══════════════════════════════════════════════
      '/api/password-formatters': {
        get: {
          tags: ['Password Formatters'],
          summary: 'Get all password formatters',
          responses: { 200: { description: 'List of password formatters' } },
        },
        post: {
          tags: ['Password Formatters'],
          summary: 'Create a password formatter',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PasswordFormatterRequest' } } },
          },
          responses: { 201: { description: 'Created' } },
        },
      },
      '/api/password-formatters/list': {
        get: {
          tags: ['Password Formatters'],
          summary: 'Get password formatters list (simplified)',
          responses: { 200: { description: 'Simplified list' } },
        },
      },
      '/api/password-formatters/{id}': {
        get: {
          tags: ['Password Formatters'],
          summary: 'Get password formatter by ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Found' }, 404: { description: 'Not found' } },
        },
        put: {
          tags: ['Password Formatters'],
          summary: 'Update password formatter',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PasswordFormatterRequest' } } },
          },
          responses: { 200: { description: 'Updated' } },
        },
        delete: {
          tags: ['Password Formatters'],
          summary: 'Delete password formatter',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Deleted' } },
        },
      },

      // ═══════════════════════════════════════════════
      // PHONE CREDENTIALS
      // ═══════════════════════════════════════════════
      '/api/phone-credentials': {
        get: {
          tags: ['Phone Credentials'],
          summary: 'Get all phone credentials',
          responses: { 200: { description: 'List of credentials' } },
        },
        post: {
          tags: ['Phone Credentials'],
          summary: 'Create a phone credential',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PhoneCredentialRequest' } } },
          },
          responses: { 201: { description: 'Created' } },
        },
      },
      '/api/phone-credentials/{id}': {
        get: {
          tags: ['Phone Credentials'],
          summary: 'Get phone credential by ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Found' }, 404: { description: 'Not found' } },
        },
        put: {
          tags: ['Phone Credentials'],
          summary: 'Update phone credential (full)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PhoneCredentialRequest' } } },
          },
          responses: { 200: { description: 'Updated' } },
        },
        patch: {
          tags: ['Phone Credentials'],
          summary: 'Update phone credential (partial)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PhoneCredentialRequest' } } },
          },
          responses: { 200: { description: 'Updated' } },
        },
        delete: {
          tags: ['Phone Credentials'],
          summary: 'Delete phone credential',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Deleted' } },
        },
      },
    },
  },
  apis: [], // using inline definition above
};

const swaggerSpec = swaggerJsdoc(options);

const setupSwagger = (app) => {
  // Expose raw JSON spec
  app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // Serve Swagger UI via CDN — fixes "SwaggerUIBundle is not defined" on hosted platforms
  app.get('/api/docs', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Power Automate API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
  <style>
    body { margin: 0; }
    .swagger-ui .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function () {
      SwaggerUIBundle({
        url: '/api/docs.json',
        dom_id: '#swagger-ui',
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: 'StandaloneLayout',
        deepLinking: true,
        persistAuthorization: true,
      });
    };
  </script>
</body>
</html>
    `);
  });

  console.log('📄 Swagger docs available at /api/docs');
};

module.exports = setupSwagger;