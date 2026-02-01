import * as signalR from "@microsoft/signalr";

class DocumentHubService {
  private connection: signalR.HubConnection | null = null;
  private documentId: string | null = null;
  private connectPromise: Promise<void> | null = null;

  async connect(token: string): Promise<void> {
    // If already connecting, return existing promise
    if (this.connectPromise) {
      return this.connectPromise;
    }

    // If already connected, do nothing
    if (this.connection?.state === signalR.HubConnectionState.Connected) {
      return;
    }

    // Create new connection promise
    this.connectPromise = this._doConnect(token);

    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  private async _doConnect(token: string): Promise<void> {
    // Stop existing connection if any
    if (this.connection) {
      try {
        await this.connection.stop();
      } catch {}
      this.connection = null;
    }

    const HUB_URL = process.env.NEXT_PUBLIC_API_URL
      ? `${process.env.NEXT_PUBLIC_API_URL.replace("/api", "")}/hubs/document`
      : "http://localhost:5001/hubs/document";

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, {
        accessTokenFactory: () => token,
      })
      .configureLogging(signalR.LogLevel.Warning)
      .withAutomaticReconnect()
      .build();

    await this.connection.start();
  }

  async disconnect(): Promise<void> {
    const conn = this.connection;
    this.connection = null;
    this.documentId = null;

    if (conn && conn.state !== signalR.HubConnectionState.Disconnected) {
      try {
        await conn.stop();
      } catch {}
    }
  }

  async joinDocument(documentId: string): Promise<void> {
    if (
      !this.connection ||
      this.connection.state !== signalR.HubConnectionState.Connected
    ) {
      throw new Error("Not connected to SignalR");
    }

    this.documentId = documentId;
    await this.connection.invoke("JoinDocument", documentId);
  }

  async leaveDocument(documentId: string): Promise<void> {
    if (
      !this.connection ||
      this.connection.state !== signalR.HubConnectionState.Connected
    ) {
      return;
    }

    try {
      await this.connection.invoke("LeaveDocument", documentId);
      this.documentId = null;
    } catch {}
  }

  async sendContentChange(
    content: string,
    cursorPosition: number,
  ): Promise<void> {
    if (
      !this.connection ||
      !this.documentId ||
      this.connection.state !== signalR.HubConnectionState.Connected
    ) {
      return;
    }

    await this.connection.invoke(
      "SendContentChange",
      this.documentId,
      content,
      cursorPosition,
    );
  }

  async sendCursorPosition(
    documentId: string,
    position: number,
  ): Promise<void> {
    if (
      !this.connection ||
      this.connection.state !== signalR.HubConnectionState.Connected
    ) {
      return;
    }

    await this.connection.invoke("SendCursorPosition", documentId, position);
  }

  onUserJoined(callback: (data: any) => void): void {
    this.connection?.on("UserJoined", callback);
  }

  onUserLeft(callback: (data: any) => void): void {
    this.connection?.on("UserLeft", callback);
  }

  onCurrentUsers(callback: (users: any[]) => void): void {
    this.connection?.on("CurrentUsers", callback);
  }

  onReceiveContentChange(callback: (data: any) => void): void {
    this.connection?.on("ReceiveContentChange", callback);
  }

  onReceiveCursorPosition(callback: (data: any) => void): void {
    this.connection?.on("ReceiveCursorPosition", callback);
  }

  removeAllListeners(): void {
    this.connection?.off("UserJoined");
    this.connection?.off("UserLeft");
    this.connection?.off("CurrentUsers");
    this.connection?.off("ReceiveContentChange");
    this.connection?.off("ReceiveCursorPosition");
  }
}

export const documentHubService = new DocumentHubService();
