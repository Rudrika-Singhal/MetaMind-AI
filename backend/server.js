require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const crypto = require("crypto");
const csv = require("csv-parser");
const Groq = require("groq-sdk");
const rateLimit = require("express-rate-limit");
const XLSX = require("xlsx");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

// ====================================
// Per-session dataset storage
// ====================================
// IMPORTANT FIX: datasets used to be stored in a single global variable
// (global.currentDataset), which meant EVERY user of the server shared the
// SAME dataset. One user's upload could leak into another user's chat.
// Now each upload gets its own sessionId, and each session's data is kept
// separate. Sessions auto-expire after SESSION_TTL_MS of inactivity.
const sessions = new Map();
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

function createSession(data) {
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, { ...data, lastUsed: Date.now() });
  return sessionId;
}

function getSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  session.lastUsed = Date.now();
  return session;
}

// periodic cleanup of expired sessions
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.lastUsed > SESSION_TTL_MS) sessions.delete(id);
  }
}, 5 * 60 * 1000);

// ====================================
// Rate Limiting
// ====================================
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { success: false, message: "Too many uploads. Please wait 15 minutes." },
});
const chatLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50,
  message: { answer: "Too many requests. Please wait a few minutes.", chartData: null },
});
const insightLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  message: { insight: "Too many requests. Please wait a few minutes." },
});

// ====================================
// File Upload (CSV + Excel + JSON)
// ====================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = [".csv", ".xlsx", ".xls", ".json"];
    const ext = "." + file.originalname.split(".").pop().toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error("Only CSV, Excel (.xlsx/.xls), and JSON files are supported."));
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
});

// ====================================
// PII Detection & Masking
// ====================================
// FIX: previously these regexes had no word boundaries, so e.g. "pan"
// (meant to catch PAN card numbers) matched inside words like
// "YearsAtCompany" or "NumCompaniesWorked" ("Com-PAN-y"), incorrectly
// flagging them as PII. Added \b word boundaries to all short/ambiguous
// tokens to avoid false positives.
const SENSITIVE_PATTERNS = {
  phone:   /\b(phone|mobile|contact|tel|cell)\b/i,
  email:   /\b(email|e-mail|mail)\b/i,
  address: /\b(address|addr|street|city|pincode|zipcode|zip|postal)\b/i,
  name:    /\bname\b|fullname|firstname|lastname|surname/i,
  id:      /\b(aadhar|aadhaar|pan|passport|ssn|national.?id|voter)\b/i,
  card:    /\b(card|credit|debit|cvv|account.?no|ifsc)\b/i,
  dob:     /\b(dob|birth.?date|date.?of.?birth)\b/i,
  salary:  /\b(salary|income|wage|compensation)\b/i,
};

function detectSensitiveColumns(columns) {
  return columns.filter((col) =>
    Object.values(SENSITIVE_PATTERNS).some((pattern) => pattern.test(col))
  );
}

function maskValue(col, val) {
  const str = String(val || "");
  if (!str || str.trim() === "") return str;

  if (SENSITIVE_PATTERNS.phone.test(col)) {
    return str.replace(/\d/g, (d, i) => (i < 2 ? d : "X"));
  }
  if (SENSITIVE_PATTERNS.email.test(col)) {
    const parts = str.split("@");
    if (parts.length === 2) {
      return parts[0][0] + "***@***." + parts[1].split(".").pop();
    }
    return str[0] + "***";
  }
  if (SENSITIVE_PATTERNS.card.test(col)) {
    return str.replace(/\d/g, "X").slice(0, str.length - 4) + str.slice(-4);
  }
  if (SENSITIVE_PATTERNS.id.test(col)) {
    return "XXXX-XXXX-" + str.slice(-4);
  }
  // General: keep first 2 chars, mask rest
  if (str.length > 4) return str.slice(0, 2) + "*".repeat(Math.min(str.length - 2, 6));
  return "****";
}

