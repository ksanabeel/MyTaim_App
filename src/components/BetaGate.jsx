import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getStoredValue, setStoredValue } from "../lib/native";

export default function BetaGate({ children }) {
  const { t } = useTranslation();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [passcode, setPasscode] = useState("");

  useEffect(() => {
    getStoredValue("beta_unlocked").then((val) => {
      setIsUnlocked(val === "true");
      setReady(true);
    });
  }, []);

  if (!ready) return null;
  if (isUnlocked) return children;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        backgroundColor: "#0f172a",
        fontFamily: "system-ui",
        direction: "rtl",
        padding: "20px",
      }}
    >
      <div
        style={{
          backgroundColor: "#1e293b",
          padding: "40px",
          borderRadius: "24px",
          textAlign: "center",
          boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
          maxWidth: "400px",
          width: "100%",
          border: "1px solid #334155",
        }}
      >
        <div style={{ fontSize: "4rem", marginBottom: "15px" }}>🚧</div>
        <h2
          style={{ color: "#f8fafc", margin: "0 0 10px 0", fontSize: "1.8rem" }}
        >
          {t("beta_closed_title", "منصة مغلقة مؤقتاً")}
        </h2>
        <p
          style={{
            color: "#94a3b8",
            marginBottom: "30px",
            fontSize: "0.95rem",
            lineHeight: "1.6",
          }}
        >
          {t(
            "beta_closed_desc",
            "المنصة حالياً في مرحلة الاختبار المغلق (Beta). يرجى إدخال رمز المرور السري المخصص للوصول.",
          )}
        </p>
        <input
          type="password"
          placeholder={t("enter_beta_code", "أدخل الرمز هنا...")}
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          style={{
            width: "100%",
            padding: "15px",
            borderRadius: "14px",
            border: "1px solid #475569",
            backgroundColor: "#0f172a",
            color: "#fff",
            outline: "none",
            textAlign: "center",
            fontSize: "1.2rem",
            letterSpacing: "5px",
            marginBottom: "20px",
            boxSizing: "border-box",
            transition: "0.2s",
          }}
          dir="ltr"
          onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
          onBlur={(e) => (e.target.style.borderColor = "#475569")}
        />
        <button
          onClick={() => {
            if (passcode === import.meta.env.VITE_BETA_PASSCODE) {
              setStoredValue("beta_unlocked", "true");
              setIsUnlocked(true);
            } else {
              alert(t("invalid_beta_code", "الرمز غير صحيح ❌"));
              setPasscode("");
            }
          }}
          style={{
            width: "100%",
            backgroundColor: "#3b82f6",
            color: "#fff",
            border: "none",
            padding: "15px",
            borderRadius: "14px",
            fontWeight: "900",
            fontSize: "1.1rem",
            cursor: "pointer",
            transition: "0.2s",
          }}
          onMouseOver={(e) =>
            (e.currentTarget.style.backgroundColor = "#2563eb")
          }
          onMouseOut={(e) =>
            (e.currentTarget.style.backgroundColor = "#3b82f6")
          }
        >
          {t("enter_platform_btn", "دخول للمنصة 🔓")}
        </button>
      </div>
    </div>
  );
}
