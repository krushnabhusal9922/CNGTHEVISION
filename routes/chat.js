const express = require('express');
const router = express.Router();
const { SUPPORTED_LANGUAGES, processChatMessage } = require('../services/chatService');

// GET /api/chat/languages — returns list of supported languages
router.get('/languages', (req, res) => {
  res.json({
    success: true,
    languages: Object.entries(SUPPORTED_LANGUAGES).map(([code, meta]) => ({
      code,
      name: meta.name,
      native: meta.native,
      flag: meta.flag
    }))
  });
});

// POST /api/chat — handle chat conversation
router.post('/', async (req, res) => {
  try {
    const { message, language = 'en', userCoords } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A message string is required.'
      });
    }

    const response = await processChatMessage({
      message: message.trim(),
      language: language.toLowerCase(),
      userCoords
    });

    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Error handling chat message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process chat message.'
    });
  }
});

module.exports = router;
