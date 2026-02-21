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
        url: 'https://power-automate-fontend-vtln.vercel.app',
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

        // ── Device ─────────────────────────────────────────────
        Device: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            deviceId: { type: 'string' },
            browser: { type: 'string' },
            browserVersion: { type: 'string' },
            os: { type: 'string' },
            osVersion: { type: 'string' },
            deviceType: { type: 'string' },
            deviceName: { type: 'string' },
            ipAddress: { type: 'string' },
            lastLogin: { type: 'string', format: 'date-time' },
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
            department: { type: 'string', default: 'General' },
            devices: { 
              type: 'array',
              items: { $ref: '#/components/schemas/Device' }
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
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
            department: { type: 'string', default: 'General' },
          },
        },

        // ── Password Formatter (for embedding) ────────────────
        EmbeddedPasswordFormatter: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            start_add: { type: 'string' },
            start_index: { type: 'number', minimum: 0 },
            end_index: { type: 'number', minimum: 0 },
            end_add: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },

        // ── Password Formatter (main) ─────────────────────────
        PasswordFormatter: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            start_add: { type: 'string' },
            start_index: { type: 'number', minimum: 0 },
            end_index: { type: 'number', minimum: 0 },
            end_add: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        PasswordFormatterRequest: {
          type: 'object',
          required: ['start_add', 'start_index', 'end_index', 'end_add'],
          properties: {
            start_add: { type: 'string', example: 'prefix_' },
            start_index: { type: 'number', minimum: 0, example: 0 },
            end_index: { type: 'number', minimum: 0, example: 5 },
            end_add: { type: 'string', example: '_suffix' },
          },
        },

        // ── Phone Number ──────────────────────────────────────
        PhoneNumber: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            pa_id: { type: 'string', example: 'PA_101' },
            country_code: { type: 'string', example: '+1' },
            number: { type: 'string', example: '5550123456' },
            is_active: { type: 'boolean', default: false },
            browser_reset_time: { type: 'number', minimum: 1, default: 10 },
            password_formatters: {
              type: 'array',
              items: { $ref: '#/components/schemas/EmbeddedPasswordFormatter' }
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        PhoneNumberRequest: {
          type: 'object',
          required: ['country_code', 'number'],
          properties: {
            pa_id: { type: 'string', example: 'PA_101' },
            country_code: { type: 'string', example: '+1' },
            number: { type: 'string', example: '5550123456' },
            is_active: { type: 'boolean', default: false },
            browser_reset_time: { type: 'number', minimum: 1, default: 10 },
            password_formatters: {
              type: 'array',
              items: { $ref: '#/components/schemas/PasswordFormatterRequest' }
            },
          },
        },

        // ── Phone Credential ──────────────────────────────────
        PhoneCredential: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            pa_id: { type: 'string', example: 'PA_101' },
            phone: { type: 'string', example: '+15550123456' },
            type: { type: 'string', example: 'voip' },
            password: { type: 'string', example: 'encrypted_password' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        PhoneCredentialRequest: {
          type: 'object',
          required: ['pa_id', 'phone', 'password'],
          properties: {
            pa_id: { type: 'string', example: 'PA_101' },
            phone: { type: 'string', example: '+15550123456' },
            type: { type: 'string', example: 'voip' },
            password: { type: 'string', example: 'user_password' },
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
              content: { 
                'application/json': { 
                  schema: { 
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Server is running' },
                      data: { 
                        type: 'object',
                        properties: {
                          timestamp: { type: 'string', format: 'date-time' },
                          uptime: { type: 'number' }
                        }
                      }
                    }
                  } 
                } 
              },
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
          description: 'Authenticate user and return JWT token',
          security: [],
          requestBody: {
            required: true,
            content: { 
              'application/json': { 
                schema: { $ref: '#/components/schemas/LoginRequest' } 
              } 
            },
          },
          responses: {
            200: { 
              description: 'Login successful', 
              content: { 
                'application/json': { 
                  schema: { 
                    allOf: [
                      { $ref: '#/components/schemas/SuccessResponse' },
                      {
                        properties: {
                          data: {
                            type: 'object',
                            properties: {
                              token: { type: 'string' },
                              user: { $ref: '#/components/schemas/User' }
                            }
                          }
                        }
                      }
                    ]
                  } 
                } 
              } 
            },
            401: { 
              description: 'Invalid credentials', 
              content: { 
                'application/json': { 
                  schema: { $ref: '#/components/schemas/ErrorResponse' } 
                } 
              } 
            },
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
            content: { 
              'application/json': { 
                schema: { $ref: '#/components/schemas/ForgotPasswordRequest' } 
              } 
            },
          },
          responses: {
            200: { 
              description: 'Reset email sent',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Password reset email sent' }
                    }
                  }
                }
              }
            },
            404: { 
              description: 'User not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' }
                }
              }
            },
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
            content: { 
              'application/json': { 
                schema: { $ref: '#/components/schemas/ResetPasswordRequest' } 
              } 
            },
          },
          responses: {
            200: { 
              description: 'Password reset successful',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Password reset successful' }
                    }
                  }
                }
              }
            },
            400: { 
              description: 'Invalid or expired token',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' }
                }
              }
            },
          },
        },
      },
      '/api/auth/validate-reset-token/{token}': {
        get: {
          tags: ['Auth'],
          summary: 'Validate password reset token',
          security: [],
          parameters: [
            { 
              name: 'token', 
              in: 'path', 
              required: true, 
              schema: { type: 'string' },
              description: 'Reset token from email'
            },
          ],
          responses: {
            200: { 
              description: 'Token is valid',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Token is valid' }
                    }
                  }
                }
              }
            },
            400: { 
              description: 'Token is invalid or expired',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' }
                }
              }
            },
          },
        },
      },
      '/api/auth/me': {
        get: {
          tags: ['Auth'],
          summary: 'Get current authenticated user',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { 
              description: 'Current user data', 
              content: { 
                'application/json': { 
                  schema: { 
                    allOf: [
                      { $ref: '#/components/schemas/SuccessResponse' },
                      {
                        properties: {
                          data: { $ref: '#/components/schemas/User' }
                        }
                      }
                    ]
                  } 
                } 
              } 
            },
            401: { 
              description: 'Unauthorized',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' }
                }
              }
            },
          },
        },
      },
      '/api/auth/profile': {
        put: {
          tags: ['Auth'],
          summary: 'Update user profile',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { 
              'application/json': { 
                schema: { $ref: '#/components/schemas/UpdateProfileRequest' } 
              } 
            },
          },
          responses: {
            200: { 
              description: 'Profile updated',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessResponse' },
                      {
                        properties: {
                          data: { $ref: '#/components/schemas/User' }
                        }
                      }
                    ]
                  }
                }
              }
            },
            401: { 
              description: 'Unauthorized',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' }
                }
              }
            },
          },
        },
      },
      '/api/auth/change-password': {
        put: {
          tags: ['Auth'],
          summary: 'Change password (authenticated)',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { 
              'application/json': { 
                schema: { $ref: '#/components/schemas/ChangePasswordRequest' } 
              } 
            },
          },
          responses: {
            200: { 
              description: 'Password changed successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Password changed successfully' }
                    }
                  }
                }
              }
            },
            400: { 
              description: 'Current password incorrect',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' }
                }
              }
            },
            401: { 
              description: 'Unauthorized',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' }
                }
              }
            },
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
          security: [{ bearerAuth: [] }],
          responses: {
            200: { 
              description: 'List of users',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessResponse' },
                      {
                        properties: {
                          data: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/User' }
                          }
                        }
                      }
                    ]
                  }
                }
              }
            },
            403: { 
              description: 'Forbidden',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' }
                }
              }
            },
          },
        },
      },
      '/api/users/register': {
        post: {
          tags: ['Users'],
          summary: 'Create a new user (superadmin only)',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { 
              'application/json': { 
                schema: { $ref: '#/components/schemas/CreateUserRequest' } 
              } 
            },
          },
          responses: {
            201: { 
              description: 'User created',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessResponse' },
                      {
                        properties: {
                          data: { $ref: '#/components/schemas/User' }
                        }
                      }
                    ]
                  }
                }
              }
            },
            400: { 
              description: 'Validation error',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' }
                }
              }
            },
            403: { 
              description: 'Forbidden',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' }
                }
              }
            },
          },
        },
      },
      '/api/users/{id}': {
        get: {
          tags: ['Users'],
          summary: 'Get user by ID (superadmin only)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { 
              name: 'id', 
              in: 'path', 
              required: true, 
              schema: { type: 'string' },
              description: 'User ID'
            }
          ],
          responses: {
            200: { 
              description: 'User found',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessResponse' },
                      {
                        properties: {
                          data: { $ref: '#/components/schemas/User' }
                        }
                      }
                    ]
                  }
                }
              }
            },
            404: { 
              description: 'User not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' }
                }
              }
            },
          },
        },
        put: {
          tags: ['Users'],
          summary: 'Update user (superadmin only)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { 
              name: 'id', 
              in: 'path', 
              required: true, 
              schema: { type: 'string' },
              description: 'User ID'
            }
          ],
          requestBody: {
            required: true,
            content: { 
              'application/json': { 
                schema: { $ref: '#/components/schemas/CreateUserRequest' } 
              } 
            },
          },
          responses: {
            200: { 
              description: 'User updated',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessResponse' },
                      {
                        properties: {
                          data: { $ref: '#/components/schemas/User' }
                        }
                      }
                    ]
                  }
                }
              }
            },
            404: { 
              description: 'User not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' }
                }
              }
            },
          },
        },
        delete: {
          tags: ['Users'],
          summary: 'Delete user (superadmin only)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { 
              name: 'id', 
              in: 'path', 
              required: true, 
              schema: { type: 'string' },
              description: 'User ID'
            }
          ],
          responses: {
            200: { 
              description: 'User deleted',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'User deleted successfully' }
                    }
                  }
                }
              }
            },
            404: { 
              description: 'User not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' }
                }
              }
            },
          },
        },
      },
      '/api/users/{id}/toggle-status': {
        patch: {
          tags: ['Users'],
          summary: 'Toggle user active/inactive status (superadmin only)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { 
              name: 'id', 
              in: 'path', 
              required: true, 
              schema: { type: 'string' },
              description: 'User ID'
            }
          ],
          responses: {
            200: { 
              description: 'Status toggled',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessResponse' },
                      {
                        properties: {
                          data: { $ref: '#/components/schemas/User' }
                        }
                      }
                    ]
                  }
                }
              }
            },
            404: { 
              description: 'User not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' }
                }
              }
            },
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
          security: [{ bearerAuth: [] }],
          responses: { 
            200: { 
              description: 'List of phone numbers',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessResponse' },
                      {
                        properties: {
                          data: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/PhoneNumber' }
                          }
                        }
                      }
                    ]
                  }
                }
              }
            } 
          },
        },
        post: {
          tags: ['Phone Numbers'],
          summary: 'Create a phone number',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { 
              'application/json': { 
                schema: { $ref: '#/components/schemas/PhoneNumberRequest' } 
              } 
            },
          },
          responses: {
            201: { 
              description: 'Phone number created',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessResponse' },
                      {
                        properties: {
                          data: { $ref: '#/components/schemas/PhoneNumber' }
                        }
                      }
                    ]
                  }
                }
              }
            },
            400: { 
              description: 'Validation error',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' }
                }
              }
            },
          },
        },
      },
      '/api/phone-numbers/inactive/random': {
        get: {
          tags: ['Phone Numbers'],
          summary: 'Get a random inactive phone number',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { 
              description: 'Random inactive phone number',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessResponse' },
                      {
                        properties: {
                          data: { $ref: '#/components/schemas/PhoneNumber' }
                        }
                      }
                    ]
                  }
                }
              }
            },
            404: { 
              description: 'No inactive phone numbers found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' }
                }
              }
            },
          },
        },
      },
      '/api/phone-numbers/{id}': {
        get: {
          tags: ['Phone Numbers'],
          summary: 'Get phone number by ID',
          security: [{ bearerAuth: [] }],
          parameters: [
            { 
              name: 'id', 
              in: 'path', 
              required: true, 
              schema: { type: 'string' },
              description: 'Phone Number ID'
            }
          ],
          responses: { 
            200: { 
              description: 'Phone number found',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessResponse' },
                      {
                        properties: {
                          data: { $ref: '#/components/schemas/PhoneNumber' }
                        }
                      }
                    ]
                  }
                }
              }
            }, 
            404: { 
              description: 'Not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' }
                }
              }
            } 
          },
        },
        put: {
          tags: ['Phone Numbers'],
          summary: 'Update phone number',
          security: [{ bearerAuth: [] }],
          parameters: [
            { 
              name: 'id', 
              in: 'path', 
              required: true, 
              schema: { type: 'string' },
              description: 'Phone Number ID'
            }
          ],
          requestBody: {
            required: true,
            content: { 
              'application/json': { 
                schema: { $ref: '#/components/schemas/PhoneNumberRequest' } 
              } 
            },
          },
          responses: { 
            200: { 
              description: 'Updated',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessResponse' },
                      {
                        properties: {
                          data: { $ref: '#/components/schemas/PhoneNumber' }
                        }
                      }
                    ]
                  }
                }
              }
            }, 
            404: { 
              description: 'Not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' }
                }
              }
            } 
          },
        },
        delete: {
          tags: ['Phone Numbers'],
          summary: 'Delete phone number',
          security: [{ bearerAuth: [] }],
          parameters: [
            { 
              name: 'id', 
              in: 'path', 
              required: true, 
              schema: { type: 'string' },
              description: 'Phone Number ID'
            }
          ],
          responses: { 
            200: { 
              description: 'Deleted',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Phone number deleted successfully' }
                    }
                  }
                }
              }
            }, 
            404: { 
              description: 'Not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' }
                }
              }
            } 
          },
        },
      },

      // ═══════════════════════════════════════════════
      // PASSWORD FORMATTERS
      // ═══════════════════════════════════════════════
      '/api/password-formatters': {
        get: {
          tags: ['Password Formatters'],
          summary: 'Get all password formatters',
          security: [{ bearerAuth: [] }],
          responses: { 
            200: { 
              description: 'List of password formatters',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessResponse' },
                      {
                        properties: {
                          data: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/PasswordFormatter' }
                          }
                        }
                      }
                    ]
                  }
                }
              }
            } 
          },
        },
        post: {
          tags: ['Password Formatters'],
          summary: 'Create a password formatter',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { 
              'application/json': { 
                schema: { $ref: '#/components/schemas/PasswordFormatterRequest' } 
              } 
            },
          },
          responses: { 
            201: { 
              description: 'Created',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessResponse' },
                      {
                        properties: {
                          data: { $ref: '#/components/schemas/PasswordFormatter' }
                        }
                      }
                    ]
                  }
                }
              }
            } 
          },
        },
      },
      '/api/password-formatters/list': {
        get: {
          tags: ['Password Formatters'],
          summary: 'Get password formatters list (simplified)',
          security: [{ bearerAuth: [] }],
          responses: { 
            200: { 
              description: 'Simplified list',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessResponse' },
                      {
                        properties: {
                          data: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                _id: { type: 'string' },
                                name: { 
                                  type: 'string',
                                  description: 'Virtual field combining start_add and end_add'
                                }
                              }
                            }
                          }
                        }
                      }
                    ]
                  }
                }
              }
            } 
          },
        },
      },
      '/api/password-formatters/{id}': {
        get: {
          tags: ['Password Formatters'],
          summary: 'Get password formatter by ID',
          security: [{ bearerAuth: [] }],
          parameters: [
            { 
              name: 'id', 
              in: 'path', 
              required: true, 
              schema: { type: 'string' },
              description: 'Password Formatter ID'
            }
          ],
          responses: { 
            200: { 
              description: 'Found',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessResponse' },
                      {
                        properties: {
                          data: { $ref: '#/components/schemas/PasswordFormatter' }
                        }
                      }
                    ]
                  }
                }
              }
            }, 
            404: { 
              description: 'Not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' }
                }
              }
            } 
          },
        },
        put: {
          tags: ['Password Formatters'],
          summary: 'Update password formatter',
          security: [{ bearerAuth: [] }],
          parameters: [
            { 
              name: 'id', 
              in: 'path', 
              required: true, 
              schema: { type: 'string' },
              description: 'Password Formatter ID'
            }
          ],
          requestBody: {
            required: true,
            content: { 
              'application/json': { 
                schema: { $ref: '#/components/schemas/PasswordFormatterRequest' } 
              } 
            },
          },
          responses: { 
            200: { 
              description: 'Updated',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessResponse' },
                      {
                        properties: {
                          data: { $ref: '#/components/schemas/PasswordFormatter' }
                        }
                      }
                    ]
                  }
                }
              }
            } 
          },
        },
        delete: {
          tags: ['Password Formatters'],
          summary: 'Delete password formatter',
          security: [{ bearerAuth: [] }],
          parameters: [
            { 
              name: 'id', 
              in: 'path', 
              required: true, 
              schema: { type: 'string' },
              description: 'Password Formatter ID'
            }
          ],
          responses: { 
            200: { 
              description: 'Deleted',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Password formatter deleted successfully' }
                    }
                  }
                }
              }
            } 
          },
        },
      },

      // ═══════════════════════════════════════════════
      // PHONE CREDENTIALS
      // ═══════════════════════════════════════════════
      '/api/phone-credentials': {
        get: {
          tags: ['Phone Credentials'],
          summary: 'Get all phone credentials',
          security: [{ bearerAuth: [] }],
          responses: { 
            200: { 
              description: 'List of credentials',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessResponse' },
                      {
                        properties: {
                          data: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/PhoneCredential' }
                          }
                        }
                      }
                    ]
                  }
                }
              }
            } 
          },
        },
        post: {
          tags: ['Phone Credentials'],
          summary: 'Create a phone credential',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { 
              'application/json': { 
                schema: { $ref: '#/components/schemas/PhoneCredentialRequest' } 
              } 
            },
          },
          responses: { 
            201: { 
              description: 'Created',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessResponse' },
                      {
                        properties: {
                          data: { $ref: '#/components/schemas/PhoneCredential' }
                        }
                      }
                    ]
                  }
                }
              }
            } 
          },
        },
      },
      '/api/phone-credentials/{id}': {
        get: {
          tags: ['Phone Credentials'],
          summary: 'Get phone credential by ID',
          security: [{ bearerAuth: [] }],
          parameters: [
            { 
              name: 'id', 
              in: 'path', 
              required: true, 
              schema: { type: 'string' },
              description: 'Phone Credential ID'
            }
          ],
          responses: { 
            200: { 
              description: 'Found',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessResponse' },
                      {
                        properties: {
                          data: { $ref: '#/components/schemas/PhoneCredential' }
                        }
                      }
                    ]
                  }
                }
              }
            }, 
            404: { 
              description: 'Not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' }
                }
              }
            } 
          },
        },
        put: {
          tags: ['Phone Credentials'],
          summary: 'Update phone credential (full)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { 
              name: 'id', 
              in: 'path', 
              required: true, 
              schema: { type: 'string' },
              description: 'Phone Credential ID'
            }
          ],
          requestBody: {
            required: true,
            content: { 
              'application/json': { 
                schema: { $ref: '#/components/schemas/PhoneCredentialRequest' } 
              } 
            },
          },
          responses: { 
            200: { 
              description: 'Updated',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessResponse' },
                      {
                        properties: {
                          data: { $ref: '#/components/schemas/PhoneCredential' }
                        }
                      }
                    ]
                  }
                }
              }
            } 
          },
        },
        patch: {
          tags: ['Phone Credentials'],
          summary: 'Update phone credential (partial)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { 
              name: 'id', 
              in: 'path', 
              required: true, 
              schema: { type: 'string' },
              description: 'Phone Credential ID'
            }
          ],
          requestBody: {
            required: true,
            content: { 
              'application/json': { 
                schema: { 
                  type: 'object',
                  properties: {
                    pa_id: { type: 'string' },
                    phone: { type: 'string' },
                    type: { type: 'string' },
                    password: { type: 'string' }
                  }
                } 
              } 
            },
          },
          responses: { 
            200: { 
              description: 'Updated',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessResponse' },
                      {
                        properties: {
                          data: { $ref: '#/components/schemas/PhoneCredential' }
                        }
                      }
                    ]
                  }
                }
              }
            } 
          },
        },
        delete: {
          tags: ['Phone Credentials'],
          summary: 'Delete phone credential',
          security: [{ bearerAuth: [] }],
          parameters: [
            { 
              name: 'id', 
              in: 'path', 
              required: true, 
              schema: { type: 'string' },
              description: 'Phone Credential ID'
            }
          ],
          responses: { 
            200: { 
              description: 'Deleted',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Phone credential deleted successfully' }
                    }
                  }
                }
              }
            } 
          },
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

  // Serve Swagger UI via CDN
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