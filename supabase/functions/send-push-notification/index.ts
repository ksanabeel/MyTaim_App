import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

// ── Firebase OAuth2 access token via Web Crypto ──────────────────────────────

function base64UrlEncode(input: Uint8Array | ArrayBuffer): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function strToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/-----BEGIN RSA PRIVATE KEY-----/g, "")
    .replace(/-----END RSA PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function getFirebaseAccessToken(serviceAccount: {
  client_email: string;
  private_key: string;
  project_id: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600;

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: expiry,
  };

  const encodedHeader = base64UrlEncode(strToBytes(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(strToBytes(JSON.stringify(payload)));
  const signInput = `${encodedHeader}.${encodedPayload}`;

  const keyData = pemToArrayBuffer(serviceAccount.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    strToBytes(signInput),
  );

  const jwt = `${signInput}.${base64UrlEncode(signature)}`;

  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenResp.ok) {
    const errText = await tokenResp.text();
    throw new Error(`Firebase OAuth failed (${tokenResp.status}): ${errText}`);
  }

  const tokenData = await tokenResp.json();
  return tokenData.access_token;
}

// ── Main handler ─────────────────────────────────────────────────────────────

interface NotificationPayload {
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record?: {
    id: string;
    user_id: string;
    title?: string | null;
    body?: string | null;
    is_read?: boolean;
  };
  old_record?: Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Detect Database Webhook payload vs direct API call
    let payload: NotificationPayload;

    if (body && body.type === "INSERT" && body.record && body.table === "notifications") {
      const rec = body.record as NonNullable<WebhookPayload["record"]>;
      payload = {
        user_id: rec.user_id,
        title: rec.title || "إشعار جديد",
        body: rec.body || "",
      };
    } else {
      payload = body as NotificationPayload;
    }

    if (!payload.user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 1. Fetch device tokens for this user ──────────────────────────────────
    const { data: tokens, error: tokenError } = await supabase
      .from("user_push_tokens")
      .select("token, platform")
      .eq("user_id", payload.user_id);

    if (tokenError) {
      return new Response(
        JSON.stringify({ error: tokenError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No device tokens found for user" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 2. Get unread notification count ──────────────────────────────────────
    const { count: unreadCount, error: countError } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", payload.user_id)
      .eq("is_read", false);

    if (countError) {
      console.error("Failed to get unread count:", countError.message);
    }

    const badge = unreadCount ?? 0;

    // ── 3. Get Firebase access token ───────────────────────────────────────────
    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    if (!serviceAccountJson) {
      return new Response(
        JSON.stringify({ error: "FIREBASE_SERVICE_ACCOUNT secret is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    const accessToken = await getFirebaseAccessToken(serviceAccount);
    const projectId = serviceAccount.project_id;
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    // ── 4. Send to each token ──────────────────────────────────────────────────
    const tokensToDelete: string[] = [];
    const results: { token: string; success: boolean; error?: string }[] = [];

    for (const entry of tokens) {
      const message: Record<string, unknown> = {
        message: {
          token: entry.token,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          data: payload.data || {},
          apns: {
            payload: {
              aps: {
                badge: badge,
                sound: "default",
              },
            },
          },
          android: {
            notification: {
              notification_count: badge,
            },
          },
        },
      };

      try {
        const fcmResp = await fetch(fcmUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(message),
        });

        if (fcmResp.ok) {
          results.push({ token: entry.token, success: true });
        } else {
          const errBody = await fcmResp.text();
          let errJson: { error?: { details?: { code?: string }; code?: number; message?: string; status?: string } } = {};
          try { errJson = JSON.parse(errBody); } catch { /* not JSON */ }

          const errCode = errJson.error?.details?.code || errJson.error?.code;
          const errStatus = errJson.error?.status || "";
          const errMsg = errJson.error?.message || errBody;

          // FCM v1 returns 404 for UNREGISTERED, 400 for INVALID_ARGUMENT
          if (
            fcmResp.status === 404 ||
            errStatus === "NOT_FOUND" ||
            errCode === 404 ||
            errMsg.includes("UNREGISTERED") ||
            errMsg.includes("Requested entity was not found")
          ) {
            tokensToDelete.push(entry.token);
          } else if (
            fcmResp.status === 400 ||
            errStatus === "INVALID_ARGUMENT" ||
            errCode === 400 ||
            errMsg.includes("INVALID_ARGUMENT")
          ) {
            tokensToDelete.push(entry.token);
          }

          results.push({ token: entry.token, success: false, error: errMsg });
          console.error(`FCM error for token ${entry.token.slice(0, 12)}...: ${errMsg}`);
        }
      } catch (fetchErr) {
        results.push({ token: entry.token, success: false, error: String(fetchErr) });
      }
    }

    // ── 5. Clean up invalid tokens ─────────────────────────────────────────────
    if (tokensToDelete.length > 0) {
      const { error: delError } = await supabase
        .from("user_push_tokens")
        .delete()
        .in("token", tokensToDelete);

      if (delError) {
        console.error("Failed to delete invalid tokens:", delError.message);
      } else {
        console.log(`Deleted ${tokensToDelete.length} invalid push tokens`);
      }
    }

    const sentCount = results.filter((r) => r.success).length;

    return new Response(
      JSON.stringify({
        sent: sentCount,
        total: tokens.length,
        badge,
        cleanedUp: tokensToDelete.length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-push-notification error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
