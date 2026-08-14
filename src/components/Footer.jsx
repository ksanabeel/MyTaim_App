import { useTranslation } from "react-i18next";

export default function Footer({
  platformName,
  licenseNumber,
  licenseName,
  licenseLink,
  onShowLegalDoc,
  onContactAdmin,
}) {
  const { t } = useTranslation();

  return (
    <div
      style={{
        textAlign: "center",
        padding: "30px 0",
        marginTop: "50px",
        borderTop: "2px solid #e2e8f0",
        color: "#64748b",
        fontSize: "0.9rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "15px",
      }}
    >
      {licenseNumber && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "#f8fafc",
            border: "1px solid #cbd5e1",
            padding: "10px 25px",
            borderRadius: "16px",
            boxShadow: "0 4px 10px rgba(0,0,0,0.03)",
          }}
        >
          <span style={{ fontSize: "1.3rem" }}>✅</span>
          <span style={{ fontWeight: "bold", color: "#334155" }}>
            {licenseName ||
              t("verified_by_authorities", "موثق من الجهات الرسمية")}
            :
          </span>
          <a
            href={licenseLink || "#"}
            target="_blank"
            rel="noreferrer"
            style={{
              color: "#10b981",
              textDecoration: "none",
              fontWeight: "900",
              fontSize: "1.2rem",
              direction: "ltr",
              display: "inline-block",
            }}
          >
            {licenseNumber}
          </a>
        </div>
      )}
      <p style={{ margin: 0, fontWeight: "bold", fontSize: "1rem" }}>
        © {new Date().getFullYear()} {platformName}{" "}
        {t("all_rights_reserved", " (جميع الحقوق محفوظة )")}
        <br />
        email:bookonmap@hotmail.com ترخيص FL-822660150
      </p>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "20px",
          flexWrap: "wrap",
          backgroundColor: "#f8fafc",
          padding: "12px 25px",
          borderRadius: "20px",
          border: "1px solid #f1f5f9",
        }}
      >
        <span
          onClick={() => onShowLegalDoc("terms")}
          style={{
            cursor: "pointer",
            color: "#4f46e5",
            fontWeight: "bold",
            transition: "0.2s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.color = "#312e81")}
          onMouseOut={(e) => (e.currentTarget.style.color = "#4f46e5")}
        >
          {t("terms_of_use", "شروط الاستخدام")}
        </span>{" "}
        <span style={{ color: "#cbd5e1" }}>|</span>
        <span
          onClick={() => onShowLegalDoc("privacy")}
          style={{
            cursor: "pointer",
            color: "#4f46e5",
            fontWeight: "bold",
            transition: "0.2s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.color = "#312e81")}
          onMouseOut={(e) => (e.currentTarget.style.color = "#4f46e5")}
        >
          {t("privacy_policy", "سياسة الخصوصية")}
        </span>{" "}
        <span style={{ color: "#cbd5e1" }}>|</span>
        <span
          onClick={() => onShowLegalDoc("refund")}
          style={{
            cursor: "pointer",
            color: "#4f46e5",
            fontWeight: "bold",
            transition: "0.2s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.color = "#312e81")}
          onMouseOut={(e) => (e.currentTarget.style.color = "#4f46e5")}
        >
          {t("refund_policies", "سياسات الدفع والاسترجاع")}
        </span>{" "}
        <span style={{ color: "#cbd5e1" }}>|</span>
        <span
          onClick={onContactAdmin}
          style={{
            cursor: "pointer",
            color: "#d97706",
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            transition: "0.2s",
          }}
          onMouseOver={(e) =>
            (e.currentTarget.style.transform = "scale(1.05)")
          }
          onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          <span>✉️</span> {t("contact_admin_footer", "تواصل مع الإدارة")}
        </span>
      </div>
    </div>
  );
}
