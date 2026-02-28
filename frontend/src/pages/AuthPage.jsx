import { useState } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { useSoundPreferences } from "../hooks/useSoundPreferences";

const initialForm = {
  name: "",
  email: "",
  password: "",
};

const neutralSoundUrl = `${import.meta.env.BASE_URL}NeutralClick.mp3`;

export default function AuthPage() {
  const { token, signIn, signUp } = useAuth();
  const { isMuted, playSound, setIsMuted, setVolume, volume } = useSoundPreferences();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (token) {
    return <Navigate to="/app" replace />;
  }

  const title = mode === "login" ? "Sign in to your focus space" : "Create your ADHD support account";

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    playSound(neutralSoundUrl);
    setIsSubmitting(true);
    setError("");

    try {
      if (mode === "login") {
        await signIn({
          email: form.email,
          password: form.password,
        });
      } else {
        await signUp(form);
      }
    } catch (submissionError) {
      setError(submissionError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModeChange = (nextMode) => {
    playSound(neutralSoundUrl);
    setMode(nextMode);
  };

  const handleToggleMute = () => {
    if (!isMuted) {
      playSound(neutralSoundUrl);
    }

    setIsMuted((current) => !current);
  };

  const handleVolumeChange = (event) => {
    setVolume(event.target.value);
  };

  const handleVolumeCommit = () => {
    playSound(neutralSoundUrl);
  };

  return (
    <div className="page-shell auth-shell">
      <div className="hero-copy">
        <span className="eyebrow">ADHD Focus Tracking System</span>
        <h1>Build a calmer system for planning, starting, and finishing real-life tasks.</h1>
        <p>
          Organize focus areas, capture the next action, and keep visible momentum when executive function
          is fighting back.
        </p>
        <div className="feature-grid">
          <div className="glass-panel feature-card">
            <span className="feature-label">Focus Areas</span>
            <strong>Context buckets</strong>
            <p>Separate home, work, school, and personal routines so everything is not fighting for attention.</p>
          </div>
          <div className="glass-panel feature-card">
            <span className="feature-label">Next Actions</span>
            <strong>One step at a time</strong>
            <p>Track what is waiting, what is in motion, and what is already done.</p>
          </div>
          <div className="glass-panel feature-card">
            <span className="feature-label">Support</span>
            <strong>Built-in accountability</strong>
            <p>Assign actions so they stay visible instead of disappearing after the first burst of energy.</p>
          </div>
        </div>
      </div>

      <div className="glass-panel auth-card">
        <div className="tab-strip">
          <button
            className={mode === "login" ? "tab-button active" : "tab-button"}
            type="button"
            onClick={() => handleModeChange("login")}
          >
            Login
          </button>
          <button
            className={mode === "register" ? "tab-button active" : "tab-button"}
            type="button"
            onClick={() => handleModeChange("register")}
          >
            Register
          </button>
        </div>

        <h2>{title}</h2>
        <p className="muted-copy">Create an account to keep your focus areas and next actions in one place.</p>
        <div className="sound-preferences sound-preferences-compact">
          <button className="ghost-button" onClick={handleToggleMute} type="button">
            {isMuted ? "Unmute Sounds" : "Mute Sounds"}
          </button>
          <label className="sound-slider">
            Volume
            <input
              aria-label="Sound volume"
              max="1"
              min="0"
              onChange={handleVolumeChange}
              onKeyUp={handleVolumeCommit}
              onPointerUp={handleVolumeCommit}
              step="0.05"
              type="range"
              value={volume}
            />
          </label>
        </div>

        <form className="stacked-form" onSubmit={handleSubmit}>
          {mode === "register" ? (
            <label>
              Name
              <input
                autoComplete="name"
                name="name"
                onChange={handleChange}
                placeholder="Thomas"
                required
                value={form.name}
              />
            </label>
          ) : null}

          <label>
            Email
            <input
              autoComplete="email"
              name="email"
              onChange={handleChange}
              placeholder="you@example.com"
              required
              type="email"
              value={form.email}
            />
          </label>

          <label>
            Password
            <input
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={8}
              name="password"
              onChange={handleChange}
              placeholder="Minimum 8 characters"
              required
              type="password"
              value={form.password}
            />
          </label>

          {error ? <p className="error-text">{error}</p> : null}

          <button className="primary-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Working..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
