const express = require('express');
const auth = require('../Middlewares/auth');
const { updateStatus, listDoctors } = require('../Controllers/doctorController');

const router = express.Router();

// Routes
router.post('/status', auth, updateStatus);
router.get('/', auth, listDoctors);

module.exports = router;