function maskSensitiveData(rows, columns) {
  const sensitiveColumns = detectSensitiveColumns(columns);
  if (sensitiveColumns.length === 0) return { maskedRows: rows, sensitiveColumns: [] };

  const maskedRows = rows.map((row) => {
    const maskedRow = { ...row };
    sensitiveColumns.forEach((col) => {
      if (maskedRow[col] !== undefined && maskedRow[col] !== "") {
        maskedRow[col] = maskValue(col, maskedRow[col]);
      }
    });
    return maskedRow;
  });

  return { maskedRows, sensitiveColumns };
}

// ====================================
// Type Detection & Stats
// ====================================
function detectType(values) {
  const filtered = values.filter((v) => v !== undefined && v !== null && v !== "");
  if (filtered.length === 0) return "Unknown";
  const isNumber = filtered.every((v) => !isNaN(v));
  if (isNumber) return filtered.some((v) => String(v).includes(".")) ? "Float" : "Integer";
  const datePattern = /^\d{4}-\d{2}-\d{2}|^\d{2}\/\d{2}\/\d{4}/;
  if (filtered.some((v) => datePattern.test(String(v)))) return "Date";
  return "String";
}

function getBasicStats(values, type) {
  const filtered = values.filter((v) => v !== "" && v !== null && v !== undefined);
  const missing = values.length - filtered.length;
  const unique = new Set(filtered).size;
  const stats = {
    missing,
    missingPct: ((missing / values.length) * 100).toFixed(1),
    unique,
  };
  if (type === "Integer" || type === "Float") {
    const nums = filtered.map(Number).filter((n) => !isNaN(n));
    if (nums.length > 0) {
      stats.min = Math.min(...nums);
      stats.max = Math.max(...nums);
      stats.mean = (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2);
    }
  }
  if (type === "String") {
    const freq = {};
    filtered.forEach((v) => (freq[v] = (freq[v] || 0) + 1));
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    stats.topValues = sorted.slice(0, 5).map(([v, c]) => `${v}(${c})`).join(", ");
    stats.topValuesArr = sorted.slice(0, 6).map(([v, c]) => ({ name: v, value: c }));
  }
  return stats;
}

// ====================================
// Parse any file format → rows[]
// ====================================
function parseFile(filePath, originalName) {
  return new Promise((resolve, reject) => {
    const ext = originalName.split(".").pop().toLowerCase();

    if (ext === "csv") {
      const rows = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on("data", (d) => rows.push(d))
        .on("end", () => resolve(rows))
        .on("error", reject);
      return;
    }

    if (ext === "xlsx" || ext === "xls") {
      try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
        resolve(rows);
      } catch (e) {
        reject(e);
      }
      return;
    }

    if (ext === "json") {
      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(raw);
        const rows = Array.isArray(parsed) ? parsed : parsed.data || Object.values(parsed)[0];
        if (!Array.isArray(rows)) throw new Error("JSON must be an array of objects.");
        resolve(rows);
      } catch (e) {
        reject(e);
      }
      return;
    }

    reject(new Error("Unsupported file format."));
  });
}

// ====================================
// Groq: Generate AI Data Dictionary
// ====================================
async function generateAIDataDictionary(columns, sampleRows, basicMeta) {
  const sampleData = JSON.stringify(sampleRows.slice(0, 5), null, 2);
  const metaSummary = basicMeta
    .map(
      (m) =>
        `${m.column} [${m.type}] - unique:${m.stats.unique}, missing:${m.stats.missingPct}%` +
        (m.stats.min !== undefined ? `, range:[${m.stats.min}-${m.stats.max}], mean:${m.stats.mean}` : "") +
        (m.stats.topValues ? `, top values: ${m.stats.topValues}` : "")
    )
    .join("\n");

  const prompt = `You are a senior data scientist. Analyze this dataset and return ONLY valid JSON (no markdown, no backticks, no explanation).

Dataset columns:
${metaSummary}

Sample rows (may be masked for privacy):
${sampleData}

Return ONLY this JSON:
{
  "datasetName": "descriptive name",
  "datasetPurpose": "2-sentence description",
  "datasetType": "HR Analytics / Sales / Financial / Healthcare / etc",
  "qualityAssessment": "2-sentence quality assessment",
  "columns": [
    {
      "column": "exact column name",
      "description": "clear specific description",
      "businessMeaning": "why this matters for analysis",
      "relationship": "Primary Key / Target Variable / Feature / Categorical / Numerical / Date / Identifier",
      "dataQualityNote": "quality concern or Clean"
    }
  ],
  "insights": ["insight 1","insight 2","insight 3","insight 4","insight 5","insight 6","insight 7"],
  "analysisRecommendations": ["rec 1","rec 2","rec 3"],
  "potentialUseCases": ["use case 1","use case 2","use case 3"]
}`;

  const completion = await groq.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "llama-3.3-70b-versatile",
    temperature: 0.3,
    max_tokens: 3000,
  });

  const text = completion.choices[0].message.content.trim().replace(/```json|```/g, "").trim();
  return JSON.parse(text);
}

