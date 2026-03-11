import { Brain } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { login } from "../utils/localAuth";

interface LoginScreenProps {
  onLogin: () => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

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

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden">
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
            className="w-20 h-20 rounded-full border-2 border-gold/50 flex items-center justify-center mb-4 gold-glow"
            style={{ background: "oklch(0.08 0.004 85)" }}
          >
            <Brain className="w-10 h-10 text-gold" />
          </motion.div>
          <h1 className="font-display font-black text-4xl tracking-[0.4em] text-gold gold-glow-text">
            SENTRY
          </h1>
          <p className="text-[10px] font-mono text-muted-foreground tracking-[0.3em] mt-1">
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
              className="w-full bg-black border border-gold/30 text-gold font-mono text-sm px-4 py-3 rounded focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 placeholder:text-muted-foreground/30 transition-colors"
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
              className="w-full bg-black border border-gold/30 text-gold font-mono text-sm px-4 py-3 rounded focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 placeholder:text-muted-foreground/30 transition-colors"
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
            className="w-full py-3 bg-gold/10 border border-gold/50 text-gold font-mono text-sm tracking-[0.2em] rounded hover:bg-gold/20 hover:border-gold transition-all gold-glow mt-2"
            data-ocid="login.submit_button"
          >
            AUTHENTICATE
          </button>
        </form>

        <p className="text-center text-[10px] font-mono text-muted-foreground/30 mt-8 tracking-widest">
          AUTHORIZED PERSONNEL ONLY
        </p>
      </motion.div>

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
