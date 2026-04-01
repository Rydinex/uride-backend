"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ProtectedRoute({ children, redirectTo = "/login" }) {
  const router = useRouter();
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("sessionToken") : null;
    if (!token) {
      router.push(redirectTo);
      return;
    }
    setIsAllowed(true);
  }, [router, redirectTo]);

  if (!isAllowed) {
    return <div className="p-6 text-gray-600">Checking session...</div>;
  }

  return children;
}
