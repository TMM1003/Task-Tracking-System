import { createContext, useContext, useEffect, useState } from "react";

import { api } from "../api/client";

const TOKEN_KEY = "task-tracker-token";
const USER_KEY = "task-tracker-user";

const AuthContext = createContext(null);

function parseStoredUser() {
  if (typeof window === "undefined") {
    return null;
  }

  const storedUser = localStorage.getItem(USER_KEY);

  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser);
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

function decodeTokenPayload(token) {
  try {
    const payloadSegment = token.split(".")[1];

    if (!payloadSegment) {
      return null;
    }

    const normalizedPayload = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, "=");
    return JSON.parse(window.atob(paddedPayload));
  } catch {
    return null;
  }
}

function getTokenExpiry(token) {
  const payload = decodeTokenPayload(token);

  if (!payload || typeof payload.exp !== "number") {
    return null;
  }

  return payload.exp * 1000;
}

function getInitialToken() {
  if (typeof window === "undefined") {
    return null;
  }

  const storedToken = localStorage.getItem(TOKEN_KEY);

  if (!storedToken) {
    return null;
  }

  const tokenExpiry = getTokenExpiry(storedToken);
  if (tokenExpiry && tokenExpiry <= Date.now()) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    return null;
  }

  return storedToken;
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(getInitialToken);
  const [user, setUser] = useState(parseStoredUser);
  const [isLoading, setIsLoading] = useState(Boolean(getInitialToken()));

  const clearSession = () => {
    if (typeof window === "undefined") {
      setToken(null);
      setUser(null);
      return;
    }

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  };

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return undefined;
    }

    if (typeof window === "undefined") {
      return undefined;
    }

    const tokenExpiry = getTokenExpiry(token);
    if (!tokenExpiry) {
      return undefined;
    }

    const remainingMs = tokenExpiry - Date.now();
    if (remainingMs <= 0) {
      clearSession();
      setIsLoading(false);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      clearSession();
    }, remainingMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [token]);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    api
      .me(token)
      .then((profile) => {
        if (!isMounted) {
          return;
        }

        setUser(profile);
        localStorage.setItem(USER_KEY, JSON.stringify(profile));
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        clearSession();
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const saveSession = (response) => {
    const nextToken = response.token.access_token;
    const nextUser = response.user;

    if (typeof window !== "undefined") {
      localStorage.setItem(TOKEN_KEY, nextToken);
      localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    }

    setToken(nextToken);
    setUser(nextUser);
    setIsLoading(false);
  };

  const signIn = async (credentials) => {
    const response = await api.login(credentials);
    saveSession(response);
    return response;
  };

  const signUp = async (details) => {
    const response = await api.register(details);
    saveSession(response);
    return response;
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isLoading,
        signIn,
        signUp,
        signOut: clearSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
