"""
Live Browser Stream Manager

Captures Playwright page screenshots at ~8 FPS and broadcasts binary JPEG
frames to connected WebSocket viewers.  This gives Flowpilot users a
real-time browser view while the AI agent navigates.

Architecture:
  - Each AI testing session registers a Playwright page via register_session()
  - The capture loop runs as an asyncio.Task, calling page.screenshot() at
    the configured FPS
  - JPEG frames are broadcast as raw bytes over WebSocket (no base64)
  - Hash-based dedup skips identical consecutive frames
  - PIL resizes frames to max 1280px width to save bandwidth

Safety guards:
  - MAX_SESSIONS = 3  (prevents runaway resource use)
  - MAX_VIEWERS_PER_SESSION = 5
  - MAX_STREAM_DURATION_SECS = 600  (auto-stop after 10 min)

@version 1.0.0
"""

import asyncio
import hashlib
import io
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ── Safety Limits ──────────────────────────────────────────────────────────
MAX_SESSIONS = 3
MAX_VIEWERS_PER_SESSION = 5
MAX_STREAM_DURATION_SECS = 600  # 10 minutes


@dataclass
class StreamSession:
    """State for a single streaming session."""
    session_id: str
    page: Any = None               # Playwright Page object
    viewers: List[Any] = field(default_factory=list)  # WebSocket connections
    capture_task: Optional[asyncio.Task] = None
    fps: int = 8
    quality: int = 65
    is_streaming: bool = False
    frame_count: int = 0
    start_time: float = 0.0
    last_frame_hash: str = ""


