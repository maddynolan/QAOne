/**
 * WebSocketClient - Interactive WebSocket client for testing WS/WSS endpoints.
 * Uses browser-native WebSocket API — no backend needed.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { CodeEditor } from "./CodeEditor";
import {
  Plug, Unplug, Send, Trash2, ArrowUp, ArrowDown, Loader2, Copy,
} from "lucide-react";

interface WsMessage {
  id: string;
  direction: "sent" | "received";
  data: string;
  timestamp: Date;
  type: "text" | "binary";
  size: number;
}

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

/** Cap message history to prevent unbounded memory growth during long-running sessions. */
const MAX_WS_MESSAGES = 500;

export default function WebSocketClient() {
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const [url, setUrl] = useState("wss://echo.websocket.org");
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [messages, setMessages] = useState<WsMessage[]>([]);
  const [messageInput, setMessageInput] = useState('{"type": "ping"}');
  const [autoReconnect, setAutoReconnect] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    setStatus("connecting");
    setReconnectAttempts(0);

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("connected");
        setReconnectAttempts(0);
        setMessages(prev => [...prev, {
          id: `sys_${Date.now()}`,
          direction: "received",
          data: `Connected to ${url}`,
          timestamp: new Date(),
          type: "text",
          size: 0,
        }].slice(-MAX_WS_MESSAGES));
      };

      ws.onmessage = (event) => {
        const data = typeof event.data === "string" ? event.data : "[Binary Data]";
        setMessages(prev => [...prev, {
          id: `recv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          direction: "received",
          data,
          timestamp: new Date(),
          type: typeof event.data === "string" ? "text" : "binary",
          size: data.length,
        }].slice(-MAX_WS_MESSAGES));
      };

      ws.onerror = () => {
        setStatus("error");
      };

      ws.onclose = (event) => {
        setStatus("disconnected");
        setMessages(prev => [...prev, {
          id: `sys_${Date.now()}`,
          direction: "received",
          data: `Disconnected (code: ${event.code}${event.reason ? `, reason: ${event.reason}` : ""})`,
          timestamp: new Date(),
          type: "text",
          size: 0,
        }].slice(-MAX_WS_MESSAGES));

        // Auto-reconnect
        if (autoReconnect && event.code !== 1000) {
          setReconnectAttempts(prev => {
            const next = prev + 1;
            if (next <= 5) {
              const delay = Math.min(1000 * Math.pow(2, next - 1), 10000);
              reconnectTimerRef.current = setTimeout(() => connect(), delay);
            }
            return next;
          });
        }
      };
    } catch (err: any) {
      setStatus("error");
      toast({ title: "Connection failed", description: err.message, variant: "destructive" });
    }
  }, [url, autoReconnect, toast]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    setAutoReconnect(false);
    if (wsRef.current) {
      wsRef.current.close(1000, "User disconnected");
      wsRef.current = null;
    }
  }, []);

  const sendMessage = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      toast({ title: "Not connected", variant: "destructive" });
      return;
    }
    const msg = messageInput.trim();
    if (!msg) return;

    wsRef.current.send(msg);
    setMessages(prev => [...prev, {
      id: `sent_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      direction: "sent",
      data: msg,
      timestamp: new Date(),
      type: "text",
      size: msg.length,
    }].slice(-MAX_WS_MESSAGES));
  }, [messageInput, toast]);

  const statusColor: Record<ConnectionStatus, string> = {
    disconnected: "bg-gray-400",
    connecting: "bg-amber-500 animate-pulse",
    connected: "bg-green-500",
    error: "bg-red-500",
  };

  const statusLabel: Record<ConnectionStatus, string> = {
    disconnected: "Disconnected",
    connecting: "Connecting...",
    connected: "Connected",
    error: "Error",
  };

  return (
    <div className="space-y-4">
      {/* Connection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plug className="w-4 h-4" />
            WebSocket Client
            <div className={`w-2 h-2 rounded-full ${statusColor[status]}`} />
            <Badge variant={status === "connected" ? "default" : "secondary"} className="text-xs">
              {statusLabel[status]}
            </Badge>
          </CardTitle>
          <CardDescription>Test WebSocket endpoints with real-time message exchange</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="wss://echo.websocket.org"
              value={url}
              onChange={e => setUrl(e.target.value)}
              className="flex-1 font-mono text-sm"
              onKeyDown={e => { if (e.key === "Enter" && status === "disconnected") connect(); }}
              disabled={status === "connected" || status === "connecting"}
            />
            {status === "connected" ? (
              <Button variant="destructive" onClick={disconnect}>
                <Unplug className="w-4 h-4 mr-2" />
                Disconnect
              </Button>
            ) : (
              <Button onClick={connect} disabled={status === "connecting" || !url.trim()}>
                {status === "connecting" ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plug className="w-4 h-4 mr-2" />
                )}
                Connect
              </Button>
            )}
          </div>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input type="checkbox" checked={autoReconnect} onChange={e => setAutoReconnect(e.target.checked)} />
            Auto-reconnect on disconnect (max 5 attempts)
            {reconnectAttempts > 0 && status === "disconnected" && (
              <Badge variant="outline" className="text-[10px] h-4 ml-1">Attempt {reconnectAttempts}/5</Badge>
            )}
          </label>
        </CardContent>
      </Card>

      {/* Message Input */}
      {status === "connected" && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <CodeEditor
              value={messageInput}
              onChange={val => setMessageInput(val)}
              language="json"
              height="80px"
              placeholder='{"type": "ping", "data": "Hello!"}'
              onCtrlEnter={sendMessage}
            />
            <div className="flex justify-between items-center">
              <p className="text-[10px] text-muted-foreground">Ctrl+Enter to send</p>
              <Button onClick={sendMessage} disabled={!messageInput.trim()} size="sm">
                <Send className="w-4 h-4 mr-2" />
                Send Message
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Message Log */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Messages</CardTitle>
            <div className="flex gap-2 items-center">
              <Badge variant="outline" className="text-xs">{messages.length} messages</Badge>
              {messages.length > 0 && (
                <Button variant="ghost" size="sm" className="h-7" onClick={() => setMessages([])}>
                  <Trash2 className="w-3 h-3 mr-1" /> Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[350px]">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No messages yet. Connect to a WebSocket server and send a message.
              </p>
            ) : (
              <div className="space-y-1.5">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex gap-2 p-2 rounded-lg text-sm ${
                      msg.direction === "sent"
                        ? "bg-blue-500/10 border-l-2 border-blue-500"
                        : "bg-green-500/10 border-l-2 border-green-500"
                    }`}
                  >
                    {msg.direction === "sent" ? (
                      <ArrowUp className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                    ) : (
                      <ArrowDown className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <pre className="text-xs font-mono whitespace-pre-wrap break-all">{msg.data}</pre>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <span className="text-[10px] text-muted-foreground">
                        {msg.timestamp.toLocaleTimeString()}
                      </span>
                      {msg.size > 0 && (
                        <span className="text-[9px] text-muted-foreground">{msg.size}B</span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        onClick={() => {
                          navigator.clipboard.writeText(msg.data);
                          toast({ title: "Copied" });
                        }}
                      >
                        <Copy className="w-2.5 h-2.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
