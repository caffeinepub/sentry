import { Brain, Camera } from "lucide-react";
import { motion } from "motion/react";
import { useRef, useState } from "react";
import { login, loginWithAvatar } from "../utils/localAuth";

interface LoginScreenProps {
  onLogin: () => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [photoUsername, setPhotoUsername] = useState("");
  const [photoError, setPhotoError] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(username, password)) {
      onLogin();
    } else {
      setError("INVALID CREDENTIALS");
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  const handlePhotoLogin = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!photoUsername.trim()) {
        setPhotoError("ENTER AGENT ID FIRST");
        return;
      }
      if (loginWithAvatar(photoUsername.trim(), dataUrl)) {
        onLogin();
      } else {
        setPhotoError("PHOTO NOT RECOGNIZED");
        setTimeout(() => setPhotoError(""), 3000);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-y-auto py-8">
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 39px, oklch(0.72 0.14 85) 39px, oklch(0.72 0.14 85) 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, oklch(0.72 0.14 85) 39px, oklch(0.72 0.14 85) 40px)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, oklch(0.2 0.08 85 / 0.4), transparent)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className={`relative z-10 w-full max-w-sm px-8 ${shake ? "animate-shake" : ""}`}
      >
        <div className="flex flex-col items-center mb-10">
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY }}
            className="w-20 h-20 rounded-full border-2 border-gold flex items-center justify-center mb-4 gold-glow"
            style={{ background: "oklch(0.08 0.004 85)" }}
          >
            <Brain className="w-10 h-10 text-gold" />
          </motion.div>
          <h1 className="font-display font-black text-4xl tracking-[0.4em] text-gold gold-glow-text">
            SENTRY
          </h1>
          <p className="text-[10px] font-mono text-gold/60 tracking-[0.3em] mt-1">
            ADAPTIVE NEURAL INTERFACE
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label
              htmlFor="login-username"
              className="text-[10px] font-mono text-gold/60 tracking-widest block"
            >
              AGENT ID
            </label>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError("");
              }}
              autoComplete="username"
              className="w-full bg-black border border-gold text-gold font-mono text-sm px-4 py-3 rounded focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/40 placeholder:text-gold/30 transition-colors"
              placeholder="Enter agent ID"
              data-ocid="login.input"
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="login-password"
              className="text-[10px] font-mono text-gold/60 tracking-widest block"
            >
              ACCESS CODE
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              autoComplete="current-password"
              className="w-full bg-black border border-gold text-gold font-mono text-sm px-4 py-3 rounded focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/40 placeholder:text-gold/30 transition-colors"
              placeholder="Enter access code"
            />
          </div>

          {error && (
            <p
              className="text-xs font-mono text-destructive text-center tracking-widest"
              data-ocid="login.error_state"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full py-3 bg-gold border-2 border-gold text-black font-bold font-mono text-sm tracking-[0.2em] rounded hover:bg-gold-bright transition-all gold-glow mt-2"
            data-ocid="login.submit_button"
          >
            AUTHENTICATE
          </button>
        </form>

        {/* Photo login */}
        <div className="my-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-gold/30" />
          <span className="text-[10px] font-mono text-gold/40 tracking-widest">
            OR
          </span>
          <div className="flex-1 h-px bg-gold/30" />
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-mono text-gold/60 tracking-widest">
            PHOTO LOGIN
          </p>
          <div className="space-y-1">
            <label
              htmlFor="photo-login-username"
              className="text-[10px] font-mono text-gold/40 tracking-widest block"
            >
              AGENT ID FOR PHOTO LOGIN
            </label>
            <input
              id="photo-login-username"
              type="text"
              value={photoUsername}
              onChange={(e) => {
                setPhotoUsername(e.target.value);
                setPhotoError("");
              }}
              className="w-full bg-black border border-gold text-gold font-mono text-sm px-4 py-2.5 rounded focus:outline-none focus:border-gold placeholder:text-gold/25 transition-colors"
              placeholder="Enter agent ID"
              data-ocid="login.photo_input"
            />
          </div>
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className="w-full py-2.5 bg-gold border-2 border-gold text-black font-bold font-mono text-xs tracking-[0.2em] rounded hover:bg-gold-bright transition-all flex items-center justify-center gap-2"
            data-ocid="login.upload_button"
          >
            <Camera className="w-3.5 h-3.5" />
            UPLOAD PHOTO TO LOGIN
          </button>
          {photoError && (
            <p
              className="text-xs font-mono text-destructive text-center tracking-widest"
              data-ocid="login.photo_error_state"
            >
              {photoError}
            </p>
          )}
        </div>

        <p className="text-center text-[10px] font-mono text-gold/40 mt-8 tracking-widest">
          AUTHORIZED PERSONNEL ONLY
        </p>
      </motion.div>

      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePhotoLogin}
      />

      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-8px)}
          40%{transform:translateX(8px)}
          60%{transform:translateX(-6px)}
          80%{transform:translateX(6px)}
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  );
}
