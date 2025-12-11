# WeTransfer Clone - Large File Sharing Platform

A simple, WeTransfer-style file sharing platform built with Node.js and Express. Files are stored locally on the server (just like WeTransfer stores files on their servers) and shared via unique download links.

## How WeTransfer Works

WeTransfer works by:
1. **Upload**: Users upload files to WeTransfer's servers
2. **Storage**: Files are stored on WeTransfer's infrastructure (they use cloud storage behind the scenes)
3. **Link Generation**: A unique, shareable link is generated for each upload
4. **Sharing**: Recipients can download files using the link (usually valid for 7 days on free accounts)
5. **Auto-cleanup**: Files are automatically deleted after expiration

This implementation works the same way, but stores files locally on your server instead of cloud storage.

## Features

- ✅ **Large File Support**: Upload files up to 20GB+ using multipart upload
- ✅ **Progress Tracking**: Real-time upload progress with speed indicators
- ✅ **Chunked Upload**: 10MB chunks for reliable large file transfers
- ✅ **Shareable Links**: Generate shareable download links after upload
- ✅ **Auto-Download**: Automatic file download on the download page
- ✅ **Clean UI**: Modern, responsive interface with no frameworks
- ✅ **SQLite Database**: Simple file metadata storage
- ✅ **CORS Enabled**: Ready for cross-origin requests
- ✅ **No Cloud Required**: Files stored locally on your server

## Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: Plain HTML, CSS, JavaScript (no frameworks)
- **Storage**: Local filesystem (files stored in `uploads/` directory)
- **Database**: SQLite3
- **Upload**: Multipart chunked uploads

## Project Structure

```
.
├── server.js              # Main Express server
├── routes/
│   ├── upload.js          # Upload endpoints
│   └── download.js         # Download endpoints
├── utils/
│   ├── fileStorage.js     # Local file storage operations
│   └── database.js        # SQLite database operations
├── public/
│   ├── index.html         # Upload page
│   ├── download.html      # Download page
│   ├── styles.css         # Styles
│   ├── upload.js          # Upload logic
│   └── download.js        # Download logic
├── uploads/               # File storage directory (created automatically)
├── package.json
└── README.md
```

## Setup Instructions

### Local Development (No Cloud Storage Needed)

#### 1. Install Dependencies

```bash
npm install
```

#### 2. Run the Server

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

That's it! No AWS credentials or cloud storage setup needed. The server will:
- Create the `uploads/` directory automatically
- Create the SQLite database automatically
- Start serving on `http://localhost:3000`

#### 3. Optional: Configure Port

Create a `.env` file to customize the port:

```bash
PORT=3000
```

### Deploying to Vercel (Cloud Storage Required)

For Vercel deployment with 30GB+ file support, you need cloud storage. **Don't have credentials yet?** No problem!

📖 **Quick Setup Guide**: See [`QUICK_START_R2.md`](./QUICK_START_R2.md) for a 5-minute Cloudflare R2 setup

📚 **Detailed Guide**: See [`SETUP_CLOUD_STORAGE.md`](./SETUP_CLOUD_STORAGE.md) for:
- Cloudflare R2 setup (recommended - free downloads!)
- AWS S3 setup
- Backblaze B2 setup
- Comparison of free tiers

🚀 **Vercel Deployment**: See [`VERCEL_DEPLOYMENT.md`](./VERCEL_DEPLOYMENT.md) for complete deployment instructions

## Usage

### Uploading a File

1. Navigate to `http://localhost:3000`
2. Click "Choose a file" and select your file
3. Click "Upload File"
4. Watch the progress bar and logs
5. Copy the shareable link when upload completes

### Downloading a File

1. Visit the shareable link: `http://localhost:3000/download?id=<fileId>`
2. The file will automatically start downloading
3. Or click the "Download File" button

## API Endpoints

### Upload Endpoints

#### `POST /api/upload/start`
Start a new multipart upload.

**Request:**
```json
{
  "fileName": "example.zip",
  "fileSize": 104857600
}
```

**Response:**
```json
{
  "uploadId": "abc123...",
  "fileId": "uuid-here",
  "chunkSize": 10485760
}
```

#### `POST /api/upload/part`
Upload a chunk directly to the server.

**Request:** FormData
- `chunk`: File chunk (Blob/Buffer)
- `uploadId`: Upload session ID
- `partNumber`: Chunk number

**Response:**
```json
{
  "success": true,
  "partNumber": 1
}
```

#### `POST /api/upload/complete`
Complete the multipart upload.

**Request:**
```json
{
  "uploadId": "abc123...",
  "parts": [
    { "partNumber": 1 },
    { "partNumber": 2 }
  ]
}
```

