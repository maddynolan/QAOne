"""
Protocol Recorder - Capture HTTP/Protocol traffic during browser sessions
This is the KEY differentiator from NeoLoad/LoadRunner

Captures:
- All HTTP/HTTPS requests with full headers, body, timing
- WebSocket connections and messages
- GraphQL queries/mutations
- Auto-detects correlatable values (tokens, session IDs, CSRF)
- Generates performance test scripts from recordings
"""

import asyncio
import logging
import json
import re
import time
from typing import Dict, List, Any, Optional, Set
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import hashlib

logger = logging.getLogger(__name__)


class RequestType(Enum):
    """Types of recorded requests"""
    HTTP = "http"
    WEBSOCKET = "websocket"
    GRAPHQL = "graphql"
    XHR = "xhr"
    FETCH = "fetch"
    DOCUMENT = "document"
    STYLESHEET = "stylesheet"
    SCRIPT = "script"
    IMAGE = "image"
    FONT = "font"
    OTHER = "other"


@dataclass
class RecordedRequest:
    """A single recorded HTTP request"""
    request_id: str
    timestamp: float
    method: str
    url: str
    headers: Dict[str, str]
    body: Optional[str] = None
    query_params: Dict[str, str] = field(default_factory=dict)
    
    # Response data
    status_code: int = 0
    response_headers: Dict[str, str] = field(default_factory=dict)
    response_body: Optional[str] = None
    response_size: int = 0
    
    # Timing
    duration_ms: float = 0
    ttfb_ms: float = 0  # Time to first byte
    dns_ms: float = 0
    connect_ms: float = 0
    ssl_ms: float = 0
    
    # Classification
    request_type: RequestType = RequestType.HTTP
    initiator: str = ""  # What triggered this request
    
    # Correlation markers
    detected_correlations: List[Dict[str, Any]] = field(default_factory=list)
    dynamic_values: Dict[str, str] = field(default_factory=dict)


@dataclass
class RecordedWebSocket:
    """A WebSocket connection recording"""
    ws_id: str
    url: str
    timestamp: float
    messages: List[Dict[str, Any]] = field(default_factory=list)  # {direction, data, timestamp}
    closed: bool = False


@dataclass
class ProtocolRecording:
    """Complete protocol recording session"""
    recording_id: str
    name: str
    start_time: float
    end_time: Optional[float] = None
    base_url: str = ""
    
    requests: List[RecordedRequest] = field(default_factory=list)
    websockets: List[RecordedWebSocket] = field(default_factory=list)
    
    # Auto-detected patterns
    correlation_rules: List[Dict[str, Any]] = field(default_factory=list)
    detected_tokens: Dict[str, str] = field(default_factory=dict)
    
    # User actions (from browser)
    user_actions: List[Dict[str, Any]] = field(default_factory=list)
    
    # Statistics
    total_requests: int = 0
    total_bytes: int = 0
    avg_response_time: float = 0