class LiveBrowserStreamManager:
    """
    Singleton manager for live browser streaming sessions.

    Usage:
        await manager.register_session(session_id, playwright_page)
        await manager.start_streaming(session_id)
        ...
        await manager.stop_streaming(session_id)
        await manager.unregister_session(session_id)
    """

    def __init__(self):
        self._sessions: Dict[str, StreamSession] = {}

    # ── Session Lifecycle ──────────────────────────────────────────────────

    async def register_session(self, session_id: str, page: Any) -> bool:
        """Register a Playwright page for streaming."""
        if len(self._sessions) >= MAX_SESSIONS:
            logger.warning(
                f"[LiveStream] Cannot register session {session_id}: "
                f"max sessions ({MAX_SESSIONS}) reached"
            )
            return False

        self._sessions[session_id] = StreamSession(
            session_id=session_id,
            page=page,
        )
        logger.info(f"[LiveStream] Session registered: {session_id}")
        return True

    async def unregister_session(self, session_id: str) -> None:
        """Remove a session and clean up resources."""
        session = self._sessions.pop(session_id, None)
        if not session:
            return

        # Stop capture loop if running
        if session.capture_task and not session.capture_task.done():
            session.capture_task.cancel()
            try:
                await session.capture_task
            except (asyncio.CancelledError, Exception):
                pass

        # Close viewer connections
        for ws in list(session.viewers):
            try:
                await ws.close()
            except Exception:
                pass

        logger.info(
            f"[LiveStream] Session unregistered: {session_id} "
            f"(sent {session.frame_count} frames)"
        )

    # ── Viewer Management ──────────────────────────────────────────────────

    async def connect_viewer(self, session_id: str, websocket: Any) -> bool:
        """Add a WebSocket viewer to a session."""
        session = self._sessions.get(session_id)

        if not session:
            # Session doesn't exist yet — create a placeholder
            # (the orchestrator may not have registered it yet)
            if len(self._sessions) >= MAX_SESSIONS:
                try:
                    await websocket.accept()
                    await websocket.send_json({
                        "type": "error",
                        "message": "Maximum streaming sessions reached"
                    })
                    await websocket.close()
                except Exception:
                    pass
                return False

            session = StreamSession(session_id=session_id)
            self._sessions[session_id] = session

        if len(session.viewers) >= MAX_VIEWERS_PER_SESSION:
            try:
                await websocket.accept()
                await websocket.send_json({
                    "type": "error",
                    "message": "Maximum viewers reached for this session"
                })
                await websocket.close()
            except Exception:
                pass
            return False

        await websocket.accept()
        session.viewers.append(websocket)
        logger.info(
            f"[LiveStream] Viewer connected to {session_id} "
            f"({len(session.viewers)} total)"
        )
        return True

    def disconnect_viewer(self, session_id: str, websocket: Any) -> None:
        """Remove a WebSocket viewer from a session."""
        session = self._sessions.get(session_id)
        if session and websocket in session.viewers:
            session.viewers.remove(websocket)
            logger.info(
                f"[LiveStream] Viewer disconnected from {session_id} "
                f"({len(session.viewers)} remaining)"
            )

    # ── Streaming Control ──────────────────────────────────────────────────

    async def start_streaming(self, session_id: str) -> bool:
        """Start the capture loop for a session."""
        session = self._sessions.get(session_id)
        if not session:
            return False

        if session.is_streaming:
            return True  # Already streaming

        if not session.page:
            logger.debug(
                f"[LiveStream] Cannot start streaming {session_id}: no page"
            )
            return False

        session.is_streaming = True
        session.start_time = time.time()
        session.capture_task = asyncio.create_task(
            self._capture_loop(session)
        )
        logger.info(f"[LiveStream] Streaming started: {session_id}")
        return True

    async def stop_streaming(self, session_id: str) -> None:
        """Stop the capture loop for a session."""
        session = self._sessions.get(session_id)
        if not session:
            return

        session.is_streaming = False

        if session.capture_task and not session.capture_task.done():
            session.capture_task.cancel()
            try:
                await session.capture_task
            except (asyncio.CancelledError, Exception):
                pass
            session.capture_task = None

        logger.info(
            f"[LiveStream] Streaming stopped: {session_id} "
            f"(sent {session.frame_count} frames)"
        )

    # ── Capture Loop ───────────────────────────────────────────────────────

    async def _capture_loop(self, session: StreamSession) -> None:
        """
        Async loop that captures screenshots and broadcasts to viewers.
        Runs until stopped or the duration limit is reached.
        """
        try:
            while session.is_streaming:
                loop_start = time.time()

                # Safety: auto-stop after MAX_STREAM_DURATION_SECS
                elapsed = loop_start - session.start_time
                if elapsed > MAX_STREAM_DURATION_SECS:
                    logger.info(
                        f"[LiveStream] Auto-stopping {session.session_id} "
                        f"after {MAX_STREAM_DURATION_SECS}s"
                    )
                    break

                # Skip if no viewers
                if not session.viewers:
                    await asyncio.sleep(0.5)
                    continue

                # Capture frame
                try:
                    frame_bytes = await self._capture_frame(session)
                    if frame_bytes:
                        await self._broadcast_frame(session, frame_bytes)
                except Exception as e:
                    logger.debug(
                        f"[LiveStream] Capture error for "
                        f"{session.session_id}: {e}"
                    )
                    # Don't break — page might recover
                    await asyncio.sleep(1.0)
                    continue

                # Maintain target FPS
                frame_time = time.time() - loop_start
                target_delay = 1.0 / max(1, session.fps)
                sleep_time = max(0.01, target_delay - frame_time)
                await asyncio.sleep(sleep_time)

        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(
                f"[LiveStream] Capture loop crashed for "
                f"{session.session_id}: {e}"
            )
        finally:
            session.is_streaming = False

    async def _capture_frame(
        self, session: StreamSession
    ) -> Optional[bytes]:
        """
        Take a screenshot, optimize it, and return JPEG bytes.
        Returns None if the frame is identical to the previous one.
        """
        if not session.page:
            return None

        try:
            # Capture as JPEG directly from Playwright
            raw_bytes = await session.page.screenshot(
                type="jpeg",
                quality=session.quality,
                timeout=5000,
            )
        except Exception:
            return None

        # Hash-based dedup: skip identical frames
        frame_hash = hashlib.md5(raw_bytes).hexdigest()
        if frame_hash == session.last_frame_hash:
            return None
        session.last_frame_hash = frame_hash

        # Optimize: resize to max 1280px width if needed
        optimized = await self._optimize_frame(raw_bytes, session.quality)
        return optimized or raw_bytes

    async def _optimize_frame(
        self, frame_bytes: bytes, quality: int
    ) -> Optional[bytes]:
        """Resize frame to max 1280px width using PIL."""
        try:
            from PIL import Image

            img = Image.open(io.BytesIO(frame_bytes))
            max_width = 1280

            if img.width > max_width:
                ratio = max_width / img.width
                new_size = (max_width, int(img.height * ratio))
                img = img.resize(new_size, Image.LANCZOS)

                buf = io.BytesIO()
                img.save(buf, format="JPEG", quality=quality, optimize=True)
                return buf.getvalue()

            return None  # No resize needed, use original
        except ImportError:
            # PIL not available, return original
            return None
        except Exception:
            return None

    async def _broadcast_frame(
        self, session: StreamSession, frame_bytes: bytes
    ) -> None:
        """Send binary frame to all connected viewers."""
        dead_viewers = []

        for ws in session.viewers:
            try:
                await ws.send_bytes(frame_bytes)
            except Exception:
                dead_viewers.append(ws)

        # Clean up disconnected viewers
        for ws in dead_viewers:
            if ws in session.viewers:
                session.viewers.remove(ws)

        session.frame_count += 1

    # ── Settings ───────────────────────────────────────────────────────────

    def set_fps(self, session_id: str, fps: int) -> None:
        """Update capture FPS (clamped to 1-15)."""
        session = self._sessions.get(session_id)
        if session:
            session.fps = max(1, min(15, fps))

    def set_quality(self, session_id: str, quality: int) -> None:
        """Update JPEG quality (clamped to 30-90)."""
        session = self._sessions.get(session_id)
        if session:
            session.quality = max(30, min(90, quality))

    def get_session_info(self, session_id: str) -> Optional[Dict]:
        """Get session status info."""
        session = self._sessions.get(session_id)
        if not session:
            return None

        return {
            "session_id": session.session_id,
            "has_page": session.page is not None,
            "is_streaming": session.is_streaming,
            "viewer_count": len(session.viewers),
            "frame_count": session.frame_count,
            "fps": session.fps,
            "quality": session.quality,
        }


# ── Global Singleton ───────────────────────────────────────────────────────
live_stream_manager = LiveBrowserStreamManager()
