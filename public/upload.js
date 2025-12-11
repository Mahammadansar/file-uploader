const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
const API_BASE = '/api/upload';

let currentUpload = {
    file: null,
    uploadId: null,
    fileId: null,
    storageType: 'local',
    totalChunks: 0,
    uploadedChunks: 0,
    parts: [],
    startTime: null,
    abortController: null
};

// DOM Elements
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const uploadBtn = document.getElementById('uploadBtn');
const cancelBtn = document.getElementById('cancelBtn');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const uploadSpeed = document.getElementById('uploadSpeed');
const logs = document.getElementById('logs');
const result = document.getElementById('result');
const shareLink = document.getElementById('shareLink');
const copyBtn = document.getElementById('copyBtn');

// Event Listeners
fileInput.addEventListener('change', handleFileSelect);
uploadBtn.addEventListener('click', startUpload);
cancelBtn.addEventListener('click', cancelUpload);
copyBtn.addEventListener('click', copyShareLink);

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    currentUpload.file = file;
    
    // Show file info
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    fileInfo.classList.remove('hidden');
    uploadBtn.classList.remove('hidden');
    uploadBtn.disabled = false;
    
    // Hide previous results
    result.classList.add('hidden');
    progressContainer.classList.add('hidden');
    logs.classList.add('hidden');
    logs.innerHTML = '';
}

async function startUpload() {
    if (!currentUpload.file) return;

    const file = currentUpload.file;
    currentUpload.startTime = Date.now();
    currentUpload.abortController = new AbortController();
    
    // Calculate total chunks
    currentUpload.totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    currentUpload.uploadedChunks = 0;
    currentUpload.parts = [];

    // Disable upload button
    uploadBtn.disabled = true;
    cancelBtn.classList.remove('hidden');
    progressContainer.classList.remove('hidden');
    logs.classList.remove('hidden');
    result.classList.add('hidden');

    addLog('Starting upload...', 'info');

    try {
        // Step 1: Start multipart upload
        addLog('Initializing multipart upload...', 'info');
        const startResponse = await fetch(`${API_BASE}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileName: file.name,
                fileSize: file.size
            })
        });

        if (!startResponse.ok) {
            const error = await startResponse.json();
            throw new Error(error.error || 'Failed to start upload');
        }

        const startData = await startResponse.json();
        currentUpload.uploadId = startData.uploadId;
        currentUpload.fileId = startData.fileId;
        currentUpload.storageType = startData.storageType || 'local';

        addLog(`Upload initialized. File ID: ${currentUpload.fileId}`, 'success');
        addLog(`Storage type: ${currentUpload.storageType}`, 'info');
        addLog(`Total chunks: ${currentUpload.totalChunks}`, 'info');

        // Step 2: Upload chunks
        for (let i = 0; i < currentUpload.totalChunks; i++) {
            if (currentUpload.abortController.signal.aborted) {
                throw new Error('Upload cancelled');
            }

            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const chunk = file.slice(start, end);
            const partNumber = i + 1;

            addLog(`Uploading chunk ${partNumber}/${currentUpload.totalChunks}...`, 'info');

            if (currentUpload.storageType === 'cloud') {
                // Cloud storage: Get presigned URL and upload directly to S3
                const partResponse = await fetch(`${API_BASE}/part`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        uploadId: currentUpload.uploadId,
                        partNumber: partNumber
                    })
                });

                if (!partResponse.ok) {
                    const error = await partResponse.json();
                    throw new Error(error.error || 'Failed to get upload URL');
                }

                const partData = await partResponse.json();
                const presignedUrl = partData.presignedUrl;

                // Upload chunk directly to S3
                const uploadResponse = await fetch(presignedUrl, {
                    method: 'PUT',
                    body: chunk,
                    signal: currentUpload.abortController.signal
                });

                if (!uploadResponse.ok) {
                    throw new Error(`Failed to upload chunk ${partNumber} to cloud storage`);
                }

                // Get ETag from response
                const etag = uploadResponse.headers.get('ETag');
                if (!etag) {
                    throw new Error(`No ETag received for chunk ${partNumber}`);
                }

                currentUpload.parts.push({
                    partNumber: partNumber,
                    etag: etag.replace(/"/g, '') // Remove quotes from ETag
                });
            } else {
                // Local storage: Upload chunk to server
                const formData = new FormData();
                formData.append('chunk', chunk, `chunk-${partNumber}`);
                formData.append('uploadId', currentUpload.uploadId);
                formData.append('partNumber', partNumber.toString());

                const uploadResponse = await fetch(`${API_BASE}/chunk`, {
                    method: 'POST',
                    body: formData,
                    signal: currentUpload.abortController.signal
                });

                if (!uploadResponse.ok) {
                    const error = await uploadResponse.json();
                    throw new Error(error.error || `Failed to upload chunk ${partNumber}`);
                }

                currentUpload.parts.push({
                    partNumber: partNumber
                });
            }

            currentUpload.uploadedChunks++;
            updateProgress();

            addLog(`Chunk ${partNumber}/${currentUpload.totalChunks} uploaded successfully`, 'success');
        }

        // Step 3: Complete multipart upload
        addLog('Completing upload...', 'info');
        const completeResponse = await fetch(`${API_BASE}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                uploadId: currentUpload.uploadId,
                parts: currentUpload.parts
            })
        });

        if (!completeResponse.ok) {
            const error = await completeResponse.json();
            throw new Error(error.error || 'Failed to complete upload');
        }

        const completeData = await completeResponse.json();
        
        addLog('Upload completed successfully!', 'success');
        
        // Show result
        const shareUrl = `${window.location.origin}/download?id=${completeData.fileId}`;
        shareLink.value = shareUrl;
        result.classList.remove('hidden');
        cancelBtn.classList.add('hidden');
        uploadBtn.disabled = false;

    } catch (error) {
        if (error.name === 'AbortError' || error.message === 'Upload cancelled') {
            addLog('Upload cancelled by user', 'error');
            await abortUpload();
        } else {
            addLog(`Error: ${error.message}`, 'error');
            console.error('Upload error:', error);
        }
        
        uploadBtn.disabled = false;
        cancelBtn.classList.add('hidden');
    }
}

