'use strict';

const router = require('express').Router();
const api = require('../controllers/apiController');

router.get('/chats',                api.listChats);
router.get('/chats/:convId/messages', api.listMessages);
router.post('/send',                api.sendMessage);
router.post('/sync',                api.syncHistory);
router.get('/contacts/:id',         api.getContact);
router.patch('/contacts/:id',       api.updateContact);

module.exports = router;
