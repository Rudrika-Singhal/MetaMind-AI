require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const csv = require("csv-parser");
const Groq = require("groq-sdk");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

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
  const stats = { missing, missingPct: ((missing / values.length) * 100).toFixed(1), unique };
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

async function generateAIDataDictionary(columns, sampleRows, basicMeta) {
  const sampleData = JSON.stringify(sampleRows.slice(0, 5), null, 2);
  const metaSummary = basicMeta.map((m) =>
    `${m.column} [${m.type}] - unique:${m.stats.unique}, missing:${m.stats.missingPct}%${
      m.stats.min !== undefined ? `, range:[${m.stats.min}-${m.stats.max}], mean:${m.stats.mean}` : ""
    }${m.stats.topValues ? `, top values: ${m.stats.topValues}` : ""}`
  ).join("\n");

  const prompt = `You are a senior data scientist. Analyze this dataset and return ONLY valid JSON (no markdown, no backticks, no explanation).

Dataset columns:
${metaSummary}

Sample rows:
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
// Upload Route
// ====================================
app.post("/upload", upload.single("dataset"), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (data) => results.push(data))
    .on("end", async () => {
      if (results.length === 0) return res.json({ success: false, message: "CSV file is empty" });

      const columns = Object.keys(results[0]);
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
      let qualityScore = Math.max(0, Math.round(100 - parseFloat(missingPercentage) - (duplicateRows / results.length) * 100));

      try {
        const aiData = await generateAIDataDictionary(columns, results, basicMeta);

        const metadata = basicMeta.map((m) => {
          const aiCol = aiData.columns?.find((c) => c.column === m.column) || {};
          return {
            column: m.column, type: m.type,
            description: aiCol.description || `Information about ${m.column}`,
            businessMeaning: aiCol.businessMeaning || "",
            relationship: aiCol.relationship || "General Attribute",
            dataQualityNote: aiCol.dataQualityNote || "Unknown",
            stats: m.stats,
          };
        });

        const summary = {
          datasetName: aiData.datasetName || "Unknown Dataset",
          datasetPurpose: aiData.datasetPurpose || "",
          datasetType: aiData.datasetType || "General Dataset",
          qualityAssessment: aiData.qualityAssessment || "",
          totalRows: results.length, totalColumns: columns.length,
          numericColumns, textColumns, qualityScore, duplicateRows, missingPercentage,
        };

        global.currentDataset = { rows: results, columns, metadata, summary, aiData };

        return res.json({
          success: true, summary, metadata,
          insights: aiData.insights || [],
          recommendations: aiData.analysisRecommendations || [],
          useCases: aiData.potentialUseCases || [],
        });

      } catch (aiError) {
        console.error("Groq AI error:", aiError.message);
        const metadata = basicMeta.map((m) => ({ ...m, description: `Information about ${m.column}`, businessMeaning: "", relationship: "General Attribute", dataQualityNote: "Unknown" }));
        global.currentDataset = { rows: results, columns, metadata, summary: {}, aiData: {} };
        return res.json({
          success: true,
          summary: { datasetName: "Uploaded Dataset", datasetType: "General Dataset", totalRows: results.length, totalColumns: columns.length, numericColumns, textColumns, qualityScore, duplicateRows, missingPercentage },
          metadata,
          insights: [`Dataset has ${results.length} rows and ${columns.length} columns`, "AI analysis unavailable - check Groq API key"],
          recommendations: [], useCases: [],
          error: "AI analysis failed: " + aiError.message,
        });
      }
    })
    .on("error", (err) => res.status(500).json({ success: false, error: err.message }));
});

// ====================================
// Chat Route
// ====================================
app.post("/chat", async (req, res) => {
  const { question, chatHistory = [] } = req.body;
  if (!global.currentDataset) return res.json({ answer: "Please upload a dataset first.", chartData: null });

  const { rows, columns, metadata, summary, aiData } = global.currentDataset;

  const dataContext = `
Dataset: ${summary.datasetName}
Type: ${summary.datasetType}
Rows: ${summary.totalRows}, Columns: ${summary.totalColumns}
Quality: ${summary.qualityScore}%, Missing: ${summary.missingPercentage}%, Duplicates: ${summary.duplicateRows}

Columns with stats:
${metadata.map((m) =>
  `- ${m.column} (${m.type}): ${m.description}. unique=${m.stats.unique}, missing=${m.stats.missingPct}%${
    m.stats.min !== undefined ? `, min=${m.stats.min}, max=${m.stats.max}, mean=${m.stats.mean}` : ""
  }${m.stats.topValues ? `, top values: ${m.stats.topValues}` : ""}`
).join("\n")}

Sample data (first 3 rows):
${JSON.stringify(rows.slice(0, 3), null, 2)}`;

  const systemPrompt = `You are DataAnalytics AI, expert data scientist. Answer dataset questions clearly.

IMPORTANT CHART RULE: When asked for distribution, breakdown, comparison, visualization, chart, or graph — you MUST end your response with a JSON block in this EXACT format:
CHART_DATA:{"type":"pie","title":"Chart Title","data":[{"name":"Label1","value":42},{"name":"Label2","value":58}]}

For bar charts use: CHART_DATA:{"type":"bar","title":"Chart Title","data":[{"name":"Label1","value":100},{"name":"Label2","value":200}]}

Use REAL numbers from the dataset context. Keep text response under 150 words. Always include CHART_DATA when showing any distribution or comparison.

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
      messages, model: "llama-3.3-70b-versatile", temperature: 0.4, max_tokens: 1200,
    });

    const raw = completion.choices[0].message.content;
    let chartData = null;
    let answer = raw;

    const chartMatch = raw.match(/CHART_DATA:(\{.*\})/s);
    if (chartMatch) {
      try { chartData = JSON.parse(chartMatch[1]); answer = raw.replace(/CHART_DATA:.*$/s, "").trim(); }
      catch (e) { chartData = null; }
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
app.post("/column-insight", async (req, res) => {
  const { columnName } = req.body;
  if (!global.currentDataset) return res.json({ insight: "No dataset loaded." });

  const { rows, metadata } = global.currentDataset;
  const col = metadata.find((m) => m.column === columnName);
  if (!col) return res.json({ insight: "Column not found." });

  const values = rows.map((r) => r[columnName]).filter((v) => v !== "" && v !== null && v !== undefined);
  const sampleVals = [...new Set(values)].slice(0, 10);

  const prompt = `Analyze this column in 3-4 sentences with actionable data science insights.
Column: ${columnName}, Type: ${col.type}, Unique: ${col.stats.unique}, Missing: ${col.stats.missingPct}%
${col.stats.min !== undefined ? `Range: ${col.stats.min}-${col.stats.max}, Mean: ${col.stats.mean}` : ""}
${col.stats.topValues ? `Top values: ${col.stats.topValues}` : ""}
Sample values: ${sampleVals.join(", ")}`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile", temperature: 0.3, max_tokens: 300,
    });
    res.json({ insight: completion.choices[0].message.content });
  } catch (err) {
    res.json({ insight: "Could not generate insight at this time." });
  }
});