class ProtocolRecorder:
    """
    Main Protocol Recording Engine
    
    Features:
    - Captures HTTP/HTTPS traffic with timing
    - Auto-detects correlatable values
    - Links requests to user actions
    - Generates performance test scripts
    """
    
    # Known correlation patterns
    CORRELATION_PATTERNS = [
        # Session/Auth tokens
        {"name": "session_id", "patterns": [
            r'"session[_-]?id"\s*:\s*"([^"]+)"',
            r'sessionid=([^&;]+)',
            r'PHPSESSID=([^&;]+)',
            r'JSESSIONID=([^&;]+)',
            r'ASP\.NET_SessionId=([^&;]+)',
        ]},
        {"name": "auth_token", "patterns": [
            r'"(?:access_)?token"\s*:\s*"([^"]+)"',
            r'"bearer"\s*:\s*"([^"]+)"',
            r'Authorization:\s*Bearer\s+([^\s]+)',
            r'"jwt"\s*:\s*"([^"]+)"',
        ]},
        {"name": "csrf_token", "patterns": [
            r'"csrf[_-]?token"\s*:\s*"([^"]+)"',
            r'_csrf=([^&;]+)',
            r'X-CSRF-TOKEN:\s*([^\s]+)',
            r'name="csrf"\s+value="([^"]+)"',
            r'name="_token"\s+value="([^"]+)"',
        ]},
        {"name": "request_id", "patterns": [
            r'"request[_-]?id"\s*:\s*"([^"]+)"',
            r'X-Request-ID:\s*([^\s]+)',
            r'"trace[_-]?id"\s*:\s*"([^"]+)"',
        ]},
        {"name": "user_id", "patterns": [
            r'"user[_-]?id"\s*:\s*"([^"]+)"',
            r'"userId"\s*:\s*(\d+)',
            r'"uid"\s*:\s*"([^"]+)"',
        ]},
        {"name": "nonce", "patterns": [
            r'"nonce"\s*:\s*"([^"]+)"',
            r'nonce=([^&;]+)',
        ]},
        {"name": "timestamp", "patterns": [
            r'"timestamp"\s*:\s*(\d{10,13})',
            r'_t=(\d{10,13})',
            r'timestamp=(\d{10,13})',
        ]},
    ]
    
    # Content types to ignore for body capture
    IGNORE_CONTENT_TYPES = {
        'image/', 'font/', 'audio/', 'video/',
        'application/octet-stream', 'application/pdf'
    }
    
    def __init__(self):
        self.recordings: Dict[str, ProtocolRecording] = {}
        self.active_recording_id: Optional[str] = None
        
    async def start_recording(
        self,
        recording_id: str,
        name: str = "Protocol Recording",
        base_url: str = ""
    ) -> str:
        """Start a new protocol recording session"""
        recording = ProtocolRecording(
            recording_id=recording_id,
            name=name,
            start_time=time.time(),
            base_url=base_url
        )
        
        self.recordings[recording_id] = recording
        self.active_recording_id = recording_id
        
        logger.info(f"Started protocol recording: {recording_id}")
        return recording_id
    
    async def stop_recording(self, recording_id: str) -> ProtocolRecording:
        """Stop recording and finalize"""
        if recording_id not in self.recordings:
            raise ValueError(f"Recording {recording_id} not found")
        
        recording = self.recordings[recording_id]
        recording.end_time = time.time()
        
        # Calculate statistics
        recording.total_requests = len(recording.requests)
        recording.total_bytes = sum(r.response_size for r in recording.requests)
        
        if recording.requests:
            recording.avg_response_time = sum(r.duration_ms for r in recording.requests) / len(recording.requests)
        
        # Auto-detect correlations
        await self._detect_correlations(recording)
        
        if self.active_recording_id == recording_id:
            self.active_recording_id = None
        
        logger.info(f"Stopped protocol recording: {recording_id} ({recording.total_requests} requests)")
        return recording
    
    async def record_request(
        self,
        recording_id: str,
        request_data: Dict[str, Any]
    ) -> str:
        """Record an HTTP request"""
        if recording_id not in self.recordings:
            raise ValueError(f"Recording {recording_id} not found")
        
        recording = self.recordings[recording_id]
        
        # Generate request ID
        request_id = f"req_{len(recording.requests)}_{int(time.time() * 1000)}"
        
        # Parse URL and query params
        url = request_data.get("url", "")
        query_params = {}
        if "?" in url:
            base_url, query_string = url.split("?", 1)
            for param in query_string.split("&"):
                if "=" in param:
                    key, value = param.split("=", 1)
                    query_params[key] = value
        
        # Classify request type
        request_type = self._classify_request(request_data)
        
        # Create recorded request
        recorded = RecordedRequest(
            request_id=request_id,
            timestamp=time.time(),
            method=request_data.get("method", "GET").upper(),
            url=url,
            headers=request_data.get("headers", {}),
            body=request_data.get("body"),
            query_params=query_params,
            status_code=request_data.get("status_code", 0),
            response_headers=request_data.get("response_headers", {}),
            response_body=self._capture_response_body(request_data),
            response_size=request_data.get("response_size", 0),
            duration_ms=request_data.get("duration_ms", 0),
            ttfb_ms=request_data.get("ttfb_ms", 0),
            dns_ms=request_data.get("dns_ms", 0),
            connect_ms=request_data.get("connect_ms", 0),
            ssl_ms=request_data.get("ssl_ms", 0),
            request_type=request_type,
            initiator=request_data.get("initiator", "")
        )
        
        # Detect dynamic values in this request
        self._detect_request_dynamics(recorded, recording)
        
        recording.requests.append(recorded)
        
        return request_id
    
    async def record_websocket_message(
        self,
        recording_id: str,
        ws_url: str,
        message: str,
        direction: str = "sent"  # sent or received
    ):
        """Record a WebSocket message"""
        if recording_id not in self.recordings:
            return
        
        recording = self.recordings[recording_id]
        
        # Find or create WebSocket recording
        ws_recording = None
        for ws in recording.websockets:
            if ws.url == ws_url and not ws.closed:
                ws_recording = ws
                break
        
        if not ws_recording:
            ws_recording = RecordedWebSocket(
                ws_id=f"ws_{len(recording.websockets)}",
                url=ws_url,
                timestamp=time.time()
            )
            recording.websockets.append(ws_recording)
        
        ws_recording.messages.append({
            "direction": direction,
            "data": message,
            "timestamp": time.time()
        })
    
    async def link_user_action(
        self,
        recording_id: str,
        action: Dict[str, Any]
    ):
        """Link a user action to the recording"""
        if recording_id not in self.recordings:
            return
        
        recording = self.recordings[recording_id]
        recording.user_actions.append({
            **action,
            "timestamp": time.time()
        })
    
    def _classify_request(self, request_data: Dict[str, Any]) -> RequestType:
        """Classify the type of request"""
        url = request_data.get("url", "").lower()
        content_type = request_data.get("content_type", "")
        initiator = request_data.get("initiator", "").lower()
        
        # Check GraphQL
        if "graphql" in url or request_data.get("is_graphql"):
            return RequestType.GRAPHQL
        
        # Check XHR/Fetch
        if initiator in ["xmlhttprequest", "fetch"]:
            return RequestType.XHR if initiator == "xmlhttprequest" else RequestType.FETCH
        
        # Check by content type
        if "text/html" in content_type:
            return RequestType.DOCUMENT
        if "text/css" in content_type:
            return RequestType.STYLESHEET
        if "javascript" in content_type:
            return RequestType.SCRIPT
        if content_type.startswith("image/"):
            return RequestType.IMAGE
        if "font" in content_type:
            return RequestType.FONT
        
        return RequestType.HTTP
    
    def _capture_response_body(self, request_data: Dict[str, Any]) -> Optional[str]:
        """Capture response body if appropriate"""
        content_type = request_data.get("content_type", "")
        
        # Skip binary content
        for ignore_type in self.IGNORE_CONTENT_TYPES:
            if ignore_type in content_type:
                return None
        
        response_body = request_data.get("response_body")
        
        # Limit body size
        if response_body and len(str(response_body)) > 1_000_000:  # 1MB limit
            return None
        
        return response_body
    
    def _detect_request_dynamics(
        self,
        request: RecordedRequest,
        recording: ProtocolRecording
    ):
        """Detect dynamic values in request/response"""
        # Check request body and URL for patterns
        search_text = json.dumps({
            "url": request.url,
            "body": request.body or "",
            "headers": request.headers,
            "response_body": request.response_body or "",
            "response_headers": request.response_headers
        })
        
        for pattern_group in self.CORRELATION_PATTERNS:
            name = pattern_group["name"]
            for pattern in pattern_group["patterns"]:
                matches = re.findall(pattern, search_text, re.IGNORECASE)
                for match in matches:
                    if match and len(match) > 5:  # Skip very short matches
                        request.detected_correlations.append({
                            "name": name,
                            "value": match,
                            "pattern": pattern
                        })
                        request.dynamic_values[name] = match
    
    async def _detect_correlations(self, recording: ProtocolRecording):
        """Detect correlation patterns across all requests"""
        # Find values that appear in responses and then in subsequent requests
        seen_values: Dict[str, int] = {}  # value -> first seen index
        
        for i, request in enumerate(recording.requests):
            # Check if any previously seen values appear in this request
            request_text = json.dumps({
                "url": request.url,
                "body": request.body or "",
                "headers": request.headers
            })
            
            for value, first_index in list(seen_values.items()):
                if value in request_text and i > first_index:
                    # This value appears after it was first seen - needs correlation
                    recording.correlation_rules.append({
                        "variable_name": f"corr_{hashlib.md5(value.encode()).hexdigest()[:8]}",
                        "value": value,
                        "source_request": first_index,
                        "used_in_request": i,
                        "extract_type": "auto"
                    })
            
            # Extract potential dynamic values from response
            if request.response_body:
                for pattern_group in self.CORRELATION_PATTERNS:
                    for pattern in pattern_group["patterns"]:
                        matches = re.findall(pattern, request.response_body, re.IGNORECASE)
                        for match in matches:
                            if match and len(match) > 5 and match not in seen_values:
                                seen_values[match] = i
    
    def get_recording(self, recording_id: str) -> Optional[ProtocolRecording]:
        """Get a recording by ID"""
        return self.recordings.get(recording_id)
    
    async def generate_load_script(
        self,
        recording_id: str,
        format: str = "qaai"  # qaai, k6, jmeter, gatling
    ) -> Dict[str, Any]:
        """Generate load test script from recording"""
        if recording_id not in self.recordings:
            raise ValueError(f"Recording {recording_id} not found")
        
        recording = self.recordings[recording_id]
        
        if format == "qaai":
            return self._generate_qaai_script(recording)
        elif format == "k6":
            return self._generate_k6_script(recording)
        elif format == "jmeter":
            return self._generate_jmeter_script(recording)
        else:
            raise ValueError(f"Unsupported format: {format}")
    
    def _generate_qaai_script(self, recording: ProtocolRecording) -> Dict[str, Any]:
        """Generate QAAI performance test scenario"""
        steps = []
        
        # Filter to only API/document requests (skip static assets)
        meaningful_requests = [
            r for r in recording.requests
            if r.request_type in [RequestType.HTTP, RequestType.XHR, RequestType.FETCH, 
                                  RequestType.GRAPHQL, RequestType.DOCUMENT]
        ]
        
        for i, request in enumerate(meaningful_requests):
            step = {
                "step_id": f"step_{i}",
                "name": f"{request.method} {self._shorten_url(request.url)}",
                "action_type": "http_request",
                "parameters": {
                    "method": request.method,
                    "url": request.url,
                    "headers": self._sanitize_headers(request.headers),
                    "body": request.body
                }
            }
            
            # Add correlation extraction if needed
            if request.detected_correlations:
                step["correlation_rules"] = [
                    {
                        "variable_name": corr["name"],
                        "extract_type": "auto",
                        "pattern": corr["pattern"]
                    }
                    for corr in request.detected_correlations
                ]
            
            steps.append(step)
            
            # Add think time between requests
            if i < len(meaningful_requests) - 1:
                next_request = meaningful_requests[i + 1]
                delay = int((next_request.timestamp - request.timestamp) * 1000)
                if delay > 100 and delay < 30000:  # Between 100ms and 30s
                    steps.append({
                        "step_id": f"think_{i}",
                        "name": "Think Time",
                        "action_type": "delay",
                        "parameters": {"delay_ms": min(delay, 5000)}
                    })
        
        return {
            "scenario_id": recording.recording_id,
            "name": recording.name,
            "description": f"Generated from protocol recording on {datetime.fromtimestamp(recording.start_time).isoformat()}",
            "steps": steps,
            "correlation_rules": recording.correlation_rules,
            "statistics": {
                "total_requests": recording.total_requests,
                "meaningful_requests": len(meaningful_requests),
                "total_bytes": recording.total_bytes,
                "avg_response_time": recording.avg_response_time,
                "duration_seconds": (recording.end_time or time.time()) - recording.start_time
            }
        }
    
    def _generate_k6_script(self, recording: ProtocolRecording) -> Dict[str, Any]:
        """Generate k6 JavaScript script"""
        lines = [
            "import http from 'k6/http';",
            "import { check, sleep } from 'k6';",
            "",
            "export const options = {",
            "  vus: 10,",
            "  duration: '5m',",
            "};",
            "",
            "export default function () {",
        ]
        
        meaningful_requests = [
            r for r in recording.requests
            if r.request_type in [RequestType.HTTP, RequestType.XHR, RequestType.FETCH, RequestType.GRAPHQL]
        ]
        
        for i, request in enumerate(meaningful_requests):
            # Add request
            if request.method == "GET":
                lines.append(f"  let res{i} = http.get('{request.url}');")
            else:
                body = json.dumps(request.body) if request.body else "''"
                lines.append(f"  let res{i} = http.{request.method.lower()}('{request.url}', {body});")
            
            # Add check
            lines.append(f"  check(res{i}, {{ 'status 200': (r) => r.status === 200 }});")
            
            # Add sleep
            lines.append("  sleep(1);")
            lines.append("")
        
        lines.append("}")
        
        return {
            "format": "k6",
            "script": "\n".join(lines),
            "filename": f"{recording.name.replace(' ', '_').lower()}.js"
        }
    
    def _generate_jmeter_script(self, recording: ProtocolRecording) -> Dict[str, Any]:
        """Generate JMeter JMX format (simplified XML structure)"""
        # This is a simplified version - full JMX is complex XML
        return {
            "format": "jmeter",
            "test_plan": {
                "name": recording.name,
                "thread_group": {
                    "num_threads": 10,
                    "ramp_time": 60,
                    "duration": 300
                },
                "http_samplers": [
                    {
                        "name": f"{r.method} {self._shorten_url(r.url)}",
                        "method": r.method,
                        "path": r.url,
                        "body": r.body
                    }
                    for r in recording.requests
                    if r.request_type in [RequestType.HTTP, RequestType.XHR, RequestType.FETCH]
                ]
            }
        }
    
    def _shorten_url(self, url: str) -> str:
        """Shorten URL for display"""
        # Remove query params and truncate path
        if "?" in url:
            url = url.split("?")[0]
        
        # Get path only
        if "://" in url:
            parts = url.split("/", 3)
            if len(parts) > 3:
                return "/" + parts[3][:50]
        
        return url[:50]
    
    def _sanitize_headers(self, headers: Dict[str, str]) -> Dict[str, str]:
        """Remove sensitive headers for script generation"""
        sensitive = {"cookie", "authorization", "x-csrf-token", "x-api-key"}
        return {
            k: v for k, v in headers.items()
            if k.lower() not in sensitive
        }
    
    async def export_har(self, recording_id: str) -> Dict[str, Any]:
        """Export recording as HAR (HTTP Archive) format"""
        if recording_id not in self.recordings:
            raise ValueError(f"Recording {recording_id} not found")
        
        recording = self.recordings[recording_id]
        
        entries = []
        for request in recording.requests:
            entry = {
                "startedDateTime": datetime.fromtimestamp(request.timestamp).isoformat() + "Z",
                "time": request.duration_ms,
                "request": {
                    "method": request.method,
                    "url": request.url,
                    "httpVersion": "HTTP/1.1",
                    "headers": [{"name": k, "value": v} for k, v in request.headers.items()],
                    "queryString": [{"name": k, "value": v} for k, v in request.query_params.items()],
                    "postData": {
                        "mimeType": request.headers.get("Content-Type", ""),
                        "text": request.body or ""
                    } if request.body else None,
                    "headersSize": -1,
                    "bodySize": len(request.body) if request.body else 0
                },
                "response": {
                    "status": request.status_code,
                    "statusText": "",
                    "httpVersion": "HTTP/1.1",
                    "headers": [{"name": k, "value": v} for k, v in request.response_headers.items()],
                    "content": {
                        "size": request.response_size,
                        "mimeType": request.response_headers.get("Content-Type", ""),
                        "text": request.response_body or ""
                    },
                    "headersSize": -1,
                    "bodySize": request.response_size
                },
                "timings": {
                    "dns": request.dns_ms,
                    "connect": request.connect_ms,
                    "ssl": request.ssl_ms,
                    "send": 0,
                    "wait": request.ttfb_ms,
                    "receive": request.duration_ms - request.ttfb_ms
                }
            }
            entries.append(entry)
        
        return {
            "log": {
                "version": "1.2",
                "creator": {
                    "name": "QAAI Protocol Recorder",
                    "version": "1.0"
                },
                "pages": [{
                    "startedDateTime": datetime.fromtimestamp(recording.start_time).isoformat() + "Z",
                    "id": recording.recording_id,
                    "title": recording.name
                }],
                "entries": entries
            }
        }
    
    async def import_har(self, har_data: Dict[str, Any], name: str = "HAR Import") -> str:
        """Import recording from HAR file - handles multiple HAR formats"""
        import uuid
        
        recording_id = str(uuid.uuid4())
        
        log = har_data.get("log", {})
        entries = log.get("entries", [])
        
        recording = ProtocolRecording(
            recording_id=recording_id,
            name=name,
            start_time=time.time()
        )
        
        def parse_headers(headers_data):
            """Parse headers from various formats"""
            if not headers_data:
                return {}
            # If it's already a dict, return it
            if isinstance(headers_data, dict):
                return headers_data
            # If it's a list of {name, value} objects (standard HAR format)
            if isinstance(headers_data, list):
                result = {}
                for h in headers_data:
                    if isinstance(h, dict) and "name" in h:
                        result[h["name"]] = h.get("value", "")
                    elif isinstance(h, dict):
                        # Try other common formats
                        for k, v in h.items():
                            result[k] = str(v) if v else ""
                return result
            return {}
        
        for i, entry in enumerate(entries):
            try:
                request_data = entry.get("request", {})
                response_data = entry.get("response", {})
                timings = entry.get("timings", {})
                
                # Handle postData which might be string or object
                body = None
                post_data = request_data.get("postData")
                if post_data:
                    if isinstance(post_data, str):
                        body = post_data
                    elif isinstance(post_data, dict):
                        body = post_data.get("text")
                
                recorded = RecordedRequest(
                    request_id=f"har_{i}",
                    timestamp=time.time(),
                    method=request_data.get("method", "GET"),
                    url=request_data.get("url", ""),
                    headers=parse_headers(request_data.get("headers")),
                    body=body,
                    status_code=response_data.get("status", 0),
                    response_headers=parse_headers(response_data.get("headers")),
                    response_body=response_data.get("content", {}).get("text") if isinstance(response_data.get("content"), dict) else None,
                    response_size=response_data.get("content", {}).get("size", 0) if isinstance(response_data.get("content"), dict) else 0,
                    duration_ms=entry.get("time", 0) or 0,
                    ttfb_ms=timings.get("wait", 0) or 0,
                    dns_ms=timings.get("dns", 0) or 0,
                    connect_ms=timings.get("connect", 0) or 0,
                    ssl_ms=timings.get("ssl", 0) or 0
                )
                
                recording.requests.append(recorded)
            except Exception as e:
                logger.warning(f"Failed to parse HAR entry {i}: {e}")
                continue
        
        recording.end_time = time.time()
        recording.total_requests = len(recording.requests)
        
        # Detect correlations (with error handling)
        try:
            await self._detect_correlations(recording)
        except Exception as e:
            logger.warning(f"Correlation detection failed: {e}")
        
        self.recordings[recording_id] = recording
        
        logger.info(f"Imported HAR file as recording: {recording_id} ({len(recording.requests)} requests)")
        return recording_id


# Global instance
protocol_recorder = ProtocolRecorder()
