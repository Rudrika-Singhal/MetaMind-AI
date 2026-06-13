import { useState, useRef, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid
} from "recharts";

const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap";
document.head.appendChild(fontLink);

const globalStyles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); }
  ::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.4); border-radius: 4px; }
  @keyframes fadeUp { from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)} }
  @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.3} }
  @keyframes micPulse { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.4)}50%{box-shadow:0 0 0 8px rgba(239,68,68,0)} }
  .fade-up { animation: fadeUp 0.4s ease forwards; }
  .hover-card { transition: all 0.25s cubic-bezier(0.4,0,0.2,1); }
  .hover-card:hover { transform: translateY(-3px); box-shadow: 0 12px 40px rgba(139,92,246,0.2) !important; }
  .tab-item { transition: all 0.2s; cursor: pointer; }
  .tab-item:hover { background: rgba(139,92,246,0.15) !important; }
  .col-row { transition: background 0.15s; cursor: pointer; }
  .col-row:hover { background: rgba(139,92,246,0.08) !important; }
  .send-btn { transition: all 0.2s; }
  .send-btn:hover { transform: scale(1.06); filter: brightness(1.15); }
  .mic-btn-active { animation: micPulse 1s infinite; }
  textarea:focus { outline: none; }
  button { font-family: 'Inter', sans-serif; }
  .suggest-btn { transition: all 0.2s; }
  .suggest-btn:hover { background: rgba(139,92,246,0.15) !important; color: #a78bfa !important; border-color: rgba(139,92,246,0.4) !important; }
  .listen-btn { transition: all 0.2s; }
  .listen-btn:hover { opacity: 0.8; }
  .fun-tab:hover { opacity: 0.85; }
`;
const styleEl = document.createElement("style");
styleEl.textContent = globalStyles;
document.head.appendChild(styleEl);

const DARK = {
  bg: "linear-gradient(160deg,#06080F 0%,#0C0F1D 40%,#0F1320 100%)",
  card: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.08)",
  borderAccent: "rgba(139,92,246,0.3)", text: "#F1F5F9",
  sub: "rgba(241,245,249,0.45)", muted: "rgba(241,245,249,0.25)",
  accent: "#8B5CF6", accent2: "#A78BFA", accentGreen: "#10B981",
  accentAmber: "#F59E0B", accentRed: "#EF4444", accentBlue: "#3B82F6",
  chatUser: "rgba(139,92,246,0.2)", chatAI: "rgba(255,255,255,0.04)",
  input: "rgba(255,255,255,0.05)", tabActive: "rgba(139,92,246,0.2)",
};
const LIGHT = {
  bg: "linear-gradient(160deg,#F8F7FF 0%,#EEF0FF 40%,#E8ECFF 100%)",
  card: "rgba(255,255,255,0.8)", border: "rgba(0,0,0,0.07)",
  borderAccent: "rgba(139,92,246,0.25)", text: "#0F0F23",
  sub: "rgba(15,15,35,0.55)", muted: "rgba(15,15,35,0.35)",
  accent: "#7C3AED", accent2: "#8B5CF6", accentGreen: "#059669",
  accentAmber: "#D97706", accentRed: "#DC2626", accentBlue: "#2563EB",
  chatUser: "rgba(139,92,246,0.12)", chatAI: "rgba(255,255,255,0.9)",
  input: "rgba(255,255,255,0.8)", tabActive: "rgba(139,92,246,0.15)",
};

const COLORS = ["#8B5CF6","#10B981","#F59E0B","#EF4444","#3B82F6","#EC4899","#06B6D4","#84CC16"];

const typeColor = (tp) => {
  if (tp==="Integer"||tp==="Float") return "#10B981";
  if (tp==="String") return "#F59E0B";
  if (tp==="Date") return "#8B5CF6";
  return "#94A3B8";
};
const relColor = (r) => {
  if (r?.includes("Target")) return "#EF4444";
  if (r?.includes("Primary")) return "#3B82F6";
  if (r?.includes("Categorical")) return "#F59E0B";
  if (r?.includes("Numerical")||r?.includes("Feature")) return "#10B981";
  return "#94A3B8";
};

const Badge = ({ label, color="#8B5CF6", size="sm" }) => (
  <span style={{
    display:"inline-flex", alignItems:"center",
    padding: size==="sm"?"2px 9px":"3px 12px",
    borderRadius:"6px", background:color+"18", color,
    border:`1px solid ${color}30`,
    fontSize: size==="sm"?"10px":"11px",
    fontWeight:600, fontFamily:"'JetBrains Mono',monospace",
    letterSpacing:"0.02em", whiteSpace:"nowrap",
  }}>{label}</span>
);

function SmartMessage({ content, chartData, dark, onSpeak, isSpeaking }) {
  const t = dark ? DARK : LIGHT;
  const Tip = ({ active, payload, label }) => {
    if (!active||!payload?.length) return null;
    return (
      <div style={{ background:dark?"#1a1f35":"#fff", border:`1px solid ${t.borderAccent}`, borderRadius:"10px", padding:"10px 14px", fontSize:"12px", color:t.text }}>
        <p style={{ fontWeight:700, marginBottom:"4px", color:t.accent2 }}>{label||payload[0]?.name}</p>
        {payload.map((p,i)=><p key={i} style={{ color:p.fill||p.color||t.accent }}>{p.name||"Value"}: <strong>{p.value}</strong></p>)}
      </div>
    );
  };
  return (
    <div>
      {onSpeak && (
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:"6px" }}>
          <button className="listen-btn" onClick={()=>onSpeak(content)}
            style={{ background:"none", border:`1px solid ${t.border}`, borderRadius:"8px", padding:"3px 10px", color:isSpeaking?t.accentRed:t.muted, cursor:"pointer", fontSize:"11px", display:"flex", alignItems:"center", gap:"4px" }}>
            {isSpeaking ? "⏸ Stop" : "🔊 Listen"}
          </button>
        </div>
      )}
      <div style={{ fontSize:"14px", lineHeight:"1.75", color:t.text, whiteSpace:"pre-wrap" }}>
        {content.replace(/\*\*(.*?)\*\*/g,"$1")}
      </div>
      {chartData && chartData.data && chartData.data.length > 0 && (
        <div style={{ background:dark?"rgba(139,92,246,0.06)":"rgba(139,92,246,0.04)", border:`1px solid ${t.borderAccent}`, borderRadius:"16px", padding:"18px", marginTop:"14px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"14px" }}>
            <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:t.accent }} />
            <span style={{ fontSize:"11px", fontFamily:"'JetBrains Mono',monospace", color:t.accent2, fontWeight:600 }}>{chartData.title || "DATA VISUALIZATION"}</span>
          </div>
          {chartData.type === "pie" ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={chartData.data} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                  label={({name,value})=>`${String(name).slice(0,12)}: ${value}`} labelLine={false} fontSize={10}>
                  {chartData.data.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                </Pie>
                <Tooltip content={<Tip />} />
                <Legend wrapperStyle={{ fontSize:"11px", color:t.sub }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData.data} margin={{ top:5,right:10,left:0,bottom:35 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.05)"} />
                <XAxis dataKey="name" tick={{ fill:t.sub, fontSize:10 }} angle={-30} textAnchor="end" />
                <YAxis tick={{ fill:t.sub, fontSize:10 }} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="value" radius={[6,6,0,0]}>
                  {chartData.data.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [dark, setDark] = useState(true);
  const t = dark ? DARK : LIGHT;
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [funTab, setFunTab] = useState(null);
  const [selectedCol, setSelectedCol] = useState(null);
  const [colInsight, setColInsight] = useState("");
  const [colInsightLoading, setColInsightLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [metadata, setMetadata] = useState([]);
  const [insights, setInsights] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [useCases, setUseCases] = useState([]);
  const [search, setSearch] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [messages, setMessages] = useState([
    { role:"model", content:"👋 Welcome to MetaMind AI!\n\nUpload a CSV dataset to get started. I'll analyze your data and generate an intelligent data dictionary with insights, visualizations, and more.\n\n🎤 You can also use the mic button to ask questions by voice!", chartData:null },
  ]);
  const [chatLoading, setChatLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMsgIndex, setSpeakingMsgIndex] = useState(null);
  const [detectiveReport, setDetectiveReport] = useState("");
  const [horoscope, setHoroscope] = useState("");
  const [detectiveLoading, setDetectiveLoading] = useState(false);
  const [horoscopeLoading, setHoroscopeLoading] = useState(false);

  const inputRef = useRef("");
  const textareaRef = useRef(null);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(()=>{ chatEndRef.current?.scrollIntoView({ behavior:"smooth" }); },[messages]);

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Voice not supported! Please use Google Chrome."); return; }
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "en-US"; recognition.continuous = false; recognition.interimResults = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (e) => {
      const text = e.results[0][0].transcript;
      if (textareaRef.current) { textareaRef.current.value = text; inputRef.current = text; }
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const speakText = (text, msgIndex) => {
    window.speechSynthesis.cancel();
    if (isSpeaking && speakingMsgIndex === msgIndex) { setIsSpeaking(false); setSpeakingMsgIndex(null); return; }
    let clean = text
      .replace(/[#*`_►▸]/g, "")
      .replace(/(\d+(?:\.\d+)?)%/g, (_, n) => `${n} percent`)
      .replace(/(\d+(?:\.\d+)?)\s*\/\s*(\d+)/g, (_, a, b) => `${a} out of ${b}`)
      .replace(/\$(\d+(?:,\d+)*(?:\.\d+)?)/g, (_, n) => `${n.replace(/,/g, "")} dollars`)
      .replace(/(\d+),(\d{3})/g, (_, a, b) => `${a}${b}`)
      .replace(/\n{2,}/g, ". ").replace(/\n/g, ". ").replace(/[:\-–—]/g, ", ")
      .replace(/\s+/g, " ").trim().slice(0, 700);
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 0.88; utterance.pitch = 1.05; utterance.lang = "en-US";
    const trySpeak = () => {
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v => v.name.includes("Google US English") || v.name.includes("Samantha") || v.name.includes("Karen") || v.name.includes("Daniel") || (v.lang === "en-US" && v.localService === false));
      if (preferred) utterance.voice = preferred;
      utterance.onstart = () => { setIsSpeaking(true); setSpeakingMsgIndex(msgIndex); };
      utterance.onend = () => { setIsSpeaking(false); setSpeakingMsgIndex(null); };
      utterance.onerror = () => { setIsSpeaking(false); setSpeakingMsgIndex(null); };
      window.speechSynthesis.speak(utterance);
    };
    if (window.speechSynthesis.getVoices().length === 0) { window.speechSynthesis.onvoiceschanged = trySpeak; } else { trySpeak(); }
  };

  const handleUpload = async (f) => {
    const selectedFile = f || file;
    if (!selectedFile) { setUploadError("Please select a CSV file first"); return; }
    setLoading(true); setUploadError("");
    const formData = new FormData();
    formData.append("dataset", selectedFile);
    try {
      const res = await fetch("http://localhost:5000/upload", { method:"POST", body:formData });
      const data = await res.json();
      if (data.success) {
        setSummary(data.summary); setMetadata(data.metadata);
        setInsights(data.insights||[]); setRecommendations(data.recommendations||[]); setUseCases(data.useCases||[]);
        setMessages([{ role:"model", content:`✅ Dataset loaded successfully!\n\n${data.summary.datasetName}\n${data.summary.datasetPurpose||""}\n\n📊 ${data.summary.totalRows} rows × ${data.summary.totalColumns} columns · Quality: ${data.summary.qualityScore}%\n\nAsk me anything — type or use the 🎤 mic button!`, chartData:null }]);
        setTab("dashboard"); setFunTab(null);
        if (data.error) setUploadError("⚠️ "+data.error);
      } else { setUploadError(data.message||"Upload failed"); }
    } catch { setUploadError("Cannot connect to server on port 5000."); }
    setLoading(false);
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith(".csv")) { setFile(f); handleUpload(f); }
    else setUploadError("Please drop a CSV file");
  };

  const sendMessage = useCallback(async () => {
    const question = inputRef.current.trim();
    if (!question || chatLoading) return;
    if (textareaRef.current) textareaRef.current.value = "";
    inputRef.current = "";
    setMessages(prev=>[...prev, { role:"user", content:question, chartData:null }]);
    setChatLoading(true);
    try {
      const res = await fetch("http://localhost:5000/chat", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ question, chatHistory: [] }),
      });
      const data = await res.json();
      setMessages(prev=>[...prev,{ role:"model", content:data.answer, chartData:data.chartData||null }]);
    } catch {
      setMessages(prev=>[...prev,{ role:"model", content:"❌ Server error. Make sure backend is running.", chartData:null }]);
    }
    setChatLoading(false);
  }, [chatLoading]);

  const fetchColInsight = async (colName) => {
    setSelectedCol(colName); setColInsight(""); setColInsightLoading(true);
    try {
      const res = await fetch("http://localhost:5000/column-insight", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ columnName:colName }) });
      const data = await res.json(); setColInsight(data.insight);
    } catch { setColInsight("Could not load insight."); }
    setColInsightLoading(false);
  };

  const downloadCSV = () => {
    if (!metadata.length) return;
    const rows = [["Column","Type","Description","Business Meaning","Relationship","Missing %","Unique"],
      ...metadata.map(m=>[m.column,m.type,`"${(m.description||"").replace(/"/g,"''")}"`
        ,`"${(m.businessMeaning||"").replace(/"/g,"''")}"`
        ,m.relationship,(m.stats?.missingPct||0)+"%",m.stats?.unique||0])];
    const blob = new Blob([rows.map(r=>r.join(",")).join("\n")],{type:"text/csv"});
    const a = document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download=`${summary?.datasetName||"data"}_dictionary.csv`; a.click();
  };

  const fetchDetective = async () => {
    setDetectiveLoading(true); setFunTab("detective"); setTab(null);
    try {
      const res = await fetch("http://localhost:5000/detective", { method:"POST", headers:{"Content-Type":"application/json"} });
      const data = await res.json();
      setDetectiveReport(data.report);
    } catch { setDetectiveReport("Detective is unavailable. Make sure server is running!"); }
    setDetectiveLoading(false);
  };

  const fetchHoroscope = async () => {
    setHoroscopeLoading(true); setFunTab("horoscope"); setTab(null);
    try {
      const res = await fetch("http://localhost:5000/horoscope", { method:"POST", headers:{"Content-Type":"application/json"} });
      const data = await res.json();
      setHoroscope(data.horoscope);
    } catch { setHoroscope("The stars are unclear. Make sure server is running!"); }
    setHoroscopeLoading(false);
  };

  const typeDistData = [
    { name:"Integer", value:metadata.filter(m=>m.type==="Integer").length, color:"#10B981" },
    { name:"Float", value:metadata.filter(m=>m.type==="Float").length, color:"#3B82F6" },
    { name:"String", value:metadata.filter(m=>m.type==="String").length, color:"#F59E0B" },
    { name:"Date", value:metadata.filter(m=>m.type==="Date").length, color:"#8B5CF6" },
  ].filter(d=>d.value>0);

  const missingData = metadata.filter(m=>parseFloat(m.stats?.missingPct)>0)
    .sort((a,b)=>parseFloat(b.stats?.missingPct)-parseFloat(a.stats?.missingPct)).slice(0,10)
    .map(m=>({ name:m.column, value:parseFloat(m.stats?.missingPct), fill:parseFloat(m.stats?.missingPct)>20?"#EF4444":"#F59E0B" }));

  const qualityData = summary ? [
    { name:"Complete", value:parseFloat((100-parseFloat(summary.missingPercentage||0)).toFixed(1)), fill:"#10B981" },
    { name:"Missing", value:parseFloat(parseFloat(summary.missingPercentage||0).toFixed(1)), fill:"#EF4444" },
  ] : [];

  const relData = [
    { name:"Primary Key", value:metadata.filter(m=>m.relationship?.includes("Primary")).length },
    { name:"Target", value:metadata.filter(m=>m.relationship?.includes("Target")).length },
    { name:"Categorical", value:metadata.filter(m=>m.relationship?.includes("Categorical")).length },
    { name:"Numerical", value:metadata.filter(m=>m.relationship?.includes("Numerical")||m.relationship?.includes("Feature")).length },
    { name:"Other", value:metadata.filter(m=>!m.relationship?.match(/Primary|Target|Categorical|Numerical|Feature|Identifier/)).length },
  ].filter(d=>d.value>0);

  const numStats = metadata.filter(m=>m.stats?.mean!==undefined).map(m=>({
    name:m.column.slice(0,12), mean:parseFloat(m.stats.mean), min:parseFloat(m.stats.min), max:parseFloat(m.stats.max)
  }));

  const filtered = metadata.filter(m=>m.column.toLowerCase().includes(search.toLowerCase()));

  const Tip = ({ active, payload, label }) => {
    if (!active||!payload?.length) return null;
    return <div style={{ background:dark?"#1a1f35":"#fff", border:`1px solid ${t.borderAccent}`, borderRadius:"10px", padding:"10px 14px", fontSize:"12px", color:t.text }}>
      <p style={{ fontWeight:700, marginBottom:"4px", color:t.accent2 }}>{label||payload[0]?.name}</p>
      {payload.map((p,i)=><p key={i} style={{ color:p.fill||p.color||t.accent }}>{p.name}: <strong>{p.value}</strong></p>)}
    </div>;
  };

  const Card = ({ children, style={} }) => (
    <div className="hover-card" style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:"16px", padding:"20px", backdropFilter:"blur(20px)", ...style }}>{children}</div>
  );

  const SectionTitle = ({ icon, label, color=t.accent2 }) => (
    <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"16px" }}>
      <span style={{ fontSize:"14px" }}>{icon}</span>
      <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"11px", color, fontWeight:600, letterSpacing:"0.08em" }}>{label}</span>
    </div>
  );

  const TabItem = ({ id, label, icon }) => (
    <div className="tab-item" onClick={()=>{ setTab(id); setFunTab(null); }} style={{
      display:"flex", alignItems:"center", gap:"10px", padding:"10px 14px", borderRadius:"10px",
      background: tab===id && !funTab ? t.tabActive : "transparent",
      borderLeft: tab===id && !funTab ? `2px solid ${t.accent}` : "2px solid transparent",
    }}>
      <span style={{ fontSize:"15px" }}>{icon}</span>
      <span style={{ fontSize:"13px", fontWeight:tab===id&&!funTab?600:400, color:tab===id&&!funTab?t.accent2:t.sub }}>{label}</span>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:t.bg, color:t.text, display:"flex", flexDirection:"column" }}>
      {/* Navbar */}
      <div style={{ height:"56px", borderBottom:`1px solid ${t.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 28px", backdropFilter:"blur(20px)", background:dark?"rgba(6,8,15,0.8)":"rgba(248,247,255,0.8)", position:"sticky", top:0, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <div style={{ width:"32px", height:"32px", borderRadius:"10px", background:"linear-gradient(135deg,#8B5CF6,#06B6D4)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"16px" }}>🧠</div>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"17px", fontWeight:700, color:t.text }}>MetaMind<span style={{ color:t.accent }}> AI</span></span>
          <div style={{ width:"1px", height:"16px", background:t.border, margin:"0 6px" }} />
          <span style={{ fontSize:"12px", color:t.muted }}>Intelligent Data Dictionary</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
          {summary && (
            <div style={{ display:"flex", alignItems:"center", gap:"6px", padding:"4px 12px", background:t.card, border:`1px solid ${t.border}`, borderRadius:"8px" }}>
              <span style={{ fontSize:"11px" }}>📂</span>
              <span style={{ fontSize:"12px", color:t.sub, maxWidth:"200px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{summary.datasetName}</span>
            </div>
          )}
          <button onClick={()=>setDark(!dark)} style={{ padding:"6px 14px", border:`1px solid ${t.border}`, borderRadius:"8px", background:t.card, color:t.sub, cursor:"pointer", fontSize:"12px", fontWeight:500 }}>
            {dark?"☀️ Light":"🌙 Dark"}
          </button>
        </div>
      </div>

      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>
        {/* Sidebar */}
        <div style={{ width:"240px", borderRight:`1px solid ${t.border}`, padding:"20px 12px", display:"flex", flexDirection:"column", gap:"16px", background:dark?"rgba(6,8,15,0.6)":"rgba(255,255,255,0.5)", backdropFilter:"blur(20px)", overflowY:"auto" }}>
          <div style={{ padding:"4px" }}>
            <div style={{ fontSize:"10px", fontFamily:"'JetBrains Mono',monospace", color:t.muted, letterSpacing:"0.1em", marginBottom:"10px", paddingLeft:"4px" }}>DATASET</div>
            <div onDragOver={(e)=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={handleDrop} onClick={()=>fileInputRef.current?.click()}
              style={{ padding:"18px 12px", border:`2px dashed ${dragOver?t.accent:t.border}`, borderRadius:"12px", textAlign:"center", cursor:"pointer", transition:"all 0.2s", background:dragOver?`${t.accent}10`:"transparent", marginBottom:"10px" }}>
              <input ref={fileInputRef} type="file" accept=".csv" onChange={e=>setFile(e.target.files[0])} style={{ display:"none" }} />
              <div style={{ fontSize:"22px", marginBottom:"6px" }}>📄</div>
              {file ? <div style={{ fontSize:"11px", color:t.accent2, fontWeight:600, wordBreak:"break-all" }}>✓ {file.name}</div>
                : <div style={{ fontSize:"11px", color:t.muted }}>Drop CSV or click</div>}
            </div>
            {uploadError && <div style={{ fontSize:"11px", color:t.accentRed, padding:"8px 10px", background:`${t.accentRed}12`, border:`1px solid ${t.accentRed}25`, borderRadius:"8px", marginBottom:"10px", lineHeight:"1.5" }}>{uploadError}</div>}
            <button onClick={()=>handleUpload()} disabled={loading||!file} style={{ width:"100%", padding:"10px", border:"none", borderRadius:"10px", background:loading||!file?"rgba(139,92,246,0.3)":"linear-gradient(135deg,#8B5CF6,#06B6D4)", color:"#fff", cursor:loading||!file?"not-allowed":"pointer", fontWeight:600, fontSize:"13px" }}>
              {loading ? "⏳ Analyzing..." : "🚀 Analyze"}
            </button>
            {summary && (
              <div style={{ marginTop:"12px", padding:"10px 12px", background:t.card, border:`1px solid ${t.border}`, borderRadius:"10px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"6px" }}>
                  <span style={{ fontSize:"11px", color:t.muted }}>Quality</span>
                  <span style={{ fontSize:"11px", fontFamily:"'JetBrains Mono',monospace", color:summary.qualityScore>90?t.accentGreen:summary.qualityScore>70?t.accentAmber:t.accentRed, fontWeight:600 }}>{summary.qualityScore}%</span>
                </div>
                <div style={{ height:"4px", background:t.border, borderRadius:"4px", overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${summary.qualityScore}%`, background:`linear-gradient(90deg,${t.accent},${t.accentBlue})`, borderRadius:"4px", transition:"width 1.2s ease" }} />
                </div>
              </div>
            )}
          </div>

          {summary && (
            <div>
              <div style={{ fontSize:"10px", fontFamily:"'JetBrains Mono',monospace", color:t.muted, letterSpacing:"0.1em", marginBottom:"8px", paddingLeft:"4px" }}>NAVIGATION</div>
              <div style={{ display:"flex", flexDirection:"column", gap:"2px" }}>
                <TabItem id="dashboard" icon="🏠" label="Dashboard" />
                <TabItem id="visuals" icon="📈" label="Visualizations" />
                <TabItem id="dictionary" icon="📖" label="Data Dictionary" />
                <TabItem id="chat" icon="💬" label="AI Assistant" />
                <div className="tab-item" onClick={fetchDetective} style={{
                  display:"flex", alignItems:"center", gap:"10px", padding:"10px 14px", borderRadius:"10px", cursor:"pointer",
                  background: funTab==="detective" ? "rgba(239,68,68,0.15)" : "transparent",
                  borderLeft: funTab==="detective" ? "2px solid #EF4444" : "2px solid transparent",
                }}>
                  <span style={{ fontSize:"15px" }}>🕵️</span>
                  <span style={{ fontSize:"13px", fontWeight: funTab==="detective"?600:400, color:"#EF4444" }}>Data Detective</span>
                </div>
                {/* Horoscope */}
                <div className="fun-tab tab-item" onClick={fetchHoroscope} style={{
                  display:"flex", alignItems:"center", gap:"10px", padding:"10px 14px", borderRadius:"10px", cursor:"pointer",
                  background: funTab==="horoscope" ? "rgba(167,139,250,0.15)" : "transparent",
                  borderLeft: funTab==="horoscope" ? "2px solid #A78BFA" : "2px solid transparent",
                }}>
                  <span style={{ fontSize:"15px" }}>🔮</span>
                  <span style={{ fontSize:"13px", fontWeight: funTab==="horoscope"?600:400, color:"#A78BFA" }}>Data Horoscope</span>
                </div>
              </div>
            </div>
          )}

          {summary && (
            <div>
              <div style={{ fontSize:"10px", fontFamily:"'JetBrains Mono',monospace", color:t.muted, letterSpacing:"0.1em", marginBottom:"8px", paddingLeft:"4px" }}>OVERVIEW</div>
              <div style={{ display:"flex", flexDirection:"column", gap:"1px" }}>
                {[["Rows",summary.totalRows,t.accentBlue],["Columns",summary.totalColumns,t.accent2],["Numeric",summary.numericColumns,t.accentGreen],["Text",summary.textColumns,t.accentAmber],["Duplicates",summary.duplicateRows,t.accentRed],["Missing",summary.missingPercentage+"%",t.accentAmber]].map(([l,v,c])=>(
                  <div key={l} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 10px", borderRadius:"8px" }}>
                    <span style={{ fontSize:"12px", color:t.sub }}>{l}</span>
                    <span style={{ fontSize:"12px", fontFamily:"'JetBrains Mono',monospace", color:c, fontWeight:600 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div style={{ flex:1, overflowY:"auto", padding:"24px 28px" }}>

          {/* Landing */}
          {!summary && (
            <div className="fade-up" style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", textAlign:"center", padding:"60px 40px" }}>
              <div style={{ width:"72px", height:"72px", borderRadius:"20px", background:"linear-gradient(135deg,#8B5CF6,#06B6D4)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"32px", marginBottom:"24px", boxShadow:"0 0 40px rgba(139,92,246,0.4)" }}>🧠</div>
              <h1 style={{ fontSize:"32px", fontWeight:800, color:t.text, marginBottom:"12px" }}>Intelligent Data Dictionary</h1>
              <p style={{ color:t.sub, fontSize:"15px", maxWidth:"480px", lineHeight:"1.7", marginBottom:"32px" }}>Upload any CSV dataset. AI automatically analyzes fields, data types, relationships, and generates human-readable descriptions with interactive visualizations.</p>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px", maxWidth:"520px" }}>
                {[["🔍","AI Field Analysis","Auto-detect types, relationships, and anomalies"],["📊","Smart Visualizations","Interactive charts generated from your data"],["🎤","Voice AI Assistant","Talk to your data — ask by voice, hear answers!"],["🕵️","Data Detective","Crime-style investigation of your data quality"],["🔮","Data Horoscope","Mystical ML recommendations for your dataset"],["📖","Data Dictionary","Export complete metadata documentation"]].map(([icon,title,desc])=>(
                  <div key={title} style={{ padding:"16px", background:t.card, border:`1px solid ${t.border}`, borderRadius:"14px", textAlign:"left" }}>
                    <div style={{ fontSize:"20px", marginBottom:"8px" }}>{icon}</div>
                    <div style={{ fontSize:"13px", fontWeight:600, color:t.text, marginBottom:"4px" }}>{title}</div>
                    <div style={{ fontSize:"12px", color:t.muted, lineHeight:"1.5" }}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DASHBOARD */}
          {summary && tab==="dashboard" && !funTab && (
            <div className="fade-up" style={{ display:"flex", flexDirection:"column", gap:"20px" }}>
              <div style={{ background:`linear-gradient(135deg,rgba(139,92,246,0.12),rgba(6,182,212,0.08))`, border:`1px solid ${t.borderAccent}`, borderRadius:"18px", padding:"24px 28px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"16px" }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:"10px", fontFamily:"'JetBrains Mono',monospace", color:t.muted, letterSpacing:"0.1em", marginBottom:"8px" }}>DATASET IDENTIFIED</div>
                    <h2 style={{ fontSize:"22px", fontWeight:800, color:t.text, marginBottom:"10px" }}>{summary.datasetName}</h2>
                    <p style={{ color:t.sub, fontSize:"14px", lineHeight:"1.7", maxWidth:"680px" }}>{summary.datasetPurpose}</p>
                  </div>
                  <Badge label={summary.datasetType} color={t.accent} size="md" />
                </div>
                {summary.qualityAssessment && (
                  <div style={{ marginTop:"16px", padding:"12px 16px", background:dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.03)", borderRadius:"10px", fontSize:"13px", color:t.sub, lineHeight:"1.6", borderLeft:`3px solid ${t.accent}` }}>
                    {summary.qualityAssessment}
                  </div>
                )}
              </div>
              {insights.length>0 && (
                <Card>
                  <SectionTitle icon="🤖" label="AI INSIGHTS" />
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:"10px" }}>
                    {insights.map((ins,i)=>(
                      <div key={i} style={{ padding:"12px 14px", background:dark?"rgba(139,92,246,0.06)":"rgba(139,92,246,0.04)", border:`1px solid ${t.borderAccent}`, borderRadius:"10px", fontSize:"13px", color:t.text, lineHeight:"1.6" }}>
                        <span style={{ color:t.accent, marginRight:"8px", fontSize:"12px" }}>▸</span>{ins}
                      </div>
                    ))}
                  </div>
                </Card>
              )}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
                {recommendations.length>0 && (
                  <Card>
                    <SectionTitle icon="✅" label="RECOMMENDATIONS" color={t.accentGreen} />
                    {recommendations.map((r,i)=><div key={i} style={{ fontSize:"13px", color:t.text, marginBottom:"10px", lineHeight:"1.6", paddingLeft:"12px", borderLeft:`2px solid ${t.accentGreen}` }}>{r}</div>)}
                  </Card>
                )}
                {useCases.length>0 && (
                  <Card>
                    <SectionTitle icon="💡" label="USE CASES" color={t.accentAmber} />
                    {useCases.map((u,i)=><div key={i} style={{ fontSize:"13px", color:t.text, marginBottom:"10px", lineHeight:"1.6", paddingLeft:"12px", borderLeft:`2px solid ${t.accentAmber}` }}>{u}</div>)}
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* VISUALIZATIONS */}
          {summary && tab==="visuals" && !funTab && (
            <div className="fade-up" style={{ display:"flex", flexDirection:"column", gap:"20px" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"20px" }}>
                <Card>
                  <SectionTitle icon="📊" label="DATA TYPE DISTRIBUTION" />
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={typeDistData} cx="50%" cy="50%" outerRadius={82} dataKey="value" label={({name,value})=>`${name}:${value}`} labelLine={false} fontSize={10}>
                        {typeDistData.map((e,i)=><Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip content={<Tip />} /><Legend wrapperStyle={{ fontSize:"11px", color:t.sub }} />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
                <Card>
                  <SectionTitle icon="🔍" label="DATA COMPLETENESS" />
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={qualityData} cx="50%" cy="50%" innerRadius={55} outerRadius={82} dataKey="value" label={({name,value})=>`${name}: ${value}%`}>
                        {qualityData.map((e,i)=><Cell key={i} fill={e.fill} />)}
                      </Pie>
                      <Tooltip content={<Tip />} /><Legend wrapperStyle={{ fontSize:"11px", color:t.sub }} />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
              </div>
              {missingData.length>0 && (
                <Card>
                  <SectionTitle icon="⚠️" label="MISSING VALUES BY COLUMN" color={t.accentRed} />
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={missingData} margin={{ top:5,right:20,left:0,bottom:40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.05)"} />
                      <XAxis dataKey="name" tick={{ fill:t.sub, fontSize:11 }} angle={-35} textAnchor="end" />
                      <YAxis tick={{ fill:t.sub, fontSize:11 }} unit="%" />
                      <Tooltip content={<Tip />} />
                      <Bar dataKey="value" name="Missing %" radius={[6,6,0,0]}>
                        {missingData.map((e,i)=><Cell key={i} fill={e.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}
              {relData.length>0 && (
                <Card>
                  <SectionTitle icon="🔗" label="COLUMN RELATIONSHIPS" color={t.accent2} />
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={relData} layout="vertical" margin={{ top:5,right:30,left:90,bottom:5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.05)"} />
                      <XAxis type="number" tick={{ fill:t.sub, fontSize:11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fill:t.sub, fontSize:11 }} />
                      <Tooltip content={<Tip />} />
                      <Bar dataKey="value" name="Count" radius={[0,6,6,0]}>
                        {relData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}
              {numStats.length>0 && (
                <Card>
                  <SectionTitle icon="🔢" label="NUMERIC COLUMN STATISTICS" color={t.accentGreen} />
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={numStats} margin={{ top:5,right:20,left:0,bottom:40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.05)"} />
                      <XAxis dataKey="name" tick={{ fill:t.sub, fontSize:11 }} angle={-35} textAnchor="end" />
                      <YAxis tick={{ fill:t.sub, fontSize:11 }} />
                      <Tooltip content={<Tip />} />
                      <Bar dataKey="min" name="Min" fill="#10B981" radius={[4,4,0,0]} />
                      <Bar dataKey="mean" name="Mean" fill="#8B5CF6" radius={[4,4,0,0]} />
                      <Bar dataKey="max" name="Max" fill="#EF4444" radius={[4,4,0,0]} />
                      <Legend wrapperStyle={{ fontSize:"11px", color:t.sub }} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}
            </div>
          )}

          {/* DATA DICTIONARY */}
          {summary && tab==="dictionary" && !funTab && (
            <div className="fade-up">
              <Card style={{ padding:"0", overflow:"hidden" }}>
                <div style={{ padding:"18px 22px", borderBottom:`1px solid ${t.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ fontSize:"15px", fontWeight:700, color:t.text }}>Data Dictionary</div>
                    <div style={{ fontSize:"12px", color:t.muted, marginTop:"2px" }}>{filtered.length} columns · Click any row for AI analysis</div>
                  </div>
                  <div style={{ display:"flex", gap:"10px" }}>
                    <input placeholder="Search columns..." value={search} onChange={e=>setSearch(e.target.value)}
                      style={{ padding:"8px 14px", borderRadius:"8px", border:`1px solid ${t.border}`, background:t.input, color:t.text, fontSize:"13px", width:"180px" }} />
                    <button onClick={downloadCSV} style={{ padding:"8px 16px", border:"none", borderRadius:"8px", background:t.accent, color:"#fff", cursor:"pointer", fontSize:"13px", fontWeight:600 }}>⬇ Export</button>
                  </div>
                </div>
                {selectedCol && (
                  <div style={{ margin:"16px 22px", background:dark?"rgba(139,92,246,0.08)":"rgba(139,92,246,0.05)", border:`1px solid ${t.borderAccent}`, borderRadius:"12px", padding:"14px 16px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"8px" }}>
                      <span style={{ fontSize:"13px", color:t.accent2, fontWeight:600, fontFamily:"'JetBrains Mono',monospace" }}>🔍 {selectedCol}</span>
                      <button onClick={()=>{setSelectedCol(null);setColInsight("");}} style={{ background:"none", border:"none", color:t.muted, cursor:"pointer", fontSize:"16px" }}>✕</button>
                    </div>
                    {colInsightLoading ? <div style={{ color:t.muted, fontSize:"13px", animation:"pulse 1.5s infinite" }}>Analyzing column...</div>
                      : <div style={{ fontSize:"13px", color:t.text, lineHeight:"1.7" }}>{colInsight}</div>}
                  </div>
                )}
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse" }}>
                    <thead>
                      <tr style={{ background:dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.03)" }}>
                        {["Column","Type","Description","Business Meaning","Role","Missing","Unique"].map(h=>(
                          <th key={h} style={{ padding:"11px 16px", textAlign:"left", borderBottom:`1px solid ${t.border}`, fontFamily:"'JetBrains Mono',monospace", fontSize:"10px", color:t.muted, fontWeight:600, letterSpacing:"0.06em", whiteSpace:"nowrap" }}>{h.toUpperCase()}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((m,i)=>(
                        <tr key={i} className="col-row" onClick={()=>fetchColInsight(m.column)} style={{ borderBottom:`1px solid ${t.border}` }}>
                          <td style={{ padding:"12px 16px", fontFamily:"'JetBrains Mono',monospace", fontSize:"12px", color:t.text, fontWeight:600 }}>{m.column}</td>
                          <td style={{ padding:"12px 16px" }}><Badge label={m.type} color={typeColor(m.type)} /></td>
                          <td style={{ padding:"12px 16px", fontSize:"13px", color:t.sub, maxWidth:"220px", lineHeight:"1.5" }}>{m.description}</td>
                          <td style={{ padding:"12px 16px", fontSize:"12px", color:t.muted, maxWidth:"180px", lineHeight:"1.5" }}>{m.businessMeaning}</td>
                          <td style={{ padding:"12px 16px" }}><Badge label={m.relationship} color={relColor(m.relationship)} /></td>
                          <td style={{ padding:"12px 16px", fontFamily:"'JetBrains Mono',monospace", fontSize:"12px", color:parseFloat(m.stats?.missingPct)>10?t.accentRed:t.accentGreen, fontWeight:600 }}>{m.stats?.missingPct}%</td>
                          <td style={{ padding:"12px 16px", fontFamily:"'JetBrains Mono',monospace", fontSize:"12px", color:t.muted }}>{m.stats?.unique}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* AI CHAT */}
          {summary && tab==="chat" && !funTab && (
            <div className="fade-up" style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 130px)" }}>
              <Card style={{ flex:1, display:"flex", flexDirection:"column", padding:"0", overflow:"hidden" }}>
                <div style={{ padding:"16px 22px", borderBottom:`1px solid ${t.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                    <div style={{ width:"36px", height:"36px", borderRadius:"50%", background:"linear-gradient(135deg,#8B5CF6,#06B6D4)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"16px" }}>🤖</div>
                    <div>
                      <div style={{ fontSize:"14px", fontWeight:600, color:t.text }}>AI Assistant</div>
                      <div style={{ fontSize:"11px", color:t.accentGreen }}>● Active · {summary.datasetName}</div>
                    </div>
                  </div>
                  {isListening && (
                    <div style={{ display:"flex", alignItems:"center", gap:"8px", padding:"6px 14px", background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:"20px" }}>
                      <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:"#EF4444", animation:"pulse 1s infinite" }} />
                      <span style={{ fontSize:"12px", color:"#EF4444", fontWeight:600 }}>Listening...</span>
                    </div>
                  )}
                  {isSpeaking && (
                    <div style={{ display:"flex", alignItems:"center", gap:"8px", padding:"6px 14px", background:"rgba(16,185,129,0.1)", border:"1px solid rgba(16,185,129,0.3)", borderRadius:"20px" }}>
                      <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:"#10B981", animation:"pulse 1s infinite" }} />
                      <span style={{ fontSize:"12px", color:"#10B981", fontWeight:600 }}>Speaking...</span>
                    </div>
                  )}
                </div>
                {messages.length<=1 && (
                  <div style={{ padding:"14px 22px", borderBottom:`1px solid ${t.border}`, display:"flex", gap:"8px", flexWrap:"wrap" }}>
                    {["Show survival rate distribution","Compare fare by class","What are the key patterns?","Which columns need cleaning?","Show age distribution"].map(q=>(
                      <button key={q} className="suggest-btn"
                        onClick={()=>{ if(textareaRef.current){ textareaRef.current.value=q; inputRef.current=q; textareaRef.current.focus(); } }}
                        style={{ padding:"6px 12px", border:`1px solid ${t.border}`, borderRadius:"20px", background:"transparent", color:t.muted, fontSize:"12px", cursor:"pointer" }}>{q}</button>
                    ))}
                  </div>
                )}
                <div style={{ flex:1, overflowY:"auto", padding:"20px 22px", display:"flex", flexDirection:"column", gap:"16px" }}>
                  {messages.map((msg,i)=>(
                    <div key={i} style={{ display:"flex", justifyContent:msg.role==="user"?"flex-end":"flex-start", animation:i===messages.length-1?"fadeUp 0.3s ease":"none" }}>
                      {msg.role==="model" && (
                        <div style={{ width:"28px", height:"28px", borderRadius:"50%", background:"linear-gradient(135deg,#8B5CF6,#06B6D4)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"12px", marginRight:"10px", flexShrink:0, marginTop:"4px" }}>🤖</div>
                      )}
                      <div style={{ maxWidth:"80%", padding:"14px 18px", borderRadius:msg.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px", background:msg.role==="user"?t.chatUser:t.chatAI, border:`1px solid ${t.border}`, color:t.text }}>
                        <SmartMessage content={msg.content} chartData={msg.chartData} dark={dark}
                          onSpeak={msg.role==="model" ? (text)=>speakText(text,i) : null}
                          isSpeaking={isSpeaking && speakingMsgIndex===i} />
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                      <div style={{ width:"28px", height:"28px", borderRadius:"50%", background:"linear-gradient(135deg,#8B5CF6,#06B6D4)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"12px" }}>🤖</div>
                      <div style={{ display:"flex", gap:"5px", padding:"12px 16px", background:t.chatAI, border:`1px solid ${t.border}`, borderRadius:"16px 16px 16px 4px" }}>
                        {[0,1,2].map(d=><div key={d} style={{ width:"7px", height:"7px", borderRadius:"50%", background:t.accent, animation:`pulse 1.3s ease ${d*0.2}s infinite` }} />)}
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div style={{ padding:"16px 22px", borderTop:`1px solid ${t.border}`, display:"flex", gap:"10px", alignItems:"flex-end" }}>
                  <textarea ref={textareaRef} onChange={e => { inputRef.current = e.target.value; }}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder={isListening ? "🎤 Listening... speak now!" : "Type or 🎤 speak your question..."}
                    rows={3} autoComplete="off" autoCorrect="off" spellCheck="false"
                    style={{ flex:1, padding:"12px 16px", borderRadius:"12px", border:`1px solid ${isListening?"#EF4444":t.border}`, background:isListening?"rgba(239,68,68,0.05)":t.input, color:t.text, fontSize:"14px", resize:"none", fontFamily:"'Inter',sans-serif", lineHeight:"1.5", transition:"all 0.2s" }}
                    onFocus={e => e.target.style.borderColor = isListening ? "#EF4444" : t.borderAccent}
                    onBlur={e => e.target.style.borderColor = isListening ? "#EF4444" : t.border}
                  />
                  <button onClick={startListening} title={isListening?"Click to stop":"Click to speak"}
                    className={isListening ? "mic-btn-active" : ""}
                    style={{ padding:"12px 14px", borderRadius:"12px", background:isListening?"linear-gradient(135deg,#EF4444,#F87171)":"rgba(139,92,246,0.15)", color:isListening?"#fff":t.accent2, cursor:"pointer", fontSize:"18px", flexShrink:0, transition:"all 0.2s", border:`1px solid ${isListening?"#EF4444":t.borderAccent}` }}>
                    {isListening ? "⏹" : "🎤"}
                  </button>
                  <button className="send-btn" onClick={sendMessage} disabled={chatLoading}
                    style={{ padding:"12px 20px", border:"none", borderRadius:"12px", background:"linear-gradient(135deg,#8B5CF6,#06B6D4)", color:"#fff", cursor:"pointer", fontWeight:700, fontSize:"16px", opacity:chatLoading?0.4:1, flexShrink:0 }}>↑</button>
                </div>
              </Card>
            </div>
          )}

          {/* 🕵️ DATA DETECTIVE */}
          {summary && funTab==="detective" && (
            <div className="fade-up">
              <Card style={{ borderColor:"rgba(239,68,68,0.3)" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"20px" }}>
                  <div style={{ width:"48px", height:"48px", borderRadius:"14px", background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"24px" }}>🕵️</div>
                  <div>
                    <div style={{ fontSize:"17px", fontWeight:700, color:t.text }}>Data Detective</div>
                    <div style={{ fontSize:"12px", color:"#EF4444" }}>● Case File — {summary.datasetName}</div>
                  </div>
                </div>
                {detectiveLoading ? (
                  <div style={{ color:t.muted, fontSize:"14px", animation:"pulse 1.5s infinite", padding:"30px 0", textAlign:"center" }}>
                    🔍 Detective is investigating your data...
                  </div>
                ) : (
                  <div style={{ fontSize:"14px", color:t.text, lineHeight:"1.9", whiteSpace:"pre-wrap", padding:"20px", background:"rgba(239,68,68,0.05)", borderRadius:"14px", border:"1px solid rgba(239,68,68,0.15)" }}>
                    {detectiveReport}
                  </div>
                )}
                <button onClick={fetchDetective} style={{ marginTop:"16px", padding:"10px 22px", borderRadius:"10px", background:"rgba(239,68,68,0.15)", color:"#EF4444", cursor:"pointer", fontSize:"13px", fontWeight:600, border:"1px solid rgba(239,68,68,0.3)" }}>
                  🔄 Reinvestigate
                </button>
              </Card>
            </div>
          )}

          {/* 🔮 DATA HOROSCOPE */}
          {summary && funTab==="horoscope" && (
            <div className="fade-up">
              <Card style={{ borderColor:"rgba(167,139,250,0.3)", background: dark?"rgba(167,139,250,0.03)":"rgba(167,139,250,0.06)" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"20px" }}>
                  <div style={{ width:"48px", height:"48px", borderRadius:"14px", background:"rgba(167,139,250,0.15)", border:"1px solid rgba(167,139,250,0.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"24px" }}>🔮</div>
                  <div>
                    <div style={{ fontSize:"17px", fontWeight:700, color:t.text }}>Data Horoscope</div>
                    <div style={{ fontSize:"12px", color:"#A78BFA" }}>✨ Cosmic Reading — {summary.datasetName}</div>
                  </div>
                </div>
                {horoscopeLoading ? (
                  <div style={{ color:t.muted, fontSize:"14px", animation:"pulse 1.5s infinite", padding:"30px 0", textAlign:"center" }}>
                    🔮 Reading the stars for your dataset...
                  </div>
                ) : (
                  <div style={{ fontSize:"14px", color:t.text, lineHeight:"1.9", whiteSpace:"pre-wrap", padding:"20px", background:"rgba(167,139,250,0.07)", borderRadius:"14px", border:"1px solid rgba(167,139,250,0.2)" }}>
                    {horoscope}
                  </div>
                )}
                <button onClick={fetchHoroscope} style={{ marginTop:"16px", padding:"10px 22px", borderRadius:"10px", background:"rgba(167,139,250,0.15)", color:"#A78BFA", cursor:"pointer", fontSize:"13px", fontWeight:600, border:"1px solid rgba(167,139,250,0.3)" }}>
                  ✨ Read Again
                </button>
              </Card>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}





















// import { useState, useRef, useEffect, useCallback } from "react";
// import {
//   BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
//   PieChart, Pie, Cell, Legend, CartesianGrid
// } from "recharts";

// const fontLink = document.createElement("link");
// fontLink.rel = "stylesheet";
// fontLink.href = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap";
// document.head.appendChild(fontLink);

// const globalStyles = `
//   * { box-sizing: border-box; margin: 0; padding: 0; }
//   body { font-family: 'Inter', sans-serif; }
//   ::-webkit-scrollbar { width: 4px; }
//   ::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); }
//   ::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.4); border-radius: 4px; }
//   @keyframes fadeUp { from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)} }
//   @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.3} }
//   @keyframes micPulse { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.4)}50%{box-shadow:0 0 0 8px rgba(239,68,68,0)} }
//   .fade-up { animation: fadeUp 0.4s ease forwards; }
//   .hover-card { transition: all 0.25s cubic-bezier(0.4,0,0.2,1); }
//   .hover-card:hover { transform: translateY(-3px); box-shadow: 0 12px 40px rgba(139,92,246,0.2) !important; }
//   .tab-item { transition: all 0.2s; cursor: pointer; }
//   .tab-item:hover { background: rgba(139,92,246,0.15) !important; }
//   .col-row { transition: background 0.15s; cursor: pointer; }
//   .col-row:hover { background: rgba(139,92,246,0.08) !important; }
//   .send-btn { transition: all 0.2s; }
//   .send-btn:hover { transform: scale(1.06); filter: brightness(1.15); }
//   .mic-btn-active { animation: micPulse 1s infinite; }
//   textarea:focus { outline: none; }
//   button { font-family: 'Inter', sans-serif; }
//   .suggest-btn { transition: all 0.2s; }
//   .suggest-btn:hover { background: rgba(139,92,246,0.15) !important; color: #a78bfa !important; border-color: rgba(139,92,246,0.4) !important; }
//   .listen-btn { transition: all 0.2s; }
//   .listen-btn:hover { opacity: 0.8; }
// `;
// const styleEl = document.createElement("style");
// styleEl.textContent = globalStyles;
// document.head.appendChild(styleEl);

// const DARK = {
//   bg: "linear-gradient(160deg,#06080F 0%,#0C0F1D 40%,#0F1320 100%)",
//   card: "rgba(255,255,255,0.04)",
//   border: "rgba(255,255,255,0.08)",
//   borderAccent: "rgba(139,92,246,0.3)",
//   text: "#F1F5F9",
//   sub: "rgba(241,245,249,0.45)",
//   muted: "rgba(241,245,249,0.25)",
//   accent: "#8B5CF6",
//   accent2: "#A78BFA",
//   accentGreen: "#10B981",
//   accentAmber: "#F59E0B",
//   accentRed: "#EF4444",
//   accentBlue: "#3B82F6",
//   chatUser: "rgba(139,92,246,0.2)",
//   chatAI: "rgba(255,255,255,0.04)",
//   input: "rgba(255,255,255,0.05)",
//   tabActive: "rgba(139,92,246,0.2)",
// };
// const LIGHT = {
//   bg: "linear-gradient(160deg,#F8F7FF 0%,#EEF0FF 40%,#E8ECFF 100%)",
//   card: "rgba(255,255,255,0.8)",
//   border: "rgba(0,0,0,0.07)",
//   borderAccent: "rgba(139,92,246,0.25)",
//   text: "#0F0F23",
//   sub: "rgba(15,15,35,0.55)",
//   muted: "rgba(15,15,35,0.35)",
//   accent: "#7C3AED",
//   accent2: "#8B5CF6",
//   accentGreen: "#059669",
//   accentAmber: "#D97706",
//   accentRed: "#DC2626",
//   accentBlue: "#2563EB",
//   chatUser: "rgba(139,92,246,0.12)",
//   chatAI: "rgba(255,255,255,0.9)",
//   input: "rgba(255,255,255,0.8)",
//   tabActive: "rgba(139,92,246,0.15)",
// };

// const COLORS = ["#8B5CF6","#10B981","#F59E0B","#EF4444","#3B82F6","#EC4899","#06B6D4","#84CC16"];

// const typeColor = (tp) => {
//   if (tp==="Integer"||tp==="Float") return "#10B981";
//   if (tp==="String") return "#F59E0B";
//   if (tp==="Date") return "#8B5CF6";
//   return "#94A3B8";
// };
// const relColor = (r) => {
//   if (r?.includes("Target")) return "#EF4444";
//   if (r?.includes("Primary")) return "#3B82F6";
//   if (r?.includes("Categorical")) return "#F59E0B";
//   if (r?.includes("Numerical")||r?.includes("Feature")) return "#10B981";
//   return "#94A3B8";
// };

// const Badge = ({ label, color="#8B5CF6", size="sm" }) => (
//   <span style={{
//     display:"inline-flex", alignItems:"center",
//     padding: size==="sm"?"2px 9px":"3px 12px",
//     borderRadius:"6px", background:color+"18", color,
//     border:`1px solid ${color}30`,
//     fontSize: size==="sm"?"10px":"11px",
//     fontWeight:600, fontFamily:"'JetBrains Mono',monospace",
//     letterSpacing:"0.02em", whiteSpace:"nowrap",
//   }}>{label}</span>
// );

// function SmartMessage({ content, chartData, dark, onSpeak, isSpeaking }) {
//   const t = dark ? DARK : LIGHT;
//   const Tip = ({ active, payload, label }) => {
//     if (!active||!payload?.length) return null;
//     return (
//       <div style={{ background:dark?"#1a1f35":"#fff", border:`1px solid ${t.borderAccent}`, borderRadius:"10px", padding:"10px 14px", fontSize:"12px", color:t.text }}>
//         <p style={{ fontWeight:700, marginBottom:"4px", color:t.accent2 }}>{label||payload[0]?.name}</p>
//         {payload.map((p,i)=><p key={i} style={{ color:p.fill||p.color||t.accent }}>{p.name||"Value"}: <strong>{p.value}</strong></p>)}
//       </div>
//     );
//   };
//   return (
//     <div>
//       {/* Listen button */}
//       {onSpeak && (
//         <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:"6px" }}>
//           <button
//             className="listen-btn"
//             onClick={()=>onSpeak(content)}
//             style={{
//               background:"none", border:`1px solid ${t.border}`,
//               borderRadius:"8px", padding:"3px 10px",
//               color: isSpeaking ? t.accentRed : t.muted,
//               cursor:"pointer", fontSize:"11px", display:"flex",
//               alignItems:"center", gap:"4px",
//             }}
//           >
//             {isSpeaking ? "⏸ Stop" : "🔊 Listen"}
//           </button>
//         </div>
//       )}
//       <div style={{ fontSize:"14px", lineHeight:"1.75", color:t.text, whiteSpace:"pre-wrap" }}>
//         {content.replace(/\*\*(.*?)\*\*/g,"$1")}
//       </div>
//       {chartData && chartData.data && chartData.data.length > 0 && (
//         <div style={{ background:dark?"rgba(139,92,246,0.06)":"rgba(139,92,246,0.04)", border:`1px solid ${t.borderAccent}`, borderRadius:"16px", padding:"18px", marginTop:"14px" }}>
//           <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"14px" }}>
//             <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:t.accent }} />
//             <span style={{ fontSize:"11px", fontFamily:"'JetBrains Mono',monospace", color:t.accent2, fontWeight:600 }}>
//               {chartData.title || "DATA VISUALIZATION"}
//             </span>
//           </div>
//           {chartData.type === "pie" ? (
//             <ResponsiveContainer width="100%" height={220}>
//               <PieChart>
//                 <Pie data={chartData.data} cx="50%" cy="50%" outerRadius={80} dataKey="value"
//                   label={({name,value})=>`${String(name).slice(0,12)}: ${value}`} labelLine={false} fontSize={10}>
//                   {chartData.data.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]} />)}
//                 </Pie>
//                 <Tooltip content={<Tip />} />
//                 <Legend wrapperStyle={{ fontSize:"11px", color:t.sub }} />
//               </PieChart>
//             </ResponsiveContainer>
//           ) : (
//             <ResponsiveContainer width="100%" height={220}>
//               <BarChart data={chartData.data} margin={{ top:5,right:10,left:0,bottom:35 }}>
//                 <CartesianGrid strokeDasharray="3 3" stroke={dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.05)"} />
//                 <XAxis dataKey="name" tick={{ fill:t.sub, fontSize:10 }} angle={-30} textAnchor="end" />
//                 <YAxis tick={{ fill:t.sub, fontSize:10 }} />
//                 <Tooltip content={<Tip />} />
//                 <Bar dataKey="value" radius={[6,6,0,0]}>
//                   {chartData.data.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]} />)}
//                 </Bar>
//               </BarChart>
//             </ResponsiveContainer>
//           )}
//         </div>
//       )}
//     </div>
//   );
// }

// export default function App() {
//   const [dark, setDark] = useState(true);
//   const t = dark ? DARK : LIGHT;
//   const [file, setFile] = useState(null);
//   const [loading, setLoading] = useState(false);
//   const [tab, setTab] = useState("dashboard");
//   const [selectedCol, setSelectedCol] = useState(null);
//   const [colInsight, setColInsight] = useState("");
//   const [colInsightLoading, setColInsightLoading] = useState(false);
//   const [summary, setSummary] = useState(null);
//   const [metadata, setMetadata] = useState([]);
//   const [insights, setInsights] = useState([]);
//   const [recommendations, setRecommendations] = useState([]);
//   const [useCases, setUseCases] = useState([]);
//   const [search, setSearch] = useState("");
//   const [uploadError, setUploadError] = useState("");
//   const [messages, setMessages] = useState([
//     { role:"model", content:"👋 Welcome to MetaMind AI!\n\nUpload a CSV dataset to get started. I'll analyze your data and generate an intelligent data dictionary with insights, visualizations, and more.\n\n🎤 You can also use the mic button to ask questions by voice!", chartData:null },
//   ]);
//   const [chatLoading, setChatLoading] = useState(false);
//   const [dragOver, setDragOver] = useState(false);
//   const [isListening, setIsListening] = useState(false);
//   const [isSpeaking, setIsSpeaking] = useState(false);
//   const [speakingMsgIndex, setSpeakingMsgIndex] = useState(null);

//   const inputRef = useRef("");
//   const textareaRef = useRef(null);
//   const chatEndRef = useRef(null);
//   const fileInputRef = useRef(null);
//   const recognitionRef = useRef(null);

//   useEffect(()=>{ chatEndRef.current?.scrollIntoView({ behavior:"smooth" }); },[messages]);

//   // ── Voice Input ──
//   const startListening = () => {
//     const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
//     if (!SpeechRecognition) {
//       alert("Voice not supported! Please use Google Chrome.");
//       return;
//     }
//     if (isListening) {
//       recognitionRef.current?.stop();
//       setIsListening(false);
//       return;
//     }
//     const recognition = new SpeechRecognition();
//     recognitionRef.current = recognition;
//     recognition.lang = "en-US";
//     recognition.continuous = false;
//     recognition.interimResults = false;
//     recognition.onstart = () => setIsListening(true);
//     recognition.onresult = (e) => {
//       const text = e.results[0][0].transcript;
//       if (textareaRef.current) {
//         textareaRef.current.value = text;
//         inputRef.current = text;
//       }
//       setIsListening(false);
//     };
//     recognition.onerror = () => setIsListening(false);
//     recognition.onend = () => setIsListening(false);
//     recognition.start();
//   };

//   // ── Voice Output ──
//   const speakText = (text, msgIndex) => {
//     window.speechSynthesis.cancel();
//     if (isSpeaking && speakingMsgIndex === msgIndex) {
//       setIsSpeaking(false);
//       setSpeakingMsgIndex(null);
//       return;
//     }
    
    
//     const clean = text.replace(/[#*`_]/g, "").replace(/\n/g, " ").slice(0, 600);
//     const utterance = new SpeechSynthesisUtterance(clean);
//     utterance.rate = 0.92;
//     utterance.pitch = 1.05;
//     utterance.lang = "en-US";
//     const voices = window.speechSynthesis.getVoices();
//     const preferred = voices.find(v => v.name.includes("Google") || v.name.includes("Female") || v.name.includes("Samantha"));
//     if (preferred) utterance.voice = preferred;
//     utterance.onstart = () => { setIsSpeaking(true); setSpeakingMsgIndex(msgIndex); };
//     utterance.onend = () => { setIsSpeaking(false); setSpeakingMsgIndex(null); };
//     utterance.onerror = () => { setIsSpeaking(false); setSpeakingMsgIndex(null); };
//     window.speechSynthesis.speak(utterance);
//   };

//   const handleUpload = async (f) => {
//     const selectedFile = f || file;
//     if (!selectedFile) { setUploadError("Please select a CSV file first"); return; }
//     setLoading(true); setUploadError("");
//     const formData = new FormData();
//     formData.append("dataset", selectedFile);
//     try {
//       const res = await fetch("http://localhost:5000/upload", { method:"POST", body:formData });
//       const data = await res.json();
//       if (data.success) {
//         setSummary(data.summary); setMetadata(data.metadata);
//         setInsights(data.insights||[]); setRecommendations(data.recommendations||[]); setUseCases(data.useCases||[]);
//         setMessages([{ role:"model", content:`✅ Dataset loaded successfully!\n\n${data.summary.datasetName}\n${data.summary.datasetPurpose||""}\n\n📊 ${data.summary.totalRows} rows × ${data.summary.totalColumns} columns · Quality: ${data.summary.qualityScore}%\n\nAsk me anything — type or use the 🎤 mic button!`, chartData:null }]);
//         setTab("dashboard");
//         if (data.error) setUploadError("⚠️ "+data.error);
//       } else { setUploadError(data.message||"Upload failed"); }
//     } catch { setUploadError("Cannot connect to server on port 5000."); }
//     setLoading(false);
//   };

//   const handleDrop = (e) => {
//     e.preventDefault(); setDragOver(false);
//     const f = e.dataTransfer.files[0];
//     if (f && f.name.endsWith(".csv")) { setFile(f); handleUpload(f); }
//     else setUploadError("Please drop a CSV file");
//   };

//   const sendMessage = useCallback(async () => {
//     const question = inputRef.current.trim();
//     if (!question || chatLoading) return;
//     if (textareaRef.current) textareaRef.current.value = "";
//     inputRef.current = "";
//     const userMsg = { role:"user", content:question, chartData:null };
//     setMessages(prev=>[...prev, userMsg]);
//     setChatLoading(true);
//     try {
//       const res = await fetch("http://localhost:5000/chat", {
//         method:"POST", headers:{"Content-Type":"application/json"},
//         body: JSON.stringify({ question, chatHistory: [] }),
//       });
//       const data = await res.json();
//       setMessages(prev=>[...prev,{ role:"model", content:data.answer, chartData:data.chartData||null }]);
//     } catch {
//       setMessages(prev=>[...prev,{ role:"model", content:"❌ Server error. Make sure backend is running.", chartData:null }]);
//     }
//     setChatLoading(false);
//   }, [chatLoading]);

//   const fetchColInsight = async (colName) => {
//     setSelectedCol(colName); setColInsight(""); setColInsightLoading(true);
//     try {
//       const res = await fetch("http://localhost:5000/column-insight", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ columnName:colName }) });
//       const data = await res.json(); setColInsight(data.insight);
//     } catch { setColInsight("Could not load insight."); }
//     setColInsightLoading(false);
//   };

//   const downloadCSV = () => {
//     if (!metadata.length) return;
//     const rows = [["Column","Type","Description","Business Meaning","Relationship","Missing %","Unique"],
//       ...metadata.map(m=>[m.column,m.type,`"${(m.description||"").replace(/"/g,"''")}"`
//         ,`"${(m.businessMeaning||"").replace(/"/g,"''")}"`
//         ,m.relationship,(m.stats?.missingPct||0)+"%",m.stats?.unique||0])];
//     const blob = new Blob([rows.map(r=>r.join(",")).join("\n")],{type:"text/csv"});
//     const a = document.createElement("a"); a.href=URL.createObjectURL(blob);
//     a.download=`${summary?.datasetName||"data"}_dictionary.csv`; a.click();
//   };

//   const typeDistData = [
//     { name:"Integer", value:metadata.filter(m=>m.type==="Integer").length, color:"#10B981" },
//     { name:"Float", value:metadata.filter(m=>m.type==="Float").length, color:"#3B82F6" },
//     { name:"String", value:metadata.filter(m=>m.type==="String").length, color:"#F59E0B" },
//     { name:"Date", value:metadata.filter(m=>m.type==="Date").length, color:"#8B5CF6" },
//   ].filter(d=>d.value>0);

//   const missingData = metadata.filter(m=>parseFloat(m.stats?.missingPct)>0)
//     .sort((a,b)=>parseFloat(b.stats?.missingPct)-parseFloat(a.stats?.missingPct)).slice(0,10)
//     .map(m=>({ name:m.column, value:parseFloat(m.stats?.missingPct), fill:parseFloat(m.stats?.missingPct)>20?"#EF4444":"#F59E0B" }));

//   const qualityData = summary ? [
//     { name:"Complete", value:parseFloat((100-parseFloat(summary.missingPercentage||0)).toFixed(1)), fill:"#10B981" },
//     { name:"Missing", value:parseFloat(parseFloat(summary.missingPercentage||0).toFixed(1)), fill:"#EF4444" },
//   ] : [];

//   const relData = [
//     { name:"Primary Key", value:metadata.filter(m=>m.relationship?.includes("Primary")).length },
//     { name:"Target", value:metadata.filter(m=>m.relationship?.includes("Target")).length },
//     { name:"Categorical", value:metadata.filter(m=>m.relationship?.includes("Categorical")).length },
//     { name:"Numerical", value:metadata.filter(m=>m.relationship?.includes("Numerical")||m.relationship?.includes("Feature")).length },
//     { name:"Other", value:metadata.filter(m=>!m.relationship?.match(/Primary|Target|Categorical|Numerical|Feature|Identifier/)).length },
//   ].filter(d=>d.value>0);

//   const numStats = metadata.filter(m=>m.stats?.mean!==undefined).map(m=>({
//     name:m.column.slice(0,12), mean:parseFloat(m.stats.mean), min:parseFloat(m.stats.min), max:parseFloat(m.stats.max)
//   }));

//   const filtered = metadata.filter(m=>m.column.toLowerCase().includes(search.toLowerCase()));

//   const Tip = ({ active, payload, label }) => {
//     if (!active||!payload?.length) return null;
//     return <div style={{ background:dark?"#1a1f35":"#fff", border:`1px solid ${t.borderAccent}`, borderRadius:"10px", padding:"10px 14px", fontSize:"12px", color:t.text }}>
//       <p style={{ fontWeight:700, marginBottom:"4px", color:t.accent2 }}>{label||payload[0]?.name}</p>
//       {payload.map((p,i)=><p key={i} style={{ color:p.fill||p.color||t.accent }}>{p.name}: <strong>{p.value}</strong></p>)}
//     </div>;
//   };

//   const Card = ({ children, style={} }) => (
//     <div className="hover-card" style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:"16px", padding:"20px", backdropFilter:"blur(20px)", ...style }}>{children}</div>
//   );

//   const SectionTitle = ({ icon, label, color=t.accent2 }) => (
//     <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"16px" }}>
//       <span style={{ fontSize:"14px" }}>{icon}</span>
//       <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"11px", color, fontWeight:600, letterSpacing:"0.08em" }}>{label}</span>
//     </div>
//   );

//   const TabItem = ({ id, label, icon }) => (
//     <div className="tab-item" onClick={()=>setTab(id)} style={{
//       display:"flex", alignItems:"center", gap:"10px", padding:"10px 14px",
//       borderRadius:"10px",
//       background: tab===id ? t.tabActive : "transparent",
//       borderLeft: tab===id ? `2px solid ${t.accent}` : "2px solid transparent",
//     }}>
//       <span style={{ fontSize:"15px" }}>{icon}</span>
//       <span style={{ fontSize:"13px", fontWeight:tab===id?600:400, color:tab===id?t.accent2:t.sub }}>{label}</span>
//     </div>
//   );

//   return (
//     <div style={{ minHeight:"100vh", background:t.bg, color:t.text, display:"flex", flexDirection:"column" }}>
//       {/* Navbar */}
//       <div style={{ height:"56px", borderBottom:`1px solid ${t.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 28px", backdropFilter:"blur(20px)", background:dark?"rgba(6,8,15,0.8)":"rgba(248,247,255,0.8)", position:"sticky", top:0, zIndex:100 }}>
//         <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
//           <div style={{ width:"32px", height:"32px", borderRadius:"10px", background:"linear-gradient(135deg,#8B5CF6,#06B6D4)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"16px" }}>🧠</div>
//           <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"17px", fontWeight:700, color:t.text }}>MetaMind<span style={{ color:t.accent }}> AI</span></span>
//           <div style={{ width:"1px", height:"16px", background:t.border, margin:"0 6px" }} />
//           <span style={{ fontSize:"12px", color:t.muted }}>Intelligent Data Dictionary</span>
//         </div>
//         <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
//           {summary && (
//             <div style={{ display:"flex", alignItems:"center", gap:"6px", padding:"4px 12px", background:t.card, border:`1px solid ${t.border}`, borderRadius:"8px" }}>
//               <span style={{ fontSize:"11px" }}>📂</span>
//               <span style={{ fontSize:"12px", color:t.sub, maxWidth:"200px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{summary.datasetName}</span>
//             </div>
//           )}
//           <button onClick={()=>setDark(!dark)} style={{ padding:"6px 14px", border:`1px solid ${t.border}`, borderRadius:"8px", background:t.card, color:t.sub, cursor:"pointer", fontSize:"12px", fontWeight:500 }}>
//             {dark?"☀️ Light":"🌙 Dark"}
//           </button>
//         </div>
//       </div>

//       <div style={{ display:"flex", flex:1, overflow:"hidden" }}>
//         {/* Sidebar */}
//         <div style={{ width:"240px", borderRight:`1px solid ${t.border}`, padding:"20px 12px", display:"flex", flexDirection:"column", gap:"16px", background:dark?"rgba(6,8,15,0.6)":"rgba(255,255,255,0.5)", backdropFilter:"blur(20px)", overflowY:"auto" }}>
//           <div style={{ padding:"4px" }}>
//             <div style={{ fontSize:"10px", fontFamily:"'JetBrains Mono',monospace", color:t.muted, letterSpacing:"0.1em", marginBottom:"10px", paddingLeft:"4px" }}>DATASET</div>
//             <div
//               onDragOver={(e)=>{e.preventDefault();setDragOver(true);}}
//               onDragLeave={()=>setDragOver(false)}
//               onDrop={handleDrop}
//               onClick={()=>fileInputRef.current?.click()}
//               style={{ padding:"18px 12px", border:`2px dashed ${dragOver?t.accent:t.border}`, borderRadius:"12px", textAlign:"center", cursor:"pointer", transition:"all 0.2s", background:dragOver?`${t.accent}10`:"transparent", marginBottom:"10px" }}
//             >
//               <input ref={fileInputRef} type="file" accept=".csv" onChange={e=>setFile(e.target.files[0])} style={{ display:"none" }} />
//               <div style={{ fontSize:"22px", marginBottom:"6px" }}>📄</div>
//               {file ? <div style={{ fontSize:"11px", color:t.accent2, fontWeight:600, wordBreak:"break-all" }}>✓ {file.name}</div>
//                 : <div style={{ fontSize:"11px", color:t.muted }}>Drop CSV or click</div>}
//             </div>
//             {uploadError && <div style={{ fontSize:"11px", color:t.accentRed, padding:"8px 10px", background:`${t.accentRed}12`, border:`1px solid ${t.accentRed}25`, borderRadius:"8px", marginBottom:"10px", lineHeight:"1.5" }}>{uploadError}</div>}
//             <button onClick={()=>handleUpload()} disabled={loading||!file} style={{ width:"100%", padding:"10px", border:"none", borderRadius:"10px", background:loading||!file?"rgba(139,92,246,0.3)":"linear-gradient(135deg,#8B5CF6,#06B6D4)", color:"#fff", cursor:loading||!file?"not-allowed":"pointer", fontWeight:600, fontSize:"13px" }}>
//               {loading ? "⏳ Analyzing..." : "🚀 Analyze"}
//             </button>
//             {summary && (
//               <div style={{ marginTop:"12px", padding:"10px 12px", background:t.card, border:`1px solid ${t.border}`, borderRadius:"10px" }}>
//                 <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"6px" }}>
//                   <span style={{ fontSize:"11px", color:t.muted }}>Quality</span>
//                   <span style={{ fontSize:"11px", fontFamily:"'JetBrains Mono',monospace", color:summary.qualityScore>90?t.accentGreen:summary.qualityScore>70?t.accentAmber:t.accentRed, fontWeight:600 }}>{summary.qualityScore}%</span>
//                 </div>
//                 <div style={{ height:"4px", background:t.border, borderRadius:"4px", overflow:"hidden" }}>
//                   <div style={{ height:"100%", width:`${summary.qualityScore}%`, background:`linear-gradient(90deg,${t.accent},${t.accentBlue})`, borderRadius:"4px", transition:"width 1.2s ease" }} />
//                 </div>
//               </div>
//             )}
//           </div>

//           {summary && (
//             <div>
//               <div style={{ fontSize:"10px", fontFamily:"'JetBrains Mono',monospace", color:t.muted, letterSpacing:"0.1em", marginBottom:"8px", paddingLeft:"4px" }}>NAVIGATION</div>
//               <div style={{ display:"flex", flexDirection:"column", gap:"2px" }}>
//                 <TabItem id="dashboard" icon="🏠" label="Dashboard" />
//                 <TabItem id="visuals" icon="📈" label="Visualizations" />
//                 <TabItem id="dictionary" icon="📖" label="Data Dictionary" />
//                 <TabItem id="chat" icon="💬" label="AI Assistant" />
//               </div>
//             </div>
//           )}

//           {summary && (
//             <div>
//               <div style={{ fontSize:"10px", fontFamily:"'JetBrains Mono',monospace", color:t.muted, letterSpacing:"0.1em", marginBottom:"8px", paddingLeft:"4px" }}>OVERVIEW</div>
//               <div style={{ display:"flex", flexDirection:"column", gap:"1px" }}>
//                 {[["Rows",summary.totalRows,t.accentBlue],["Columns",summary.totalColumns,t.accent2],["Numeric",summary.numericColumns,t.accentGreen],["Text",summary.textColumns,t.accentAmber],["Duplicates",summary.duplicateRows,t.accentRed],["Missing",summary.missingPercentage+"%",t.accentAmber]].map(([l,v,c])=>(
//                   <div key={l} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 10px", borderRadius:"8px" }}>
//                     <span style={{ fontSize:"12px", color:t.sub }}>{l}</span>
//                     <span style={{ fontSize:"12px", fontFamily:"'JetBrains Mono',monospace", color:c, fontWeight:600 }}>{v}</span>
//                   </div>
//                 ))}
//               </div>
//             </div>
//           )}
//         </div>

//         {/* Main Content */}
//         <div style={{ flex:1, overflowY:"auto", padding:"24px 28px" }}>

//           {!summary && (
//             <div className="fade-up" style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", textAlign:"center", padding:"60px 40px" }}>
//               <div style={{ width:"72px", height:"72px", borderRadius:"20px", background:"linear-gradient(135deg,#8B5CF6,#06B6D4)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"32px", marginBottom:"24px", boxShadow:"0 0 40px rgba(139,92,246,0.4)" }}>🧠</div>
//               <h1 style={{ fontSize:"32px", fontWeight:800, color:t.text, marginBottom:"12px" }}>Intelligent Data Dictionary</h1>
//               <p style={{ color:t.sub, fontSize:"15px", maxWidth:"480px", lineHeight:"1.7", marginBottom:"32px" }}>Upload any CSV dataset. AI automatically analyzes fields, data types, relationships, and generates human-readable descriptions with interactive visualizations.</p>
//               <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px", maxWidth:"480px" }}>
//                 {[["🔍","AI Field Analysis","Auto-detect types, relationships, and anomalies"],["📊","Smart Visualizations","Interactive charts generated from your data"],["🎤","Voice AI Assistant","Talk to your data — ask by voice, hear answers!"],["📖","Data Dictionary","Export complete metadata documentation"]].map(([icon,title,desc])=>(
//                   <div key={title} style={{ padding:"16px", background:t.card, border:`1px solid ${t.border}`, borderRadius:"14px", textAlign:"left" }}>
//                     <div style={{ fontSize:"20px", marginBottom:"8px" }}>{icon}</div>
//                     <div style={{ fontSize:"13px", fontWeight:600, color:t.text, marginBottom:"4px" }}>{title}</div>
//                     <div style={{ fontSize:"12px", color:t.muted, lineHeight:"1.5" }}>{desc}</div>
//                   </div>
//                 ))}
//               </div>
//             </div>
//           )}

//           {/* DASHBOARD */}
//           {summary && tab==="dashboard" && (
//             <div className="fade-up" style={{ display:"flex", flexDirection:"column", gap:"20px" }}>
//               <div style={{ background:`linear-gradient(135deg,rgba(139,92,246,0.12),rgba(6,182,212,0.08))`, border:`1px solid ${t.borderAccent}`, borderRadius:"18px", padding:"24px 28px" }}>
//                 <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"16px" }}>
//                   <div style={{ flex:1 }}>
//                     <div style={{ fontSize:"10px", fontFamily:"'JetBrains Mono',monospace", color:t.muted, letterSpacing:"0.1em", marginBottom:"8px" }}>DATASET IDENTIFIED</div>
//                     <h2 style={{ fontSize:"22px", fontWeight:800, color:t.text, marginBottom:"10px" }}>{summary.datasetName}</h2>
//                     <p style={{ color:t.sub, fontSize:"14px", lineHeight:"1.7", maxWidth:"680px" }}>{summary.datasetPurpose}</p>
//                   </div>
//                   <Badge label={summary.datasetType} color={t.accent} size="md" />
//                 </div>
//                 {summary.qualityAssessment && (
//                   <div style={{ marginTop:"16px", padding:"12px 16px", background:dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.03)", borderRadius:"10px", fontSize:"13px", color:t.sub, lineHeight:"1.6", borderLeft:`3px solid ${t.accent}` }}>
//                     {summary.qualityAssessment}
//                   </div>
//                 )}
//               </div>
//               {insights.length>0 && (
//                 <Card>
//                   <SectionTitle icon="🤖" label="AI INSIGHTS" />
//                   <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:"10px" }}>
//                     {insights.map((ins,i)=>(
//                       <div key={i} style={{ padding:"12px 14px", background:dark?"rgba(139,92,246,0.06)":"rgba(139,92,246,0.04)", border:`1px solid ${t.borderAccent}`, borderRadius:"10px", fontSize:"13px", color:t.text, lineHeight:"1.6" }}>
//                         <span style={{ color:t.accent, marginRight:"8px", fontSize:"12px" }}>▸</span>{ins}
//                       </div>
//                     ))}
//                   </div>
//                 </Card>
//               )}
//               <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
//                 {recommendations.length>0 && (
//                   <Card>
//                     <SectionTitle icon="✅" label="RECOMMENDATIONS" color={t.accentGreen} />
//                     {recommendations.map((r,i)=><div key={i} style={{ fontSize:"13px", color:t.text, marginBottom:"10px", lineHeight:"1.6", paddingLeft:"12px", borderLeft:`2px solid ${t.accentGreen}` }}>{r}</div>)}
//                   </Card>
//                 )}
//                 {useCases.length>0 && (
//                   <Card>
//                     <SectionTitle icon="💡" label="USE CASES" color={t.accentAmber} />
//                     {useCases.map((u,i)=><div key={i} style={{ fontSize:"13px", color:t.text, marginBottom:"10px", lineHeight:"1.6", paddingLeft:"12px", borderLeft:`2px solid ${t.accentAmber}` }}>{u}</div>)}
//                   </Card>
//                 )}
//               </div>
//             </div>
//           )}

//           {/* VISUALIZATIONS */}
//           {summary && tab==="visuals" && (
//             <div className="fade-up" style={{ display:"flex", flexDirection:"column", gap:"20px" }}>
//               <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"20px" }}>
//                 <Card>
//                   <SectionTitle icon="📊" label="DATA TYPE DISTRIBUTION" />
//                   <ResponsiveContainer width="100%" height={220}>
//                     <PieChart>
//                       <Pie data={typeDistData} cx="50%" cy="50%" outerRadius={82} dataKey="value" label={({name,value})=>`${name}:${value}`} labelLine={false} fontSize={10}>
//                         {typeDistData.map((e,i)=><Cell key={i} fill={e.color} />)}
//                       </Pie>
//                       <Tooltip content={<Tip />} /><Legend wrapperStyle={{ fontSize:"11px", color:t.sub }} />
//                     </PieChart>
//                   </ResponsiveContainer>
//                 </Card>
//                 <Card>
//                   <SectionTitle icon="🔍" label="DATA COMPLETENESS" />
//                   <ResponsiveContainer width="100%" height={220}>
//                     <PieChart>
//                       <Pie data={qualityData} cx="50%" cy="50%" innerRadius={55} outerRadius={82} dataKey="value" label={({name,value})=>`${name}: ${value}%`}>
//                         {qualityData.map((e,i)=><Cell key={i} fill={e.fill} />)}
//                       </Pie>
//                       <Tooltip content={<Tip />} /><Legend wrapperStyle={{ fontSize:"11px", color:t.sub }} />
//                     </PieChart>
//                   </ResponsiveContainer>
//                 </Card>
//               </div>
//               {missingData.length>0 && (
//                 <Card>
//                   <SectionTitle icon="⚠️" label="MISSING VALUES BY COLUMN" color={t.accentRed} />
//                   <ResponsiveContainer width="100%" height={220}>
//                     <BarChart data={missingData} margin={{ top:5,right:20,left:0,bottom:40 }}>
//                       <CartesianGrid strokeDasharray="3 3" stroke={dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.05)"} />
//                       <XAxis dataKey="name" tick={{ fill:t.sub, fontSize:11 }} angle={-35} textAnchor="end" />
//                       <YAxis tick={{ fill:t.sub, fontSize:11 }} unit="%" />
//                       <Tooltip content={<Tip />} />
//                       <Bar dataKey="value" name="Missing %" radius={[6,6,0,0]}>
//                         {missingData.map((e,i)=><Cell key={i} fill={e.fill} />)}
//                       </Bar>
//                     </BarChart>
//                   </ResponsiveContainer>
//                 </Card>
//               )}
//               {relData.length>0 && (
//                 <Card>
//                   <SectionTitle icon="🔗" label="COLUMN RELATIONSHIPS" color={t.accent2} />
//                   <ResponsiveContainer width="100%" height={200}>
//                     <BarChart data={relData} layout="vertical" margin={{ top:5,right:30,left:90,bottom:5 }}>
//                       <CartesianGrid strokeDasharray="3 3" stroke={dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.05)"} />
//                       <XAxis type="number" tick={{ fill:t.sub, fontSize:11 }} />
//                       <YAxis type="category" dataKey="name" tick={{ fill:t.sub, fontSize:11 }} />
//                       <Tooltip content={<Tip />} />
//                       <Bar dataKey="value" name="Count" radius={[0,6,6,0]}>
//                         {relData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]} />)}
//                       </Bar>
//                     </BarChart>
//                   </ResponsiveContainer>
//                 </Card>
//               )}
//               {numStats.length>0 && (
//                 <Card>
//                   <SectionTitle icon="🔢" label="NUMERIC COLUMN STATISTICS" color={t.accentGreen} />
//                   <ResponsiveContainer width="100%" height={260}>
//                     <BarChart data={numStats} margin={{ top:5,right:20,left:0,bottom:40 }}>
//                       <CartesianGrid strokeDasharray="3 3" stroke={dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.05)"} />
//                       <XAxis dataKey="name" tick={{ fill:t.sub, fontSize:11 }} angle={-35} textAnchor="end" />
//                       <YAxis tick={{ fill:t.sub, fontSize:11 }} />
//                       <Tooltip content={<Tip />} />
//                       <Bar dataKey="min" name="Min" fill="#10B981" radius={[4,4,0,0]} />
//                       <Bar dataKey="mean" name="Mean" fill="#8B5CF6" radius={[4,4,0,0]} />
//                       <Bar dataKey="max" name="Max" fill="#EF4444" radius={[4,4,0,0]} />
//                       <Legend wrapperStyle={{ fontSize:"11px", color:t.sub }} />
//                     </BarChart>
//                   </ResponsiveContainer>
//                 </Card>
//               )}
//             </div>
//           )}

//           {/* DATA DICTIONARY */}
//           {summary && tab==="dictionary" && (
//             <div className="fade-up">
//               <Card style={{ padding:"0", overflow:"hidden" }}>
//                 <div style={{ padding:"18px 22px", borderBottom:`1px solid ${t.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
//                   <div>
//                     <div style={{ fontSize:"15px", fontWeight:700, color:t.text }}>Data Dictionary</div>
//                     <div style={{ fontSize:"12px", color:t.muted, marginTop:"2px" }}>{filtered.length} columns · Click any row for AI analysis</div>
//                   </div>
//                   <div style={{ display:"flex", gap:"10px" }}>
//                     <input placeholder="Search columns..." value={search} onChange={e=>setSearch(e.target.value)}
//                       style={{ padding:"8px 14px", borderRadius:"8px", border:`1px solid ${t.border}`, background:t.input, color:t.text, fontSize:"13px", width:"180px" }} />
//                     <button onClick={downloadCSV} style={{ padding:"8px 16px", border:"none", borderRadius:"8px", background:t.accent, color:"#fff", cursor:"pointer", fontSize:"13px", fontWeight:600 }}>⬇ Export</button>
//                   </div>
//                 </div>
//                 {selectedCol && (
//                   <div style={{ margin:"16px 22px", background:dark?"rgba(139,92,246,0.08)":"rgba(139,92,246,0.05)", border:`1px solid ${t.borderAccent}`, borderRadius:"12px", padding:"14px 16px" }}>
//                     <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"8px" }}>
//                       <span style={{ fontSize:"13px", color:t.accent2, fontWeight:600, fontFamily:"'JetBrains Mono',monospace" }}>🔍 {selectedCol}</span>
//                       <button onClick={()=>{setSelectedCol(null);setColInsight("");}} style={{ background:"none", border:"none", color:t.muted, cursor:"pointer", fontSize:"16px" }}>✕</button>
//                     </div>
//                     {colInsightLoading ? <div style={{ color:t.muted, fontSize:"13px", animation:"pulse 1.5s infinite" }}>Analyzing column...</div>
//                       : <div style={{ fontSize:"13px", color:t.text, lineHeight:"1.7" }}>{colInsight}</div>}
//                   </div>
//                 )}
//                 <div style={{ overflowX:"auto" }}>
//                   <table style={{ width:"100%", borderCollapse:"collapse" }}>
//                     <thead>
//                       <tr style={{ background:dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.03)" }}>
//                         {["Column","Type","Description","Business Meaning","Role","Missing","Unique"].map(h=>(
//                           <th key={h} style={{ padding:"11px 16px", textAlign:"left", borderBottom:`1px solid ${t.border}`, fontFamily:"'JetBrains Mono',monospace", fontSize:"10px", color:t.muted, fontWeight:600, letterSpacing:"0.06em", whiteSpace:"nowrap" }}>{h.toUpperCase()}</th>
//                         ))}
//                       </tr>
//                     </thead>
//                     <tbody>
//                       {filtered.map((m,i)=>(
//                         <tr key={i} className="col-row" onClick={()=>fetchColInsight(m.column)} style={{ borderBottom:`1px solid ${t.border}` }}>
//                           <td style={{ padding:"12px 16px", fontFamily:"'JetBrains Mono',monospace", fontSize:"12px", color:t.text, fontWeight:600 }}>{m.column}</td>
//                           <td style={{ padding:"12px 16px" }}><Badge label={m.type} color={typeColor(m.type)} /></td>
//                           <td style={{ padding:"12px 16px", fontSize:"13px", color:t.sub, maxWidth:"220px", lineHeight:"1.5" }}>{m.description}</td>
//                           <td style={{ padding:"12px 16px", fontSize:"12px", color:t.muted, maxWidth:"180px", lineHeight:"1.5" }}>{m.businessMeaning}</td>
//                           <td style={{ padding:"12px 16px" }}><Badge label={m.relationship} color={relColor(m.relationship)} /></td>
//                           <td style={{ padding:"12px 16px", fontFamily:"'JetBrains Mono',monospace", fontSize:"12px", color:parseFloat(m.stats?.missingPct)>10?t.accentRed:t.accentGreen, fontWeight:600 }}>{m.stats?.missingPct}%</td>
//                           <td style={{ padding:"12px 16px", fontFamily:"'JetBrains Mono',monospace", fontSize:"12px", color:t.muted }}>{m.stats?.unique}</td>
//                         </tr>
//                       ))}
//                     </tbody>
//                   </table>
//                 </div>
//               </Card>
//             </div>
//           )}

//           {/* AI CHAT with VOICE */}
//           {summary && tab==="chat" && (
//             <div className="fade-up" style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 130px)" }}>
//               <Card style={{ flex:1, display:"flex", flexDirection:"column", padding:"0", overflow:"hidden" }}>
//                 {/* Chat header */}
//                 <div style={{ padding:"16px 22px", borderBottom:`1px solid ${t.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
//                   <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
//                     <div style={{ width:"36px", height:"36px", borderRadius:"50%", background:"linear-gradient(135deg,#8B5CF6,#06B6D4)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"16px" }}>🤖</div>
//                     <div>
//                       <div style={{ fontSize:"14px", fontWeight:600, color:t.text }}>AI Assistant</div>
//                       <div style={{ fontSize:"11px", color:t.accentGreen }}>● Active · {summary.datasetName}</div>
//                     </div>
//                   </div>
//                   {/* Voice status indicator */}
//                   {isListening && (
//                     <div style={{ display:"flex", alignItems:"center", gap:"8px", padding:"6px 14px", background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:"20px" }}>
//                       <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:"#EF4444", animation:"pulse 1s infinite" }} />
//                       <span style={{ fontSize:"12px", color:"#EF4444", fontWeight:600 }}>Listening...</span>
//                     </div>
//                   )}
//                   {isSpeaking && (
//                     <div style={{ display:"flex", alignItems:"center", gap:"8px", padding:"6px 14px", background:"rgba(16,185,129,0.1)", border:"1px solid rgba(16,185,129,0.3)", borderRadius:"20px" }}>
//                       <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:"#10B981", animation:"pulse 1s infinite" }} />
//                       <span style={{ fontSize:"12px", color:"#10B981", fontWeight:600 }}>Speaking...</span>
//                     </div>
//                   )}
//                 </div>

//                 {/* Suggestions */}
//                 {messages.length<=1 && (
//                   <div style={{ padding:"14px 22px", borderBottom:`1px solid ${t.border}`, display:"flex", gap:"8px", flexWrap:"wrap" }}>
//                     {["Show survival rate distribution","Compare fare by class","What are the key patterns?","Which columns need cleaning?","Show age distribution"].map(q=>(
//                       <button key={q} className="suggest-btn"
//                         onClick={()=>{ if(textareaRef.current){ textareaRef.current.value=q; inputRef.current=q; textareaRef.current.focus(); } }}
//                         style={{ padding:"6px 12px", border:`1px solid ${t.border}`, borderRadius:"20px", background:"transparent", color:t.muted, fontSize:"12px", cursor:"pointer" }}>{q}</button>
//                     ))}
//                   </div>
//                 )}

//                 {/* Messages */}
//                 <div style={{ flex:1, overflowY:"auto", padding:"20px 22px", display:"flex", flexDirection:"column", gap:"16px" }}>
//                   {messages.map((msg,i)=>(
//                     <div key={i} style={{ display:"flex", justifyContent:msg.role==="user"?"flex-end":"flex-start", animation:i===messages.length-1?"fadeUp 0.3s ease":"none" }}>
//                       {msg.role==="model" && (
//                         <div style={{ width:"28px", height:"28px", borderRadius:"50%", background:"linear-gradient(135deg,#8B5CF6,#06B6D4)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"12px", marginRight:"10px", flexShrink:0, marginTop:"4px" }}>🤖</div>
//                       )}
//                       <div style={{ maxWidth:"80%", padding:"14px 18px", borderRadius:msg.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px", background:msg.role==="user"?t.chatUser:t.chatAI, border:`1px solid ${t.border}`, color:t.text }}>
//                         <SmartMessage
//                           content={msg.content}
//                           chartData={msg.chartData}
//                           dark={dark}
//                           onSpeak={msg.role==="model" ? (text)=>speakText(text,i) : null}
//                           isSpeaking={isSpeaking && speakingMsgIndex===i}
//                         />
//                       </div>
//                     </div>
//                   ))}
//                   {chatLoading && (
//                     <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
//                       <div style={{ width:"28px", height:"28px", borderRadius:"50%", background:"linear-gradient(135deg,#8B5CF6,#06B6D4)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"12px" }}>🤖</div>
//                       <div style={{ display:"flex", gap:"5px", padding:"12px 16px", background:t.chatAI, border:`1px solid ${t.border}`, borderRadius:"16px 16px 16px 4px" }}>
//                         {[0,1,2].map(d=><div key={d} style={{ width:"7px", height:"7px", borderRadius:"50%", background:t.accent, animation:`pulse 1.3s ease ${d*0.2}s infinite` }} />)}
//                       </div>
//                     </div>
//                   )}
//                   <div ref={chatEndRef} />
//                 </div>

//                 {/* Input with Voice */}
//                 <div style={{ padding:"16px 22px", borderTop:`1px solid ${t.border}`, display:"flex", gap:"10px", alignItems:"flex-end" }}>
//                   <textarea
//                     ref={textareaRef}
//                     onChange={e => { inputRef.current = e.target.value; }}
//                     onKeyDown={e => {
//                       if (e.key === "Enter" && !e.shiftKey) {
//                         e.preventDefault();
//                         sendMessage();
//                       }
//                     }}
//                     placeholder={isListening ? "🎤 Listening... speak now!" : "Type or 🎤 speak your question..."}
//                     rows={3}
//                     autoComplete="off"
//                     autoCorrect="off"
//                     spellCheck="false"
//                     style={{
//                       flex:1, padding:"12px 16px", borderRadius:"12px",
//                       border:`1px solid ${isListening ? "#EF4444" : t.border}`,
//                       background: isListening ? "rgba(239,68,68,0.05)" : t.input,
//                       color:t.text, fontSize:"14px", resize:"none",
//                       fontFamily:"'Inter',sans-serif", lineHeight:"1.5",
//                       transition:"all 0.2s"
//                     }}
//                     onFocus={e => e.target.style.borderColor = isListening ? "#EF4444" : t.borderAccent}
//                     onBlur={e => e.target.style.borderColor = isListening ? "#EF4444" : t.border}
//                   />

//                   {/* 🎤 Mic Button */}
//                   <button
//                     onClick={startListening}
//                     title={isListening ? "Click to stop" : "Click to speak"}
//                     className={isListening ? "mic-btn-active" : ""}
//                     style={{
//                       padding:"12px 14px", border:"none", borderRadius:"12px",
//                       background: isListening
//                         ? "linear-gradient(135deg,#EF4444,#F87171)"
//                         : `rgba(139,92,246,0.15)`,
//                       color: isListening ? "#fff" : t.accent2,
//                       cursor:"pointer", fontSize:"18px", flexShrink:0,
//                       transition:"all 0.2s",
//                       border: `1px solid ${isListening ? "#EF4444" : t.borderAccent}`,
//                     }}
//                   >
//                     {isListening ? "⏹" : "🎤"}
//                   </button>

//                   {/* ↑ Send Button */}
//                   <button
//                     className="send-btn"
//                     onClick={sendMessage}
//                     disabled={chatLoading}
//                     style={{
//                       padding:"12px 20px", border:"none", borderRadius:"12px",
//                       background:`linear-gradient(135deg,#8B5CF6,#06B6D4)`,
//                       color:"#fff", cursor:"pointer", fontWeight:700,
//                       fontSize:"16px", opacity:chatLoading?0.4:1, flexShrink:0
//                     }}
//                   >↑</button>
//                 </div>
//               </Card>
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }