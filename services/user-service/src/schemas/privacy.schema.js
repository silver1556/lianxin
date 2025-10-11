// validations/privacy.schema.js
/* Schema for validating user privacy visibility settings
 */

const Joi = require("joi");

const privacyPerFieldSchema = Joi.object({
  field: Joi.string()
    .valid(
      "birth_date",
      "gender",
      "lives_in_location",
      "hometown",
      "occupation",
      "salary",
      "relationship_status",
      "languages",
      "hobbies",
      "skills"
    )
    .required(),
  visibility: Joi.string()
    .valid("public", "friends", "private")
    .default("public"),
});

module.exports = { privacyPerFieldSchema };
