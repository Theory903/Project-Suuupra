import express from 'express';
import multer from 'multer';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3001;

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads'); // Files will be stored in the 'uploads' directory
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Append timestamp to filename
  },
});

const upload = multer({ storage: storage });

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Creator Studio Backend is running');
});

app.post('/upload', upload.single('media'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }
  res.status(200).send(`File uploaded: ${req.file.filename}`);
});

app.listen(PORT, () => {
  console.log(`Creator Studio Backend listening on port ${PORT}`);
});
