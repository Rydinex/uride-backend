"use client";

import { useState } from "react";
import api from "../../lib/api";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const submit = async () => {
    try {
      const res = await api.post("/auth/register", {
        full_name: fullName,
        email,
        password,
        role: "rider"
      });
      setMessage(`Account created for ${res?.data?.email || email}`);
    } catch (err) {
      setMessage(err?.response?.data?.error || "Signup failed");
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 px-4">
      <h1 className="text-3xl font-bold mb-6">Sign Up</h1>

      <input
        className="w-full p-3 border rounded mb-4"
        placeholder="Full Name"
        onChange={(e) => setFullName(e.target.value)}
      />
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

      <button onClick={submit} className="w-full bg-blue-600 text-white p-3 rounded">
        Create Account
      </button>

      {message ? <p className="mt-3 text-sm text-gray-700">{message}</p> : null}
    </div>
  );
}
