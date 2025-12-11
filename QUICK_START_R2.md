# Quick Start: Cloudflare R2 Setup (5 Minutes)

## Step 1: Sign Up (1 minute)
1. Go to: https://dash.cloudflare.com/sign-up
2. Create free account (no credit card needed)

## Step 2: Create Bucket (1 minute)
1. In dashboard, click **"R2"** (left sidebar)
2. Click **"Create bucket"**
3. Name it: `file-uploader` (or any name)
4. Click **"Create bucket"**

## Step 3: Get API Token (2 minutes)
1. Click **"Manage R2 API Tokens"** (top right)
2. Click **"Create API token"**
3. Name: `file-uploader-token`
4. Permissions: Select **"Object Read & Write"** and **"Admin Read & Write"**
5. Click **"Create API Token"**
6. **COPY THESE** (you won't see them again!):
   - Access Key ID: `________________`
   - Secret Access Key: `________________`

## Step 4: Get Account ID (30 seconds)
1. Look at right sidebar in Cloudflare dashboard
2. Find **"Account ID"** 
3. Copy it: `________________`

## Step 5: Set CORS (1 minute)
1. Go to your bucket → **Settings** tab
2. Scroll to **"CORS Policy"**
3. Click **"Edit CORS Policy"**
4. Paste this (replace with your Vercel URL after deployment):
```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
```
5. Click **"Save"**

## Step 6: Add to Vercel
In Vercel project → Settings → Environment Variables, add:

```bash
STORAGE_TYPE=cloud
AWS_ACCESS_KEY_ID=<paste-access-key-id>
AWS_SECRET_ACCESS_KEY=<paste-secret-access-key>
AWS_REGION=auto
S3_BUCKET_NAME=<your-bucket-name>
S3_ENDPOINT=https://<your-account-id>.r2.cloudflarestorage.com
S3_FORCE_PATH_STYLE=true
```

**Example:**
```bash
STORAGE_TYPE=cloud
AWS_ACCESS_KEY_ID=a1b2c3d4e5f6g7h8
AWS_SECRET_ACCESS_KEY=xyz123abc456def789
AWS_REGION=auto
S3_BUCKET_NAME=file-uploader
S3_ENDPOINT=https://a1b2c3d4e5f6.r2.cloudflarestorage.com
S3_FORCE_PATH_STYLE=true
```

## ✅ Done!

Now deploy to Vercel and your files will upload directly to Cloudflare R2!

**Cost**: FREE for 10GB storage + unlimited downloads! 🎉

