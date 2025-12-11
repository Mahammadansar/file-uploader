# Setting Up Cloud Storage for Vercel Deployment

Since you don't have cloud storage credentials yet, here's a step-by-step guide to set up **Cloudflare R2** (recommended - free downloads!) or alternatives.

## 🎯 Recommended: Cloudflare R2 (Best for Free Tier)

### Why Cloudflare R2?
- ✅ **FREE egress** (unlimited downloads - no bandwidth charges!)
- ✅ S3-compatible API (works with our code)
- ✅ $0.015/GB/month storage (very cheap)
- ✅ Easy setup
- ✅ Free tier: 10GB storage + unlimited egress

### Step-by-Step Setup

#### 1. Create Cloudflare Account
1. Go to https://dash.cloudflare.com/sign-up
2. Sign up for a free account (no credit card required for free tier)

#### 2. Enable R2
1. Log into Cloudflare dashboard
2. Click **"R2"** in the left sidebar
3. Click **"Get Started"** or **"Create bucket"**
4. Accept terms if prompted

#### 3. Create R2 Bucket
1. Click **"Create bucket"**
2. Enter bucket name (e.g., `file-uploader-bucket`)
3. Choose location (closest to your users)
4. Click **"Create bucket"**

#### 4. Create API Token
1. In R2 dashboard, click **"Manage R2 API Tokens"**
2. Click **"Create API token"**
3. Configure:
   - **Token name**: `file-uploader-token`
   - **Permissions**: 
     - ✅ Object Read & Write
     - ✅ Admin Read & Write (for bucket management)
   - **TTL**: Leave default or set expiration
4. Click **"Create API Token"**
5. **IMPORTANT**: Copy these values immediately (you won't see them again!):
   - **Access Key ID**
   - **Secret Access Key**

#### 5. Get Your Account ID
1. In Cloudflare dashboard, go to any page
2. Look at the right sidebar - you'll see your **Account ID**
3. Copy it

#### 6. Get Your R2 Endpoint
Your endpoint will be: `https://<account-id>.r2.cloudflarestorage.com`

To find it:
1. Go to your R2 bucket
2. Click on any file (or upload a test file)
3. The URL will show the endpoint format
4. Or use: `https://<your-account-id>.r2.cloudflarestorage.com`

#### 7. Configure CORS (Important!)
1. In your R2 bucket, go to **Settings**
2. Scroll to **"CORS Policy"**
3. Click **"Edit CORS Policy"**
4. Add this configuration:
```json
[
  {
    "AllowedOrigins": [
      "https://your-vercel-app.vercel.app",
      "http://localhost:3000"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "POST",
      "HEAD",
      "DELETE"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag",
      "Content-Length"
    ],
    "MaxAgeSeconds": 3600
  }
]
```
5. Replace `your-vercel-app.vercel.app` with your actual Vercel domain
6. Click **"Save"**

#### 8. Set Environment Variables in Vercel
Go to your Vercel project → Settings → Environment Variables:

```bash
STORAGE_TYPE=cloud
AWS_ACCESS_KEY_ID=<your-r2-access-key-id>
AWS_SECRET_ACCESS_KEY=<your-r2-secret-access-key>
AWS_REGION=auto
S3_BUCKET_NAME=<your-bucket-name>
S3_ENDPOINT=https://<your-account-id>.r2.cloudflarestorage.com
S3_FORCE_PATH_STYLE=true
```

**Example:**
```bash
STORAGE_TYPE=cloud
AWS_ACCESS_KEY_ID=abc123def456...
AWS_SECRET_ACCESS_KEY=xyz789uvw012...
AWS_REGION=auto
S3_BUCKET_NAME=file-uploader-bucket
S3_ENDPOINT=https://a1b2c3d4e5f6.r2.cloudflarestorage.com
S3_FORCE_PATH_STYLE=true
```

#### 9. Test Your Setup
1. Deploy to Vercel
2. Try uploading a small file
3. Check R2 bucket - file should appear there!

---

## Alternative Option 1: AWS S3 (If You Prefer AWS)

### Setup Steps

#### 1. Create AWS Account
1. Go to https://aws.amazon.com/
2. Click "Create an AWS Account"
3. Complete signup (requires credit card, but free tier available)

#### 2. Create S3 Bucket
1. Go to AWS Console → S3
2. Click "Create bucket"
3. Configure:
   - **Bucket name**: `file-uploader-bucket` (must be globally unique)
   - **Region**: Choose closest to users
   - **Block Public Access**: Uncheck (or configure CORS properly)
4. Click "Create bucket"

#### 3. Create IAM User
1. Go to IAM → Users → "Add users"
2. Username: `file-uploader-user`
3. Select "Programmatic access"
4. Click "Next: Permissions"
5. Click "Attach policies directly"
6. Search and select: `AmazonS3FullAccess` (or create custom policy)
7. Click "Next" → "Create user"
8. **IMPORTANT**: Copy:
   - **Access Key ID**
   - **Secret Access Key**

#### 4. Configure CORS
1. Go to your S3 bucket → Permissions → CORS
2. Add this configuration:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedOrigins": [
      "https://your-vercel-app.vercel.app",
      "http://localhost:3000"
    ],
    "ExposeHeaders": ["ETag"]
  }
]
```

#### 5. Set Environment Variables in Vercel
```bash
STORAGE_TYPE=cloud
AWS_ACCESS_KEY_ID=<your-access-key>
AWS_SECRET_ACCESS_KEY=<your-secret-key>
AWS_REGION=us-east-1
S3_BUCKET_NAME=<your-bucket-name>
```

---

## Alternative Option 2: Backblaze B2 (Cheapest Storage)

### Setup Steps

#### 1. Create Backblaze Account
1. Go to https://www.backblaze.com/b2/sign-up.html
2. Sign up (free 10GB storage)

#### 2. Create B2 Bucket
1. Go to B2 Cloud Storage → Buckets
2. Click "Create a Bucket"
3. Configure:
   - **Bucket Name**: `file-uploader-bucket`
   - **Files in Bucket are**: Public (or Private with application key)
4. Click "Create a Bucket"

#### 3. Create Application Key
1. Go to App Keys → "Add a New Application Key"
2. Configure:
   - **Key Name**: `file-uploader-key`
   - **Allow access to Bucket(s)**: Select your bucket
   - **Type of Access**: Read and Write
3. Click "Create New Key"
4. **IMPORTANT**: Copy:
   - **keyID**
   - **applicationKey**

#### 4. Get Endpoint
Your endpoint will be: `https://s3.<region>.backblazeb2.com`

