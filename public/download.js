const API_BASE = '/api/download';

// Get file ID from URL
const urlParams = new URLSearchParams(window.location.search);
const fileId = urlParams.get('id');

const loading = document.getElementById('loading');
const error = document.getElementById('error');
const errorMessage = document.getElementById('errorMessage');
const downloadReady = document.getElementById('downloadReady');
const downloadFileName = document.getElementById('downloadFileName');
const downloadFileSize = document.getElementById('downloadFileSize');
const downloadBtn = document.getElementById('downloadBtn');

if (!fileId) {
    showError('No file ID provided. Please use a valid download link.');
} else {
    loadFileInfo();
}

async function loadFileInfo() {
    try {
        const response = await fetch(`${API_BASE}/url?id=${fileId}`);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'File not found');
        }

        const fileData = await response.json();
        
        // Display file info
        downloadFileName.textContent = fileData.fileName;
        downloadFileSize.textContent = formatFileSize(fileData.fileSize);
        
        // Set up download button
        downloadBtn.onclick = () => {
            window.location.href = fileData.downloadUrl;
        };

        // Show download ready section
        loading.classList.add('hidden');
        downloadReady.classList.remove('hidden');

        // Auto-download after a short delay
        setTimeout(() => {
            downloadBtn.click();
        }, 1000);

    } catch (err) {
        console.error('Error loading file:', err);
        showError(err.message || 'Failed to load file information');
    }
}

function showError(message) {
    loading.classList.add('hidden');
    errorMessage.textContent = message;
    error.classList.remove('hidden');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

