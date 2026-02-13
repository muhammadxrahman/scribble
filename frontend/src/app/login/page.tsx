"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

export default function LoginPage() {
  const [formData, setFormData] = useState({
    usernameOrEmail: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(formData);
    } catch (err: any) {
      setError(err.response?.data?.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-vh-100 d-flex align-items-center justify-content-center"
      style={{
        background:
          "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
      }}
    >
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-12 col-sm-10 col-md-8 col-lg-7 col-xl-6 col-xxl-5">
            <div
              className="card border-0 shadow-lg"
              style={{
                borderRadius: "1rem",
                overflow: "hidden",
                background: "rgba(255, 255, 255, 0.95)",
              }}
            >
              {/* Header */}
              <div
                className="card-header text-white text-center py-4 border-0"
                style={{
                  background:
                    "linear-gradient(135deg, #2c3e50 0%, #34495e 100%)",
                }}
              >
                <h1
                  className="h3 mb-1 fw-bold"
                  style={{ letterSpacing: "1px" }}
                >
                  SCRIBBLE
                </h1>
                <p className="mb-0 opacity-75 small">
                  Professional Collaborative Writing
                </p>
              </div>

              <div className="card-body p-4 p-md-5">
                <h2
                  className="h5 text-center mb-4"
                  style={{ color: "#2c3e50" }}
                >
                  Welcome Back
                </h2>

                {error && (
                  <div
                    className="alert alert-danger border-0 mb-4"
                    style={{
                      borderRadius: "0.5rem",
                      backgroundColor: "#fee",
                    }}
                  >
                    <small>{error}</small>
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label
                      htmlFor="usernameOrEmail"
                      className="form-label small fw-semibold"
                      style={{ color: "#546e7a" }}
                    >
                      Username or Email
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-lg border-2"
                      id="usernameOrEmail"
                      placeholder="Enter your username or email"
                      value={formData.usernameOrEmail}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          usernameOrEmail: e.target.value,
                        })
                      }
                      required
                      style={{
                        borderRadius: "0.5rem",
                        borderColor: "#cfd8dc",
                        backgroundColor: "#fafafa",
                      }}
                    />
                  </div>

                  <div className="mb-4">
                    <label
                      htmlFor="password"
                      className="form-label small fw-semibold"
                      style={{ color: "#546e7a" }}
                    >
                      Password
                    </label>
                    <input
                      type="password"
                      className="form-control form-control-lg border-2"
                      id="password"
                      placeholder="Enter your password"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      required
                      style={{
                        borderRadius: "0.5rem",
                        borderColor: "#cfd8dc",
                        backgroundColor: "#fafafa",
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-lg w-100 text-white fw-semibold mb-3"
                    disabled={loading}
                    style={{
                      background:
                        "linear-gradient(135deg, #2c3e50 0%, #34495e 100%)",
                      border: "none",
                      borderRadius: "0.5rem",
                      padding: "0.75rem",
                      letterSpacing: "0.5px",
                    }}
                  >
                    {loading ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden="true"
                        ></span>
                        Logging in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </button>
                </form>

                <div className="text-center">
                  <p className="small mb-0" style={{ color: "#78909c" }}>
                    Don't have an account?{" "}
                    <Link
                      href="/register"
                      className="text-decoration-none fw-semibold"
                      style={{ color: "#34495e" }}
                    >
                      Create one
                    </Link>
                  </p>
                </div>
              </div>
            </div>

            {/* Footer note */}
            <p className="text-center text-white mt-4 small opacity-75">
              Secure, Professional, Collaborative
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
