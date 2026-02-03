# 🚀 Quick Setup Guide - Combined Verification System

## Step-by-Step Installation

### 1. Install Dependencies

```bash
cd Face-recognition-master
npm install
```

This will install:
- TensorFlow.js & COCO-SSD (for ID detection)
- Tesseract.js (for OCR)
- face-api.js (for face recognition)
- React, Tailwind, and other dependencies

### 2. Prepare Student Reference Photos

Create reference photos for each student:

```bash
# Photos should be in /uploads/ folder
uploads/
  ├── 2201521.jpg    # John Doe's photo
  └── 2201547.jpg    # Jane Smith's photo
```

**Photo Requirements:**
- Clear frontal face
- Good lighting
- Neutral expression
- No glasses/masks (preferred)
- Minimum 640x480 resolution
- Format: JPG, PNG, or WebP

### 3. Update Student Database

Edit `src/services/studentDatabase.js`:

```javascript
const STUDENTS = {
  '2201521': {
    id: '2201521',
    name: 'John Doe',
    department: 'Computer Science',
    year: 'Junior',
    faceImage: '/uploads/2201521.jpg',
    email: 'john.doe@university.edu'
  },
  // Add more students here
};
```

### 4. Ensure Face-API Models Exist

The face recognition models should be in `/public/models/`:

```
public/models/
  ├── tiny_face_detector_model-weights_manifest.json
  ├── tiny_face_detector_model-shard1
  ├── face_landmark_68_model-weights_manifest.json
  ├── face_landmark_68_model-shard1
  ├── face_recognition_model-weights_manifest.json
  └── face_recognition_model-shard1
```

If missing, they should already be there from your existing setup.

### 5. Start the Application

**Terminal 1 - Backend Server:**
```bash
node backend.js
```
Should show: `Server running on port 3000`

**Terminal 2 - Frontend Dev Server:**
```bash
npm run dev
```
Should show: `Local: http://localhost:5173`

### 6. Test the System

1. Open browser to `http://localhost:5173`
2. Allow camera permissions when prompted
3. Test ID scanning with a student ID card
4. Test face verification

## 🎯 Testing Checklist

- [ ] Camera access granted
- [ ] Backend server running (port 3000)
- [ ] Frontend server running (port 5173)
- [ ] Student photos uploaded to `/uploads/`
- [ ] Student database updated
- [ ] Face-API models present in `/public/models/`
- [ ] ID card scan works
- [ ] Face verification works
- [ ] Success screen displays correctly

## 🔧 Common Issues

### Issue: "Camera access denied"
**Solution:** Grant camera permissions in browser settings

### Issue: "Failed to load face recognition models"
**Solution:** 
- Check `/public/models/` folder exists
- Ensure backend is running on port 3000
- Check browser console for specific errors

### Issue: "Student ID not found"
**Solution:** 
- Verify ID is in `studentDatabase.js`
- Check ID format is exactly 7 digits
- Ensure whitelist includes the ID

### Issue: "Face verification failed"
**Solution:**
- Ensure reference photo exists in `/uploads/`
- Check photo filename matches student ID
- Verify photo quality is good
- Try better lighting conditions

## 📱 Browser Compatibility

✅ **Supported:**
- Chrome 90+ (Desktop & Mobile)
- Firefox 88+
- Edge 90+
- Safari 14+ (iOS 14+)

⚠️ **Note:** HTTPS required for camera access on mobile devices

## 🎨 Customization Quick Tips

### Change Match Threshold
`src/hooks/useFaceVerification.js` line 16:
```javascript
const MATCH_THRESHOLD = 0.5; // Change to 0.45 for more lenient
```

### Change Scan Timeout
`src/hooks/useIDScannerLogic.js` line 17:
```javascript
const MAX_ATTEMPTS = 60; // Increase for longer scanning time
```

### Change Colors
Edit Tailwind classes in component files or modify `tailwind.config.js`

## 🚀 Production Deployment

1. Build the application:
```bash
npm run build
```

2. Serve the `dist` folder with a web server

3. Ensure HTTPS is enabled (required for camera)

4. Update CORS settings in `backend.js` for production domain

## 📞 Need Help?

Check the full documentation in `VERIFICATION_SYSTEM_README.md`

---

**Ready to verify students! 🎓**
