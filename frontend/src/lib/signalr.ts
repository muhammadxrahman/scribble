import * as signalR from '@microsoft/signalr';

class DocumentHubService {
  private connection: signalR.HubConnection | null = null;
  private documentId: string | null = null;

  async connect(token: string): Promise<void> {
  if (this.connection) {
    await this.disconnect();
  }

  this.connection = new signalR.HubConnectionBuilder()
    .withUrl('http://localhost:5001/hubs/document', {
      accessTokenFactory: () => token,
      skipNegotiation: false, // Allow negotiation
      transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.ServerSentEvents | signalR.HttpTransportType.LongPolling
    })
    .configureLogging(signalR.LogLevel.Information)
    .withAutomaticReconnect()
    .build();

  // Add connection handlers
  this.connection.onclose((error) => {
    console.log('SignalR connection closed:', error);
  });

  this.connection.onreconnecting((error) => {
    console.log('SignalR reconnecting:', error);
  });

  this.connection.onreconnected((connectionId) => {
    console.log('SignalR reconnected:', connectionId);
  });

  await this.connection.start();
  console.log('SignalR connected successfully');
}

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
      this.documentId = null;
      console.log('SignalR disconnected');
    }
  }

  async joinDocument(documentId: string): Promise<void> {
    if (!this.connection) {
      throw new Error('Not connected to SignalR');
    }

    this.documentId = documentId;
    await this.connection.invoke('JoinDocument', documentId);
    console.log('Joined document:', documentId);
  }

  async leaveDocument(documentId: string): Promise<void> {
    if (!this.connection) return;

    await this.connection.invoke('LeaveDocument', documentId);
    this.documentId = null;
    console.log('Left document:', documentId);
  }

  async sendContentChange(content: string, cursorPosition: number): Promise<void> {
    if (!this.connection || !this.documentId) return;

    await this.connection.invoke('SendContentChange', this.documentId, content, cursorPosition);
  }

  async sendCursorPosition(position: number): Promise<void> {
    if (!this.connection || !this.documentId) return;

    await this.connection.invoke('SendCursorPosition', this.documentId, position);
  }

  onUserJoined(callback: (data: any) => void): void {
    this.connection?.on('UserJoined', callback);
  }

  onUserLeft(callback: (data: any) => void): void {
    this.connection?.on('UserLeft', callback);
  }

  onCurrentUsers(callback: (users: any[]) => void): void {
    this.connection?.on('CurrentUsers', callback);
  }

  onReceiveContentChange(callback: (data: any) => void): void {
    this.connection?.on('ReceiveContentChange', callback);
  }

  onReceiveCursorPosition(callback: (data: any) => void): void {
    this.connection?.on('ReceiveCursorPosition', callback);
  }

  removeAllListeners(): void {
    this.connection?.off('UserJoined');
    this.connection?.off('UserLeft');
    this.connection?.off('CurrentUsers');
    this.connection?.off('ReceiveContentChange');
    this.connection?.off('ReceiveCursorPosition');
  }
}

export const documentHubService = new DocumentHubService();