**Response:**
```json
{
  "fileId": "uuid-here",
  "downloadUrl": "/download?id=uuid-here"
}
```

#### `POST /api/upload/abort`
Abort an ongoing multipart upload.

**Request:**
```json
{
  "uploadId": "abc123..."
}
```

### Download Endpoints

#### `GET /api/download/url?id=<fileId>`
Get download information for a file.

**Response:**
```json
{
  "fileName": "example.zip",
  "fileSize": 104857600,
  "downloadUrl": "/api/download/file/uuid-here",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

#### `GET /api/download/file/:id`
Download the file directly (streams file to client).

## Configuration

### Chunk Size

The default chunk size is 10MB. To change it, modify `CHUNK_SIZE` in `public/upload.js`:

```javascript
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
```

### File Size Limit

The default limit is 20GB. To change it, modify the limit in `routes/upload.js`:

```javascript
const maxFileSize = 20 * 1024 * 1024 * 1024; // 20GB
```

### Storage Location

Files are stored in the `uploads/` directory by default. To change this, modify `STORAGE_DIR` in `utils/fileStorage.js`.

## Database Schema

The SQLite database stores file metadata:

```sql
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  fileName TEXT NOT NULL,
  fileSize INTEGER NOT NULL,
  key TEXT NOT NULL,
  url TEXT,
  createdAt TEXT NOT NULL
)
```

## How It Works

1. **Upload Flow**:
   - User selects a file
   - Frontend splits file into 10MB chunks
   - Each chunk is uploaded to `/api/upload/part`
   - Server stores chunks temporarily in memory
   - When all chunks are uploaded, `/api/upload/complete` combines them into final file
   - File is saved to `uploads/<fileId>/<fileName>`
   - Metadata is saved to database

2. **Download Flow**:
   - User visits `/download?id=<fileId>`
   - Server looks up file metadata in database
   - Server streams file from `uploads/` directory to client
   - Browser downloads the file

## Deployment

### Production Considerations

1. **File Cleanup**: Implement automatic file deletion after a certain period (e.g., 7 days like WeTransfer):
   ```javascript
   // Add a cleanup job that runs daily
   // Delete files older than 7 days
   ```

2. **Storage Management**: Monitor disk space. For production, consider:
   - Setting up disk quotas
   - Implementing file size limits per user
   - Using cloud storage (S3, etc.) for scalability

3. **Rate Limiting**: Add rate limiting to prevent abuse:
   ```bash
   npm install express-rate-limit
   ```

4. **HTTPS**: Always use HTTPS in production for secure file transfers.

5. **Database Backups**: Implement regular backups of the SQLite database.

6. **CORS Configuration**: Configure CORS properly for your domain:
   ```javascript
   app.use(cors({
     origin: 'https://yourdomain.com',
     credentials: true
   }));
   ```

### Docker Deployment

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

**Important**: Mount a volume for the `uploads/` directory to persist files:

```bash
docker run -v /path/to/uploads:/app/uploads -p 3000:3000 your-image
```

## File Storage

Files are stored in the following structure:
```
uploads/
  └── <fileId>/
      └── <originalFileName>
```

Each file gets its own directory with a unique ID, making it easy to:
- Find files by ID
- Clean up files
- Prevent filename conflicts

## Troubleshooting

### Upload Fails

- Check disk space: `df -h` (Linux/Mac) or check disk properties (Windows)
- Check file permissions for `uploads/` directory
- Review server logs for errors
- Ensure chunk size doesn't exceed server limits

### Download Not Working

- Verify the file exists in `uploads/` directory
- Check file permissions
- Review server logs for errors
- Ensure database has correct file metadata

### Database Errors

- Check file permissions for `database.sqlite`
- Ensure SQLite3 is properly installed
- Review database initialization logs

### Out of Memory Errors

For very large files, you may need to increase Node.js memory:
```bash
node --max-old-space-size=4096 server.js
```

## Differences from Real WeTransfer

1. **Storage**: WeTransfer uses cloud storage (likely S3), this uses local filesystem
2. **Expiration**: WeTransfer auto-deletes after 7 days, this keeps files until manually deleted
3. **Scale**: WeTransfer handles millions of users, this is designed for smaller scale
4. **CDN**: WeTransfer uses CDN for fast downloads globally, this serves directly from server

## Future Enhancements

- [ ] Automatic file expiration (delete after X days)
- [ ] File preview for images/PDFs
- [ ] Multiple file uploads
- [ ] Password protection for links
- [ ] Download count tracking
- [ ] Email notifications
- [ ] Cloud storage integration (optional)

## License

MIT

## Contributing

Feel free to submit issues and enhancement requests!
