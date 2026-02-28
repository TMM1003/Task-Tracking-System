import { createContext, useContext, useEffect, useState } from "react";

import { api } from "../api/client";

const TOKEN_KEY = "task-tracker-token";
const USER_KEY = "task-tracker-user";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem(USER_KEY);
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [isLoading, setIsLoading] = useState(Boolean(token));

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

        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setToken(null);
        setUser(null);
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

    localStorage.setItem(TOKEN_KEY, nextToken);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
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

  const signOut = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isLoading,
        signIn,
        signUp,
        signOut,
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

