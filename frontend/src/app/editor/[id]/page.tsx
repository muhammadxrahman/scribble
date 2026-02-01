"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { documentsApi, Document } from "@/lib/api";
import { documentHubService } from "@/lib/signalr";
import ProtectedRoute from "@/components/ProtectedRoute";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { ProseMirrorEditorRef } from "@/components/ProseMirrorEditor";
import RemoteCursor from "@/components/RemoteCursor";
import { getUserColor } from "@/lib/colors";

// Dynamic import to avoid SSR issues with ProseMirror
const ProseMirrorEditor = dynamic(
  () => import("@/components/ProseMirrorEditor"),
  {
    ssr: false,
    loading: () => <div className="text-center py-5">Loading editor...</div>,
  },
);

export default function EditorPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.id as string;
  const signalRConnected = useRef(false);

  const editorRef = useRef<ProseMirrorEditorRef>(null);
  const contentSyncTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const [remoteCursors, setRemoteCursors] = useState<{
    [userId: string]: {
      position: number;
      username: string;
      displayName: string;
      color: string;
    };
  }>({});

  const [isOwner, setIsOwner] = useState(false);
  const [document, setDocument] = useState<Document | null>(null);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [characterCount, setCharacterCount] = useState(0);

  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUsername, setShareUsername] = useState("");
  const [sharePermission, setSharePermission] = useState("Edit");
  const [shareError, setShareError] = useState("");
  const [shareLoading, setShareLoading] = useState(false);

  const [hasEditPermission, setHasEditPermission] = useState(true);
  const [sharedUsers, setSharedUsers] = useState<
    Array<{
      userId: string;
      username: string;
      displayName: string;
      email: string;
      permission: string;
      sharedAt: string;
    }>
  >([]);
  const [activeUsers, setActiveUsers] = useState<
    Array<{
      userId: string;
      displayName: string;
      username: string;
      connectionId: string;
    }>
  >([]);

  const maxCharacters = 50000;

  // Throttle cursor updates to avoid spamming
  const lastCursorSendRef = useRef<number>(0);
  const handleCursorChange = useCallback(
    (position: number) => {
      const now = Date.now();
      if (now - lastCursorSendRef.current < 200) return; // Throttle to 200ms

      lastCursorSendRef.current = now;
      documentHubService.sendCursorPosition(documentId, position);
    },
    [documentId],
  );

  // Load document
  useEffect(() => {
    if (documentId) {
      loadDocument();
    }
  }, [documentId]);

  const loadDocument = async () => {
    try {
      const [doc, permissionData] = await Promise.all([
        documentsApi.getById(documentId),
        documentsApi.getPermission(documentId),
      ]);
      setDocument(doc);
      setTitle(doc.title);

      // Check if current user is owner
      const userIsOwner = permissionData.permission === "Owner";
      setIsOwner(userIsOwner);

      // Set edit permission based on Owner or Edit permission
      const canEdit =
        permissionData.permission === "Owner" ||
        permissionData.permission === "Edit";
      setHasEditPermission(canEdit);

      // Parse JSON content or use empty string
      try {
        const parsed = JSON.parse(doc.content);
        setContent(parsed.text || "");
      } catch {
        setContent("");
      }

      setCharacterCount(doc.characterCount);
    } catch (err: any) {
      console.error("Error loading document:", err);
      console.error("Error response:", err.response?.data);
      console.error("Status:", err.response?.status);
      setError("Failed to load document");
    } finally {
      setLoading(false);
    }
  };

  // Connect to SignalR when component mounts
  useEffect(() => {
    // Skip if already connected
    if (signalRConnected.current) return;

    const token = localStorage.getItem("token");
    if (!token || !documentId) return;

    const connectAndJoin = async () => {
      try {
        signalRConnected.current = true;

        await documentHubService.connect(token);
        await documentHubService.joinDocument(documentId);
      } catch (error) {
        signalRConnected.current = false;
      }
    };

    connectAndJoin();

    // Cleanup
    return () => {
      // Clear any pending content sync
      if (contentSyncTimeoutRef.current) {
        clearTimeout(contentSyncTimeoutRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      signalRConnected.current = false;
      documentHubService.leaveDocument(documentId).catch(() => {});
      documentHubService.disconnect().catch(() => {});
    };
  }, [documentId]);

  // Listen for real-time changes from other users
  useEffect(() => {
    if (!signalRConnected.current) return;

    const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
    const currentUserId = currentUser.userId;

    // When another user changes content
    documentHubService.onReceiveContentChange((data) => {
      // Don't interrupt if user is actively typing
      if (isTypingRef.current) {
        console.log("⏸️ Skipping update - user is typing");
        return;
      }
      setContent(data.content);
      // Update ProseMirror editor
      editorRef.current?.updateContent(data.content);
    });

    // When another user moves their cursor
    documentHubService.onReceiveCursorPosition((data) => {
      setRemoteCursors((prev) => ({
        ...prev,
        [data.userId]: {
          position: data.position,
          username: data.username,
          displayName: data.displayName,
          color: getUserColor(data.userId),
        },
      }));
    });

    // When another user joins
    documentHubService.onUserJoined((data) => {
      if (data.userId === currentUserId) return;
      setActiveUsers((prev) => {
        // Don't add if already in list
        if (prev.some((u) => u.connectionId === data.connectionId)) {
          return prev;
        }
        return [
          ...prev,
          {
            userId: data.userId,
            displayName: data.displayName,
            username: data.username || data.displayName,
            connectionId: data.connectionId,
          },
        ];
      });
    });

    // When another user leaves
    documentHubService.onUserLeft((data) => {
      setActiveUsers((prev) =>
        prev.filter((u) => u.connectionId !== data.connectionId),
      );
      // Remove their cursor
      setRemoteCursors((prev) => {
        const updated = { ...prev };
        delete updated[data.userId];
        return updated;
      });
    });

    // Get current users already in the document (when you first join)
    documentHubService.onCurrentUsers((users) => {
      // Filter out yourself
      const otherUsers = users.filter((u: any) => u.userId !== currentUserId);
      setActiveUsers(
        otherUsers.map((u: any) => ({
          userId: u.userId,
          displayName: u.displayName,
          username: u.username || u.displayName,
          connectionId: u.connectionId,
        })),
      );
    });

    // Cleanup listeners
    return () => {
      documentHubService.removeAllListeners();
    };
  }, [signalRConnected.current]);

  // Auto-save function
  const saveDocument = useCallback(async () => {
    if (!document) return;

    setSaving(true);
    try {
      // Store as simple JSON with text field
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

  // Auto-save on content change (debounced) - but DON'T auto-save if we just received a change
  useEffect(() => {
    if (!document) return;

    const timeoutId = setTimeout(() => {
      saveDocument();
    }, 5000); // Increased to 5 seconds to reduce conflicts

    return () => clearTimeout(timeoutId);
  }, [content, title, saveDocument, document]);

  // Update character count
  useEffect(() => {
    setCharacterCount(content.length);
  }, [content]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    if (newContent.length <= maxCharacters) {
      setContent(newContent);
      setError("");

      // Send change to other users via SignalR
      const cursorPosition = e.target.selectionStart;
      documentHubService.sendContentChange(newContent, cursorPosition);
    } else {
      setError(`Character limit reached (${maxCharacters} max)`);
    }
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    setShareError("");
    setShareLoading(true);

    try {
      await documentsApi.shareDocument(
        documentId,
        shareUsername,
        sharePermission,
      );
      setShareUsername("");
      await fetchSharedUsers(); // refresh list
      setShareError("");
    } catch (err: any) {
      setShareError(err.response?.data?.message || "Failed to share document");
    } finally {
      setShareLoading(false);
    }
  };

  const fetchSharedUsers = async () => {
    try {
      const users = await documentsApi.getShares(documentId);
      setSharedUsers(users);
    } catch (err) {
      console.error("Failed to fetch shared users:", err);
    }
  };

  const handleRemoveShare = async (userId: string) => {
    if (!confirm("Remove access for this user?")) {
      return;
    }

    try {
      await documentsApi.removeShare(documentId, userId);
      await fetchSharedUsers(); // Refresh the list
    } catch (err) {
      setShareError("Failed to remove access");
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <>
          <Navbar />
          <div className="container mt-5 text-center">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </>
      </ProtectedRoute>
    );
  }

  if (!document) {
    return (
      <ProtectedRoute>
        <>
          <Navbar />
          <div className="container mt-5">
            <div className="alert alert-danger">
              Document not found or you don't have access to it.
            </div>
            <Link href="/dashboard" className="btn btn-primary">
              Back to Dashboard
            </Link>
          </div>
        </>
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
                  {isOwner && (
                    <button
                      className="btn btn-outline-primary"
                      onClick={() => {
                        setShowShareModal(true);
                        fetchSharedUsers();
                      }}
                    >
                      👥 Share
                    </button>
                  )}
                  <input
                    type="text"
                    className="form-control"
                    style={{ width: "300px" }}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Document title"
                    disabled={!isOwner}
                    title={
                      !isOwner ? "Only the owner can change the title" : ""
                    }
                  />
                </div>

                <div className="d-flex align-items-center gap-3">
                  <small className="text-white">
                    {characterCount.toLocaleString()} /{" "}
                    {maxCharacters.toLocaleString()} characters
                  </small>

                  {/* User Presence Indicators */}
                  {activeUsers.length > 0 && (
                    <div className="d-flex align-items-center gap-2">
                      <small className="text-muted">•</small>
                      {activeUsers.map((user) => (
                        <div
                          key={user.connectionId}
                          className="badge bg-secondary"
                          title={`@${user.username}`}
                          style={{ cursor: "pointer" }}
                        >
                          {user.displayName}
                        </div>
                      ))}
                      <small className="text-muted">viewing</small>
                    </div>
                  )}

                  {saving && (
                    <small className="text-white">
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
              <div style={{ position: "relative" }}>
                <ProseMirrorEditor
                  ref={editorRef}
                  content={content}
                  onChange={(newContent) => {
                    // Mark as typing
                    isTypingRef.current = true;
                    setContent(newContent);
                    // Clear existing timeouts
                    if (typingTimeoutRef.current) {
                      clearTimeout(typingTimeoutRef.current);
                    }
                    if (contentSyncTimeoutRef.current) {
                      clearTimeout(contentSyncTimeoutRef.current);
                    }

                    // After 500ms of no typing, mark as not typing and sync
                    typingTimeoutRef.current = setTimeout(() => {
                      isTypingRef.current = false;
                    }, 500);

                    contentSyncTimeoutRef.current = setTimeout(() => {
                      documentHubService.sendContentChange(newContent, 0);
                    }, 500);
                  }}
                  onCursorChange={handleCursorChange}
                  readOnly={!hasEditPermission}
                />

                {/* Render remote cursors - positioned absolutely within this container */}
                {Object.entries(remoteCursors).map(([userId, cursor]) => (
                  <RemoteCursor
                    key={userId}
                    position={cursor.position}
                    username={cursor.displayName}
                    color={cursor.color}
                    editorView={editorRef.current?.getView() || null}
                  />
                ))}
              </div>
            </div>
          </div>

          {showShareModal && (
            <>
              <div className="modal show d-block" tabIndex={-1}>
                <div className="modal-dialog modal-lg">
                  <div className="modal-content">
                    <div className="modal-header">
                      <h5 className="modal-title">Share Document</h5>
                      <button
                        type="button"
                        className="btn-close"
                        onClick={() => {
                          setShowShareModal(false);
                          setShareError("");
                          setShareUsername("");
                        }}
                      ></button>
                    </div>
                    <div className="modal-body">
                      {/* Share Form */}
                      <form onSubmit={handleShare} className="mb-4">
                        {shareError && (
                          <div className="alert alert-danger" role="alert">
                            {shareError}
                          </div>
                        )}

                        <div className="row">
                          <div className="col-md-6 mb-3">
                            <label
                              htmlFor="shareUsername"
                              className="form-label"
                            >
                              Username
                            </label>
                            <input
                              type="text"
                              className="form-control"
                              id="shareUsername"
                              value={shareUsername}
                              onChange={(e) => setShareUsername(e.target.value)}
                              placeholder="Enter username"
                              required
                            />
                          </div>

                          <div className="col-md-4 mb-3">
                            <label
                              htmlFor="sharePermission"
                              className="form-label"
                            >
                              Permission
                            </label>
                            <select
                              className="form-select"
                              id="sharePermission"
                              value={sharePermission}
                              onChange={(e) =>
                                setSharePermission(e.target.value)
                              }
                            >
                              <option value="Read">Read Only</option>
                              <option value="Edit">Can Edit</option>
                            </select>
                          </div>

                          <div className="col-md-2 mb-3">
                            <label className="form-label">&nbsp;</label>
                            <button
                              type="submit"
                              className="btn btn-primary w-100"
                              disabled={shareLoading}
                            >
                              {shareLoading ? "Adding..." : "Add"}
                            </button>
                          </div>
                        </div>
                      </form>

                      <hr />

                      {/* List of Shared Users */}
                      <div>
                        <h6 className="mb-3">People with access</h6>

                        {sharedUsers.length === 0 ? (
                          <p className="text-muted small">
                            Not shared with anyone yet
                          </p>
                        ) : (
                          <div className="list-group">
                            {sharedUsers.map((user) => (
                              <div
                                key={user.userId}
                                className="list-group-item d-flex justify-content-between align-items-center"
                              >
                                <div>
                                  <div className="fw-bold">
                                    {user.displayName}
                                  </div>
                                  <div className="text-muted small">
                                    @{user.username}
                                  </div>
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                  <span
                                    className={`badge ${user.permission === "Edit" ? "bg-success" : "bg-secondary"}`}
                                  >
                                    {user.permission === "Edit"
                                      ? "Can Edit"
                                      : "Read Only"}
                                  </span>
                                  <button
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() =>
                                      handleRemoveShare(user.userId)
                                    }
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="modal-footer">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setShowShareModal(false);
                          setShareError("");
                          setShareUsername("");
                        }}
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-backdrop show"></div>
            </>
          )}
        </div>
      </>
    </ProtectedRoute>
  );
}