// ====================================
// Upload Route (CSV + Excel + JSON)
// ====================================
app.post("/upload", uploadLimiter, upload.single("dataset"), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

  let results = [];
  try {
    results = await parseFile(req.file.path, req.file.originalname);
  } catch (err) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ success: false, message: "Could not parse file: " + err.message });
  }

  // Cleanup uploaded file immediately — only parsed rows are kept (in this
  // session's memory only), the original file is deleted from disk.
  fs.unlink(req.file.path, () => {});

  if (results.length === 0) return res.json({ success: false, message: "File is empty or has no rows." });

  // Normalize keys (trim whitespace)
  results = results.map((row) => {
    const clean = {};
    Object.entries(row).forEach(([k, v]) => (clean[k.trim()] = v));
    return clean;
  });

  const columns = Object.keys(results[0]);

  // Detect & mask PII before sending to AI
  const { maskedRows, sensitiveColumns } = maskSensitiveData(results, columns);

  const basicMeta = columns.map((column) => {
    const values = results.map((row) => row[column]);
    const type = detectType(values);
    return { column, type, stats: getBasicStats(values, type) };
  });

  const numericColumns = basicMeta.filter((m) => m.type === "Integer" || m.type === "Float").length;
  const textColumns = basicMeta.filter((m) => m.type === "String").length;
  const totalMissing = basicMeta.reduce((acc, m) => acc + m.stats.missing, 0);
  const missingPercentage = ((totalMissing / (results.length * columns.length)) * 100).toFixed(2);
  const duplicateRows = results.length - new Set(results.map((r) => JSON.stringify(r))).size;
  const qualityScore = Math.max(
    0,
    Math.round(100 - parseFloat(missingPercentage) - (duplicateRows / results.length) * 100)
  );

  try {
    // Send MASKED rows to Groq
    const aiData = await generateAIDataDictionary(columns, maskedRows, basicMeta);

    const metadata = basicMeta.map((m) => {
      const aiCol = aiData.columns?.find((c) => c.column === m.column) || {};
      return {
        column: m.column,
        type: m.type,
        description: aiCol.description || `Information about ${m.column}`,
        businessMeaning: aiCol.businessMeaning || "",
        relationship: aiCol.relationship || "General Attribute",
        dataQualityNote: aiCol.dataQualityNote || "Unknown",
        isPII: sensitiveColumns.includes(m.column),
        stats: m.stats,
      };
    });

    const summary = {
      datasetName: aiData.datasetName || "Unknown Dataset",
      datasetPurpose: aiData.datasetPurpose || "",
      datasetType: aiData.datasetType || "General Dataset",
      qualityAssessment: aiData.qualityAssessment || "",
      totalRows: results.length,
      totalColumns: columns.length,
      numericColumns,
      textColumns,
      qualityScore,
      duplicateRows,
      missingPercentage,
      sensitiveColumnsCount: sensitiveColumns.length,
      fileType: req.file.originalname.split(".").pop().toUpperCase(),
    };

    // Store this dataset under its OWN session — not in a shared global,
    // so other users/tabs can never see it.
    const sessionId = createSession({
      rows: results,
      maskedRows,
      sensitiveColumns,
      columns,
      metadata,
      summary,
      aiData,
    });

    return res.json({
      success: true,
      sessionId,
      summary,
      metadata,
      insights: aiData.insights || [],
      recommendations: aiData.analysisRecommendations || [],
      useCases: aiData.potentialUseCases || [],
      sensitiveColumns,
    });
  } catch (aiError) {
    console.error("Groq AI error:", aiError.message);
    const metadata = basicMeta.map((m) => ({
      ...m,
      description: `Information about ${m.column}`,
      businessMeaning: "",
      relationship: "General Attribute",
      dataQualityNote: "Unknown",
      isPII: sensitiveColumns.includes(m.column),
    }));

    const fallbackSummary = {
      datasetName: req.file.originalname,
      datasetType: "General Dataset",
      totalRows: results.length,
      totalColumns: columns.length,
      numericColumns,
      textColumns,
      qualityScore,
      duplicateRows,
      missingPercentage,
      sensitiveColumnsCount: sensitiveColumns.length,
      fileType: req.file.originalname.split(".").pop().toUpperCase(),
    };

    const sessionId = createSession({
      rows: results,
      maskedRows,
      sensitiveColumns,
      columns,
      metadata,
      summary: fallbackSummary,
      aiData: {},
    });

    return res.json({
      success: true,
      sessionId,
      summary: fallbackSummary,
      metadata,
      insights: [
        `Dataset has ${results.length} rows and ${columns.length} columns`,
        "AI analysis unavailable — check Groq API key",
      ],
      recommendations: [],
      useCases: [],
      sensitiveColumns,
      error: "AI analysis failed: " + aiError.message,
    });
  }
});