async function cancelUpload() {
    if (currentUpload.abortController) {
        currentUpload.abortController.abort();
    }
}

async function abortUpload() {
    if (!currentUpload.uploadId) return;

    try {
        await fetch(`${API_BASE}/abort`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                uploadId: currentUpload.uploadId
            })
        });
    } catch (error) {
        console.error('Error aborting upload:', error);
    }
}

function updateProgress() {
    const progress = (currentUpload.uploadedChunks / currentUpload.totalChunks) * 100;
    progressBar.style.width = `${progress}%`;
    progressText.textContent = `${Math.round(progress)}%`;

    // Calculate upload speed
    if (currentUpload.startTime) {
        const elapsed = (Date.now() - currentUpload.startTime) / 1000; // seconds
        const uploaded = currentUpload.uploadedChunks * CHUNK_SIZE;
        const speed = uploaded / elapsed; // bytes per second
        uploadSpeed.textContent = `Speed: ${formatFileSize(speed)}/s`;
    }
}

function addLog(message, type = 'info') {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    const timestamp = new Date().toLocaleTimeString();
    logEntry.textContent = `[${timestamp}] ${message}`;
    logs.appendChild(logEntry);
    logs.scrollTop = logs.scrollHeight;
}

function copyShareLink() {
    shareLink.select();
    shareLink.setSelectionRange(0, 99999); // For mobile devices
    
    try {
        document.execCommand('copy');
        copyBtn.textContent = 'Copied!';
        copyBtn.classList.add('copied');
        
        setTimeout(() => {
            copyBtn.textContent = 'Copy';
            copyBtn.classList.remove('copied');
        }, 2000);
    } catch (err) {
        console.error('Failed to copy:', err);
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
