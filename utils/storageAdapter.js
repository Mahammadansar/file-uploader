/**
 * Storage Adapter - Supports both local filesystem and cloud storage (S3-compatible)
 * Automatically detects which storage to use based on environment variables
 */

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Storage configuration
const STORAGE_TYPE = process.env.STORAGE_TYPE || 'local'; // 'local' or 'cloud'
const STORAGE_DIR = path.join(__dirname, '..', 'uploads');

// Cloud storage configuration (S3-compatible)
let s3Client = null;
let s3Helpers = null;
let BUCKET_NAME = null;

// Initialize cloud storage if configured
if (STORAGE_TYPE === 'cloud') {
  const { S3Client } = require('@aws-sdk/client-s3');
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
  const { 
    PutObjectCommand, 
    GetObjectCommand, 
    CreateMultipartUploadCommand, 
    UploadPartCommand, 
    CompleteMultipartUploadCommand, 
    AbortMultipartUploadCommand 
  } = require('@aws-sdk/client-s3');

  const s3Config = {
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  };

  if (process.env.S3_ENDPOINT) {
    s3Config.endpoint = process.env.S3_ENDPOINT;
    s3Config.forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true' || true;
  }

  s3Client = new S3Client(s3Config);
  BUCKET_NAME = process.env.S3_BUCKET_NAME;
  
  s3Helpers = {
    getSignedUrl,
    PutObjectCommand,
    GetObjectCommand,
    CreateMultipartUploadCommand,
    UploadPartCommand,
    CompleteMultipartUploadCommand,
    AbortMultipartUploadCommand
  };
}

// Store multipart upload info
const multipartUploads = new Map();

/**
 * Ensure storage directory exists (local only)
 */
async function ensureStorageDir() {
  if (STORAGE_TYPE === 'local') {
    try {
      await fs.mkdir(STORAGE_DIR, { recursive: true });
    } catch (error) {
      console.error('Error creating storage directory:', error);
      throw error;
    }
  }
}

// Initialize storage on module load
if (STORAGE_TYPE === 'local') {
  ensureStorageDir().catch(err => {
    console.error('Failed to initialize storage directory:', err);
  });
}

/**
 * Start multipart upload
 */
async function startMultipartUpload(fileName, fileSize) {
  const fileId = uuidv4();
  const uploadId = uuidv4();
  
  if (STORAGE_TYPE === 'cloud') {
    // Cloud storage: Start S3 multipart upload
    if (!BUCKET_NAME) {
      throw new Error('S3_BUCKET_NAME is required for cloud storage');
    }
    
    const key = `uploads/${fileId}/${fileName}`;
    const command = new s3Helpers.CreateMultipartUploadCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    const response = await s3Client.send(command);
    
    multipartUploads.set(uploadId, {
      fileId,
      fileName,
      fileSize,
      key,
      s3UploadId: response.UploadId,
      type: 'cloud'
    });

    return { uploadId, fileId, key, s3UploadId: response.UploadId };
  } else {
    // Local storage: Create directory structure
    const filePath = path.join(STORAGE_DIR, fileId, fileName);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    
    multipartUploads.set(uploadId, {
      fileId,
      fileName,
      fileSize,
      filePath,
      parts: [],
      tempChunks: new Map(),
      type: 'local'
    });

    return { uploadId, fileId, filePath };
  }
}

/**
 * Get presigned URL for uploading a chunk (cloud only)
 */
async function getUploadPartUrl(uploadId, partNumber) {
  if (STORAGE_TYPE !== 'cloud') {
    throw new Error('Presigned URLs only available for cloud storage');
  }

  const uploadInfo = multipartUploads.get(uploadId);
  if (!uploadInfo) {
    throw new Error('Upload session not found');
  }

  const command = new s3Helpers.UploadPartCommand({
    Bucket: BUCKET_NAME,
    Key: uploadInfo.key,
    PartNumber: partNumber,
    UploadId: uploadInfo.s3UploadId
  });

  const presignedUrl = await s3Helpers.getSignedUrl(s3Client, command, {
    expiresIn: 3600
  });

  return presignedUrl;
}

/**
 * Upload chunk (local only - for direct uploads)
 */
