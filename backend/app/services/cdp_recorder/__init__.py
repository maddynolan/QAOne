# CDP Recorder Service
# Browser-based test recording using Chrome DevTools Protocol
# No browser extension required - works like Testim/Tosca/Mabl

from .recorder_service import CDPRecorderService
from .session_manager import CDPSessionManager

__all__ = ['CDPRecorderService', 'CDPSessionManager']

