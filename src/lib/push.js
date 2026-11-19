import { Capacitor } from "@capacitor/core";
import { supabase } from "./supabase";

const isNative = () => Capacitor.isNativePlatform();

let registrationListeners = null;

export async function initPushNotifications() {
  if (!isNative()) return;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === "prompt") {
      permStatus = await PushNotifications.requestPermissions();
    }
    if (permStatus.receive !== "granted") {
      return;
    }

    await PushNotifications.register();

    if (registrationListeners) return;
    registrationListeners = true;

    await PushNotifications.addListener("registration", (token) => {
      savePushToken(token.value);
    });

    await PushNotifications.addListener("registrationError", (err) => {
      console.error("Push registration error:", err);
    });

    await PushNotifications.addListener("pushNotificationReceived", (notification) => {
      console.log("Push received:", notification);
    });

    await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      console.log("Push action:", action);
    });
  } catch (err) {
    console.error("initPushNotifications failed:", err);
  }
}

async function savePushToken(token) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId || !token) return;

    const platform = Capacitor.getPlatform();

    const { error } = await supabase
      .from("user_push_tokens")
      .upsert(
        { user_id: userId, token, platform },
        { onConflict: "user_id,token" }
      );

    if (error) {
      console.error("Failed to save push token:", error.message);
    }
  } catch (err) {
    console.error("savePushToken failed:", err);
  }
}

export async function updateAppBadge(count) {
  if (!isNative()) return;
  try {
    const { Badge } = await import("@capawesome/capacitor-badge");
    if (count > 0) {
      await Badge.set({ count });
    } else {
      await Badge.clear();
    }
  } catch (err) {
    console.error("updateAppBadge failed:", err);
  }
}

export async function clearAppBadge() {
  if (!isNative()) return;
  try {
    const { Badge } = await import("@capawesome/capacitor-badge");
    await Badge.clear();
  } catch (err) {
    console.error("clearAppBadge failed:", err);
  }
}
