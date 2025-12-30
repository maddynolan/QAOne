"""
PAGE INTELLIGENCE SERVICE
==========================
Integrates the browser extension's PageAnalyzer capabilities with the Flowstral Engine.

This provides:
- Smart element discovery (pierces Shadow DOM)
- Multiple selector strategies per element
- App-specific element detection
- Proactive action suggestions

The Suggest tab in the extension already does this client-side.
This module makes it available server-side for test generation.
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class DiscoveredElement:
    """An element discovered during page analysis."""
    element_type: str  # button, link, input, heading
    text: str
    selectors: List[Dict[str, str]]  # Multiple selector strategies
    attributes: Dict[str, str]
    location: str  # header, nav, main, footer, modal
    is_visible: bool = True
    is_enabled: bool = True
    confidence: float = 1.0
    
    # For inputs
    input_type: Optional[str] = None
    label: Optional[str] = None
    placeholder: Optional[str] = None
    
    # For Salesforce-specific
    sf_component: Optional[str] = None  # lightning-input, lightning-button, etc.


@dataclass
class PageAnalysisResult:
    """Complete analysis of a page."""
    url: str
    title: str
    page_type: str  # login, list_view, record_page, form, dashboard
    app_type: str  # salesforce, servicenow, generic
    
    buttons: List[DiscoveredElement] = field(default_factory=list)
    links: List[DiscoveredElement] = field(default_factory=list)
    inputs: List[DiscoveredElement] = field(default_factory=list)
    headings: List[DiscoveredElement] = field(default_factory=list)
    
    # Suggested actions
    suggestions: List[Dict[str, Any]] = field(default_factory=list)
    
    # Metadata
    analysis_time_ms: float = 0
    element_count: int = 0
    analyzed_at: str = ""


class PageIntelligenceService:
    """
    Server-side page intelligence that works with browser extension analysis.
    
    Usage:
        service = PageIntelligenceService()
        
        # From extension analysis data
        result = service.process_extension_analysis(analysis_data)
        
        # Generate test steps from analysis
        steps = service.generate_test_steps(result)
    """
    
    def __init__(self):
        self.app_patterns = self._load_app_patterns()
    
    def _load_app_patterns(self) -> Dict[str, Dict]:
        """Load app-specific detection patterns."""
        return {
            "salesforce": {
                "url_patterns": ["salesforce.com", "force.com", ".my.salesforce"],
                "dom_indicators": ["lightning-", "slds-", "aura", "one-app"],
                "components": {
                    "app_launcher": ["div.slds-icon-waffle", "one-app-launcher-header"],
                    "global_search": ["button[title='Search']", "[aria-label='Search']"],
                    "record_tabs": ["lightning-tab-bar", "[role='tab']"],
                }
            },
            "servicenow": {
                "url_patterns": ["service-now.com", "servicenow"],
                "dom_indicators": ["sn-", "angular", "seismic"],
                "components": {}
            },
            "workday": {
                "url_patterns": ["workday.com", "myworkday"],
                "dom_indicators": ["wd-", "WDAY"],
                "components": {}
            },
        }
    
    def process_extension_analysis(self, analysis_data: Dict) -> PageAnalysisResult:
        """
        Process analysis data from browser extension's PageAnalyzer.
        
        Args:
            analysis_data: Data from PAGE_ANALYSIS message
            
        Returns:
            Structured PageAnalysisResult
        """
        analysis = analysis_data.get('analysis', {})
        suggestions = analysis_data.get('suggestions', [])
        
        result = PageAnalysisResult(
            url=analysis.get('url', ''),
            title=analysis.get('title', ''),
            page_type=analysis.get('pageType', 'unknown'),
            app_type=analysis.get('appType', 'generic'),
            analysis_time_ms=float(analysis.get('timing', '0').replace('ms', '')),
            element_count=analysis.get('counts', {}).get('total', 0),
            analyzed_at=datetime.now().isoformat()
        )
        
        # Process buttons
        for btn in analysis.get('buttons', []):
            result.buttons.append(self._process_element(btn, 'button'))
        
        # Process links
        for link in analysis.get('links', []):
            result.links.append(self._process_element(link, 'link'))
        
        # Process inputs
        for inp in analysis.get('inputs', []):
            result.inputs.append(self._process_element(inp, 'input'))
        
        # Process headings
        for heading in analysis.get('headings', []):
            result.headings.append(self._process_element(heading, 'heading'))
        
        # Add suggestions
        result.suggestions = suggestions
        
        return result
    
    def _process_element(self, elem_data: Dict, elem_type: str) -> DiscoveredElement:
        """Convert raw element data to DiscoveredElement."""
        # Extract multiple selectors if available
        selectors = []
        
        if elem_data.get('selector'):
            selectors.append({
                'strategy': 'primary',
                'selector': elem_data['selector']
            })
        
        if elem_data.get('fallbackSelectors'):
            for i, fallback in enumerate(elem_data['fallbackSelectors']):
                selectors.append({
                    'strategy': f'fallback_{i+1}',
                    'selector': fallback
                })
        
        # Add computed selectors based on attributes
        if elem_data.get('text'):
            selectors.append({
                'strategy': 'text',
                'selector': f"text='{elem_data['text']}'"
            })
        
        if elem_data.get('ariaLabel'):
            selectors.append({
                'strategy': 'aria',
                'selector': f"[aria-label='{elem_data['ariaLabel']}']"
            })
        
        return DiscoveredElement(
            element_type=elem_type,
            text=elem_data.get('text', ''),
            selectors=selectors,
            attributes={
                'id': elem_data.get('id', ''),
                'class': elem_data.get('className', ''),
                'role': elem_data.get('role', ''),
                'aria-label': elem_data.get('ariaLabel', ''),
            },
            location=elem_data.get('location', 'main'),
            is_visible=elem_data.get('visible', True),
            is_enabled=not elem_data.get('disabled', False),
            input_type=elem_data.get('type') if elem_type == 'input' else None,
            label=elem_data.get('label'),
            placeholder=elem_data.get('placeholder'),
            sf_component=elem_data.get('sfComponent'),
        )
    
    def generate_test_steps(self, analysis: PageAnalysisResult) -> List[Dict]:
        """
        Generate test steps from page analysis.
        
        This is the key integration - instead of recording one path,
        we can generate comprehensive tests covering all discovered elements.
        """
        steps = []
        
        # If it's a login page, suggest login steps
        if analysis.page_type == 'login':
            steps.extend(self._generate_login_steps(analysis))
        
        # If it's Salesforce, add SF-specific suggestions
        if analysis.app_type == 'salesforce':
            steps.extend(self._generate_salesforce_steps(analysis))
        
        # Add steps for key interactive elements
        for btn in analysis.buttons[:5]:  # Top 5 buttons
            if btn.text and btn.is_enabled:
                steps.append({
                    'action': 'click',
                    'description': f'Click "{btn.text}"',
                    'text': btn.text,
                    'role': 'button',
                    'selectors': btn.selectors,
                    'confidence': btn.confidence
                })
        
        return steps
    
    def _generate_login_steps(self, analysis: PageAnalysisResult) -> List[Dict]:
        """Generate login-specific steps."""
        steps = []
        
        # Find username and password inputs
        for inp in analysis.inputs:
            if any(x in (inp.input_type or '').lower() for x in ['email', 'user', 'text']):
                if 'user' in (inp.label or '').lower() or 'email' in (inp.label or '').lower():
                    steps.append({
                        'action': 'fill',
                        'description': f'Fill {inp.label or "username"}',
                        'label': inp.label,
                        'placeholder': inp.placeholder,
                        'selectors': inp.selectors,
                        'value_placeholder': '{{username}}'
                    })
            elif inp.input_type == 'password':
                steps.append({
                    'action': 'fill',
                    'description': f'Fill {inp.label or "password"}',
                    'label': inp.label,
                    'selectors': inp.selectors,
                    'value_placeholder': '{{password}}'
                })
        
        # Find login button
        for btn in analysis.buttons:
            if any(x in btn.text.lower() for x in ['log in', 'login', 'sign in', 'submit']):
                steps.append({
                    'action': 'click',
                    'description': 'Click Login',
                    'text': btn.text,
                    'role': 'button',
                    'selectors': btn.selectors
                })
                break
        
        return steps
    
    def _generate_salesforce_steps(self, analysis: PageAnalysisResult) -> List[Dict]:
        """Generate Salesforce-specific suggested steps."""
        steps = []
        
        # Look for App Launcher
        for btn in analysis.buttons:
            if 'waffle' in ' '.join(s.get('selector', '') for s in btn.selectors).lower():
                steps.append({
                    'action': 'sf_app_launcher_click',
                    'description': 'Open App Launcher',
                    'selectors': btn.selectors,
                    'sf_pattern': 'app_launcher'
                })
                break
        
        # Look for Global Search
        for btn in analysis.buttons:
            if any('search' in s.get('selector', '').lower() for s in btn.selectors):
                steps.append({
                    'action': 'sf_global_search',
                    'description': 'Open Global Search',
                    'selectors': btn.selectors,
                    'sf_pattern': 'global_search'
                })
                break
        
        return steps
    
    def create_comprehensive_test(
        self,
        analysis: PageAnalysisResult,
        test_name: str,
        focus: str = "all"  # all, buttons, inputs, navigation
    ) -> Dict:
        """
        Create a comprehensive test covering multiple elements.
        
        Instead of testing one path, test multiple interactions.
        """
        test = {
            'name': test_name,
            'app_type': analysis.app_type,
            'page_type': analysis.page_type,
            'steps': [],
            'coverage': {
                'buttons': 0,
                'inputs': 0,
                'links': 0
            }
        }
        
        if focus in ['all', 'buttons']:
            for btn in analysis.buttons[:10]:
                if btn.is_enabled and btn.text:
                    test['steps'].append({
                        'action': 'click',
                        'text': btn.text,
                        'selectors': btn.selectors
                    })
                    test['coverage']['buttons'] += 1
        
        if focus in ['all', 'inputs']:
            for inp in analysis.inputs[:10]:
                if inp.is_enabled:
                    test['steps'].append({
                        'action': 'fill',
                        'label': inp.label,
                        'placeholder': inp.placeholder,
                        'selectors': inp.selectors,
                        'value': '{{test_data}}'
                    })
                    test['coverage']['inputs'] += 1
        
        return test


# ============================================================
# ENHANCED WORKFLOW: Suggest + Engine Integration
# ============================================================

class EnhancedTestWorkflow:
    """
    The enhanced workflow that combines:
    1. Extension's PageAnalyzer (Suggest tab)
    2. Flowstral Engine (robust execution)
    
    Flow:
    1. Extension analyzes page → sends to backend
    2. Backend processes analysis → generates smart steps
    3. Steps converted to Flowstral Engine code
    4. Engine executes with self-healing
    """
    
    def __init__(self):
        self.intelligence = PageIntelligenceService()
    
    def process_analysis_and_generate_test(
        self,
        analysis_data: Dict,
        test_name: str
    ) -> str:
        """
        Full workflow: Analysis → Test Code
        
        Args:
            analysis_data: From extension's PAGE_ANALYSIS message
            test_name: Name for the test
            
        Returns:
            Complete Python test code
        """
        # 1. Process the analysis
        analysis = self.intelligence.process_extension_analysis(analysis_data)
        
        # 2. Generate smart steps
        steps = self.intelligence.generate_test_steps(analysis)
        
        # 3. Convert to Flowstral Engine test
        from .test_builder import FlowstralTestBuilder
        builder = FlowstralTestBuilder(app_type=analysis.app_type)
        
        # Create test case format
        test_case = {
            'name': test_name,
            'steps': steps,
            'startUrl': analysis.url
        }
        
        return builder.build_from_test_case(test_case)
    
    def get_suggested_actions(self, analysis_data: Dict) -> List[Dict]:
        """
        Get suggested actions from page analysis.
        
        Used by the UI to show what actions are available.
        """
        analysis = self.intelligence.process_extension_analysis(analysis_data)
        return analysis.suggestions


# ============================================================
# API FUNCTIONS
# ============================================================

def process_page_analysis(analysis_data: Dict) -> PageAnalysisResult:
    """Process page analysis from extension."""
    service = PageIntelligenceService()
    return service.process_extension_analysis(analysis_data)


def generate_test_from_analysis(analysis_data: Dict, test_name: str) -> str:
    """Generate test code from page analysis."""
    workflow = EnhancedTestWorkflow()
    return workflow.process_analysis_and_generate_test(analysis_data, test_name)

