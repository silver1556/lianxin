const swaggerJSDoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Your API Name",
      version: "1.0.0",
      description: "API documentation for your Express backend",
    },
    servers: [
      {
        url: "http://localhost:3000/api/v1",
      },
    ],
  },
  apis: ["./routes/*.js"], // <-- Path to the API docs (your route files with annotations)
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
