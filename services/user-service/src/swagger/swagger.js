const swaggerJsdoc = require("swagger-jsdoc");
const path = require("path");
const schemas = require("./schemas");
const paths = require("./paths");

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "User Service API",
    version: "1.0.0",
    description:
      "API documentation for User Service - Authentication, Profile Management, User Settings, User Sessions",
  },
  contact: {
    name: "API Support",
    email: "support@lianxin.com",
  },
  servers: [
    {
      url: "/api/v1",
      description: "User Service API",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      ...schemas,
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
  paths: {
    ...paths,
  },
};

const options = {
  swaggerDefinition,
  apis: [
    path.join(__dirname, "../controllers/*.js"),
    path.join(__dirname, "../routes/*.js"),
  ],
};

const specs = swaggerJsdoc(options);

module.exports = specs;
