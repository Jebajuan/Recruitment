import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import pdf from "pdf-parse";
import { embedText } from "./utils/embedClient.js";
import csvParser from "csv-parser";

dotenv.config();
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5000;
const RESUME_FOLDER = process.env.RESUME_FOLDER;
const RESPONSES_FILE = process.env.RESPONSES_FILE;

// ---------------------
// Extract text from PDF
// ---------------------
async function extractText(filePath) {
  const buffer = fs.readFileSync(filePath);
  const data = await pdf(buffer);
  return data.text;
}

// ---------------------
// Load email mapping from CSV
// ---------------------
function loadEmailMapping() {
  return new Promise((resolve, reject) => {
    const mapping = {};
    fs.createReadStream(RESPONSES_FILE)
      .pipe(csvParser())
      .on("data", (row) => {
        const email = row["Email Address"];
        const fileLink = row["File Upload"];
        if (email && fileLink) {
          const match = fileLink.match(/([^/]+)\.pdf/);
          if (match) {
            const filename = match[1] + ".pdf";
            mapping[filename] = email;
          }
        }
      })
      .on("end", () => resolve(mapping))
      .on("error", reject);
  });
}

// ---------------------
// Email setup
// ---------------------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ---------------------
// State
// ---------------------
let candidates = [];
let activeSkills = [];
let weights = { skill: 70, experience: 20, internship: 5, certification: 5 }; // default

// ---------------------
// Init resumes once
// ---------------------
async function initResumes() {
  const emailMapping = await loadEmailMapping();
  const files = fs.readdirSync(RESUME_FOLDER).filter((f) => f.endsWith(".pdf"));

  candidates = [];
  for (const file of files) {
    const filePath = path.join(RESUME_FOLDER, file);
    const text = await extractText(filePath);
    const embedding = await embedText(text);
    const email = emailMapping[file] || null;

    candidates.push({
      name: file.replace(".pdf", ""),
      email,
      text,
      embedding,
      score: 0,
    });
  }
  console.log(`✅ Loaded ${candidates.length} resumes`);
}
initResumes();

// ---------------------
// Helpers
// ---------------------
function cosineSimilarity(vecA, vecB) {
  const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dot / (magA * magB);
}

function extractFactors(text) {
  return {
    experience: /experience/i.test(text) ? 1 : 0,
    internship: /internship/i.test(text) ? 1 : 0,
    certification: /certification/i.test(text) ? 1 : 0,
  };
}

// ---------------------
// Routes
// ---------------------
app.post("/set-weights", (req, res) => {
  const { skill, experience, internship, certification } = req.body;
  const total = skill + experience + internship + certification;
  if (total !== 100) {
    return res.status(400).json({ error: "Weights must add up to 100" });
  }
  weights = { skill, experience, internship, certification };
  console.log("⚖️ Updated weights:", weights);
  res.json({ message: "Weights updated", weights });
});

app.post("/filter-skill", async (req, res) => {
  const { skill } = req.body;
  if (!skill) return res.status(400).json({ error: "Skill is required" });

  activeSkills.push(skill);
  console.log(`🎯 Active skills: ${activeSkills.join(", ")}`);

  const skillEmbeddings = [];
  for (const s of activeSkills) {
    skillEmbeddings.push(await embedText(s));
  }

  for (const cand of candidates) {
    let skillScore = 0;
    for (const emb of skillEmbeddings) {
      skillScore += cosineSimilarity(emb, cand.embedding);
    }
    skillScore = skillScore / activeSkills.length; // normalize

    const factors = extractFactors(cand.text);

    cand.score =
      (weights.skill / 100) * skillScore +
      (weights.experience / 100) * factors.experience +
      (weights.internship / 100) * factors.internship +
      (weights.certification / 100) * factors.certification;
  }

  candidates.sort((a, b) => b.score - a.score);
  res.json({ ranked: candidates, activeSkills, weights });
});

app.post("/send-emails", async (req, res) => {
  const top5 = candidates.slice(0, 5);

  for (const cand of top5) {
    if (!cand.email) continue;
    try {
      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: cand.email,
        subject: `Shortlisted for ${activeSkills.join(", ")} role`,
        text: `Hi ${cand.name},\n\nYou have been shortlisted for ${activeSkills.join(
          ", "
        )} based on your resume.\n\nBest regards,\nRecruitment Team`,
      });
      console.log(`📧 Email sent to ${cand.email}`);
    } catch (err) {
      console.error(`❌ Email failed for ${cand.email}:`, err.message);
    }
  }

  res.json({ emailed: top5 });
});

app.post("/reset", (req, res) => {
  activeSkills = [];
  for (const cand of candidates) {
    cand.score = 0;
  }
  res.json({ message: "Skills reset", activeSkills });
});

// ---------------------
// Start
// ---------------------
app.listen(PORT, () => {
  console.log(`✅ Backend running on ${PORT}`);
});
