export const padS = { padding: "16px" };

export const thS = {
  padding: "15px",
  color: "#475569",
  backgroundColor: "#f8fafc",
  borderBottom: "2px solid #e2e8f0",
  fontWeight: "900",
  fontSize: "0.85rem",
};

export const tdS = {
  padding: "15px",
  borderBottom: "1px solid #f1f5f9",
  fontSize: "0.9rem",
  color: "#334155",
};

export const admBtn = (bg) => ({
  backgroundColor: bg,
  color: "white",
  border: "none",
  padding: "10px 16px",
  borderRadius: "12px",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "0.85rem",
  transition: "all 0.2s ease",
  boxShadow: `0 4px 10px ${bg}40`,
});

export const reportCard = (color, isActive) => ({
  backgroundColor: "#fff",
  padding: "20px",
  borderRadius: "20px",
  borderBottom: `4px solid ${color}`,
  textAlign: "center",
  boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
  transition: "all 0.3s ease",
});

export const addSkillBtn = {
  background: "linear-gradient(135deg, #0f766e 0%, #0f4c81 100%)",
  color: "white",
  border: "none",
  padding: "12px 25px",
  borderRadius: "14px",
  cursor: "pointer",
  fontWeight: "900",
  fontSize: "1rem",
  boxShadow: "0 6px 15px rgba(15, 118, 110, 0.25)",
};

export const cardS = {
  backgroundColor: "#fff",
  padding: "25px",
  borderRadius: "24px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 10px 30px rgba(0,0,0,0.03)",
};

export const modalOverlay = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(15, 23, 42, 0.6)",
  backdropFilter: "blur(8px)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 4000,
  padding: "20px",
};

export const modalContent = {
  backgroundColor: "#fff",
  padding: "30px",
  borderRadius: "24px",
  width: "100%",
  maxWidth: "600px",
  maxHeight: "85vh",
  display: "flex",
  flexDirection: "column",
  boxShadow: "0 25px 50px rgba(0,0,0,0.15)",
  overflowY: "auto",
};

export const smInput = {
  padding: "12px 15px",
  borderRadius: "12px",
  border: "1px solid #cbd5e1",
  flex: "1 1 100px",
  outline: "none",
  fontFamily: "inherit",
  fontSize: "0.9rem",
  transition: "border-color 0.2s",
};