// ====================================
// Anomaly Detection
// ====================================
app.post("/anomalies", async (req, res) => {
  if (!global.currentDataset) return res.json({ anomalies: [] });
  const { metadata, rows } = global.currentDataset;
  const anomalies = [];

  metadata.forEach((m) => {
    if (m.type === "Integer" || m.type === "Float") {
      const values = rows.map((r) => parseFloat(r[m.column])).filter((v) => !isNaN(v));
      if (values.length === 0) return;
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const std = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length);
      const outliers = values.filter((v) => Math.abs(v - mean) > 3 * std).length;
      if (outliers > 0) anomalies.push({ column: m.column, issue: `${outliers} outliers detected (>3σ from mean ${parseFloat(mean.toFixed(2))})`, severity: outliers > 5 ? "high" : "medium" });
    }
    if (parseFloat(m.stats.missingPct) > 20) anomalies.push({ column: m.column, issue: `High missing data: ${m.stats.missingPct}%`, severity: "high" });
    if (m.stats.unique === 1) anomalies.push({ column: m.column, issue: "Only 1 unique value — constant column", severity: "high" });
  });

  res.json({ anomalies });
});

// ====================================
// 🕵️ Data Detective Route
// ====================================
app.post("/detective", async (req, res) => {
  if (!global.currentDataset) return res.json({ report: "No dataset loaded." });
  const { metadata, summary } = global.currentDataset;

  const suspects = metadata
    .filter(m => parseFloat(m.stats?.missingPct) > 5 || m.stats?.unique === 1)
    .map(m => `${m.column}: missing=${m.stats?.missingPct}%, unique=${m.stats?.unique}`)
    .join("\n");

  const prompt = `You are Detective MetaMind, a dramatic data science detective. Write a SHORT crime investigation report about this dataset.

Dataset: ${summary.datasetName}
Total Rows: ${summary.totalRows}
Quality Score: ${summary.qualityScore}%
Duplicate Rows: ${summary.duplicateRows}
Missing Data: ${summary.missingPercentage}%

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
// 🔮 Data Horoscope Route
// ====================================
app.post("/horoscope", async (req, res) => {
  if (!global.currentDataset) return res.json({ horoscope: "No dataset loaded." });
  const { metadata, summary } = global.currentDataset;

  const numericCols = metadata.filter(m => m.type === "Integer" || m.type === "Float").map(m => m.column).join(", ");
  const textCols = metadata.filter(m => m.type === "String").map(m => m.column).join(", ");
  const targetCol = metadata.find(m => m.relationship?.includes("Target"))?.column || "not identified";

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

app.get("/", (req, res) => res.send("MetaMind AI Backend 🚀 - Groq Powered"));
app.listen(5000, () => console.log("🚀 Server running on port 5000 - Groq AI Ready!"));