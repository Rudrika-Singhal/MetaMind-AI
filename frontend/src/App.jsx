import { useState } from "react";

function App() {
  const [darkMode, setDarkMode] = useState(true);

  const bg = darkMode
    ? "linear-gradient(135deg, #050816, #0B1437, #111C44)"
    : "linear-gradient(135deg, #EEF2FF, #DCE7FF, #C7D7FF)";

  const text = darkMode ? "white" : "#111827";

  const cardBg = darkMode
    ? "rgba(255,255,255,0.06)"
    : "rgba(255,255,255,0.7)";

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: bg,
        color: text,
        padding: "40px",
        transition: "0.3s",
      }}
    >
      {/* Navbar */}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "50px",
        }}
      >
        <h1
          style={{
            fontSize: "42px",
            fontWeight: "700",
            color: darkMode ? "#7DA0FF" : "#304FFE",
          }}
        >
          MetaMind AI
        </h1>

        <button
          onClick={() => setDarkMode(!darkMode)}
          style={{
            padding: "10px 18px",
            borderRadius: "10px",
            border: "none",
            background: darkMode ? "#5B7FFF" : "#304FFE",
            color: "white",
            cursor: "pointer",
            fontWeight: "600",
          }}
        >
          {darkMode ? "Light Mode" : "Dark Mode"}
        </button>
      </div>

      {/* Hero Section */}

      <div
        style={{
          marginBottom: "50px",
        }}
      >
        <h2
          style={{
            fontSize: "54px",
            lineHeight: "1.2",
            maxWidth: "800px",
            marginBottom: "20px",
          }}
        >
          AI-Powered Metadata Intelligence Platform
        </h2>

        <p
          style={{
            fontSize: "20px",
            maxWidth: "700px",
            opacity: "0.8",
          }}
        >
          Automatically analyze datasets, detect relationships, and generate
          human-readable metadata insights using Artificial Intelligence.
        </p>
      </div>

      {/* Main Grid */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 2fr",
          gap: "30px",
        }}
      >
        {/* Upload Card */}

        <div
          style={{
            background: cardBg,
            padding: "30px",
            borderRadius: "20px",
            backdropFilter: "blur(12px)",
            boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
          }}
        >
          <h2
            style={{
              marginBottom: "25px",
              fontSize: "28px",
            }}
          >
            Upload Dataset
          </h2>

          <input
            type="file"
            style={{
              marginBottom: "25px",
              width: "100%",
            }}
          />

          <button
            style={{
              width: "100%",
              padding: "14px",
              background: "#5B7FFF",
              border: "none",
              borderRadius: "12px",
              color: "white",
              fontSize: "16px",
              cursor: "pointer",
              fontWeight: "600",
            }}
          >
            Analyze Dataset
          </button>
        </div>

        {/* Metadata Card */}

        <div
          style={{
            background: cardBg,
            padding: "30px",
            borderRadius: "20px",
            backdropFilter: "blur(12px)",
            boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
          }}
        >
          <h2
            style={{
              marginBottom: "25px",
              fontSize: "28px",
            }}
          >
            Metadata Insights
          </h2>

          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr>
                <th style={thStyle}>Column</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Description</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td style={tdStyle}>emp_id</td>
                <td style={tdStyle}>Integer</td>
                <td style={tdStyle}>Unique employee identifier</td>
              </tr>

              <tr>
                <td style={tdStyle}>salary</td>
                <td style={tdStyle}>Float</td>
                <td style={tdStyle}>Employee annual salary</td>
              </tr>

              <tr>
                <td style={tdStyle}>department</td>
                <td style={tdStyle}>String</td>
                <td style={tdStyle}>Employee department name</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const thStyle = {
  padding: "14px",
  textAlign: "left",
  borderBottom: "1px solid rgba(255,255,255,0.2)",
  color: "#7DA0FF",
};

const tdStyle = {
  padding: "16px 14px",
};

export default App;