// ====================================
// Chat Route
// ====================================
app.post("/chat", chatLimiter, async (req, res) => {
  const { question, chatHistory = [], sessionId } = req.body;
  const dataset = getSession(sessionId);
  if (!dataset) return res.json({ answer: "Please upload a dataset first.", chartData: null });

  const { maskedRows, columns, metadata, summary } = dataset;

  const dataContext = `
Dataset: ${summary.datasetName}
Type: ${summary.datasetType}
Rows: ${summary.totalRows}, Columns: ${summary.totalColumns}
Quality: ${summary.qualityScore}%, Missing: ${summary.missingPercentage}%, Duplicates: ${summary.duplicateRows}
PII Columns (masked): ${dataset.sensitiveColumns.join(", ") || "none"}

Columns with stats:
${metadata
  .map(
    (m) =>
      `- ${m.column} (${m.type}${m.isPII ? ", PII🔒" : ""}): ${m.description}. unique=${m.stats.unique}, missing=${m.stats.missingPct}%` +
      (m.stats.min !== undefined ? `, min=${m.stats.min}, max=${m.stats.max}, mean=${m.stats.mean}` : "") +
      (m.stats.topValues ? `, top values: ${m.stats.topValues}` : "")
  )
  .join("\n")}

Sample data (PII columns are masked for privacy):
${JSON.stringify(maskedRows.slice(0, 3), null, 2)}`;

  const systemPrompt = `You are DataAnalytics AI, expert data scientist. Answer dataset questions clearly.

PRIVACY RULE: Never reveal raw values from PII columns (marked with 🔒). If asked about sensitive data like phone numbers, emails, names, or addresses, say they are masked for privacy.

CHART RULE: When asked for distribution, breakdown, comparison, visualization, chart, or graph — end your response with:
CHART_DATA:{"type":"pie","title":"Chart Title","data":[{"name":"Label1","value":42},{"name":"Label2","value":58}]}
For bar charts: CHART_DATA:{"type":"bar","title":"Chart Title","data":[{"name":"Label1","value":100}]}

Use REAL numbers from the dataset context. Keep text under 150 words.

Dataset Context:
${dataContext}`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...chatHistory.slice(-8).map((msg) => ({
      role: msg.role === "model" ? "assistant" : "user",
      content: msg.content.replace(/CHART_DATA:.*$/s, "").trim(),
    })),
    { role: "user", content: question },
  ];

  try {
    const completion = await groq.chat.completions.create({
      messages,
      model: "llama-3.3-70b-versatile",
      temperature: 0.4,
      max_tokens: 1200,
    });

    const raw = completion.choices[0].message.content;
    let chartData = null;
    let answer = raw;

    const chartMatch = raw.match(/CHART_DATA:(\{.*\})/s);
    if (chartMatch) {
      try {
        chartData = JSON.parse(chartMatch[1]);
        answer = raw.replace(/CHART_DATA:.*$/s, "").trim();
      } catch {
        chartData = null;
      }
    }

    return res.json({ answer, chartData });
  } catch (err) {
    console.error("Chat error:", err.message);
    return res.status(500).json({ answer: "AI temporarily unavailable. Try again.", chartData: null });
  }
});

