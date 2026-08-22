import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useTranslation } from "react-i18next";

// 🚀 تهيئة Capacitor لضمان الدخول داخل التطبيق (Native/In-App UX)
import { Browser } from "@capacitor/browser";
import { App } from "@capacitor/app";
import { SignInWithApple } from "@capacitor-community/apple-sign-in";

const Login = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";

  // حالات الدخول
  const [authMode, setAuthMode] = useState("email_login"); // 'email_login', 'email_signup', 'phone_login', 'phone_otp'

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");

  const [loading, setLoading] = useState(false);
  const [activeLegalDoc, setActiveLegalDoc] = useState(null); // 'terms', 'privacy', 'refund'

  // ✨ تخزين النصوص القانونية (عربي وإنجليزي) لجلبها من قاعدة البيانات أو استخدام النصوص الافتراضية
  const [legalContentAr, setLegalContentAr] = useState("");
  const [legalContentEn, setLegalContentEn] = useState("");

  // ✨ جلب أحدث السياسات من جدول platform_settings عند فتح نافذة قانونية
  useEffect(() => {
    if (!activeLegalDoc) return;

    const fetchLegalTexts = async () => {
      try {
        const { data, error } = await supabase
          .from("platform_settings")
          .select("*")
          .eq("id", 1)
          .maybeSingle();

        if (!error && data) {
          if (activeLegalDoc === "terms") {
            setLegalContentAr(
              data.terms_text_ar ||
                data.terms_text ||
                "شروط الاستخدام غير متوفرة حالياً.",
            );
            setLegalContentEn(
              data.terms_text_en || "Terms of use are currently unavailable.",
            );
          } else if (activeLegalDoc === "privacy") {
            setLegalContentAr(
              data.privacy_text_ar ||
                data.privacy_text ||
                "سياسة الخصوصية غير متوفرة حالياً.",
            );
            setLegalContentEn(
              data.privacy_text_en ||
                "Privacy policy is currently unavailable.",
            );
          } else if (activeLegalDoc === "refund") {
            setLegalContentAr(
              data.refund_text_ar ||
                data.refund_text ||
                "سياسة الاسترجاع غير متوفرة حالياً.",
            );
            setLegalContentEn(
              data.refund_text_en || "Refund policy is currently unavailable.",
            );
          }
        }
      } catch (err) {
        console.error("Error fetching legal docs:", err);
      }
    };

    fetchLegalTexts();
  }, [activeLegalDoc]);

  // ✨ إعداد دائم داخل التطبيق لاستلام الرابط العميق (Deep Link Callback)
  useEffect(() => {
    const handleUrlOpener = (event) => {
      if (event.url.includes("com.bookonmap.app://auth-callback")) {
        const url = new URL(event.url);
        if (url.hash && url.hash.includes("#access_token")) {
          console.log("Deep link received, session should create...");
        }
      }
    };

    App.addListener("appUrlOpen", handleUrlOpener);

    return () => {
      App.removeAllListeners("appUrlOpen");
    };
  }, []);

  // تبديل اللغة
  const toggleLanguage = () => {
    const newLang = i18n.language === "ar" ? "en" : "ar";
    i18n.changeLanguage(newLang);
    document.documentElement.dir = newLang === "ar" ? "rtl" : "ltr";
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: "com.bookonmap.app://auth-callback",
        },
      });
      if (error) throw error;
    } catch (error) {
      alert("خطأ في الاتصال بجوجل: " + error.message);
    }
  };

  const handleAppleLogin = async () => {
    try {
      const { response } = await SignInWithApple.authorize({
        clientId: "com.bookonmap.app.service",
        scopes: "email name",
      });

      const idToken = response.identityToken;
      if (!idToken) {
        throw new Error("لم يتم إرجاع رمز تحقق من أبل");
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: idToken,
      });

      if (error) throw error;
      console.log("تم تسجيل الدخول بنجاح!", data);
    } catch (error) {
      console.error("حدث خطأ أثناء تسجيل الدخول بـ Apple:", error);
      alert("حدث خطأ أثناء تسجيل الدخول بحساب أبل.");
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (authMode === "email_login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else if (authMode === "email_signup") {
        if (!fullName.trim()) return alert("الرجاء إدخال الاسم الكامل");
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        alert("✅ تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول.");
        setAuthMode("email_login");
        setPassword("");
      }
    } catch (error) {
      alert("حدث خطأ: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      alert("الرجاء إدخال بريدك الإلكتروني في الحقل المخصص أولاً.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      alert(
        "تم إرسال رابط استعادة كلمة المرور إلى إيميلك! (شيك صندوق الوارد أو البريد المزعج Spam).",
      );
    } catch (err) {
      alert("حدث خطأ: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderFormContent = () => {
    return (
      <form onSubmit={handleEmailAuth} style={styles.form}>
        {authMode === "email_signup" && (
          <input
            type="text"
            placeholder="الاسم الكامل"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={{
              ...styles.input,
              textAlign: isRTL ? "right" : "left",
            }}
            required
          />
        )}
        <input
          type="email"
          placeholder="البريد الإلكتروني"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={styles.input}
          required
          dir="ltr"
        />
        <input
          type="password"
          placeholder="كلمة المرور (6 أحرف على الأقل)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={styles.input}
          required
          dir="ltr"
          minLength="6"
        />

        {authMode === "email_login" && (
          <button
            type="button"
            onClick={handleResetPassword}
            style={{
              background: "transparent",
              color: "#3b82f6",
              border: "none",
              fontSize: "0.85rem",
              fontWeight: "bold",
              cursor: "pointer",
              textAlign: isRTL ? "right" : "left",
              textDecoration: "underline",
              marginTop: "-5px",
              marginBottom: "5px",
            }}
          >
            نسيت كلمة المرور؟
          </button>
        )}

        <button type="submit" disabled={loading} style={styles.submitBtn}>
          {loading
            ? "جاري التحقق..."
            : authMode === "email_login"
            ? "تسجيل الدخول"
            : "إنشاء حساب"}
        </button>

        <p style={styles.footerText}>
          {authMode === "email_login"
            ? "ليس لديك حساب؟ "
            : "لديك حساب بالفعل؟ "}
          <span
            onClick={() =>
              setAuthMode(
                authMode === "email_login" ? "email_signup" : "email_login",
              )
            }
            style={styles.link}
          >
            {authMode === "email_login" ? "إنشاء حساب جديد" : "تسجيل الدخول"}
          </span>
        </p>
      </form>
    );
  };

  return (
    <div style={styles.container}>
      <button onClick={toggleLanguage} style={styles.langToggle}>
        🌐 {isRTL ? "English" : "العربية"}
      </button>

      <div style={styles.box}>
        <div style={styles.header}>
          <span style={styles.logoIcon}>📍</span>
          <h2 style={styles.title}>BookOnMap</h2>
        </div>

        <p style={styles.subtitle}>سجل دخولك لبدء استخدام المنصة</p>

        <div style={styles.socialBtnsContainer}>
          <button onClick={handleGoogleLogin} style={styles.socialBtn}>
            <img
              src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/google/google-original.svg"
              alt="Google"
              style={styles.socialIcon}
            />
            جوجل
          </button>

          <button
            onClick={handleAppleLogin}
            style={{
              ...styles.socialBtn,
              backgroundColor: "#000",
              color: "#fff",
              border: "none",
            }}
          >
            <span
              style={{
                fontSize: "1.2rem",
                marginLeft: "5px",
                marginRight: "5px",
              }}
            >
              
            </span>
            أبل
          </button>
        </div>

        <div style={styles.divider}>
          <span style={styles.dividerLine}></span>
          <span style={styles.dividerText}>أو</span>
          <span style={styles.dividerLine}></span>
        </div>

        {renderFormContent()}

        <div style={styles.legalLinks}>
          <span
            onClick={() => setActiveLegalDoc("terms")}
            style={styles.legalLink}
          >
            شروط الاستخدام
          </span>{" "}
          •
          <span
            onClick={() => setActiveLegalDoc("privacy")}
            style={styles.legalLink}
          >
            سياسة الخصوصية
          </span>{" "}
          •
          <span
            onClick={() => setActiveLegalDoc("refund")}
            style={styles.legalLink}
          >
            سياسة الاسترجاع
          </span>
        </div>
      </div>

      {/* نافذة عرض السياسات والشروط بنظام الجدول ذي العمودين (عربي يميناً، إنجليزي يساراً) */}
      {activeLegalDoc && (
        <div style={styles.modalOverlay}>
          <div
            style={{
              ...styles.modalContent,
              maxWidth: "950px",
              direction: isRTL ? "rtl" : "ltr",
            }}
          >
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0, color: "#1e293b", fontWeight: "900" }}>
                {activeLegalDoc === "terms" &&
                  "شروط وأحكام الاستخدام / Terms of Use"}
                {activeLegalDoc === "privacy" &&
                  "سياسة الخصوصية / Privacy Policy"}
                {activeLegalDoc === "refund" &&
                  "سياسة الاسترجاع / Refund Policy"}
              </h3>
              <button
                onClick={() => setActiveLegalDoc(null)}
                style={styles.closeBtn}
              >
                ✕
              </button>
            </div>

            <div style={styles.modalBody}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr
                    style={{
                      backgroundColor: "#f8fafc",
                      borderBottom: "2px solid #cbd5e1",
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                    }}
                  >
                    <th
                      style={{
                        padding: "14px 16px",
                        width: "50%",
                        color: "#1e293b",
                        textAlign: "right",
                        fontSize: "0.95rem",
                        fontWeight: "900",
                      }}
                    >
                      العربية (Arabic)
                    </th>
                    <th
                      style={{
                        padding: "14px 16px",
                        width: "50%",
                        color: "#1e293b",
                        textAlign: "left",
                        direction: "ltr",
                        fontSize: "0.95rem",
                        fontWeight: "900",
                        borderRight: "1px solid #e2e8f0",
                      }}
                    >
                      English (الإنجليزية)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const arLines = (legalContentAr || "")
                      .split("\n")
                      .filter((l) => l.trim() !== "");
                    const enLines = (legalContentEn || "")
                      .split("\n")
                      .filter((l) => l.trim() !== "");
                    const maxRows = Math.max(arLines.length, enLines.length, 1);

                    return Array.from({ length: maxRows }).map((_, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: "1px solid #f1f5f9",
                          backgroundColor: idx % 2 === 0 ? "#fff" : "#f8fafc",
                        }}
                      >
                        <td
                          style={{
                            padding: "14px 16px",
                            verticalAlign: "top",
                            color: "#334155",
                            lineHeight: "1.7",
                            fontSize: "0.9rem",
                            textAlign: "right",
                          }}
                        >
                          {arLines[idx] || ""}
                        </td>
                        <td
                          style={{
                            padding: "14px 16px",
                            verticalAlign: "top",
                            color: "#334155",
                            lineHeight: "1.7",
                            fontSize: "0.9rem",
                            direction: "ltr",
                            textAlign: "left",
                            borderRight: "1px solid #f1f5f9",
                          }}
                        >
                          {enLines[idx] || ""}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: "20px", textAlign: "center" }}>
              <button
                onClick={() => setActiveLegalDoc(null)}
                style={{
                  backgroundColor: "#1e293b",
                  color: "#fff",
                  border: "none",
                  padding: "12px 30px",
                  borderRadius: "12px",
                  fontWeight: "900",
                  cursor: "pointer",
                  fontSize: "1rem",
                  width: "100%",
                }}
              >
                إغلاق النافذة / Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    backgroundColor: "#f8fafc",
    fontFamily: "system-ui, sans-serif",
    position: "relative",
  },
  langToggle: {
    position: "absolute",
    top: "20px",
    right: "20px",
    background: "#fff",
    border: "1px solid #e2e8f0",
    padding: "8px 15px",
    borderRadius: "20px",
    cursor: "pointer",
    fontWeight: "bold",
    color: "#475569",
    boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
  },
  box: {
    backgroundColor: "#fff",
    padding: "40px",
    borderRadius: "24px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.04)",
    width: "90%",
    maxWidth: "400px",
    textAlign: "center",
    border: "1px solid #e2e8f0",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    marginBottom: "10px",
  },
  logoIcon: { fontSize: "2rem" },
  title: { color: "#7c3aed", fontSize: "24px", fontWeight: "900", margin: 0 },
  subtitle: { color: "#64748b", fontSize: "14px", marginBottom: "20px" },

  socialBtnsContainer: {
    display: "flex",
    gap: "10px",
    marginBottom: "10px",
  },
  socialBtn: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    backgroundColor: "#fff",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "bold",
    color: "#1e293b",
    transition: "all 0.2s",
  },
  socialIcon: { width: "20px", marginLeft: "8px", marginRight: "8px" },

  divider: { display: "flex", alignItems: "center", margin: "15px 0" },
  dividerLine: { flex: 1, height: "1px", backgroundColor: "#e2e8f0" },
  dividerText: {
    margin: "0 15px",
    color: "#94a3b8",
    fontSize: "12px",
    fontWeight: "bold",
  },
  form: { display: "flex", flexDirection: "column", gap: "12px" },
  input: {
    padding: "14px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    outline: "none",
    textAlign: "right",
    fontSize: "15px",
    backgroundColor: "#f8fafc",
  },
  submitBtn: {
    padding: "14px",
    borderRadius: "12px",
    border: "none",
    backgroundColor: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
    backgroundColor: "#1e293b",
    color: "#fff",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: "bold",
    marginTop: "5px",
  },
  footerText: {
    marginTop: "15px",
    fontSize: "14px",
    color: "#64748b",
    marginBottom: 0,
  },
  link: {
    color: "#7c3aed",
    cursor: "pointer",
    fontWeight: "bold",
    textDecoration: "underline",
  },
  legalLinks: {
    display: "flex",
    justifyContent: "center",
    gap: "10px",
    marginTop: "25px",
    paddingTop: "15px",
    borderTop: "1px dashed #e2e8f0",
    fontSize: "12px",
    color: "#94a3b8",
  },
  legalLink: { cursor: "pointer", transition: "color 0.2s" },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    backdropFilter: "blur(6px)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 99999,
    padding: "20px",
  },
  modalContent: {
    backgroundColor: "#fff",
    padding: "30px",
    borderRadius: "24px",
    width: "100%",
    maxHeight: "85vh",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 25px 50px rgba(0,0,0,0.15)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "2px solid #f1f5f9",
    paddingBottom: "15px",
    marginBottom: "20px",
  },
  closeBtn: {
    background: "#f1f5f9",
    border: "none",
    width: "35px",
    height: "35px",
    borderRadius: "50%",
    fontSize: "1.2rem",
    cursor: "pointer",
    color: "#64748b",
    fontWeight: "bold",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: {
    overflowY: "auto",
    flex: 1,
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    backgroundColor: "#fff",
  },
};

export default Login;
