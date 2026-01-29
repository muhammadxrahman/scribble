'use client';

import { useState } from 'react';
import { documentHubService } from '@/lib/signalr';

export default function TestSignalRPage() {
  const [status, setStatus] = useState('Not connected');
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testConnect = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        addLog('❌ No token found - please login first');
        return;
      }

      addLog('🔄 Connecting to SignalR...');
      await documentHubService.connect(token);
      setStatus('✅ Connected');
      addLog('✅ Connected successfully');
    } catch (error: any) {
      setStatus('❌ Connection failed');
      addLog(`❌ Error: ${error.message}`);
    }
  };

  const testJoinDocument = async () => {
    try {
      const testDocId = 'test-doc-123';
      addLog(`🔄 Joining document: ${testDocId}`);
      await documentHubService.joinDocument(testDocId);
      addLog('✅ Joined document');
    } catch (error: any) {
      addLog(`❌ Error: ${error.message}`);
    }
  };

  const testDisconnect = async () => {
    try {
      addLog('🔄 Disconnecting...');
      await documentHubService.disconnect();
      setStatus('Disconnected');
      addLog('✅ Disconnected');
    } catch (error: any) {
      addLog(`❌ Error: ${error.message}`);
    }
  };

  return (
    <div className="container mt-5">
      <h1>SignalR Test Page</h1>
      
      <div className="alert alert-info mb-4">
        Status: <strong>{status}</strong>
      </div>

      <div className="btn-group mb-4" role="group">
        <button className="btn btn-primary" onClick={testConnect}>
          Connect
        </button>
        <button className="btn btn-success" onClick={testJoinDocument}>
          Join Test Document
        </button>
        <button className="btn btn-danger" onClick={testDisconnect}>
          Disconnect
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <h5>Logs</h5>
        </div>
        <div className="card-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {logs.length === 0 ? (
            <p className="text-muted">No logs yet. Click "Connect" to start.</p>
          ) : (
            <ul className="list-unstyled">
              {logs.map((log, index) => (
                <li key={index} className="font-monospace small">
                  {log}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="alert alert-warning mt-4">
        <strong>Note:</strong> Make sure you're logged in first! The token is required for SignalR authentication.
      </div>
    </div>
  );
}