"""
Transaction Analyzer - Detailed transaction breakdown and error analysis
Provides enterprise-grade transaction analysis
"""

import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime
from collections import defaultdict

logger = logging.getLogger(__name__)


@dataclass
class Transaction:
    """Transaction definition"""
    transaction_id: str
    name: str
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_ms: float = 0.0
    status: str = "running"  # running, success, error, timeout
    steps: List[Dict[str, Any]] = field(default_factory=list)
    error: Optional[str] = None
    response_time_ms: float = 0.0


@dataclass
class ErrorAnalysis:
    """Error analysis result"""
    error_type: str
    error_message: str
    count: int
    percentage: float
    first_occurrence: datetime
    last_occurrence: datetime
    affected_transactions: List[str] = field(default_factory=list)
    root_cause: Optional[str] = None


class TransactionAnalyzer:
    """
    Transaction Analyzer
    Analyzes transactions, provides breakdowns, and categorizes errors
    """
    
    def __init__(self):
        self.transactions: Dict[str, Transaction] = {}
        self.transaction_history: List[Transaction] = []
        self.errors: List[Dict[str, Any]] = []
    
    def start_transaction(
        self,
        transaction_id: str,
        name: str,
        start_time: Optional[datetime] = None
    ) -> Transaction:
        """Start a new transaction"""
        transaction = Transaction(
            transaction_id=transaction_id,
            name=name,
            start_time=start_time or datetime.utcnow(),
            status="running"
        )
        
        self.transactions[transaction_id] = transaction
        return transaction
    
    def end_transaction(
        self,
        transaction_id: str,
        status: str = "success",
        error: Optional[str] = None,
        end_time: Optional[datetime] = None
    ):
        """End a transaction"""
        if transaction_id not in self.transactions:
            return
        
        transaction = self.transactions[transaction_id]
        transaction.end_time = end_time or datetime.utcnow()
        transaction.status = status
        transaction.error = error
        transaction.duration_ms = (
            (transaction.end_time - transaction.start_time).total_seconds() * 1000
        )
        transaction.response_time_ms = transaction.duration_ms
        
        # Move to history
        self.transaction_history.append(transaction)
        
        if status == "error" and error:
            self.errors.append({
                "transaction_id": transaction_id,
                "transaction_name": transaction.name,
                "error": error,
                "timestamp": transaction.end_time.isoformat()
            })
    
    def add_transaction_step(
        self,
        transaction_id: str,
        step_name: str,
        step_data: Dict[str, Any]
    ):
        """Add a step to a transaction"""
        if transaction_id not in self.transactions:
            return
        
        transaction = self.transactions[transaction_id]
        transaction.steps.append({
            "name": step_name,
            "data": step_data,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    def get_transaction_breakdown(
        self,
        transaction_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get detailed transaction breakdown"""
        transactions = self.transaction_history.copy()
        
        if transaction_name:
            transactions = [t for t in transactions if t.name == transaction_name]
        
        if not transactions:
            return {"error": "No transactions found"}
        
        # Calculate statistics
        durations = [t.duration_ms for t in transactions]
        success_count = len([t for t in transactions if t.status == "success"])
        error_count = len([t for t in transactions if t.status == "error"])
        timeout_count = len([t for t in transactions if t.status == "timeout"])
        
        def percentile(values: List[float], p: float) -> float:
            if not values:
                return 0.0
            sorted_values = sorted(values)
            index = int(len(sorted_values) * p)
            return sorted_values[index] if index < len(sorted_values) else sorted_values[-1]
        
        return {
            "transaction_name": transaction_name or "all",
            "total_count": len(transactions),
            "success_count": success_count,
            "error_count": error_count,
            "timeout_count": timeout_count,
            "success_rate": success_count / len(transactions) if transactions else 0.0,
            "duration": {
                "min": min(durations) if durations else 0.0,
                "max": max(durations) if durations else 0.0,
                "avg": sum(durations) / len(durations) if durations else 0.0,
                "p50": percentile(durations, 0.50),
                "p75": percentile(durations, 0.75),
                "p90": percentile(durations, 0.90),
                "p95": percentile(durations, 0.95),
                "p99": percentile(durations, 0.99)
            },
            "transactions": [
                {
                    "transaction_id": t.transaction_id,
                    "name": t.name,
                    "status": t.status,
                    "duration_ms": t.duration_ms,
                    "start_time": t.start_time.isoformat(),
                    "end_time": t.end_time.isoformat() if t.end_time else None,
                    "error": t.error
                }
                for t in transactions[-100:]  # Last 100 transactions
            ]
        }
    
    def analyze_errors(self) -> List[ErrorAnalysis]:
        """Analyze and categorize errors"""
        if not self.errors:
            return []
        
        # Group errors by type
        error_groups = defaultdict(lambda: {
            "count": 0,
            "messages": set(),
            "transactions": set(),
            "first": None,
            "last": None
        })
        
        for error in self.errors:
            error_type = self._categorize_error(error["error"])
            group = error_groups[error_type]
            
            group["count"] += 1
            group["messages"].add(error["error"])
            group["transactions"].add(error["transaction_id"])
            
            timestamp = datetime.fromisoformat(error["timestamp"])
            if group["first"] is None or timestamp < group["first"]:
                group["first"] = timestamp
            if group["last"] is None or timestamp > group["last"]:
                group["last"] = timestamp
        
        # Convert to ErrorAnalysis objects
        total_errors = len(self.errors)
        analyses = []
        
        for error_type, group in error_groups.items():
            analyses.append(ErrorAnalysis(
                error_type=error_type,
                error_message=list(group["messages"])[0] if group["messages"] else "Unknown",
                count=group["count"],
                percentage=(group["count"] / total_errors * 100) if total_errors > 0 else 0.0,
                first_occurrence=group["first"] or datetime.utcnow(),
                last_occurrence=group["last"] or datetime.utcnow(),
                affected_transactions=list(group["transactions"]),
                root_cause=self._suggest_root_cause(error_type, list(group["messages"])[0])
            ))
        
        # Sort by count (descending)
        analyses.sort(key=lambda x: x.count, reverse=True)
        
        return analyses
    
    def _categorize_error(self, error_message: str) -> str:
        """Categorize error by message"""
        error_lower = error_message.lower()
        
        if "timeout" in error_lower or "timed out" in error_lower:
            return "timeout"
        elif "connection" in error_lower or "refused" in error_lower:
            return "connection_error"
        elif "404" in error_message or "not found" in error_lower:
            return "not_found"
        elif "500" in error_message or "500" in error_message or "internal server" in error_lower:
            return "server_error"
        elif "401" in error_message or "unauthorized" in error_lower:
            return "authentication_error"
        elif "403" in error_message or "forbidden" in error_lower:
            return "authorization_error"
        elif "400" in error_message or "bad request" in error_lower:
            return "bad_request"
        elif "rate limit" in error_lower or "429" in error_message:
            return "rate_limit"
        else:
            return "unknown_error"
    
    def _suggest_root_cause(self, error_type: str, error_message: str) -> str:
        """Suggest root cause for error"""
        suggestions = {
            "timeout": "Request exceeded timeout threshold. Check server performance or increase timeout.",
            "connection_error": "Unable to connect to server. Check network connectivity and server status.",
            "not_found": "Resource not found. Verify endpoint URL and resource ID.",
            "server_error": "Internal server error. Check server logs for details.",
            "authentication_error": "Authentication failed. Verify credentials and token validity.",
            "authorization_error": "Access denied. Check user permissions and roles.",
            "bad_request": "Invalid request format. Verify request parameters and payload.",
            "rate_limit": "Rate limit exceeded. Reduce request frequency or increase rate limits."
        }
        
        return suggestions.get(error_type, "Unknown error. Review error details for more information.")
    
    def get_error_summary(self) -> Dict[str, Any]:
        """Get error summary statistics"""
        analyses = self.analyze_errors()
        
        if not analyses:
            return {
                "total_errors": 0,
                "error_types": [],
                "most_common": None
            }
        
        return {
            "total_errors": sum(a.count for a in analyses),
            "error_types": [
                {
                    "type": a.error_type,
                    "count": a.count,
                    "percentage": a.percentage,
                    "message": a.error_message
                }
                for a in analyses
            ],
            "most_common": {
                "type": analyses[0].error_type,
                "count": analyses[0].count,
                "percentage": analyses[0].percentage,
                "message": analyses[0].error_message,
                "root_cause": analyses[0].root_cause
            } if analyses else None
        }
    
    def clear_history(self):
        """Clear transaction and error history"""
        self.transactions.clear()
        self.transaction_history.clear()
        self.errors.clear()
        logger.info("Cleared transaction and error history")




