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
      <div>
        <Navbar />

        <div className="container mt-4">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <ul className="nav nav-tabs">
                <li className="nav-item">
                  <button
                    className={`nav-link ${activeTab === "my" ? "active" : ""}`}
                    onClick={() => setActiveTab("my")}
                  >
                    My Documents ({documents.length})
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className={`nav-link ${activeTab === "shared" ? "active" : ""}`}
                    onClick={() => setActiveTab("shared")}
                  >
                    Shared with Me ({sharedDocuments.length})
                  </button>
                </li>
              </ul>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
              disabled={documents.length >= 5}
            >
              + New Document
            </button>
          </div>

          {documents.length >= 5 && (
            <div className="alert alert-warning" role="alert">
              You've reached the maximum of 5 documents. Delete a document to
              create a new one.
            </div>
          )}

          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : activeTab === "my" && documents.length === 0 ? (
            <div className="text-center py-5">
              <h3 className="text-muted">No documents yet</h3>
              <p className="text-muted">
                Create your first document to get started!
              </p>
            </div>
          ) : activeTab === "shared" && sharedDocuments.length === 0 ? (
            <div className="text-center py-5">
              <h3 className="text-muted">No shared documents</h3>
              <p className="text-muted">
                Documents shared with you will appear here.
              </p>
            </div>
          ) : (
            <div className="row">
              {(activeTab === "my" ? documents : sharedDocuments).map((doc) => (
                <div key={doc.id} className="col-md-4 mb-3">
                  <div className="card h-100">
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-start">
                        <h5 className="card-title">{doc.title}</h5>
                        {activeTab === "my" && (
                          <span
                            className="badge bg-info text-dark"
                            title="Shared with others"
                          >
                            👥
                          </span>
                        )}
                      </div>
                      {activeTab === "shared" && (
                        <p className="card-text text-muted small">
                          Owner: {doc.ownerDisplayName}
                        </p>
                      )}
                      <p className="card-text text-muted small">
                        {doc.characterCount} characters
                      </p>
                      <p className="card-text text-muted small">
                        Last updated:{" "}
                        {new Date(doc.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="card-footer bg-transparent">
                      <Link
                        href={`/editor/${doc.id}`}
                        className="btn btn-sm btn-primary me-2"
                      >
                        Open
                      </Link>
                      {activeTab === "my" && (
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDeleteDocument(doc.id)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create Document Modal */}
          {showCreateModal && (
            <div className="modal show d-block" tabIndex={-1}>
              <div className="modal-dialog">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">Create New Document</h5>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => setShowCreateModal(false)}
                    ></button>
                  </div>
                  <form onSubmit={handleCreateDocument}>
                    <div className="modal-body">
                      <div className="mb-3">
                        <label htmlFor="title" className="form-label">
                          Document Title
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          id="title"
                          value={newDocTitle}
                          onChange={(e) => setNewDocTitle(e.target.value)}
                          required
                          maxLength={255}
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="modal-footer">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setShowCreateModal(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={creating}
                      >
                        {creating ? "Creating..." : "Create"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
          {showCreateModal && <div className="modal-backdrop show"></div>}
        </div>
      </div>
    </ProtectedRoute>
  );
}
