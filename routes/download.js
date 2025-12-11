const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const { getFileMetadata } = require('../utils/database');
const { getFilePath, getPresignedDownloadUrl, STORAGE_TYPE } = require('../utils/storageAdapter');

// Get download URL/info
router.get('/url', async (req, res) => {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'File ID is required' });
    }

    const file = await getFileMetadata(id);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    let downloadUrl;
    if (STORAGE_TYPE === 'cloud') {
      // Generate new presigned URL (valid for 1 hour)
      downloadUrl = await getPresignedDownloadUrl(file.key, 3600);
    } else {
      downloadUrl = `/api/download/file/${id}`;
    }

    res.json({
      fileName: file.fileName,
      fileSize: file.fileSize,
      downloadUrl,
      createdAt: file.createdAt
    });
  } catch (error) {
    console.error('Error getting download URL:', error);
    res.status(500).json({ error: 'Failed to get download URL', message: error.message });
  }
});

// Download file directly (local storage only)
router.get('/file/:id', async (req, res) => {
  try {
    if (STORAGE_TYPE === 'cloud') {
      return res.status(400).json({ error: 'Direct file downloads not available for cloud storage. Use /api/download/url' });
    }

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'File ID is required' });
    }

    const file = await getFileMetadata(id);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Get file path
    const filePath = await getFilePath(id);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (err) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    // Set headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', file.fileSize);

    // Stream file to response
    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: 'Failed to download file', message: error.message });
  }
});

module.exports = router;
