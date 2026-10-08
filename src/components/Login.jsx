import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useTranslation } from "react-i18next";

const Login = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";

  const [authMode, setAuthMode] = useState("email_login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [identifier, setIdentifier] = useState("");

  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState("idle");
  const usernameCheckTimeoutRef = useRef(null);
  const [referralSource, setReferralSource] = useState("");
  const [referrerCode, setReferrerCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [formNotice, setFormNotice] = useState("");
  const [formNoticeType, setFormNoticeType] = useState("");
  const [resetNotice, setResetNotice] = useState("");
  const [resetNoticeType, setResetNoticeType] = useState("");
  const [resetSending, setResetSending] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendMessage, setResendMessage] = useState("");
  const [resendMessageType, setResendMessageType] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [activeLegalDoc, setActiveLegalDoc] = useState(null);

  const [legalContentAr, setLegalContentAr] = useState("");
  const [legalContentEn, setLegalContentEn] = useState("");

  useEffect(() => {
    return () => {
      if (usernameCheckTimeoutRef.current) {
        clearTimeout(usernameCheckTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (authMode !== "email_signup") return;

    const cleanUsername = username.trim().toLowerCase();
    if (usernameCheckTimeoutRef.current) {
      clearTimeout(usernameCheckTimeoutRef.current);
    }

    if (!cleanUsername) {
      setUsernameStatus("idle");
      return;
    }

    if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
      setUsernameStatus("invalid");
      return;
    }

    if (cleanUsername.length < 4) {
      setUsernameStatus("too_short");
      return;
    }

    setUsernameStatus("checking");
    usernameCheckTimeoutRef.current = setTimeout(async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", cleanUsername)
        .maybeSingle();

      if (error) {
        setUsernameStatus("error");
        return;
      }

      setUsernameStatus(data ? "taken" : "available");
    }, 400);
  }, [authMode, username]);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;

    const timer = setInterval(() => {
      setResendCooldown((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [resendCooldown]);

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

  const toggleLanguage = () => {
    const newLang = i18n.language === "ar" ? "en" : "ar";
    i18n.changeLanguage(newLang);
    document.documentElement.dir = newLang === "ar" ? "rtl" : "ltr";
  };

  const resolveLoginEmail = async (loginValue) => {
    if (loginValue.includes("@")) return loginValue;
    const { data, error } = await supabase.rpc("get_email_by_phone", {
      p_phone: loginValue.trim(),
    });
    if (error || !data) {
      throw new Error("لم يتم العثور على حساب بهذا الرقم");
    }
    return data;
  };

  const handleResendConfirmation = async () => {
    if (!resendEmail || resendCooldown > 0 || resendLoading) return;

    setResendLoading(true);
    setResendMessage("");
    setResendMessageType("");
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: resendEmail,
      });

      if (error) throw error;

      setResendMessage(
        isRTL
          ? "تم إرسال رابط التفعيل إلى بريدك الإلكتروني بنجاح، يرجى مراجعة صندوق الوارد والبريد غير الهام (Spam)."
          : "The confirmation link was sent successfully. Please check your inbox and spam folder.",
      );
      setResendMessageType("success");
      setResendCooldown(60);
    } catch (error) {
      setResendMessage(
        isRTL
          ? "تعذر إرسال رابط التفعيل حالياً. يرجى المحاولة لاحقاً."
          : "We could not resend the confirmation link right now. Please try again later.",
      );
      setResendMessageType("error");
      console.error("Failed to resend confirmation email:", error);
    } finally {
      setResendLoading(false);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    setFormNotice("");
    setFormNoticeType("");
    setResendMessage("");
    setResendMessageType("");
    setLoading(true);
    try {
      if (authMode === "email_login") {
        const loginEmail = await resolveLoginEmail(identifier);
        const { error } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password,
        });
        if (error) {
          const errorText = `${error.code || ""} ${error.message || ""}`.toLowerCase();
          const isEmailNotConfirmed =
            errorText.includes("email_not_confirmed") ||
            errorText.includes("email not confirmed");

          if (isEmailNotConfirmed) {
            setResendEmail(loginEmail);
            setAuthError(
              isRTL
                ? "البريد الإلكتروني غير مؤكد. يمكنك إعادة إرسال رابط التفعيل."
                : "Your email address is not confirmed. You can resend the confirmation link.",
            );
          } else {
            setAuthError(error.message);
          }
          return;
        }
      } else if (authMode === "email_signup") {
        if (!fullName.trim()) {
          setFormNotice("الرجاء إدخال الاسم الكامل");
          setFormNoticeType("error");
          setLoading(false);
          return;
        }
        if (usernameStatus !== "available") {
          setLoading(false);
          return;
        }
        if (!phone.trim()) {
          setFormNotice("الرجاء إدخال رقم الجوال");
          setFormNoticeType("error");
          setLoading(false);
          return;
        }

        const cleanUsername = username.trim().replace(/^@/, "");

        let referrerId = null;
        if (referrerCode.trim()) {
          const cleanRefCode = referrerCode.trim().replace(/^@/, "");
          const { data: referrer } = await supabase
            .from("profiles")
            .select("id")
            .eq("username", cleanRefCode)
            .maybeSingle();

          if (referrer) {
            referrerId = referrer.id;
          }
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              username: cleanUsername,
              phone: phone.trim(),
              referral_source: referralSource || null,
              referred_by: referrerId || null,
            },
          },
        });

        if (error) throw error;
        setFormNotice(
          isRTL
            ? "✅ تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول."
            : "✅ Account created successfully! You can now log in.",
        );
        setFormNoticeType("success");
        setAuthMode("email_login");
        setPassword("");
        setUsername("");
        setUsernameStatus("idle");
        setPhone("");
        setReferralSource("");
        setReferrerCode("");
      }
    } catch (error) {
      setFormNotice(
        isRTL
          ? "حدث خطأ: " + error.message
          : "An error occurred: " + error.message,
      );
      setFormNoticeType("error");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setResetNotice("");
    setResetNoticeType("");

    let resetEmail = "";
    if (identifier && identifier.includes("@")) {
      resetEmail = identifier;
    } else if (identifier) {
      setResetSending(true);
      try {
        resetEmail = await resolveLoginEmail(identifier);
      } catch (_err) {
        setResetNotice(
          isRTL
            ? "تعذّر العثور على البريد المرتبط بهذا الحساب. يرجى إدخال البريد الإلكتروني مباشرة."
            : "Could not find the email associated with this account. Please enter your email directly.",
        );
        setResetNoticeType("error");
        setResetSending(false);
        return;
      } finally {
        setResetSending(false);
      }
    }
    if (!resetEmail) {
      setResetNotice(
        isRTL
          ? "الرجاء إدخال بريدك الإلكتروني أو رقم الجوال في الحقل المخصص أولاً."
          : "Please enter your email or phone number in the field above first.",
      );
      setResetNoticeType("error");
      return;
    }
    setResetSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setResetNotice(
        isRTL
          ? "تم إرسال رابط استعادة كلمة المرور إلى إيميلك! يرجى مراجعة صندوق الوارد والبريد غير الهام (Spam)."
          : "A password recovery link has been sent to your email! Please check your inbox and spam folder.",
      );
      setResetNoticeType("success");
    } catch (err) {
      const errStatus = err.status || err.statusCode || 0;
      const errText = `${errStatus} ${err.message || ""}`.toLowerCase();
      const isServerError =
        errStatus === 500 ||
        errText.includes("500") ||
        errText.includes("smtp") ||
        errText.includes("recovery email");

      setResetNotice(
        isServerError
          ? isRTL
            ? "تعذر إرسال البريد حالياً، يرجى التحقق من إعدادات البريد أو المحاولة لاحقاً."
            : "We could not send the email right now. Please check your email settings or try again later."
          : isRTL
          ? "حدث خطأ: " + err.message
          : "An error occurred: " + err.message,
      );
      setResetNoticeType("error");
    } finally {
      setResetSending(false);
    }
  };

  const renderFormContent = () => {
    return (
      <form onSubmit={handleEmailAuth} style={styles.form}>
        {formNotice && (
          <div
            style={{
              padding: "12px",
              borderRadius: "10px",
              border:
                formNoticeType === "success"
                  ? "1px solid #bbf7d0"
                  : "1px solid #fecaca",
              backgroundColor:
                formNoticeType === "success" ? "#f0fdf4" : "#fef2f2",
              color: formNoticeType === "success" ? "#166534" : "#b91c1c",
              fontSize: "13px",
              lineHeight: "1.6",
              textAlign: isRTL ? "right" : "left",
            }}
          >
            {formNotice}
          </div>
        )}

        {authMode === "email_signup" && (
          <>
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

            <div style={{ position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  [isRTL ? "right" : "left"]: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#94a3b8",
                  fontSize: "15px",
                  fontWeight: "bold",
                  pointerEvents: "none",
                }}
              >
                @
              </span>
              <input
                type="text"
                placeholder="اسم المستخدم"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{
                  ...styles.input,
                  textAlign: isRTL ? "right" : "left",
                  [isRTL ? "paddingRight" : "paddingLeft"]: "32px",
                  border:
                    usernameStatus === "taken" ||
                    usernameStatus === "invalid" ||
                    usernameStatus === "too_short" ||
                    usernameStatus === "error"
                      ? "1px solid #fca5a5"
                      : usernameStatus === "available"
                      ? "1px solid #86efac"
                      : styles.input.border,
                }}
                dir="ltr"
                required
              />
              {usernameStatus !== "idle" && (
                <p
                  style={{
                    margin: "6px 0 0",
                    fontSize: "12px",
                    fontWeight: "bold",
                    textAlign: isRTL ? "right" : "left",
                    color:
                      usernameStatus === "available"
                        ? "#16a34a"
                        : usernameStatus === "checking"
                        ? "#64748b"
                        : "#dc2626",
                  }}
                >
                  {usernameStatus === "checking" && "⏳ جاري التحقق..."}
                  {usernameStatus === "available" && "✅ متاح"}
                  {usernameStatus === "taken" && "❌ مستخدم مسبقاً"}
                  {usernameStatus === "invalid" &&
                    "❌ استخدم أحرفاً إنجليزية وأرقاماً وشرطة سفلية فقط بدون مسافات"}
                  {usernameStatus === "too_short" && "❌ يجب أن يتكون من 4 خانات على الأقل"}
                  {usernameStatus === "error" && "❌ تعذر التحقق حالياً، حاول مرة أخرى"}
                </p>
              )}
            </div>
            <p
              style={{
                margin: "-6px 0 0 0",
                fontSize: "11px",
                color: "#94a3b8",
                textAlign: isRTL ? "right" : "left",
                lineHeight: "1.4",
              }}
            >
              * سيتم استخدامه كرابط مباشر لملفك الشخصي وللتسويق.
            </p>

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
              type="tel"
              placeholder="رقم الجوال"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={styles.input}
              required
              dir="ltr"
            />
          </>
        )}

        {authMode === "email_login" && (
          <input
            type="text"
            placeholder="البريد الإلكتروني أو رقم الجوال"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            style={styles.input}
            required
            dir="ltr"
          />
        )}

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

        {authMode === "email_login" && resetNotice && (
          <div
            style={{
              padding: "12px",
              borderRadius: "10px",
              border:
                resetNoticeType === "success"
                  ? "1px solid #bbf7d0"
                  : "1px solid #fecaca",
              backgroundColor:
                resetNoticeType === "success" ? "#f0fdf4" : "#fef2f2",
              color: resetNoticeType === "success" ? "#166534" : "#b91c1c",
              fontSize: "13px",
              lineHeight: "1.6",
              textAlign: isRTL ? "right" : "left",
            }}
          >
            {resetNotice}
          </div>
        )}

        {authMode === "email_login" && resetSending && !resetNotice && (
          <div
            style={{
              padding: "10px",
              borderRadius: "10px",
              border: "1px solid #bfdbfe",
              backgroundColor: "#eff6ff",
              color: "#1e40af",
              fontSize: "13px",
              textAlign: "center",
            }}
          >
            {isRTL ? "جاري إرسال رابط الاستعادة..." : "Sending recovery link..."}
          </div>
        )}

        {authMode === "email_signup" && (
          <>
            <div
              style={{
                marginTop: "4px",
                paddingTop: "12px",
                borderTop: "1px dashed #e2e8f0",
              }}
            >
              <p
                style={{
                  margin: "0 0 8px 0",
                  fontSize: "13px",
                  fontWeight: "bold",
                  color: "#475569",
                  textAlign: isRTL ? "right" : "left",
                }}
              >
                بيانات الانضمام والتسويق
              </p>
              <select
                value={referralSource}
                onChange={(e) => setReferralSource(e.target.value)}
                style={styles.input}
              >
                <option value="">اختر من القائمة...</option>
                <option value="twitter">تويتر (X)</option>
                <option value="snapchat">سناب شات</option>
                <option value="affiliate">(المسوق) شريك Book On Map</option>
                <option value="search_engine">محرك بحث (جوجل)</option>
                <option value="other">أخرى</option>
              </select>

              <input
                type="text"
                placeholder="كود المسوق (أدخل Username)"
                value={referrerCode}
                onChange={(e) => setReferrerCode(e.target.value)}
                style={{
                  ...styles.input,
                  marginTop: "12px",
                }}
                dir="ltr"
              />
            </div>
          </>
        )}

        {authMode === "email_login" && authError && (
          <div
            style={{
              padding: "12px",
              borderRadius: "10px",
              border: "1px solid #fecaca",
              backgroundColor: "#fef2f2",
              color: "#b91c1c",
              fontSize: "13px",
              lineHeight: "1.6",
              textAlign: isRTL ? "right" : "left",
            }}
          >
            <div>{authError}</div>
            <button
              type="button"
              onClick={handleResendConfirmation}
              disabled={resendLoading || resendCooldown > 0}
              style={{
                marginTop: "8px",
                padding: "0",
                border: "none",
                background: "transparent",
                color: resendLoading || resendCooldown > 0 ? "#94a3b8" : "#2563eb",
                cursor: resendLoading || resendCooldown > 0 ? "not-allowed" : "pointer",
                fontWeight: "bold",
                textDecoration: "underline",
              }}
            >
              {resendLoading
                ? isRTL
                  ? "جاري الإرسال..."
                  : "Sending..."
                : resendCooldown > 0
                ? `${isRTL ? "يمكن إعادة الإرسال بعد" : "Resend available in"} ${resendCooldown}${isRTL ? " ثانية" : "s"}`
                : isRTL
                ? "إعادة إرسال رابط التفعيل 📩"
                : "Resend Confirmation Email 📩"}
            </button>
            {resendMessage && (
              <div
                style={{
                  marginTop: "8px",
                  color: resendMessageType === "success" ? "#15803d" : "#b91c1c",
                }}
              >
                {resendMessage}
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={
            loading ||
            (authMode === "email_signup" && usernameStatus !== "available")
          }
          style={{
            ...styles.submitBtn,
            opacity:
              loading ||
              (authMode === "email_signup" && usernameStatus !== "available")
                ? 0.6
                : 1,
            cursor:
              loading ||
              (authMode === "email_signup" && usernameStatus !== "available")
                ? "not-allowed"
                : "pointer",
          }}
        >
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
