import swaggerJsdoc from 'swagger-jsdoc';

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Express Azure Auth API',
            version: '1.0.0',
            description: 'A sample Express API with Azure MSAL authentication',
            contact: {
                name: 'API Support',
                email: 'support@example.com'
            }
        },
        servers: [
            {
                url: process.env.NODE_ENV === 'production'
                    ? 'https://your-production-url.com'
                    : `http://localhost:${process.env.PORT || 5000}`,
                description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
            }
        ],
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Enter your Azure AD JWT token'
                }
            },
            schemas: {
                User: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            description: 'User ID'
                        },
                        name: {
                            type: 'string',
                            description: 'User display name'
                        },
                        email: {
                            type: 'string',
                            description: 'User email address'
                        },
                        roles: {
                            type: 'array',
                            items: {
                                type: 'string'
                            },
                            description: 'User roles'
                        },
                        tenantId: {
                            type: 'string',
                            description: 'Azure AD tenant ID'
                        }
                    }
                },
                DataItem: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'integer',
                            description: 'Item ID'
                        },
                        name: {
                            type: 'string',
                            description: 'Item name'
                        },
                        value: {
                            type: 'number',
                            description: 'Item value'
                        },
                        category: {
                            type: 'string',
                            description: 'Item category'
                        },
                        createdBy: {
                            type: 'string',
                            description: 'Created by user'
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Creation timestamp'
                        }
                    }
                },
                ApiResponse: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            description: 'Operation success status'
                        },
                        message: {
                            type: 'string',
                            description: 'Response message'
                        },
                        data: {
                            description: 'Response data'
                        },
                        timestamp: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Response timestamp'
                        }
                    }
                },
                Error: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            example: false
                        },
                        error: {
                            type: 'string',
                            description: 'Error type'
                        },
                        message: {
                            type: 'string',
                            description: 'Error message'
                        },
                        timestamp: {
                            type: 'string',
                            format: 'date-time'
                        }
                    }
                }
            }
        },
        security: [
            {
                BearerAuth: []
            }
        ]
    },
    apis: ['./server.js', './middleware/*.js'],
};

const specs = swaggerJsdoc(options);

if (process.env.NODE_ENV !== 'production') {
    console.log('🔍 Swagger Debug Info:');
    console.log('📁 API Files being scanned:');
    options.apis.forEach(apiPath => {
        console.log(`   - ${apiPath}`);
    });

    if (specs.paths && Object.keys(specs.paths).length > 0) {
        console.log('📋 Found API endpoints:');
        Object.keys(specs.paths).forEach(path => {
            console.log(`   - ${path}`);
        });
    } else {
        console.log('❌ No API endpoints found in Swagger specs');
        console.log('🔧 This usually means the JSDoc comments are not being parsed correctly');
    }
}

export default specs;