// ====================================
// Column Deep Dive
// ====================================
app.post("/column-insight", insightLimiter, async (req, res) => {
  const { columnName, sessionId } = req.body;
  const dataset = getSession(sessionId);
  if (!dataset) return res.json({ insight: "No dataset loaded." });

  const { rows, metadata, sensitiveColumns } = dataset;
  const col = metadata.find((m) => m.column === columnName);
  if (!col) return res.json({ insight: "Column not found." });

  // Use masked values for PII columns
  const isPII = sensitiveColumns.includes(columnName);
  const values = rows
    .map((r) => (isPII ? maskValue(columnName, r[columnName]) : r[columnName]))
    .filter((v) => v !== "" && v !== null && v !== undefined);
  const sampleVals = [...new Set(values)].slice(0, 10);

  const prompt = `Analyze this column in 3-4 sentences with actionable data science insights.
Column: ${columnName}${isPII ? " (PII - values are masked)" : ""}
Type: ${col.type}, Unique: ${col.stats.unique}, Missing: ${col.stats.missingPct}%
${col.stats.min !== undefined ? `Range: ${col.stats.min}-${col.stats.max}, Mean: ${col.stats.mean}` : ""}
${col.stats.topValues && !isPII ? `Top values: ${col.stats.topValues}` : ""}
${isPII ? "Note: This is a sensitive PII column. Focus on data quality, not values." : `Sample values: ${sampleVals.join(", ")}`}`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      max_tokens: 300,
    });
    res.json({ insight: completion.choices[0].message.content, isPII });
  } catch {
    res.json({ insight: "Could not generate insight at this time.", isPII });
  }
});

// ====================================
// Anomaly Detection
// ====================================
app.post("/anomalies", async (req, res) => {
  const { sessionId } = req.body;
  const dataset = getSession(sessionId);
  if (!dataset) return res.json({ anomalies: [] });
  const { metadata, rows } = dataset;
  const anomalies = [];

  metadata.forEach((m) => {
    if (m.type === "Integer" || m.type === "Float") {
      const values = rows.map((r) => parseFloat(r[m.column])).filter((v) => !isNaN(v));
      if (values.length === 0) return;
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const std = Math.sqrt(
        values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length
      );
      const outliers = values.filter((v) => Math.abs(v - mean) > 3 * std).length;
      if (outliers > 0)
        anomalies.push({
          column: m.column,
          issue: `${outliers} outliers detected (>3σ from mean ${parseFloat(mean.toFixed(2))})`,
          severity: outliers > 5 ? "high" : "medium",
        });
    }
    if (parseFloat(m.stats.missingPct) > 20)
      anomalies.push({
        column: m.column,
        issue: `High missing data: ${m.stats.missingPct}%`,
        severity: "high",
      });
    if (m.stats.unique === 1)
      anomalies.push({
        column: m.column,
        issue: "Only 1 unique value — constant column",
        severity: "high",
      });
  });

  res.json({ anomalies });
});

