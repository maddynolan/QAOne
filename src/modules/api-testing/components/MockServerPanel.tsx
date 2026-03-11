/**
 * MockServerPanel - Create mock API servers, add endpoints, view request logs.
 * Backend: /api/v2/testing/mock/server, /mock/server/{id}/endpoint, /mock/server/{id}/logs
 */

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { CodeEditor, ResponseCodeViewer } from "./CodeEditor";
import {
  Plus, Play, Square, Trash2, Loader2, Server, Globe,
  Copy, RefreshCw, Clock, ArrowDownToLine,
} from "lucide-react";
import { API_BASE_URL } from "./constants";

interface MockServer {
  server_id: string;
  name: string;
  host: string;
  port: number;
  base_url: string;
  status: "created" | "running" | "stopped";
  request_count: number;
}

interface MockEndpoint {
  endpoint_id: string;
  path: string;
  method: string;
  response_status: number;
  response_body: any;
  response_delay_ms?: number;
}

interface MockLog {
  request_id: string;
  timestamp: string;
  method: string;
  path: string;
  body: any;
  response_status: number;
  response_time_ms: number;
}

export default function MockServerPanel() {
  const { toast } = useToast();
  const [servers, setServers] = useState<MockServer[]>([]);
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [endpoints, setEndpoints] = useState<MockEndpoint[]>([]);
  const [logs, setLogs] = useState<MockLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("endpoints");

  // New server form
  const [newServerName, setNewServerName] = useState("Mock API Server");
  const [newServerPort, setNewServerPort] = useState("");

  // New endpoint form
  const [newEpPath, setNewEpPath] = useState("/api/example");
  const [newEpMethod, setNewEpMethod] = useState("GET");
  const [newEpStatus, setNewEpStatus] = useState("200");
  const [newEpBody, setNewEpBody] = useState('{\n  "message": "Hello from mock!"\n}');
  const [newEpDelay, setNewEpDelay] = useState("");

  const activeServer = servers.find(s => s.server_id === activeServerId);

  // Load servers
  const loadServers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v2/testing/mock/server`);
      if (!res.ok) return;
      const data = await res.json();
      setServers(data.servers || []);
    } catch { /* backend may not be running */ }
  }, []);

  useEffect(() => { loadServers(); }, [loadServers]);

  // Load endpoints for active server
  const loadEndpoints = useCallback(async (serverId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v2/testing/mock/server/${serverId}`);
      if (!res.ok) return;
      const data = await res.json();
      setEndpoints(data.endpoints || []);
    } catch (err) {
      console.warn('[MockServer] Failed to load endpoints:', err);
    }
  }, []);

  // Load logs for active server
  const loadLogs = useCallback(async (serverId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v2/testing/mock/server/${serverId}/logs`);
      if (!res.ok) return;
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.warn('[MockServer] Failed to load logs:', err);
    }
  }, []);

  useEffect(() => {
    if (activeServerId) {
      loadEndpoints(activeServerId);
      loadLogs(activeServerId);
    }
  }, [activeServerId, loadEndpoints, loadLogs]);

  // Create server
  const createServer = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v2/testing/mock/server`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newServerName,
          port: newServerPort ? parseInt(newServerPort) : 0,
        }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.statusText}`);
      const data = await res.json();
      toast({ title: "Server created", description: `${data.server?.name || newServerName} ready` });
      await loadServers();
      setActiveServerId(data.server_id || data.server?.server_id);
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [newServerName, newServerPort, toast, loadServers]);

  // Start/Stop server
  const toggleServer = useCallback(async (serverId: string, action: "start" | "stop") => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v2/testing/mock/server/${serverId}/${action}`, { method: "POST" });
      if (!res.ok) throw new Error(`Failed: ${res.statusText}`);
      const data = await res.json();
      toast({ title: action === "start" ? "Server started" : "Server stopped", description: data.base_url || data.message });
      await loadServers();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  }, [toast, loadServers]);

  // Delete server
  const deleteServer = useCallback(async (serverId: string) => {
    if (!window.confirm("Delete this mock server?")) return;
    try {
      await fetch(`${API_BASE_URL}/api/v2/testing/mock/server/${serverId}`, { method: "DELETE" });
      if (activeServerId === serverId) setActiveServerId(null);
      await loadServers();
      toast({ title: "Deleted" });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  }, [activeServerId, toast, loadServers]);

  // Add endpoint
  const addEndpoint = useCallback(async () => {
    if (!activeServerId) return;
    setLoading(true);
    try {
      let responseBody: any = newEpBody;
      try { responseBody = JSON.parse(newEpBody); } catch { /* keep as string */ }

      const res = await fetch(`${API_BASE_URL}/api/v2/testing/mock/server/${activeServerId}/endpoint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint_id: `ep_${Date.now()}`,
          path: newEpPath,
          method: newEpMethod,
          response_status: parseInt(newEpStatus),
          response_body: responseBody,
          response_delay_ms: newEpDelay ? parseInt(newEpDelay) : undefined,
        }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.statusText}`);
      toast({ title: "Endpoint added", description: `${newEpMethod} ${newEpPath}` });
      await loadEndpoints(activeServerId);
      setNewEpPath("/api/example");
      setNewEpBody('{\n  "message": "Hello from mock!"\n}');
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [activeServerId, newEpPath, newEpMethod, newEpStatus, newEpBody, newEpDelay, toast, loadEndpoints]);

  // Delete endpoint
  const deleteEndpoint = useCallback(async (endpointId: string) => {
    if (!activeServerId) return;
    try {
      await fetch(`${API_BASE_URL}/api/v2/testing/mock/server/${activeServerId}/endpoint/${endpointId}`, { method: "DELETE" });
      await loadEndpoints(activeServerId);
    } catch (err: any) {
      toast({ title: "Failed to delete endpoint", description: err.message, variant: "destructive" });
    }
  }, [activeServerId, loadEndpoints, toast]);

  const methodColor = (m: string) => {
    const colors: Record<string, string> = { GET: "text-green-600", POST: "text-blue-600", PUT: "text-amber-600", PATCH: "text-orange-600", DELETE: "text-red-600" };
    return colors[m] || "text-gray-600";
  };

  return (
    <div className="space-y-4">
      {/* Server List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="w-4 h-4" />
            Mock Servers
          </CardTitle>
          <CardDescription>Create HTTP mock servers to simulate API responses</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Create new server */}
          <div className="flex gap-2">
            <Input
              placeholder="Server name"
              value={newServerName}
              onChange={e => setNewServerName(e.target.value)}
              className="flex-1 text-sm"
            />
            <Input
              placeholder="Port (auto)"
              value={newServerPort}
              onChange={e => setNewServerPort(e.target.value)}
              className="w-24 text-sm"
              type="number"
            />
            <Button onClick={createServer} disabled={loading || !newServerName.trim()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
              Create
            </Button>
          </div>

          {/* Server list */}
          {servers.length > 0 && (
            <div className="space-y-2">
              {servers.map(srv => (
                <div
                  key={srv.server_id}
                  className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${activeServerId === srv.server_id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                  onClick={() => setActiveServerId(srv.server_id)}
                >
                  <div className={`w-2 h-2 rounded-full ${srv.status === "running" ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{srv.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{srv.base_url || `Port: ${srv.port || "auto"}`}</p>
                  </div>
                  <Badge variant={srv.status === "running" ? "default" : "secondary"} className="text-xs">
                    {srv.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{srv.request_count} reqs</span>
                  <div className="flex gap-1">
                    {srv.status !== "running" ? (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={e => { e.stopPropagation(); toggleServer(srv.server_id, "start"); }}>
                        <Play className="w-3.5 h-3.5 text-green-600" />
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={e => { e.stopPropagation(); toggleServer(srv.server_id, "stop"); }}>
                        <Square className="w-3.5 h-3.5 text-red-600" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={e => { e.stopPropagation(); deleteServer(srv.server_id); }}>
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {servers.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No mock servers. Create one above to get started.</p>
          )}
        </CardContent>
      </Card>

      {/* Active Server Details */}
      {activeServer && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {activeServer.name}
              {activeServer.status === "running" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={() => {
                    navigator.clipboard.writeText(activeServer.base_url);
                    toast({ title: "Copied", description: activeServer.base_url });
                  }}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  <span className="text-xs font-mono">{activeServer.base_url}</span>
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="h-8">
                <TabsTrigger value="endpoints" className="text-xs h-7">Endpoints</TabsTrigger>
                <TabsTrigger value="add" className="text-xs h-7">Add Endpoint</TabsTrigger>
                <TabsTrigger value="logs" className="text-xs h-7">
                  Request Log
                  {logs.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">{logs.length}</Badge>}
                </TabsTrigger>
              </TabsList>

              {/* Endpoints list */}
              <TabsContent value="endpoints" className="mt-2">
                {endpoints.length > 0 ? (
                  <ScrollArea className="h-[250px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20 text-xs">Method</TableHead>
                          <TableHead className="text-xs">Path</TableHead>
                          <TableHead className="w-16 text-xs">Status</TableHead>
                          <TableHead className="w-16 text-xs">Delay</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {endpoints.map(ep => (
                          <TableRow key={ep.endpoint_id}>
                            <TableCell className={`text-xs font-bold ${methodColor(ep.method)}`}>{ep.method}</TableCell>
                            <TableCell className="text-xs font-mono">{ep.path}</TableCell>
                            <TableCell className="text-xs">{ep.response_status}</TableCell>
                            <TableCell className="text-xs">{ep.response_delay_ms ? `${ep.response_delay_ms}ms` : "—"}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => deleteEndpoint(ep.endpoint_id)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">No endpoints. Add one from the "Add Endpoint" tab.</p>
                )}
              </TabsContent>

              {/* Add endpoint form */}
              <TabsContent value="add" className="mt-2 space-y-3">
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <Label className="text-xs">Method</Label>
                    <Select value={newEpMethod} onValueChange={setNewEpMethod}>
                      <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Path</Label>
                    <Input value={newEpPath} onChange={e => setNewEpPath(e.target.value)} className="h-8 text-xs font-mono mt-1" placeholder="/api/users/{id}" />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">Status</Label>
                      <Input value={newEpStatus} onChange={e => setNewEpStatus(e.target.value)} className="h-8 text-xs mt-1" type="number" />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs">Delay (ms)</Label>
                      <Input value={newEpDelay} onChange={e => setNewEpDelay(e.target.value)} className="h-8 text-xs mt-1" type="number" placeholder="0" />
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Response Body</Label>
                  <CodeEditor
                    value={newEpBody}
                    onChange={val => setNewEpBody(val)}
                    language="json"
                    height="120px"
                    placeholder='{"message": "Hello from mock!"}'
                  />
                </div>
                <Button onClick={addEndpoint} disabled={loading || !newEpPath.trim()} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Endpoint
                </Button>
              </TabsContent>

              {/* Request logs */}
              <TabsContent value="logs" className="mt-2">
                <div className="flex justify-end mb-2">
                  <Button variant="outline" size="sm" onClick={() => loadLogs(activeServerId!)}>
                    <RefreshCw className="w-3 h-3 mr-1" /> Refresh
                  </Button>
                </div>
                {logs.length > 0 ? (
                  <ScrollArea className="h-[250px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20 text-xs">Time</TableHead>
                          <TableHead className="w-16 text-xs">Method</TableHead>
                          <TableHead className="text-xs">Path</TableHead>
                          <TableHead className="w-16 text-xs">Status</TableHead>
                          <TableHead className="w-16 text-xs">Latency</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.map(log => (
                          <TableRow key={log.request_id}>
                            <TableCell className="text-[10px] text-muted-foreground">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </TableCell>
                            <TableCell className={`text-xs font-bold ${methodColor(log.method)}`}>{log.method}</TableCell>
                            <TableCell className="text-xs font-mono">{log.path}</TableCell>
                            <TableCell className="text-xs">{log.response_status}</TableCell>
                            <TableCell className="text-xs">{log.response_time_ms?.toFixed(0)}ms</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">No requests logged yet. Start the server and send requests to it.</p>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
