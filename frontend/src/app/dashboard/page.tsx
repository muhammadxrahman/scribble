"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { documentsApi, Document } from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";
import Navbar from "@/components/Navbar";
import Link from "next/link";

export default function DashboardPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const { user } = useAuth();

  const [sharedDocuments, setSharedDocuments] = useState<Document[]>([]);
  const [activeTab, setActiveTab] = useState<"my" | "shared">("my");

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const [myDocs, sharedDocs] = await Promise.all([
        documentsApi.getAll(),
        documentsApi.getSharedDocuments(),
      ]);
      setDocuments(myDocs);
      setSharedDocuments(sharedDocs);
    } catch (err: any) {
      setError("Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError("");

    try {
      await documentsApi.create({ title: newDocTitle });
      setNewDocTitle("");
      setShowCreateModal(false);
      fetchDocuments();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to create document");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    if (!confirm("Are you sure you want to delete this document?")) {
      return;
    }

    try {
      await documentsApi.delete(id);
      fetchDocuments();
    } catch (err: any) {
      setError("Failed to delete document");
    }
  };

  return (
    <ProtectedRoute>
      <div
        style={{
          minHeight: "100vh",
          background:
            "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
        }}
      >
        <Navbar />

        <div className="container py-5">
          {/* Header Section */}
          <div className="mb-5">
            <h1
              className="display-5 fw-bold mb-2 text-white"
              style={{ letterSpacing: "0.5px" }}
            >
              Your Documents
            </h1>
            <p style={{ color: "#b0bec5" }}>
              Manage and collaborate on your writing projects
            </p>
          </div>

          {/* Tabs and New Document Button */}
          <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
            <ul className="nav nav-tabs border-0">
              <li className="nav-item">
                <button
                  className={`nav-link ${activeTab === "my" ? "active" : ""}`}
                  onClick={() => setActiveTab("my")}
                  style={{
                    background: "transparent",
                    color: activeTab === "my" ? "white" : "#b0bec5",
                    border: "none",
                    borderBottom:
                      activeTab === "my"
                        ? "3px solid #2c3e50"
                        : "3px solid transparent",
                    fontWeight: "600",
                    fontSize: "1.1rem",
                    padding: "0.75rem 1.5rem",
                    marginRight: "1rem",
                  }}
                >
                  My Documents ({documents.length})
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link ${activeTab === "shared" ? "active" : ""}`}
                  onClick={() => setActiveTab("shared")}
                  style={{
                    background: "transparent",
                    color: activeTab === "shared" ? "white" : "#b0bec5",
                    border: "none",
                    borderBottom:
                      activeTab === "shared"
                        ? "3px solid #2c3e50"
                        : "3px solid transparent",
                    fontWeight: "600",
                    fontSize: "1.1rem",
                    padding: "0.75rem 1.5rem",
                  }}
                >
                  Shared with Me ({sharedDocuments.length})
                </button>
              </li>
            </ul>
            <button
              className="btn btn-lg"
              onClick={() => setShowCreateModal(true)}
              disabled={documents.length >= 5}
              style={{
                background:
                  documents.length >= 5
                    ? "rgba(255, 255, 255, 0.1)"
                    : "linear-gradient(135deg, #2c3e50 0%, #34495e 100%)",
                border: "none",
                color: documents.length >= 5 ? "#78909c" : "white",
                fontWeight: "600",
                padding: "0.75rem 1.5rem",
                borderRadius: "0.5rem",
                cursor: documents.length >= 5 ? "not-allowed" : "pointer",
              }}
            >
              + New Document
            </button>
          </div>

          {/* Alerts */}
          {documents.length >= 5 && (
            <div
              className="alert border-0 mb-4"
              style={{
                backgroundColor: "rgba(255, 193, 7, 0.15)",
                color: "#ffc107",
                borderRadius: "0.5rem",
                border: "1px solid rgba(255, 193, 7, 0.3)",
              }}
            >
              <strong>Limit Reached:</strong> You've reached the maximum of 5
              documents. Delete a document to create a new one.
            </div>
          )}

          {error && (
            <div
              className="alert border-0 mb-4"
              style={{
                backgroundColor: "rgba(244, 67, 54, 0.15)",
                color: "#f44336",
                borderRadius: "0.5rem",
                border: "1px solid rgba(244, 67, 54, 0.3)",
              }}
            >
              {error}
            </div>
          )}

          {/* Content Area */}
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-white" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : activeTab === "my" && documents.length === 0 ? (
            <div className="text-center py-5">
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  borderRadius: "1rem",
                  padding: "4rem 2rem",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                }}
              >
                <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>📝</div>
                <h3 className="text-white mb-2">No documents yet</h3>
                <p style={{ color: "#b0bec5" }}>
                  Create your first document to get started!
                </p>
              </div>
            </div>
          ) : activeTab === "shared" && sharedDocuments.length === 0 ? (
            <div className="text-center py-5">
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  borderRadius: "1rem",
                  padding: "4rem 2rem",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                }}
              >
                <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>👥</div>
                <h3 className="text-white mb-2">No shared documents</h3>
                <p style={{ color: "#b0bec5" }}>
                  Documents shared with you will appear here.
                </p>
              </div>
            </div>
          ) : (
            <div className="row">
              {(activeTab === "my" ? documents : sharedDocuments).map((doc) => (
                <div key={doc.id} className="col-md-6 col-lg-4 mb-4">
                  <div
                    className="card h-100 border-0"
                    style={{
                      background: "rgba(255, 255, 255, 0.95)",
                      borderRadius: "1rem",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                      transition: "transform 0.2s, box-shadow 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-8px)";
                      e.currentTarget.style.boxShadow =
                        "0 8px 30px rgba(0,0,0,0.4)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow =
                        "0 4px 20px rgba(0,0,0,0.3)";
                    }}
                  >
                    <div className="card-body p-4">
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <h5
                          className="card-title mb-0 fw-bold"
                          style={{
                            color: "#2c3e50",
                            fontSize: "1.25rem",
                          }}
                        >
                          {doc.title}
                        </h5>
                        {activeTab === "my" && (doc.shareCount ?? 0) > 0 && (
                          <span
                            className="badge"
                            title={`Shared with ${doc.shareCount} ${doc.shareCount === 1 ? "person" : "people"}`}
                            style={{
                              background:
                                "linear-gradient(135deg, #2c3e50 0%, #34495e 100%)",
                              color: "white",
                              padding: "0.35rem 0.65rem",
                              borderRadius: "0.5rem",
                              fontWeight: "600",
                            }}
                          >
                            👥 {doc.shareCount}
                          </span>
                        )}
                      </div>

                      {activeTab === "shared" && (
                        <p className="small mb-2" style={{ color: "#546e7a" }}>
                          <strong>Owner:</strong> {doc.ownerDisplayName}
                        </p>
                      )}

                      <div className="small mb-2" style={{ color: "#78909c" }}>
                        <span>
                          {doc.characterCount.toLocaleString()} characters
                        </span>
                      </div>

                      <div className="small" style={{ color: "#90a4ae" }}>
                        Last updated:{" "}
                        {new Date(doc.updatedAt).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="card-footer bg-transparent border-0 p-4 pt-0">
                      <div className="d-flex gap-2">
                        <Link
                          href={`/editor/${doc.id}`}
                          className="btn flex-grow-1"
                          style={{
                            background:
                              "linear-gradient(135deg, #2c3e50 0%, #34495e 100%)",
                            border: "none",
                            color: "white",
                            fontWeight: "600",
                            borderRadius: "0.5rem",
                          }}
                        >
                          Open
                        </Link>
                        {activeTab === "my" && (
                          <button
                            className="btn"
                            onClick={() => handleDeleteDocument(doc.id)}
                            style={{
                              background: "rgba(244, 67, 54, 0.1)",
                              border: "1px solid rgba(244, 67, 54, 0.3)",
                              color: "#f44336",
                              fontWeight: "600",
                              borderRadius: "0.5rem",
                              padding: "0.5rem 1rem",
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create Document Modal */}
          {showCreateModal && (
            <>
              <div className="modal show d-block" tabIndex={-1}>
                <div className="modal-dialog modal-dialog-centered">
                  <div
                    className="modal-content border-0"
                    style={{
                      borderRadius: "1rem",
                      overflow: "hidden",
                      background: "rgba(255, 255, 255, 0.95)",
                    }}
                  >
                    <div
                      className="modal-header border-0 text-white"
                      style={{
                        background:
                          "linear-gradient(135deg, #2c3e50 0%, #34495e 100%)",
                      }}
                    >
                      <h5 className="modal-title fw-bold">
                        Create New Document
                      </h5>
                      <button
                        type="button"
                        className="btn-close btn-close-white"
                        onClick={() => setShowCreateModal(false)}
                      ></button>
                    </div>
                    <form onSubmit={handleCreateDocument}>
                      <div className="modal-body p-4">
                        <div className="mb-3">
                          <label
                            htmlFor="title"
                            className="form-label fw-semibold"
                            style={{ color: "#546e7a" }}
                          >
                            Document Title
                          </label>
                          <input
                            type="text"
                            className="form-control form-control-lg"
                            id="title"
                            placeholder="Enter a descriptive title..."
                            value={newDocTitle}
                            onChange={(e) => setNewDocTitle(e.target.value)}
                            required
                            maxLength={255}
                            autoFocus
                            style={{
                              borderRadius: "0.5rem",
                              borderColor: "#cfd8dc",
                              backgroundColor: "#fafafa",
                            }}
                          />
                        </div>
                      </div>
                      <div className="modal-footer border-0 p-4 pt-0">
                        <button
                          type="button"
                          className="btn btn-lg"
                          onClick={() => setShowCreateModal(false)}
                          style={{
                            background: "#eceff1",
                            border: "none",
                            color: "#546e7a",
                            fontWeight: "600",
                            borderRadius: "0.5rem",
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="btn btn-lg"
                          disabled={creating}
                          style={{
                            background:
                              "linear-gradient(135deg, #2c3e50 0%, #34495e 100%)",
                            border: "none",
                            color: "white",
                            fontWeight: "600",
                            borderRadius: "0.5rem",
                          }}
                        >
                          {creating ? "Creating..." : "Create"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
              <div className="modal-backdrop show"></div>
            </>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
