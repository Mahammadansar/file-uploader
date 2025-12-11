const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Storage directory
const STORAGE_DIR = path.join(__dirname, '..', 'uploads');
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB

// Ensure storage directory exists
async function ensureStorageDir() {
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating storage directory:', error);
    throw error;
  }
}

// Initialize storage on module load
ensureStorageDir().catch(err => {
  console.error('Failed to initialize storage directory:', err);
});

// Store multipart upload info (uploadId -> { fileId, fileName, fileSize, filePath, parts })
const multipartUploads = new Map();

/**
 * Start a multipart upload session
 */
async function startMultipartUpload(fileName, fileSize) {
  try {
    const fileId = uuidv4();
    const uploadId = uuidv4();
    const filePath = path.join(STORAGE_DIR, fileId, fileName);
    
    // Create directory for this file
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    
    // Store upload info
    multipartUploads.set(uploadId, {
      fileId,
      fileName,
      fileSize,
      filePath,
      parts: [],
      tempChunks: new Map() // Store chunks temporarily
    });

    return { uploadId, fileId, filePath };
  } catch (error) {
    console.error('Error starting multipart upload:', error);
    throw error;
  }
}

/**
 * Upload a chunk directly to the server
 */
async function uploadChunk(uploadId, partNumber, chunkData) {
  try {
    const uploadInfo = multipartUploads.get(uploadId);
    if (!uploadInfo) {
      throw new Error('Upload session not found');
    }

    // Store chunk data temporarily
    uploadInfo.tempChunks.set(partNumber, chunkData);

    return { success: true, partNumber };
  } catch (error) {
    console.error('Error uploading chunk:', error);
    throw error;
  }
}

/**
 * Complete multipart upload - combine all chunks into final file
 */
async function completeMultipartUpload(uploadId, parts) {
  try {
    const uploadInfo = multipartUploads.get(uploadId);
    if (!uploadInfo) {
      throw new Error('Upload session not found');
    }

    // Sort parts by part number
    const sortedParts = parts
      .map(part => part.partNumber)
      .sort((a, b) => a - b);

    // Write chunks to file in order using streams
    const fs = require('fs');
    const writeStream = fs.createWriteStream(uploadInfo.filePath);
    
    // Write chunks sequentially
    for (const partNumber of sortedParts) {
      const chunkData = uploadInfo.tempChunks.get(partNumber);
      if (!chunkData) {
        writeStream.destroy();
        throw new Error(`Chunk ${partNumber} not found`);
      }
      
      // Write chunk and wait for drain if needed
      const canContinue = writeStream.write(chunkData);
      if (!canContinue) {
        await new Promise(resolve => writeStream.once('drain', resolve));
      }
    }
    
    writeStream.end();

    // Wait for file to be written
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    // Clean up temporary chunks
    uploadInfo.tempChunks.clear();
    
    const result = {
      fileId: uploadInfo.fileId,
      filePath: uploadInfo.filePath,
      fileName: uploadInfo.fileName
    };

    // Clean up upload session
    multipartUploads.delete(uploadId);

    return result;
  } catch (error) {
    console.error('Error completing multipart upload:', error);
    throw error;
  }
}

/**
 * Abort multipart upload - clean up temporary files
 */
async function abortMultipartUpload(uploadId) {
  try {
    const uploadInfo = multipartUploads.get(uploadId);
    if (!uploadInfo) {
      throw new Error('Upload session not found');
    }

    // Clean up temporary chunks
    uploadInfo.tempChunks.clear();

    // Try to delete the file directory if it exists
    try {
      const fileDir = path.dirname(uploadInfo.filePath);
      await fs.rmdir(fileDir, { recursive: true });
    } catch (err) {
      // Ignore errors if directory doesn't exist
    }

    // Clean up upload session
    multipartUploads.delete(uploadId);
  } catch (error) {
    console.error('Error aborting multipart upload:', error);
    throw error;
  }
}

/**
 * Get file path by file ID
 */
async function getFilePath(fileId) {
  try {
    const fileDir = path.join(STORAGE_DIR, fileId);
    const files = await fs.readdir(fileDir);
    
    if (files.length === 0) {
      throw new Error('File not found');
    }

    return path.join(fileDir, files[0]);
  } catch (error) {
    console.error('Error getting file path:', error);
    throw error;
  }
}

/**
 * Delete file by file ID
 */
async function deleteFile(fileId) {
  try {
    const fileDir = path.join(STORAGE_DIR, fileId);
    await fs.rmdir(fileDir, { recursive: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
}

module.exports = {
  startMultipartUpload,
  uploadChunk,
  completeMultipartUpload,
  abortMultipartUpload,
  getFilePath,
  deleteFile,
  STORAGE_DIR
};

