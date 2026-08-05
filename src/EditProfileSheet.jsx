/**
 * Edit your own profile.
 *
 * Every member gets this, admin or not — the server only ever writes the row
 * belonging to the token that called it, so there is nothing here to scope.
 * `is_admin` and `verified` are absent by design: the API ignores them, and
 * offering a control the server will refuse is worse than not offering it.
 *
 * The sheet holds a working copy and saves on submit rather than per
 * keystroke. A half-typed handle is not worth a round trip, and it keeps
 * Cancel meaningful.
 */
import React, { useState, useRef, useEffect } from "react";
import { X, Camera } from "lucide-react";
import { useAuth } from "@clerk/clerk-react";
import { createApi, validateImage, ACCEPTED_IMAGE_TYPES, mediaUrl } from "./api.js";

const PILLARS = ["Capital", "Community", "Connect"];
const PILLAR_KEY = { Capital: "gold", Community: "community", Connect: "connect" };

const LIMIT = { name: 60, role: 80, bio: 400 };

export default function EditProfileSheet({ T, profile, onSaved, onClose }) {
  const [form, setForm] = useState({
    name: profile.name || "",
    handle: profile.handle || "",
    role: profile.role || "",
    pillar: profile.pillar || "Community",
    bio: profile.bio || "",
  });
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ? mediaUrl(profile.avatar_url) : null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState(null);
  const fileRef = useRef(null);
  const { getToken } = useAuth();

  // Same reason as the composer: an un-revoked object URL keeps the blob alive
  // for the life of the document.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const problem = validateImage(file);
    if (problem) { setErr(problem); return; }

    setErr(null);
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const api = createApi(getToken);
      const saved = await api.uploadImage(file, { kind: "avatar", alt: `${form.name} profile photo` });
      // Save the link immediately: the photo is the one field where waiting
      // for the Save button would feel broken.
      const updated = await api.updateProfile({ avatar_media_id: saved.id });
      setAvatarUrl(mediaUrl(updated.avatar_url));
      onSaved(updated);
    } catch (e2) {
      setErr(e2.message || "Could not upload that photo.");
      setPreview((p) => { if (p) URL.revokeObjectURL(p); return null; });
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setErr(null);
    setBusy(true);
    try {
      const updated = await createApi(getToken).updateProfile({
        name: form.name.trim(),
        handle: form.handle.trim().toLowerCase().replace(/^@/, ""),
        role: form.role.trim(),
        pillar: form.pillar,
        bio: form.bio.trim(),
      });
      onSaved(updated);
      onClose();
    } catch (e) {
      // The API's message is written for a person — "that handle is already
      // taken" — so show it rather than a generic failure.
      setErr(e.message || "Could not save your profile.");
    } finally {
      setBusy(false);
    }
  };

  const label = {
    fontSize: 11, letterSpacing: "0.12em", color: T.dim, fontWeight: 600,
    fontFamily: "'Inter',sans-serif", marginBottom: 6, display: "block",
  };
  const field = {
    width: "100%", padding: "11px 13px", borderRadius: 12, outline: "none",
    background: T.card, border: `1px solid ${T.line}`, color: T.cream,
    fontSize: 14, fontFamily: "'Inter',sans-serif", boxSizing: "border-box",
  };

  const shown = preview || avatarUrl;

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 60, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "#00000090", backdropFilter: "blur(3px)" }} />
      <div style={{
        position: "relative", background: T.ink2, borderRadius: "22px 22px 0 0",
        border: `1px solid ${T.line}`, borderBottom: "none",
        padding: "18px 18px calc(18px + env(safe-area-inset-bottom))",
        maxHeight: "88%", overflowY: "auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <span style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 700, fontSize: 16, color: T.cream }}>Edit profile</span>
          <X size={22} color={T.dim} style={{ cursor: "pointer" }} onClick={onClose} />
        </div>

        {/* photo */}
        <input ref={fileRef} type="file" accept={ACCEPTED_IMAGE_TYPES} onChange={pickPhoto} style={{ display: "none" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div onClick={() => !uploading && fileRef.current?.click()} style={{ position: "relative", cursor: uploading ? "default" : "pointer" }}>
            <div style={{
              width: 74, height: 74, borderRadius: "50%", overflow: "hidden",
              border: `2px solid ${T.line}`, background: T.card,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Archivo',sans-serif", fontWeight: 700, fontSize: 25, color: T.cream,
              opacity: uploading ? 0.5 : 1, transition: "opacity 0.2s",
            }}>
              {shown
                ? <img src={shown} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : profile.id}
            </div>
            <div style={{
              position: "absolute", bottom: -2, right: -2, width: 27, height: 27, borderRadius: 14,
              background: T.gold, border: `2px solid ${T.ink2}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}><Camera size={13} color={T.ink} /></div>
          </div>
          <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{
            padding: "10px 16px", borderRadius: 999, cursor: uploading ? "default" : "pointer",
            background: "transparent", border: `1px solid ${T.line}`, color: T.cream,
            fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 13,
          }}>{uploading ? "Uploading…" : shown ? "Change photo" : "Add a photo"}</button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>NAME</label>
          <input value={form.name} onChange={set("name")} maxLength={LIMIT.name} style={field} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>HANDLE</label>
          <div style={{ position: "relative" }}>
            <span style={{
              position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)",
              color: T.dim, fontSize: 14, fontFamily: "'Inter',sans-serif",
            }}>@</span>
            <input value={form.handle} onChange={set("handle")} maxLength={30}
              autoCapitalize="none" autoCorrect="off" spellCheck={false}
              style={{ ...field, paddingLeft: 27 }} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>ROLE</label>
          <input value={form.role} onChange={set("role")} maxLength={LIMIT.role}
            placeholder="Founder · Company" style={field} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>PILLAR</label>
          <div style={{ display: "flex", gap: 8 }}>
            {PILLARS.map((p) => {
              const on = form.pillar === p;
              const c = T[PILLAR_KEY[p]];
              return (
                <button key={p} onClick={() => setForm((f) => ({ ...f, pillar: p }))} style={{
                  flex: 1, padding: "10px 0", borderRadius: 999, cursor: "pointer",
                  background: on ? `${c}1A` : "transparent",
                  border: `1px solid ${on ? c : T.line}`,
                  color: on ? c : T.dim,
                  fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 12.5,
                }}>{p}</button>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={label}>BIO</label>
          <textarea value={form.bio} onChange={set("bio")} rows={3} maxLength={LIMIT.bio}
            placeholder="What should other members know about you?"
            style={{ ...field, resize: "none", lineHeight: 1.5 }} />
          <div style={{ textAlign: "right", fontSize: 11, color: T.dim, fontFamily: "'Inter',sans-serif", marginTop: 4 }}>
            {form.bio.length}/{LIMIT.bio}
          </div>
        </div>

        {err && (
          <div style={{
            marginBottom: 14, padding: "9px 12px", borderRadius: 10, fontSize: 12.5,
            lineHeight: 1.45, fontFamily: "'Inter',sans-serif",
            background: "rgba(200,60,60,0.10)", border: "1px solid rgba(200,60,60,0.35)", color: "#B4483F",
          }}>{err}</div>
        )}

        <button disabled={busy || uploading || !form.name.trim()} onClick={save} style={{
          width: "100%", padding: "15px 0", borderRadius: 999, border: "none",
          cursor: busy || uploading || !form.name.trim() ? "default" : "pointer",
          background: busy || uploading || !form.name.trim() ? T.card : `linear-gradient(120deg, ${T.gold}, ${T.goldSoft})`,
          color: busy || uploading || !form.name.trim() ? T.dim : T.ink,
          fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 14.5,
        }}>{busy ? "Saving…" : "Save profile"}</button>
      </div>
    </div>
  );
}
