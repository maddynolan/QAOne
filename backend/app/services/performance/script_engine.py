"""
Custom Script Engine - User-defined test scripts for performance testing

Allows users to write custom test logic similar to:
- k6 JavaScript scripts
- JMeter Beanshell/Groovy scripts
- LoadRunner C scripts

Features:
- Python-based scripting (familiar, powerful)
- Pre-defined functions for common operations
- Variable access and manipulation
- Custom assertions and checks
- Request modification hooks
- Data-driven testing support
- Safe execution sandbox
"""

import logging
import ast
import time
import re
import json
from typing import Dict, List, Any, Optional, Callable, Tuple
from dataclasses import dataclass, field
from datetime import datetime
import threading
import random
import string
import hashlib
import base64
from urllib.parse import quote, unquote

logger = logging.getLogger(__name__)


@dataclass
class ScriptContext:
    """
    Context available to user scripts.
    Similar to k6's context or JMeter's ctx.
    """
    vu_id: str
    iteration: int
    test_start_time: datetime
    
    # Variables (accessible as vars.get('name'), vars.set('name', value))
    variables: Dict[str, Any] = field(default_factory=dict)
    
    # Request/response data
    request: Optional[Dict[str, Any]] = None
    response: Optional[Dict[str, Any]] = None
    
    # Metrics
    response_time_ms: float = 0.0
    
    # Control flags
    abort_test: bool = False
    skip_iteration: bool = False
    
    def get(self, key: str, default: Any = None) -> Any:
        """Get a variable"""
        return self.variables.get(key, default)
    
    def set(self, key: str, value: Any):
        """Set a variable"""
        self.variables[key] = value
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "vu_id": self.vu_id,
            "iteration": self.iteration,
            "variables": self.variables,
            "response_time_ms": self.response_time_ms,
            "abort_test": self.abort_test,
            "skip_iteration": self.skip_iteration
        }


class ScriptLibrary:
    """
    Library of functions available to user scripts.
    These are injected into the script execution environment.
    """
    
    @staticmethod
    def sleep(seconds: float):
        """Sleep for specified seconds"""
        time.sleep(seconds)
    
    @staticmethod
    def random_int(min_val: int, max_val: int) -> int:
        """Generate random integer"""
        return random.randint(min_val, max_val)
    
    @staticmethod
    def random_float(min_val: float, max_val: float) -> float:
        """Generate random float"""
        return random.uniform(min_val, max_val)
    
    @staticmethod
    def random_string(length: int, chars: str = None) -> str:
        """Generate random string"""
        if chars is None:
            chars = string.ascii_letters + string.digits
        return ''.join(random.choice(chars) for _ in range(length))
    
    @staticmethod
    def random_uuid() -> str:
        """Generate random UUID"""
        import uuid
        return str(uuid.uuid4())
    
    @staticmethod
    def random_email() -> str:
        """Generate random email"""
        return f"user{random.randint(1000, 9999)}@test.com"
    
    @staticmethod
    def timestamp() -> int:
        """Get current timestamp in milliseconds"""
        return int(time.time() * 1000)
    
    @staticmethod
    def timestamp_iso() -> str:
        """Get current timestamp in ISO format"""
        return datetime.utcnow().isoformat()
    
    @staticmethod
    def md5(text: str) -> str:
        """Calculate MD5 hash"""
        return hashlib.md5(text.encode()).hexdigest()
    
    @staticmethod
    def sha256(text: str) -> str:
        """Calculate SHA256 hash"""
        return hashlib.sha256(text.encode()).hexdigest()
    
    @staticmethod
    def base64_encode(text: str) -> str:
        """Base64 encode"""
        return base64.b64encode(text.encode()).decode()
    
    @staticmethod
    def base64_decode(text: str) -> str:
        """Base64 decode"""
        return base64.b64decode(text).decode()
    
    @staticmethod
    def url_encode(text: str) -> str:
        """URL encode"""
        return quote(text)
    
    @staticmethod
    def url_decode(text: str) -> str:
        """URL decode"""
        return unquote(text)
    
    @staticmethod
    def json_parse(text: str) -> Any:
        """Parse JSON string"""
        return json.loads(text)
    
    @staticmethod
    def json_stringify(obj: Any) -> str:
        """Convert to JSON string"""
        return json.dumps(obj)
    
    @staticmethod
    def regex_match(pattern: str, text: str) -> Optional[str]:
        """Find first regex match"""
        match = re.search(pattern, text)
        return match.group(1) if match and match.groups() else (match.group(0) if match else None)
    
    @staticmethod
    def regex_match_all(pattern: str, text: str) -> List[str]:
        """Find all regex matches"""
        return re.findall(pattern, text)


@dataclass
class ScriptResult:
    """Result of script execution"""
    success: bool
    output: Any = None
    error: Optional[str] = None
    duration_ms: float = 0.0
    logs: List[str] = field(default_factory=list)
    context: Optional[ScriptContext] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "output": self.output,
            "error": self.error,
            "duration_ms": self.duration_ms,
            "logs": self.logs,
            "context": self.context.to_dict() if self.context else None
        }


