"use client";

import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
      <div className="container-fluid">
        <Link href="/dashboard" className="navbar-brand">
          Scribble
        </Link>

        <div className="d-flex align-items-center">
          {user && (
            <>
              <span className="text-white me-3">
                Welcome, {user.displayName}
                <span style={{ opacity: 0.7, fontSize: "0.9em" }}>
                  (@{user.username})
                </span>
              </span>
              <button className="btn btn-outline-light btn-sm" onClick={logout}>
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
