const express = require("express");
const uploadRoutes = require("./upload.routes");
const mediaRoutes = require("./media.routes");

const router = express.Router();

// Mount sub-routes
router.use("/upload", uploadRoutes);
router.use("/media", mediaRoutes);

module.exports = router;
