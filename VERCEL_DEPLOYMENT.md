# Deploying to Vercel with 30GB+ File Support

This guide explains how to deploy the WeTransfer clone to Vercel with support for files up to 30GB+.

## ⚠️ Important: Vercel Limitations

Vercel has some limitations that affect file uploads:

1. **Request Body Size**: 4.5MB limit (Hobby) / 4.5MB (Pro)
2. **Function Timeout**: 10s (Hobby) / 60s (Pro)
3. **No Persistent Storage**: Filesystem is read-only (except `/tmp` which is ephemeral)
4. **SQLite Issues**: SQLite doesn't work well on serverless (read-only filesystem)

## ✅ Solution: Cloud Storage + Serverless Database

To support 30GB+ files on Vercel, we use:

1. **Cloud Storage** (S3, Cloudflare R2, or Backblaze B2) - Files uploaded directly from browser
2. **Serverless Database** - For metadata storage

## Setup Instructions

### 1. Choose Cloud Storage Provider

#### Option A: AWS S3
- Create an S3 bucket
- Create IAM user with multipart upload permissions
- Get access keys

#### Option B: Cloudflare R2 (Recommended - Free egress!)
- Create R2 bucket
- Create API token
- S3-compatible API

#### Option C: Backblaze B2
- Create B2 bucket
- Create application key
- S3-compatible API

### 2. Set Environment Variables in Vercel

Go to your Vercel project → Settings → Environment Variables:

```bash
# Storage Configuration
STORAGE_TYPE=cloud

# AWS S3 Configuration (or S3-compatible)
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket-name

# For Cloudflare R2:
# S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
# S3_FORCE_PATH_STYLE=true

# For Backblaze B2:
# S3_ENDPOINT=https://s3.us-west-000.backblazeb2.com
# S3_FORCE_PATH_STYLE=true

# Database (optional - for production use Vercel Postgres or similar)
# For now, SQLite will work but data won't persist between deployments
```

### 3. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# For production
vercel --prod
```

### 4. Configure CORS on Your Storage Bucket

**For AWS S3:**
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedOrigins": ["https://your-vercel-app.vercel.app"],
    "ExposeHeaders": ["ETag"]
  }
]
```

**For Cloudflare R2:**
- Go to R2 bucket settings
- Add CORS rule with your Vercel domain

### 5. Database Considerations

**Current Setup (SQLite):**
- Works for development
- Data lost on each deployment (serverless functions are stateless)
- Not recommended for production

**Production Options:**

1. **Vercel Postgres** (Recommended)
   ```bash
   vercel postgres create
   ```
   Then update `utils/database.js` to use Postgres instead of SQLite

2. **Turso** (Serverless SQLite)
   - Free tier available
   - Works with existing SQLite code

3. **PlanetScale** (MySQL)
   - Free tier available
   - Serverless MySQL

## How It Works on Vercel

1. **Upload Flow:**
   - User selects file → Frontend splits into 10MB chunks
   - Each chunk gets presigned URL from Vercel function
   - Chunk uploaded **directly to S3/R2** (bypasses Vercel)
   - When complete, Vercel function combines parts
   - Metadata saved to database

2. **Download Flow:**
   - User visits download link
   - Vercel function generates presigned URL
   - File downloaded directly from S3/R2

## Why This Works for 30GB+ Files

- ✅ **Chunks bypass Vercel**: Uploaded directly to cloud storage
- ✅ **No size limits**: Cloud storage handles large files
- ✅ **Fast**: Direct browser-to-storage transfer
- ✅ **Scalable**: No server resources used for file transfer

## Cost Considerations

### Cloudflare R2 (Recommended)
- **Storage**: $0.015/GB/month
- **Egress**: **FREE** (unlimited downloads!)
- **Operations**: $4.50/million Class A, $0.36/million Class B

### AWS S3
- **Storage**: $0.023/GB/month
- **Egress**: $0.09/GB (first 10TB)
- **Operations**: $0.005 per 1,000 requests

### Backblaze B2
- **Storage**: $0.005/GB/month (cheapest!)
- **Egress**: $0.01/GB (first 10GB free/day)
- **Operations**: Free

## Troubleshooting

### Upload Fails
- Check CORS configuration on bucket
- Verify environment variables in Vercel
- Check function logs in Vercel dashboard

### Database Errors
- SQLite won't persist on Vercel
- Use Vercel Postgres or Turso for production

### Timeout Errors
- Increase function timeout in `vercel.json`
- Pro plan allows up to 60s

## Alternative: Better Hosting for Large Files

If Vercel limitations are too restrictive, consider:

1. **Railway** - Persistent storage, no file size limits
2. **Render** - Persistent storage, Docker support
3. **DigitalOcean App Platform** - Full control, persistent storage
4. **Fly.io** - Persistent volumes, global deployment

These platforms allow local file storage and are better suited for large file handling.

## Next Steps

1. Set up cloud storage (R2 recommended)
2. Configure environment variables in Vercel
3. Deploy to Vercel
4. Test with a large file
5. Set up production database (Vercel Postgres or Turso)

