"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  documentsApi,
  Document,
  callAIFeature,
  type AIFeature,
} from "@/lib/api";
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

  // AI feature states
  const [showAIDropdown, setShowAIDropdown] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiFeature, setAIFeature] = useState<
    "grammar" | "improve" | "summarize" | "generate" | null
  >(null);
  const [selectedText, setSelectedText] = useState("");
  const [selectionRange, setSelectionRange] = useState<{
    from: number;
    to: number;
  } | null>(null);
  const [aiResult, setAIResult] = useState("");
  const [aiLoading, setAILoading] = useState(false);
  const [aiError, setAIError] = useState("");
  const [remainingAICalls, setRemainingAICalls] = useState<number | null>(null);
  const [showAITooltip, setShowAITooltip] = useState(false);

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

  // Track text selection for AI features
  const handleSelectionChange = () => {
    if (!editorRef.current) return;

    const view = editorRef.current.getView();
    if (!view) return;

    const { from, to } = view.state.selection;
    const text = view.state.doc.textBetween(from, to, " ");

    setSelectedText(text);
    setSelectionRange({ from, to });
  };

  const isValidSelection = () => {
    const length = selectedText.trim().length;
    return length >= 50 && length <= 2000;
  };

  const getAIFeatureTitle = (feature: AIFeature) => {
    switch (feature) {
      case "grammar":
        return "Grammar Check";
      case "improve":
        return "Improve Writing";
      case "summarize":
        return "Summarize";
      case "generate":
        return "Continue Writing";
      default:
        return "AI Feature";
    }
  };

  const handleAIFeature = async (feature: AIFeature) => {
    if (!isValidSelection()) {
      alert(
        "Please select between 50 and 2,000 characters to use AI features.",
      );
      return;
    }

    setAIFeature(feature);
    setShowAIDropdown(false);
    setShowAIModal(true);
    setAILoading(true);
    setAIError("");
    setAIResult("");

    try {
      const data = await callAIFeature(feature, selectedText.trim());
      setAIResult(data.result);
      setRemainingAICalls(data.remaining);
      setAILoading(false);
    } catch (err) {
      console.error("AI feature error:", err);
      setAIError(
        err instanceof Error
          ? err.message
          : "AI service is currently unavailable. Please try again.",
      );
      setAILoading(false);
    }
  };

  const acceptAIResult = () => {
    if (!editorRef.current || !selectionRange || !aiResult) return;

    const view = editorRef.current.getView();
    if (!view) return;

    // Replace selection with AI result
    const tr = view.state.tr.insertText(
      aiResult,
      selectionRange.from,
      selectionRange.to,
    );
    view.dispatch(tr);
    closeAIModal();
  };

  const closeAIModal = () => {
    setShowAIModal(false);
    setAIFeature(null);
    setAIResult("");
    setAIError("");
    setAILoading(false);
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <>
          <Navbar />
          <div
            className="container mt-5 text-center"
            style={{
              minHeight: "100vh",
              background:
                "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
            }}
          >
            <div className="spinner-border text-white" role="status">
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
          <div
            className="container mt-5"
            style={{
              minHeight: "100vh",
              background:
                "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
            }}
          >
            <div
              className="alert border-0"
              style={{
                backgroundColor: "rgba(244, 67, 54, 0.15)",
                color: "#f44336",
                borderRadius: "0.5rem",
                border: "1px solid rgba(244, 67, 54, 0.3)",
              }}
            >
              Document not found or you don't have access to it.
            </div>
            <Link
              href="/dashboard"
              className="btn"
              style={{
                background: "linear-gradient(135deg, #2c3e50 0%, #34495e 100%)",
                border: "none",
                color: "white",
                fontWeight: "600",
                borderRadius: "0.5rem",
                padding: "0.75rem 1.5rem",
              }}
            >
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

        <div
          className="container-fluid"
          style={{
            minHeight: "100vh",
            background:
              "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
            paddingTop: "1rem",
          }}
        >
          {/* Editor Header */}
          <div className="row mb-3">
            <div className="col-12">
              <div
                className="p-3 rounded"
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                }}
              >
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                  <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center gap-2 w-100 w-md-auto">
                    <div className="d-flex gap-2">
                      <Link
                        href="/dashboard"
                        className="btn btn-sm"
                        style={{
                          background: "rgba(255, 255, 255, 0.1)",
                          border: "1px solid rgba(255, 255, 255, 0.2)",
                          color: "white",
                          fontWeight: "500",
                        }}
                      >
                        ← Back
                      </Link>
                      {isOwner && (
                        <button
                          className="btn btn-sm"
                          onClick={() => {
                            setShowShareModal(true);
                            fetchSharedUsers();
                          }}
                          style={{
                            background: "rgba(255, 255, 255, 0.1)",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            color: "white",
                            fontWeight: "500",
                          }}
                        >
                          👥 Share
                        </button>
                      )}
                    </div>

                    <input
                      type="text"
                      className="form-control"
                      style={{
                        maxWidth: "100%",
                        minWidth: "200px",
                        background: "rgba(255, 255, 255, 0.95)",
                        border: "1px solid rgba(255, 255, 255, 0.3)",
                        color: "#2c3e50",
                        fontWeight: "600",
                      }}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Document title"
                      disabled={!isOwner}
                      title={
                        !isOwner ? "Only the owner can change the title" : ""
                      }
                    />
                  </div>

                  {/* AI Features Button */}
                  {hasEditPermission && (
                    <div
                      style={{ position: "relative", display: "inline-block" }}
                    >
                      <div
                        style={{ display: "inline-block" }}
                        onMouseEnter={() => setShowAITooltip(true)}
                        onMouseLeave={() => setShowAITooltip(false)}
                      >
                        <button
                          className="btn btn-sm"
                          onClick={() => setShowAIDropdown(!showAIDropdown)}
                          disabled={!isValidSelection()}
                          style={{
                            background: isValidSelection()
                              ? "linear-gradient(135deg, #2c3e50 0%, #34495e 100%)"
                              : "rgba(255, 255, 255, 0.1)",
                            border: "none",
                            color: "white",
                            fontWeight: "600",
                            pointerEvents: !isValidSelection()
                              ? "none"
                              : "auto",
                          }}
                        >
                          ✨ AI
                          {selectedText.trim().length > 0 &&
                            ` (${selectedText.trim().length})`}
                        </button>
                      </div>

                      {showAITooltip && (
                        <div
                          className="position-absolute text-white px-3 py-2 rounded small"
                          style={{
                            background: "#2c3e50",
                            top: "100%",
                            left: "50%",
                            transform: "translateX(-50%)",
                            marginTop: "8px",
                            zIndex: 1001,
                            whiteSpace: "nowrap",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                          }}
                        >
                          {!selectedText.trim()
                            ? "💡 Select 50-2,000 characters to use AI"
                            : selectedText.trim().length < 50
                              ? `Selection too short (${selectedText.trim().length} chars). Min: 50`
                              : selectedText.trim().length > 2000
                                ? `Selection too long (${selectedText.trim().length.toLocaleString()} chars). Max: 2,000`
                                : `${selectedText.trim().length} characters selected - Click for AI!`}

                          <div
                            style={{
                              position: "absolute",
                              top: "-4px",
                              left: "50%",
                              transform: "translateX(-50%)",
                              width: 0,
                              height: 0,
                              borderLeft: "5px solid transparent",
                              borderRight: "5px solid transparent",
                              borderBottom: "5px solid #2c3e50",
                            }}
                          />
                        </div>
                      )}

                      {/* AI Dropdown Menu */}
                      {showAIDropdown && isValidSelection() && (
                        <div
                          className="dropdown-menu show"
                          style={{
                            position: "absolute",
                            top: "100%",
                            right: 0,
                            marginTop: "4px",
                            zIndex: 1000,
                            background: "rgba(255, 255, 255, 0.98)",
                            border: "1px solid rgba(0,0,0,0.1)",
                            borderRadius: "0.5rem",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                          }}
                        >
                          <button
                            className="dropdown-item"
                            onClick={() => handleAIFeature("grammar")}
                            style={{ fontWeight: "500" }}
                          >
                            ✓ Grammar Check
                          </button>
                          <button
                            className="dropdown-item"
                            onClick={() => handleAIFeature("improve")}
                            style={{ fontWeight: "500" }}
                          >
                            ⚡ Improve Writing
                          </button>
                          <button
                            className="dropdown-item"
                            onClick={() => handleAIFeature("summarize")}
                            style={{ fontWeight: "500" }}
                          >
                            📝 Summarize
                          </button>
                          <button
                            className="dropdown-item"
                            onClick={() => handleAIFeature("generate")}
                            style={{ fontWeight: "500" }}
                          >
                            🔮 Continue Writing
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="d-flex flex-wrap align-items-center gap-2 gap-md-3">
                    <small className="text-white">
                      {characterCount.toLocaleString()} /{" "}
                      {maxCharacters.toLocaleString()} chars
                    </small>

                    {/* User Presence Indicators */}
                    {activeUsers.length > 0 && (
                      <div className="d-flex align-items-center gap-1 flex-wrap">
                        {activeUsers.map((user) => (
                          <div
                            key={user.connectionId}
                            className="badge small"
                            title={`@${user.username}`}
                            style={{
                              cursor: "pointer",
                              background: "rgba(255, 255, 255, 0.2)",
                              color: "white",
                              fontWeight: "500",
                            }}
                          >
                            {user.displayName}
                          </div>
                        ))}
                        <small className="text-white opacity-75 d-none d-sm-inline">
                          viewing
                        </small>
                      </div>
                    )}

                    {saving && (
                      <small className="text-white">
                        <span className="spinner-border spinner-border-sm me-1" />
                        <span className="d-none d-sm-inline">Saving...</span>
                      </small>
                    )}

                    {!saving && lastSaved && (
                      <small className="text-success">
                        ✓{" "}
                        <span className="d-none d-sm-inline">
                          Saved {lastSaved.toLocaleTimeString()}
                        </span>
                        <span className="d-inline d-sm-none">
                          {lastSaved.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </small>
                    )}
                  </div>
                </div>

                {error && (
                  <div
                    className="alert border-0 mt-2 mb-0"
                    style={{
                      backgroundColor: "rgba(244, 67, 54, 0.15)",
                      color: "#f44336",
                      border: "1px solid rgba(244, 67, 54, 0.3)",
                    }}
                  >
                    {error}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Editor Area */}
          <div className="row">
            <div className="col-12">
              <div
                style={{
                  position: "relative",
                  background: "white",
                  borderRadius: "0.75rem",
                  padding: "1.5rem",
                  minHeight: "600px",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                }}
              >
                <ProseMirrorEditor
                  ref={editorRef}
                  content={content}
                  onChange={(newContent) => {
                    isTypingRef.current = true;
                    setContent(newContent);
                    if (typingTimeoutRef.current) {
                      clearTimeout(typingTimeoutRef.current);
                    }
                    if (contentSyncTimeoutRef.current) {
                      clearTimeout(contentSyncTimeoutRef.current);
                    }

                    typingTimeoutRef.current = setTimeout(() => {
                      isTypingRef.current = false;
                    }, 500);

                    contentSyncTimeoutRef.current = setTimeout(() => {
                      documentHubService.sendContentChange(newContent, 0);
                    }, 500);
                  }}
                  onCursorChange={(position) => {
                    handleCursorChange(position);
                    handleSelectionChange();
                  }}
                  readOnly={!hasEditPermission}
                />

                {/* Render remote cursors */}
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

          {/* Share Modal */}
          {showShareModal && (
            <>
              <div className="modal show d-block" tabIndex={-1}>
                <div className="modal-dialog modal-lg modal-dialog-centered">
                  <div
                    className="modal-content border-0"
                    style={{
                      borderRadius: "1rem",
                      background: "rgba(255, 255, 255, 0.98)",
                    }}
                  >
                    <div
                      className="modal-header border-0 text-white"
                      style={{
                        background:
                          "linear-gradient(135deg, #2c3e50 0%, #34495e 100%)",
                        borderTopLeftRadius: "1rem",
                        borderTopRightRadius: "1rem",
                      }}
                    >
                      <h5 className="modal-title fw-bold">Share Document</h5>
                      <button
                        type="button"
                        className="btn-close btn-close-white"
                        onClick={() => {
                          setShowShareModal(false);
                          setShareError("");
                          setShareUsername("");
                        }}
                      ></button>
                    </div>
                    <div className="modal-body p-4">
                      {/* Share Form */}
                      <form onSubmit={handleShare} className="mb-4">
                        {shareError && (
                          <div
                            className="alert border-0 mb-3"
                            style={{
                              backgroundColor: "rgba(244, 67, 54, 0.1)",
                              color: "#f44336",
                              border: "1px solid rgba(244, 67, 54, 0.3)",
                            }}
                          >
                            {shareError}
                          </div>
                        )}

                        <div className="row">
                          <div className="col-md-6 mb-3">
                            <label
                              htmlFor="shareUsername"
                              className="form-label fw-semibold"
                              style={{ color: "#546e7a" }}
                            >
                              Username
                            </label>
                            <input
                              type="text"
                              className="form-control form-control-lg"
                              id="shareUsername"
                              value={shareUsername}
                              onChange={(e) => setShareUsername(e.target.value)}
                              placeholder="Enter username"
                              required
                              style={{
                                borderRadius: "0.5rem",
                                borderColor: "#cfd8dc",
                                backgroundColor: "#fafafa",
                              }}
                            />
                          </div>

                          <div className="col-md-4 mb-3">
                            <label
                              htmlFor="sharePermission"
                              className="form-label fw-semibold"
                              style={{ color: "#546e7a" }}
                            >
                              Permission
                            </label>
                            <select
                              className="form-select form-select-lg"
                              id="sharePermission"
                              value={sharePermission}
                              onChange={(e) =>
                                setSharePermission(e.target.value)
                              }
                              style={{
                                borderRadius: "0.5rem",
                                borderColor: "#cfd8dc",
                                backgroundColor: "#fafafa",
                              }}
                            >
                              <option value="Read">Read Only</option>
                              <option value="Edit">Can Edit</option>
                            </select>
                          </div>

                          <div className="col-md-2 mb-3">
                            <label className="form-label">&nbsp;</label>
                            <button
                              type="submit"
                              className="btn btn-lg w-100"
                              disabled={shareLoading}
                              style={{
                                background:
                                  "linear-gradient(135deg, #2c3e50 0%, #34495e 100%)",
                                border: "none",
                                color: "white",
                                fontWeight: "600",
                                borderRadius: "0.5rem",
                              }}
                            >
                              {shareLoading ? "Adding..." : "Add"}
                            </button>
                          </div>
                        </div>
                      </form>

                      <hr style={{ borderColor: "rgba(0,0,0,0.1)" }} />

                      {/* List of Shared Users */}
                      <div>
                        <h6
                          className="mb-3 fw-bold"
                          style={{ color: "#2c3e50" }}
                        >
                          People with access
                        </h6>

                        {sharedUsers.length === 0 ? (
                          <p className="text-muted small">
                            Not shared with anyone yet
                          </p>
                        ) : (
                          <div className="list-group">
                            {sharedUsers.map((user) => (
                              <div
                                key={user.userId}
                                className="list-group-item d-flex justify-content-between align-items-center border-0 mb-2"
                                style={{
                                  borderRadius: "0.5rem",
                                  backgroundColor: "#f8f9fa",
                                }}
                              >
                                <div>
                                  <div
                                    className="fw-bold"
                                    style={{ color: "#2c3e50" }}
                                  >
                                    {user.displayName}
                                  </div>
                                  <div className="text-muted small">
                                    @{user.username}
                                  </div>
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                  <span
                                    className="badge"
                                    style={{
                                      background:
                                        user.permission === "Edit"
                                          ? "rgba(76, 175, 80, 0.15)"
                                          : "rgba(158, 158, 158, 0.15)",
                                      color:
                                        user.permission === "Edit"
                                          ? "#4caf50"
                                          : "#9e9e9e",
                                      border:
                                        user.permission === "Edit"
                                          ? "1px solid rgba(76, 175, 80, 0.3)"
                                          : "1px solid rgba(158, 158, 158, 0.3)",
                                      fontWeight: "600",
                                      padding: "0.35rem 0.65rem",
                                    }}
                                  >
                                    {user.permission === "Edit"
                                      ? "Can Edit"
                                      : "Read Only"}
                                  </span>
                                  <button
                                    className="btn btn-sm"
                                    onClick={() =>
                                      handleRemoveShare(user.userId)
                                    }
                                    style={{
                                      background: "rgba(244, 67, 54, 0.1)",
                                      border:
                                        "1px solid rgba(244, 67, 54, 0.3)",
                                      color: "#f44336",
                                      fontWeight: "600",
                                      borderRadius: "0.5rem",
                                    }}
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
                    <div className="modal-footer border-0 p-4">
                      <button
                        type="button"
                        className="btn btn-lg"
                        onClick={() => {
                          setShowShareModal(false);
                          setShareError("");
                          setShareUsername("");
                        }}
                        style={{
                          background: "#eceff1",
                          border: "none",
                          color: "#546e7a",
                          fontWeight: "600",
                          borderRadius: "0.5rem",
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

          {/* AI Modal - Same styling as before */}
          {showAIModal && (
            <>
              <div className="modal show d-block" tabIndex={-1}>
                <div className="modal-dialog modal-lg modal-dialog-centered">
                  <div
                    className="modal-content border-0"
                    style={{
                      borderRadius: "1rem",
                      background: "rgba(255, 255, 255, 0.98)",
                    }}
                  >
                    <div
                      className="modal-header border-0 text-white"
                      style={{
                        background:
                          "linear-gradient(135deg, #2c3e50 0%, #34495e 100%)",
                        borderTopLeftRadius: "1rem",
                        borderTopRightRadius: "1rem",
                      }}
                    >
                      <h5 className="modal-title fw-bold">
                        {aiFeature && getAIFeatureTitle(aiFeature)}
                      </h5>
                      <button
                        type="button"
                        className="btn-close btn-close-white"
                        onClick={closeAIModal}
                      ></button>
                    </div>

                    <div className="modal-body p-4">
                      {aiLoading ? (
                        <div className="text-center py-5">
                          <div
                            className="spinner-border"
                            style={{ color: "#2c3e50" }}
                            role="status"
                          >
                            <span className="visually-hidden">Loading...</span>
                          </div>
                          <p className="mt-3" style={{ color: "#78909c" }}>
                            Processing with AI...
                          </p>
                        </div>
                      ) : aiError ? (
                        <div
                          className="alert border-0"
                          style={{
                            backgroundColor: "rgba(244, 67, 54, 0.1)",
                            color: "#f44336",
                            border: "1px solid rgba(244, 67, 54, 0.3)",
                          }}
                        >
                          <strong>Error:</strong> {aiError}
                        </div>
                      ) : (
                        <div className="row">
                          <div className="col-md-6">
                            <h6 className="mb-2" style={{ color: "#78909c" }}>
                              Original:
                            </h6>
                            <div
                              className="p-3 rounded"
                              style={{
                                minHeight: "200px",
                                maxHeight: "400px",
                                overflowY: "auto",
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                                backgroundColor: "#f8f9fa",
                                border: "1px solid #e0e0e0",
                              }}
                            >
                              {selectedText}
                            </div>
                          </div>

                          <div className="col-md-6">
                            <h6
                              className="mb-2"
                              style={{ color: "#2c3e50", fontWeight: "600" }}
                            >
                              AI Result:
                            </h6>
                            <div
                              className="p-3 rounded"
                              style={{
                                minHeight: "200px",
                                maxHeight: "400px",
                                overflowY: "auto",
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                                backgroundColor: "white",
                                border: "2px solid #2c3e50",
                              }}
                            >
                              {aiResult}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {!aiLoading && !aiError && (
                      <div className="modal-footer border-0 p-4 d-flex justify-content-between align-items-center">
                        <small style={{ color: "#78909c" }}>
                          ℹ️{" "}
                          {remainingAICalls !== null
                            ? `${remainingAICalls} of 5`
                            : "..."}{" "}
                          AI calls remaining today
                        </small>
                        <div>
                          <button
                            type="button"
                            className="btn me-2"
                            onClick={closeAIModal}
                            style={{
                              background: "#eceff1",
                              border: "none",
                              color: "#546e7a",
                              fontWeight: "600",
                              borderRadius: "0.5rem",
                            }}
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            className="btn"
                            onClick={acceptAIResult}
                            style={{
                              background:
                                "linear-gradient(135deg, #2c3e50 0%, #34495e 100%)",
                              border: "none",
                              color: "white",
                              fontWeight: "600",
                              borderRadius: "0.5rem",
                            }}
                          >
                            Accept Changes
                          </button>
                        </div>
                      </div>
                    )}

                    {(aiLoading || aiError) && (
                      <div className="modal-footer border-0 p-4">
                        <button
                          type="button"
                          className="btn"
                          onClick={closeAIModal}
                          style={{
                            background: "#eceff1",
                            border: "none",
                            color: "#546e7a",
                            fontWeight: "600",
                            borderRadius: "0.5rem",
                          }}
                        >
                          Close
                        </button>
                      </div>
                    )}
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