Find your region:
- Go to your bucket → Settings
- Note the region (e.g., `us-west-000`)

#### 5. Set Environment Variables in Vercel
```bash
STORAGE_TYPE=cloud
AWS_ACCESS_KEY_ID=<your-key-id>
AWS_SECRET_ACCESS_KEY=<your-application-key>
AWS_REGION=us-west-000
S3_BUCKET_NAME=<your-bucket-name>
S3_ENDPOINT=https://s3.us-west-000.backblazeb2.com
S3_FORCE_PATH_STYLE=true
```

---

## 🆓 Free Tier Comparison

| Service | Free Storage | Free Egress | Cost After Free Tier |
|---------|-------------|-------------|---------------------|
| **Cloudflare R2** | 10GB | **Unlimited** | $0.015/GB storage |
| **AWS S3** | 5GB | 100GB/month | $0.023/GB storage, $0.09/GB egress |
| **Backblaze B2** | 10GB | 1GB/day | $0.005/GB storage, $0.01/GB egress |

**Winner: Cloudflare R2** (free unlimited downloads!)

---

## 🚀 Quick Start: Cloudflare R2 (Recommended)

1. **Sign up**: https://dash.cloudflare.com/sign-up (free)
2. **Create bucket**: R2 → Create bucket
3. **Create API token**: R2 → Manage R2 API Tokens → Create API token
4. **Get Account ID**: Right sidebar in Cloudflare dashboard
5. **Set CORS**: Bucket Settings → CORS Policy
6. **Add to Vercel**: Environment Variables (see step 8 above)

**Total time: ~10 minutes**

---

## ❓ Troubleshooting

### "Access Denied" Error
- Check CORS configuration
- Verify API token permissions
- Ensure bucket name is correct

### "Invalid Endpoint" Error
- Verify endpoint URL format
- Check account ID is correct
- Ensure `S3_FORCE_PATH_STYLE=true` is set

### Files Not Appearing
- Check bucket name matches
- Verify API token has correct permissions
- Check Vercel function logs

---

## 💡 Don't Want Cloud Storage?

If you prefer **not** to use cloud storage, consider these alternatives to Vercel:

1. **Railway** - Persistent storage, no file size limits
2. **Render** - Persistent storage, Docker support  
3. **DigitalOcean App Platform** - Full control
4. **Fly.io** - Persistent volumes

These platforms allow local file storage and work better for large files without cloud storage setup.

