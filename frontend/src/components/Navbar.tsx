"use client";

import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
  <nav 
    className="navbar navbar-expand-lg"
    style={{
      background: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    }}
  >
    <div className="container-fluid">
      <Link 
        href="/dashboard" 
        className="navbar-brand text-white fw-bold"
        style={{ 
          fontSize: '1.5rem',
          letterSpacing: '0.5px',
        }}
      >
        SCRIBBLE
      </Link>

      <div className="d-flex align-items-center gap-3">
        {user && (
          <>
            <span className="text-white">
              <span className="fw-semibold d-none d-sm-inline me-2">{user.displayName}</span>
              <span className="opacity-75" style={{ fontSize: "0.95em" }}>
                @{user.username}
              </span>
            </span>
            <button 
              className="btn btn-sm"
              onClick={logout}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: 'white',
                fontWeight: '600',
                borderRadius: '0.5rem',
                padding: '0.5rem 1rem',
              }}
            >
              Logout
            </button>
          </>
        )}
      </div>
    </div>
  </nav>
);
}
