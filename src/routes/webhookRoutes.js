'use strict';

const router = require('express').Router();
const wh = require('../controllers/webhookController');

router.get('/',  wh.verify);
router.post('/', wh.receive);

module.exports = router;
