const express = require('express');
const router = express.Router();
const multer = require('multer');
const { 
  STORAGE_TYPE,
  startMultipartUpload, 
  getUploadPartUrl,
  uploadChunk, 
  completeMultipartUpload, 
  abortMultipartUpload 
} = require('../utils/storageAdapter');
const { saveFileMetadata, getFileMetadata } = require('../utils/database');
const { getPresignedDownloadUrl } = require('../utils/storageAdapter');

// Configure multer for memory storage (only used for local storage)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max per chunk
});

// Store multipart upload info in memory
const multipartUploads = new Map();

// Start multipart upload
router.post('/start', async (req, res) => {
  try {
    const { fileName, fileSize } = req.body;

    if (!fileName || !fileSize) {
      return res.status(400).json({ error: 'fileName and fileSize are required' });
    }

    // Check file size limit (30GB = 30 * 1024 * 1024 * 1024 bytes)
    const maxFileSize = 30 * 1024 * 1024 * 1024; // 30GB
    if (fileSize > maxFileSize) {
      return res.status(400).json({ error: 'File size exceeds 30GB limit' });
    }

    // Start multipart upload
    const result = await startMultipartUpload(fileName, parseInt(fileSize));

    // Store upload info
    multipartUploads.set(result.uploadId, {
      fileId: result.fileId,
      fileName,
      fileSize: parseInt(fileSize),
      key: result.key || result.filePath,
      s3UploadId: result.s3UploadId || null
    });

    res.json({
      uploadId: result.uploadId,
      fileId: result.fileId,
      chunkSize: 10 * 1024 * 1024, // 10MB
      storageType: STORAGE_TYPE
    });
  } catch (error) {
    console.error('Error starting upload:', error);
    res.status(500).json({ error: 'Failed to start upload', message: error.message });
  }
});

// Get presigned URL for uploading a chunk (cloud storage only)
router.post('/part', async (req, res) => {
  try {
    const { uploadId, partNumber } = req.body;

    if (!uploadId || !partNumber) {
      return res.status(400).json({ error: 'uploadId and partNumber are required' });
    }

    const uploadInfo = multipartUploads.get(uploadId);
    if (!uploadInfo) {
      return res.status(404).json({ error: 'Upload session not found' });
    }

    if (STORAGE_TYPE === 'cloud') {
      // Cloud storage: Return presigned URL for direct upload to S3
      const presignedUrl = await getUploadPartUrl(uploadId, parseInt(partNumber));
      res.json({
        presignedUrl,
        partNumber: parseInt(partNumber)
      });
    } else {
      // Local storage: Accept chunk directly
      // This endpoint should be called with FormData containing the chunk
      return res.status(400).json({ error: 'Use POST /api/upload/chunk for local storage' });
    }
  } catch (error) {
    console.error('Error getting upload part URL:', error);
    res.status(500).json({ error: 'Failed to get upload part URL', message: error.message });
  }
});

// Upload a chunk directly (local storage only)
router.post('/chunk', upload.single('chunk'), async (req, res) => {
  try {
    if (STORAGE_TYPE !== 'local') {
      return res.status(400).json({ error: 'Direct chunk uploads only available for local storage' });
    }

    const { uploadId, partNumber } = req.body;

    if (!uploadId || !partNumber) {
      return res.status(400).json({ error: 'uploadId and partNumber are required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Chunk data is required' });
    }

    const uploadInfo = multipartUploads.get(uploadId);
    if (!uploadInfo) {
      return res.status(404).json({ error: 'Upload session not found' });
    }

    // Upload chunk to local storage
    await uploadChunk(uploadId, parseInt(partNumber), req.file.buffer);

    res.json({
      success: true,
      partNumber: parseInt(partNumber)
    });
  } catch (error) {
    console.error('Error uploading chunk:', error);
    res.status(500).json({ error: 'Failed to upload chunk', message: error.message });
  }
});

// Complete multipart upload
router.post('/complete', async (req, res) => {
  try {
    const { uploadId, parts } = req.body;

    if (!uploadId || !parts || !Array.isArray(parts)) {
      return res.status(400).json({ error: 'uploadId and parts array are required' });
    }

    const uploadInfo = multipartUploads.get(uploadId);
    if (!uploadInfo) {
      return res.status(404).json({ error: 'Upload session not found' });
    }

    // Complete multipart upload
    const result = await completeMultipartUpload(uploadId, parts);

    // Generate download URL
    let downloadUrl;
    if (STORAGE_TYPE === 'cloud') {
      // For cloud storage, generate presigned URL
      downloadUrl = await getPresignedDownloadUrl(result.key, 7 * 24 * 3600); // 7 days
    } else {
      // For local storage, use direct download endpoint
      downloadUrl = `/api/download/file/${uploadInfo.fileId}`;
    }

    // Save file metadata to database
    await saveFileMetadata({
      id: uploadInfo.fileId,
      fileName: uploadInfo.fileName,
      fileSize: uploadInfo.fileSize,
      key: result.key || result.filePath,
      url: downloadUrl,
      createdAt: new Date().toISOString()
    });

    // Clean up
    multipartUploads.delete(uploadId);

    res.json({
      fileId: uploadInfo.fileId,
      downloadUrl: `/download?id=${uploadInfo.fileId}`,
      directUrl: STORAGE_TYPE === 'cloud' ? downloadUrl : null
    });
  } catch (error) {
    console.error('Error completing upload:', error);
    res.status(500).json({ error: 'Failed to complete upload', message: error.message });
  }
});

// Abort multipart upload
router.post('/abort', async (req, res) => {
  try {
    const { uploadId } = req.body;

    if (!uploadId) {
      return res.status(400).json({ error: 'uploadId is required' });
    }

    const uploadInfo = multipartUploads.get(uploadId);
    if (!uploadInfo) {
      return res.status(404).json({ error: 'Upload session not found' });
    }

    // Abort multipart upload
    await abortMultipartUpload(uploadId);

    // Clean up
    multipartUploads.delete(uploadId);

    res.json({ message: 'Upload aborted successfully' });
  } catch (error) {
    console.error('Error aborting upload:', error);
    res.status(500).json({ error: 'Failed to abort upload', message: error.message });
  }
});

module.exports = router;