async function uploadChunk(uploadId, partNumber, chunkData) {
  if (STORAGE_TYPE !== 'local') {
    throw new Error('Direct chunk uploads only available for local storage');
  }

  const uploadInfo = multipartUploads.get(uploadId);
  if (!uploadInfo) {
    throw new Error('Upload session not found');
  }

  uploadInfo.tempChunks.set(partNumber, chunkData);
  return { success: true, partNumber };
}

/**
 * Complete multipart upload
 */
async function completeMultipartUpload(uploadId, parts) {
  const uploadInfo = multipartUploads.get(uploadId);
  if (!uploadInfo) {
    throw new Error('Upload session not found');
  }

  if (STORAGE_TYPE === 'cloud') {
    // Cloud: Complete S3 multipart upload
    const sortedParts = parts
      .map(part => ({
        ETag: part.etag,
        PartNumber: part.partNumber
      }))
      .sort((a, b) => a.PartNumber - b.PartNumber);

    const command = new s3Helpers.CompleteMultipartUploadCommand({
      Bucket: BUCKET_NAME,
      Key: uploadInfo.key,
      UploadId: uploadInfo.s3UploadId,
      MultipartUpload: {
        Parts: sortedParts
      }
    });

    const response = await s3Client.send(command);
    multipartUploads.delete(uploadId);

    return {
      fileId: uploadInfo.fileId,
      key: uploadInfo.key,
      fileName: uploadInfo.fileName,
      location: response.Location
    };
  } else {
    // Local: Combine chunks into file
    const sortedParts = parts
      .map(part => part.partNumber)
      .sort((a, b) => a - b);

    const fs = require('fs');
    const writeStream = fs.createWriteStream(uploadInfo.filePath);
    
    for (const partNumber of sortedParts) {
      const chunkData = uploadInfo.tempChunks.get(partNumber);
      if (!chunkData) {
        writeStream.destroy();
        throw new Error(`Chunk ${partNumber} not found`);
      }
      
      const canContinue = writeStream.write(chunkData);
      if (!canContinue) {
        await new Promise(resolve => writeStream.once('drain', resolve));
      }
    }
    
    writeStream.end();
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    uploadInfo.tempChunks.clear();
    multipartUploads.delete(uploadId);

    return {
      fileId: uploadInfo.fileId,
      filePath: uploadInfo.filePath,
      fileName: uploadInfo.fileName
    };
  }
}

/**
 * Abort multipart upload
 */
async function abortMultipartUpload(uploadId) {
  const uploadInfo = multipartUploads.get(uploadId);
  if (!uploadInfo) {
    throw new Error('Upload session not found');
  }

  if (STORAGE_TYPE === 'cloud') {
    const command = new s3Helpers.AbortMultipartUploadCommand({
      Bucket: BUCKET_NAME,
      Key: uploadInfo.key,
      UploadId: uploadInfo.s3UploadId
    });
    await s3Client.send(command);
  } else {
    uploadInfo.tempChunks.clear();
    try {
      const fileDir = path.dirname(uploadInfo.filePath);
      await fs.rmdir(fileDir, { recursive: true });
    } catch (err) {
      // Ignore errors
    }
  }

  multipartUploads.delete(uploadId);
}

/**
 * Get file path/key
 */
async function getFilePath(fileId) {
  if (STORAGE_TYPE === 'cloud') {
    // For cloud, we need to get from database
    const { getFileMetadata } = require('./database');
    const file = await getFileMetadata(fileId);
    return file ? file.key : null;
  } else {
    const fileDir = path.join(STORAGE_DIR, fileId);
    const files = await fs.readdir(fileDir);
    if (files.length === 0) {
      throw new Error('File not found');
    }
    return path.join(fileDir, files[0]);
  }
}

/**
 * Get presigned download URL (cloud only)
 */
async function getPresignedDownloadUrl(key, expiresIn = 3600) {
  if (STORAGE_TYPE !== 'cloud') {
    throw new Error('Presigned URLs only available for cloud storage');
  }

  const command = new s3Helpers.GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key
  });

  return await s3Helpers.getSignedUrl(s3Client, command, {
    expiresIn
  });
}

module.exports = {
  STORAGE_TYPE,
  startMultipartUpload,
  getUploadPartUrl,
  uploadChunk,
  completeMultipartUpload,
  abortMultipartUpload,
  getFilePath,
  getPresignedDownloadUrl,
  multipartUploads
};
