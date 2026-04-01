"use client";

import { useState } from "react";
import api from "../../lib/api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = async () => {
    try {
      setError("");
      const res = await api.post("/auth/login", { email, password });
      const token = res?.data?.session_token || res?.data?.sessionToken;
      if (token) {
        localStorage.setItem("sessionToken", token);
      }
      console.log(res.data);
    } catch (err) {
      setError(err?.response?.data?.error || "Login failed");
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 px-4">
      <h1 className="text-3xl font-bold mb-6">Login</h1>

      <input
        className="w-full p-3 border rounded mb-4"
        placeholder="Email"
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        className="w-full p-3 border rounded mb-4"
        placeholder="Password"
        type="password"
        onChange={(e) => setPassword(e.target.value)}
      />

      {error ? <p className="text-sm text-red-600 mb-3">{error}</p> : null}

      <button onClick={submit} className="w-full bg-blue-600 text-white p-3 rounded">
        Login
      </button>
    </div>
  );
}