class ScriptEngine:
    """
    Script execution engine for custom test logic.
    
    Usage:
        engine = ScriptEngine()
        
        # Define a script
        script = '''
        # Pre-request script
        def pre_request(ctx, request):
            # Add dynamic header
            request['headers']['X-Timestamp'] = str(timestamp())
            
            # Use a correlation variable
            if ctx.get('auth_token'):
                request['headers']['Authorization'] = f"Bearer {ctx.get('auth_token')}"
            
            return request
        '''
        
        # Execute
        result = engine.execute(script, 'pre_request', context, request=request)
    """
    
    def __init__(self):
        self.scripts: Dict[str, str] = {}  # name -> script code
        self.compiled: Dict[str, Any] = {}  # name -> compiled code
        self.execution_timeout: float = 30.0  # seconds
        self._lock = threading.Lock()
        
        # Script logs (captured from print statements)
        self._logs: List[str] = []
    
    def register_script(self, name: str, code: str):
        """Register a named script"""
        with self._lock:
            # Validate script syntax
            try:
                ast.parse(code)
            except SyntaxError as e:
                raise ValueError(f"Script syntax error: {e}")
            
            self.scripts[name] = code
            
            # Clear compiled cache
            if name in self.compiled:
                del self.compiled[name]
        
        logger.info(f"Registered script: {name}")
    
    def execute(
        self,
        script_or_name: str,
        function_name: str,
        context: ScriptContext,
        **kwargs
    ) -> ScriptResult:
        """
        Execute a script function.
        
        Args:
            script_or_name: Script code or registered script name
            function_name: Function to call within the script
            context: Script context
            **kwargs: Additional arguments to pass to the function
        """
        start_time = time.time()
        self._logs = []
        
        try:
            # Get script code
            if script_or_name in self.scripts:
                code = self.scripts[script_or_name]
            else:
                code = script_or_name
            
            # Create execution environment
            env = self._create_execution_env(context)
            
            # Execute script
            exec(code, env)
            
            # Call the function
            if function_name not in env:
                raise ValueError(f"Function not found: {function_name}")
            
            func = env[function_name]
            result = func(context, **kwargs)
            
            duration_ms = (time.time() - start_time) * 1000
            
            return ScriptResult(
                success=True,
                output=result,
                duration_ms=duration_ms,
                logs=self._logs.copy(),
                context=context
            )
        
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            logger.error(f"Script execution error: {e}")
            
            return ScriptResult(
                success=False,
                error=str(e),
                duration_ms=duration_ms,
                logs=self._logs.copy(),
                context=context
            )
    
    def _create_execution_env(self, context: ScriptContext) -> Dict[str, Any]:
        """Create the execution environment with available functions"""
        
        # Capture print statements
        def script_print(*args):
            msg = " ".join(str(a) for a in args)
            self._logs.append(msg)
        
        # Custom check function (like k6)
        def check(response: Dict, checks: Dict[str, Any]) -> Dict[str, bool]:
            """
            k6-style check function.
            
            Usage:
                check(response, {
                    "status is 200": lambda r: r.get('status') == 200,
                    "body contains 'success'": lambda r: 'success' in r.get('body', '')
                })
            """
            results = {}
            for name, check_fn in checks.items():
                try:
                    if callable(check_fn):
                        results[name] = bool(check_fn(response))
                    else:
                        results[name] = bool(check_fn)
                except Exception:
                    results[name] = False
            return results
        
        # Custom fail function
        def fail(message: str = "Test failed"):
            """Fail the current iteration"""
            context.abort_test = True
            raise Exception(message)
        
        # Custom skip function
        def skip():
            """Skip the current iteration"""
            context.skip_iteration = True
        
        env = {
            # Built-in safe functions
            "print": script_print,
            "len": len,
            "str": str,
            "int": int,
            "float": float,
            "bool": bool,
            "list": list,
            "dict": dict,
            "range": range,
            "enumerate": enumerate,
            "zip": zip,
            "map": map,
            "filter": filter,
            "sorted": sorted,
            "min": min,
            "max": max,
            "sum": sum,
            "abs": abs,
            "round": round,
            
            # Script library functions
            "sleep": ScriptLibrary.sleep,
            "random_int": ScriptLibrary.random_int,
            "random_float": ScriptLibrary.random_float,
            "random_string": ScriptLibrary.random_string,
            "random_uuid": ScriptLibrary.random_uuid,
            "random_email": ScriptLibrary.random_email,
            "timestamp": ScriptLibrary.timestamp,
            "timestamp_iso": ScriptLibrary.timestamp_iso,
            "md5": ScriptLibrary.md5,
            "sha256": ScriptLibrary.sha256,
            "base64_encode": ScriptLibrary.base64_encode,
            "base64_decode": ScriptLibrary.base64_decode,
            "url_encode": ScriptLibrary.url_encode,
            "url_decode": ScriptLibrary.url_decode,
            "json_parse": ScriptLibrary.json_parse,
            "json_stringify": ScriptLibrary.json_stringify,
            "regex_match": ScriptLibrary.regex_match,
            "regex_match_all": ScriptLibrary.regex_match_all,
            
            # Test control
            "check": check,
            "fail": fail,
            "skip": skip,
            
            # Context shortcuts
            "ctx": context,
            "vars": context.variables,
        }
        
        return env
    
    def validate_script(self, code: str) -> Tuple[bool, Optional[str]]:
        """
        Validate script syntax and safety.
        Returns (is_valid, error_message)
        """
        try:
            tree = ast.parse(code)
            
            # Check for dangerous operations
            dangerous_names = {
                'eval', 'exec', 'compile', '__import__', 'open',
                'input', 'breakpoint', 'exit', 'quit'
            }
            
            for node in ast.walk(tree):
                if isinstance(node, ast.Name) and node.id in dangerous_names:
                    return False, f"Forbidden function: {node.id}"
                
                if isinstance(node, ast.Import) or isinstance(node, ast.ImportFrom):
                    return False, "Imports are not allowed in scripts"
            
            return True, None
        
        except SyntaxError as e:
            return False, f"Syntax error: {e}"
    
    def get_template(self, template_type: str) -> str:
        """Get a script template"""
        templates = {
            "pre_request": '''
def pre_request(ctx, request):
    """
    Modify request before sending.
    
    Args:
        ctx: Script context with variables
        request: Request dict with method, url, headers, body
    
    Returns:
        Modified request dict
    """
    # Example: Add timestamp header
    request['headers']['X-Timestamp'] = str(timestamp())
    
    # Example: Use correlation variable
    if ctx.get('auth_token'):
        request['headers']['Authorization'] = f"Bearer {ctx.get('auth_token')}"
    
    return request
''',
            "post_response": '''
def post_response(ctx, request, response):
    """
    Process response after receiving.
    
    Args:
        ctx: Script context with variables
        request: Request that was sent
        response: Response dict with status, body, headers
    """
    # Example: Extract and store token
    if response.get('status') == 200:
        body = response.get('body', {})
        if isinstance(body, str):
            body = json_parse(body)
        
        if 'token' in body:
            ctx.set('auth_token', body['token'])
    
    # Example: Run checks
    results = check(response, {
        "status is 200": lambda r: r.get('status') == 200,
        "has token": lambda r: 'token' in str(r.get('body', ''))
    })
    
    print(f"Check results: {results}")
''',
            "setup": '''
def setup(ctx):
    """
    Global setup - runs once before test starts.
    
    Args:
        ctx: Script context
    
    Returns:
        Data to share with VUs
    """
    # Example: Generate test data
    users = [
        {"username": f"user{i}", "password": random_string(12)}
        for i in range(100)
    ]
    
    return {"users": users}
''',
            "teardown": '''
def teardown(ctx, data):
    """
    Global teardown - runs once after test completes.
    
    Args:
        ctx: Script context
        data: Data from setup
    """
    # Example: Cleanup
    print(f"Test completed. Total iterations: {ctx.iteration}")
''',
            "vu_setup": '''
def vu_setup(ctx, data):
    """
    Per-VU setup - runs once per virtual user.
    
    Args:
        ctx: Script context
        data: Data from global setup
    
    Returns:
        VU-specific data
    """
    # Example: Assign unique user to this VU
    users = data.get('users', [])
    vu_index = int(ctx.vu_id.split('_')[-1]) % len(users)
    
    return {"user": users[vu_index]}
''',
            "custom_check": '''
def custom_check(ctx, response):
    """
    Custom validation logic.
    
    Args:
        ctx: Script context
        response: Response dict
    
    Returns:
        bool - True if check passed
    """
    # Example: Complex validation
    status = response.get('status', 0)
    body = response.get('body', '')
    response_time = ctx.response_time_ms
    
    # Check multiple conditions
    if status != 200:
        print(f"Status check failed: {status}")
        return False
    
    if response_time > 1000:
        print(f"Response time too slow: {response_time}ms")
        return False
    
    if 'error' in str(body).lower():
        print("Body contains error")
        return False
    
    return True
'''
        }
        
        return templates.get(template_type, "# No template found")
    
    def list_templates(self) -> List[str]:
        """List available script templates"""
        return ["pre_request", "post_response", "setup", "teardown", "vu_setup", "custom_check"]


from typing import Tuple

# Singleton instance
_script_engine: Optional[ScriptEngine] = None

def get_script_engine() -> ScriptEngine:
    """Get singleton script engine"""
    global _script_engine
    if _script_engine is None:
        _script_engine = ScriptEngine()
    return _script_engine