// ====================================
// Data Detective Route
// ====================================
app.post("/detective", async (req, res) => {
  const { sessionId } = req.body;
  const dataset = getSession(sessionId);
  if (!dataset) return res.json({ report: "No dataset loaded." });
  const { metadata, summary } = dataset;

  const suspects = metadata
    .filter((m) => parseFloat(m.stats?.missingPct) > 5 || m.stats?.unique === 1)
    .map((m) => `${m.column}: missing=${m.stats?.missingPct}%, unique=${m.stats?.unique}`)
    .join("\n");

  const prompt = `You are Detective MetaMind, a dramatic data science detective. Write a SHORT crime investigation report about this dataset.

Dataset: ${summary.datasetName}
Total Rows: ${summary.totalRows}
Quality Score: ${summary.qualityScore}%
Duplicate Rows: ${summary.duplicateRows}
Missing Data: ${summary.missingPercentage}%
PII Columns Protected: ${dataset.sensitiveColumns.length}

Suspicious Columns (potential criminals):
${suspects || "No major suspects found — dataset is clean!"}

Write a fun detective report with these exact sections:
🔍 CASE OVERVIEW (1 sentence about this dataset)
🚨 PRIMARY SUSPECT (worst column, why it's guilty)
🤝 ACCOMPLICES (other bad columns, max 2, or "No accomplices" if clean)
💀 VICTIM (what suffers because of bad data quality)
⚖️ VERDICT (guilty/not guilty with reason)
🔫 DETECTIVE'S ORDERS (exact 3 cleaning steps needed)

Be dramatic and fun, use crime metaphors. Give REAL data science advice in detective style. Under 220 words total.`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.85,
      max_tokens: 600,
    });
    res.json({ report: completion.choices[0].message.content });
  } catch (err) {
    console.error("Detective error:", err.message);
    res.json({ report: "Detective is unavailable right now. Try again!" });
  }
});

// ====================================
// Data Horoscope Route
// ====================================
app.post("/horoscope", async (req, res) => {
  const { sessionId } = req.body;
  const dataset = getSession(sessionId);
  if (!dataset) return res.json({ horoscope: "No dataset loaded." });
  const { metadata, summary } = dataset;

  const numericCols = metadata
    .filter((m) => m.type === "Integer" || m.type === "Float")
    .map((m) => m.column)
    .join(", ");
  const textCols = metadata
    .filter((m) => m.type === "String")
    .map((m) => m.column)
    .join(", ");
  const targetCol =
    metadata.find((m) => m.relationship?.includes("Target"))?.column || "not identified";

  const prompt = `You are a mystical data science astrologer. Generate a fun horoscope for this dataset.

Dataset: ${summary.datasetName}
Type: ${summary.datasetType}
Quality Score: ${summary.qualityScore}%
Missing Data: ${summary.missingPercentage}%
Numeric Columns: ${numericCols || "none"}
Text Columns: ${textCols || "none"}
Target Variable: ${targetCol}
Duplicates: ${summary.duplicateRows}
Total Rows: ${summary.totalRows}

Write a mystical horoscope with these exact sections:
⭐ STAR SIGN (assign a zodiac sign based on dataset personality, explain why in 1 line)
🔮 TODAY'S READING (overall dataset destiny, 2 sentences, mystical but real advice)
🍀 LUCKY ALGORITHM (best ML algorithm for this data with brief reason)
⚠️ WARNING FROM THE STARS (biggest data problem to watch out for)
💕 COMPATIBILITY (which other dataset type would pair well and why)
🙏 SACRED MANTRA (one powerful data cleaning tip as a short mantra)

Be mystical and fun, use astrology metaphors but give REAL data science advice. Under 220 words total.`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.9,
      max_tokens: 600,
    });
    res.json({ horoscope: completion.choices[0].message.content });
  } catch (err) {
    console.error("Horoscope error:", err.message);
    res.json({ horoscope: "The stars are unclear right now. Try again!" });
  }
});

app.get("/", (req, res) =>
  res.send("MetaMind AI Backend — Groq Powered | CSV + Excel + JSON | PII Protected")
);

app.listen(5000, () => console.log("Server running on port 5000 — Groq AI Ready!"));