import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import multer from "multer";
import { nanoid } from "nanoid";
import cors from "cors";
import admin from "firebase-admin";
import { addHours, isAfter } from "date-fns";

// Load Firebase Config
const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));

// Initialize Firebase Admin
try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      storageBucket: firebaseConfig.storageBucket,
      projectId: firebaseConfig.projectId,
    });
    console.log("Firebase Admin initialized successfully");
  }
} catch (error) {
  console.error("Firebase Admin initialization failed:", error);
}

const db = admin.firestore(firebaseConfig.firestoreDatabaseId);
const bucket = admin.storage().bucket();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Multer setup for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { fileSize: 50 * 1024 * 1024 } 
});

// API: Upload File
app.post("/api/upload", upload.array("files"), async (req, res) => {
  console.log("Upload request received");
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const results = [];

    for (const file of files) {
      const id = nanoid(10);
      const storagePath = `uploads/${id}/${file.originalname}`;
      const blob = bucket.file(storagePath);
      
      console.log(`Uploading ${file.originalname} to ${storagePath}`);
      
      await blob.save(file.buffer, {
        contentType: file.mimetype,
        metadata: {
          originalName: file.originalname,
        },
      });

      const expiresAt = addHours(new Date(), 24);
      const fileData = {
        id,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storagePath,
        expiresAt: expiresAt.toISOString(),
        createdAt: new Date().toISOString(),
      };

      await db.collection("files").doc(id).set(fileData);
      
      const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
      const directLink = `${appUrl}/f/${id}`;
      
      results.push({ ...fileData, directLink });
    }

    res.json({ success: true, files: results });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Failed to upload file", details: error instanceof Error ? error.message : String(error) });
  }
});

// Direct Link: Serve File
app.get("/f/:id", async (req, res) => {
  console.log(`Serve request for ID: ${req.params.id}`);
  try {
    const { id } = req.params;
    const doc = await db.collection("files").doc(id).get();

    if (!doc.exists) {
      return res.status(404).send("File not found");
    }

    const data = doc.data() as any;
    const expiresAt = new Date(data.expiresAt);

    if (isAfter(new Date(), expiresAt)) {
      return res.status(410).send("File has expired (24h limit reached)");
    }

    const file = bucket.file(data.storagePath);
    const [exists] = await file.exists();

    if (!exists) {
      return res.status(404).send("File data not found in storage");
    }

    // Set headers for direct download/view
    res.setHeader("Content-Type", data.mimeType);
    res.setHeader("Content-Length", data.size);
    res.setHeader("Content-Disposition", `inline; filename="${data.originalName}"`);

    // Stream the file from Storage to the client
    file.createReadStream().on('error', (err) => {
      console.error("Stream error:", err);
      if (!res.headersSent) {
        res.status(500).send("Error streaming file");
      }
    }).pipe(res);
  } catch (error) {
    console.error("Serve error:", error);
    res.status(500).send("Internal server error");
  }
});

async function startServer() {
  try {
    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
      console.log("Starting Vite in middleware mode...");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Server failed to start:", error);
  }
}

startServer();
