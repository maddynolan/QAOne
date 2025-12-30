"""
Debugging Utilities for Playwright Generator
Provides step-by-step tracing and debugging tools.
"""

import logging
import json
from typing import Dict, List, Any, Optional
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)


class PlaywrightGeneratorDebugger:
    """
    Debugging utilities for tracing Playwright script generation.
    """
    
    def __init__(self, verbose: bool = True):
        self.verbose = verbose
        self.trace_log = []
        self.node_traces = []
    
    def trace_node_processing(
        self,
        node_index: int,
        node: Any,
        event_type: str,
        target_selector: Optional[str],
        target_text: Optional[str],
        locator_chain: List[Tuple[str, str]],
        generated_code: List[str],
        success: bool,
        error: Optional[str] = None
    ):
        """Trace processing of a single node"""
        trace_entry = {
            "node_index": node_index,
            "event_type": event_type,
            "target_selector": target_selector,
            "target_text": target_text,
            "locator_strategies": [strategy for _, strategy in locator_chain],
            "locator_code": locator_chain[0][0] if locator_chain else None,
            "generated_lines": len(generated_code),
            "success": success,
            "error": error,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        self.node_traces.append(trace_entry)
        
        if self.verbose:
            status = "✅" if success else "❌"
            print(f"{status} Node {node_index}: {event_type}")
            if target_selector:
                print(f"   Selector: {target_selector}")
            if target_text:
                print(f"   Text: {target_text}")
            if locator_chain:
                print(f"   Locator: {locator_chain[0][0]}")
            if generated_code:
                print(f"   Generated {len(generated_code)} lines")
            if error:
                print(f"   Error: {error}")
    
    def trace_generation_start(self, node_count: int):
        """Trace start of generation"""
        trace_entry = {
            "event": "generation_start",
            "node_count": node_count,
            "timestamp": datetime.utcnow().isoformat()
        }
        self.trace_log.append(trace_entry)
        
        if self.verbose:
            print(f"\n🚀 Starting Playwright script generation")
            print(f"   Processing {node_count} nodes")
    
    def trace_generation_complete(
        self,
        action_count: int,
        skipped_count: int,
        total_nodes: int,
        generation_time_ms: float,
        script_length: int
    ):
        """Trace completion of generation"""
        trace_entry = {
            "event": "generation_complete",
            "action_count": action_count,
            "skipped_count": skipped_count,
            "total_nodes": total_nodes,
            "generation_time_ms": generation_time_ms,
            "script_length": script_length,
            "timestamp": datetime.utcnow().isoformat()
        }
        self.trace_log.append(trace_entry)
        
        if self.verbose:
            print(f"\n✅ Generation complete")
            print(f"   Processed: {action_count}/{total_nodes} nodes")
            print(f"   Skipped: {skipped_count}")
            print(f"   Time: {generation_time_ms:.0f}ms")
            print(f"   Script length: {script_length} characters")
    
    def trace_locator_generation(
        self,
        node_index: int,
        event_type: str,
        target_selector: Optional[str],
        target_text: Optional[str],
        locator_chain: List[Tuple[str, str]],
        strategy_used: str
    ):
        """Trace locator generation"""
        trace_entry = {
            "event": "locator_generation",
            "node_index": node_index,
            "event_type": event_type,
            "target_selector": target_selector,
            "target_text": target_text,
            "locator_strategies": [strategy for _, strategy in locator_chain],
            "strategy_used": strategy_used,
            "timestamp": datetime.utcnow().isoformat()
        }
        self.trace_log.append(trace_entry)
        
        if self.verbose:
            print(f"   📍 Locator generation for node {node_index}")
            print(f"      Strategy: {strategy_used}")
            if locator_chain:
                print(f"      Code: {locator_chain[0][0]}")
    
    def trace_validation(
        self,
        validation_result: Dict[str, Any]
    ):
        """Trace validation results"""
        trace_entry = {
            "event": "validation",
            "valid": validation_result.get("valid", False),
            "errors": validation_result.get("errors", []),
            "warnings": validation_result.get("warnings", []),
            "timestamp": datetime.utcnow().isoformat()
        }
        self.trace_log.append(trace_entry)
        
        if self.verbose:
            if validation_result.get("valid"):
                print(f"✅ Validation passed")
            else:
                print(f"❌ Validation failed")
                for error in validation_result.get("errors", []):
                    print(f"   Error: {error}")
            for warning in validation_result.get("warnings", []):
                print(f"   Warning: {warning}")
    
    def get_trace_summary(self) -> Dict[str, Any]:
        """Get summary of trace data"""
        return {
            "total_nodes_processed": len(self.node_traces),
            "successful_nodes": sum(1 for t in self.node_traces if t["success"]),
            "failed_nodes": sum(1 for t in self.node_traces if not t["success"]),
            "node_traces": self.node_traces,
            "generation_log": self.trace_log
        }
    
    def save_trace(self, output_file: str = "generator_trace.json"):
        """Save trace data to file"""
        trace_data = self.get_trace_summary()
        with open(output_file, 'w') as f:
            json.dump(trace_data, f, indent=2)
        print(f"💾 Trace saved to {output_file}")
    
    def print_trace_summary(self):
        """Print human-readable trace summary"""
        summary = self.get_trace_summary()
        
        print(f"\n{'='*60}")
        print("GENERATION TRACE SUMMARY")
        print(f"{'='*60}")
        print(f"Total nodes processed: {summary['total_nodes_processed']}")
        print(f"✅ Successful: {summary['successful_nodes']}")
        print(f"❌ Failed: {summary['failed_nodes']}")
        
        if summary['failed_nodes'] > 0:
            print(f"\nFailed nodes:")
            for trace in summary['node_traces']:
                if not trace['success']:
                    print(f"  - Node {trace['node_index']}: {trace['event_type']}")
                    if trace.get('error'):
                        print(f"    Error: {trace['error']}")


def create_debug_generator(verbose: bool = True) -> PlaywrightGeneratorDebugger:
    """Create a debugger instance"""
    return PlaywrightGeneratorDebugger(verbose=verbose)



