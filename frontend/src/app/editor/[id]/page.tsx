"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { documentsApi, Document } from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";
import Navbar from "@/components/Navbar";
import Link from "next/link";

export default function EditorPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.id as string;

  const [document, setDocument] = useState<Document | null>(null);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [characterCount, setCharacterCount] = useState(0);

  const maxCharacters = 50000;

  // load doc
  useEffect(() => {
    loadDocument();
  }, [documentId]);

  const loadDocument = async () => {
    try {
      const doc = await documentsApi.getById(documentId);
      setDocument(doc);
      setTitle(doc.title);

      // parse JSON content or use empty string
      try {
        const parsed = JSON.parse(doc.content);
        setContent(parsed.text || "");
      } catch {
        setContent("");
      }

      setCharacterCount(doc.characterCount);
    } catch (err: any) {
      setError("Failed to load document");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // auto save
  const saveDocument = useCallback(async () => {
    if (!document) return;

    setSaving(true);
    try {
      // store as simple JSON with text field
      const jsonContent = JSON.stringify({ text: content });

      await documentsApi.update(documentId, {
        title,
        content: jsonContent,
      });

      setLastSaved(new Date());
      setError("");
    } catch (err: any) {
      if (err.response?.status === 400) {
        setError("Character limit exceeded (50,000 max)");
      } else {
        setError("Failed to save document");
      }
    } finally {
      setSaving(false);
    }
  }, [documentId, title, content, document]);

  // auto-save on content change (debounced)
  useEffect(() => {
    if (!document) return;

    const timeoutId = setTimeout(() => {
      saveDocument();
    }, 2000); // save 2 seconds after user stops typing

    return () => clearTimeout(timeoutId);
  }, [content, title, saveDocument]);

  // update character count
  useEffect(() => {
    setCharacterCount(content.length);
  }, [content]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    if (newContent.length <= maxCharacters) {
      setContent(newContent);
      setError("");
    } else {
      setError(`Character limit reached (${maxCharacters} max)`);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <Navbar />
        <div className="container mt-5 text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!document) {
    return (
      <ProtectedRoute>
        <Navbar />
        <div className="container mt-5">
          <div className="alert alert-danger">
            Document not found or you don't have access to it.
          </div>
          <Link href="/dashboard" className="btn btn-primary">
            Back to Dashboard
          </Link>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <>
        <Navbar />

        <div className="container-fluid mt-3">
          {/* Editor Header */}
          <div className="row mb-3">
            <div className="col-12">
              <div className="d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center gap-3">
                  <Link href="/dashboard" className="btn btn-outline-secondary">
                    ← Back
                  </Link>
                  <input
                    type="text"
                    className="form-control"
                    style={{ width: "300px" }}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Document title"
                  />
                </div>

                <div className="d-flex align-items-center gap-3">
                  <small className="text-muted">
                    {characterCount.toLocaleString()} /{" "}
                    {maxCharacters.toLocaleString()} characters
                  </small>

                  {saving && (
                    <small className="text-muted">
                      <span className="spinner-border spinner-border-sm me-1" />
                      Saving...
                    </small>
                  )}

                  {!saving && lastSaved && (
                    <small className="text-success">
                      ✓ Saved {lastSaved.toLocaleTimeString()}
                    </small>
                  )}
                </div>
              </div>

              {error && (
                <div className="alert alert-danger mt-2 mb-0">{error}</div>
              )}
            </div>
          </div>

          {/* Editor Area */}
          <div className="row">
            <div className="col-12">
              <textarea
                className="form-control"
                style={{
                  minHeight: "70vh",
                  fontSize: "16px",
                  fontFamily: "monospace",
                  resize: "vertical",
                }}
                value={content}
                onChange={handleContentChange}
                placeholder="Start writing..."
              />
            </div>
          </div>
        </div>
      </>
    </ProtectedRoute>
  );
}
