"""
LLM-Powered Application Analyzer
Uses GPT-4o-mini to intelligently analyze applications and generate domain-specific test flows.
Implements multi-step analysis with progressive disclosure for cost-effective, scalable testing.
"""

import logging
import json
import asyncio
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
import hashlib

from app.services.llm.openai_service import get_openai_service
from app.services.exploration.application_analyzer import ApplicationContext

logger = logging.getLogger(__name__)


@dataclass
class AnalysisCache:
    """Cache entry for analysis results."""
    url_hash: str
    domain: str
    application_type: str
    entities: List[str]
    operations: List[str]
    cached_at: datetime
    expires_at: datetime


class LLMApplicationAnalyzer:
    """
    Uses GPT-4o-mini to analyze applications intelligently.
    Implements multi-step analysis with caching for scalability.
    """
    
    def __init__(self, enable_caching: bool = True, cache_ttl_hours: int = 24):
        """Initialize LLM analyzer with optional caching."""
        self.openai_service = get_openai_service()
        self.enable_caching = enable_caching
        self.cache_ttl_hours = cache_ttl_hours
        self._cache: Dict[str, AnalysisCache] = {}
        
        if not self.openai_service.is_available():
            logger.warning("OpenAI service not available - LLM analysis will be disabled")
    
    def _get_url_hash(self, url: str) -> str:
        """Generate hash for URL caching."""
        return hashlib.md5(url.encode()).hexdigest()
    
    def _check_cache(self, url: str) -> Optional[Dict[str, Any]]:
        """Check if analysis result is cached."""
        if not self.enable_caching:
            return None
        
        url_hash = self._get_url_hash(url)
        cached = self._cache.get(url_hash)
        
        if cached and cached.expires_at > datetime.utcnow():
            logger.info(f"Using cached analysis for {url}")
            return {
                'domain': cached.domain,
                'application_type': cached.application_type,
                'entities': cached.entities,
                'operations': cached.operations
            }
        
        return None
    
    def _save_cache(self, url: str, analysis: Dict[str, Any]):
        """Save analysis result to cache."""
        if not self.enable_caching:
            return
        
        url_hash = self._get_url_hash(url)
        from datetime import timedelta
        
        self._cache[url_hash] = AnalysisCache(
            url_hash=url_hash,
            domain=analysis.get('domain', 'unknown'),
            application_type=analysis.get('application_type', 'unknown'),
            entities=analysis.get('entities', []),
            operations=analysis.get('operations', []),
            cached_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(hours=self.cache_ttl_hours)
        )
    
    async def analyze_url(self, base_url: str, domain: Optional[str] = None) -> Dict[str, Any]:
        """
        Phase 1: Quick URL analysis before exploration starts.
        
        Args:
            base_url: Base URL of application
            domain: Optional domain name (extracted from URL if not provided)
        
        Returns:
            Dict with initial analysis: domain, expected_entities, exploration_focus, confidence
        """
        # Check cache
        cached = self._check_cache(base_url)
        if cached:
            return cached
        
        if not self.openai_service.is_available():
            logger.warning("OpenAI not available, using heuristic analysis")
            return self._heuristic_url_analysis(base_url, domain)
        
        # Extract domain from URL if not provided
        if not domain:
            from urllib.parse import urlparse
            parsed = urlparse(base_url)
            domain = parsed.netloc or parsed.path
        
        prompt = f"""Analyze this application URL and provide initial insights:

URL: {base_url}
Domain: {domain}

Based on the URL and domain, determine:
1. Likely application domain (ecommerce, crm, healthcare, finance, saas, education, real_estate, job_portal, social_media, booking, or generic)
2. Confidence level (high/medium/low)
3. Expected primary entities (e.g., Product, Order, Patient, Contact, User, Course, Property, Job)
4. Expected key operations (e.g., Purchase, Schedule, Create Lead, Transfer, Enroll, Book, Apply)
5. Suggested exploration focus areas (what pages/features to prioritize)

Respond in JSON format:
{{
    "domain": "string",
    "confidence": "high|medium|low",
    "expected_entities": ["Entity1", "Entity2"],
    "expected_operations": ["Operation1", "Operation2"],
    "exploration_focus": ["area1", "area2"],
    "reasoning": "Why you classified it this way"
}}"""

        try:
            logger.info(f"Calling OpenAI for URL analysis: {base_url}")
            # Use OpenAI service's rewrite_test_case method
            response = await self.openai_service.rewrite_test_case(
                system_prompt="You are an expert QA engineer analyzing web applications. Provide accurate, concise analysis in JSON format.",
                user_message=prompt,
                timeout=10.0,
                max_tokens=1000
            )
            
            logger.info(f"OpenAI response received: {response.get('tokens_used', 0)} tokens")
            
            # Parse JSON response
            content = response.get('response', '{}')
            logger.debug(f"Response content: {content[:200]}...")
            
            # Try to parse JSON - handle markdown code blocks
            if content.strip().startswith('```'):
                # Remove markdown code blocks
                lines = content.strip().split('\n')
                content = '\n'.join([line for line in lines if not line.strip().startswith('```')])
            
            analysis = json.loads(content)
            
            # Save to cache
            self._save_cache(base_url, analysis)
            
            logger.info(f"URL analysis complete: {analysis.get('domain')} (confidence: {analysis.get('confidence')})")
            return analysis
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {e}, content: {content[:500]}")
            logger.warning("Using heuristic analysis as fallback")
            return self._heuristic_url_analysis(base_url, domain)
        except Exception as e:
            logger.error(f"LLM URL analysis failed: {e}", exc_info=True)
            logger.warning("Using heuristic analysis as fallback")
            return self._heuristic_url_analysis(base_url, domain)
    
    async def analyze_structure(
        self,
        base_url: str,
        pages: List[Dict[str, Any]],
        headings: List[str],
        buttons: List[str],
        forms: List[Dict[str, Any]],
        links: List[str],
        initial_analysis: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Phase 2: Deep structure analysis after pages are discovered.
        
        Args:
            base_url: Base URL
            pages: List of discovered pages with metadata
            headings: All headings found
            buttons: All button texts
            forms: All forms with fields
            links: All link texts
            initial_analysis: Optional initial analysis from Phase 1
        
        Returns:
            Complete application context with entities, operations, flows, priorities
        """
        if not self.openai_service.is_available():
            logger.warning("OpenAI not available, using heuristic analysis")
            return self._heuristic_structure_analysis(pages, headings, buttons, forms, links)
        
        # Format pages for prompt
        formatted_pages = []
        for page in pages[:20]:  # Limit to first 20 pages to avoid token limits
            formatted_pages.append({
                'url': page.get('url', ''),
                'title': page.get('title', ''),
                'headings': page.get('headings', [])[:10]  # Limit headings per page
            })
        
        # Format forms
        formatted_forms = []
        for form in forms[:15]:  # Limit forms
            formatted_forms.append({
                'name': form.get('name', ''),
                'action': form.get('action', ''),
                'fields': [
                    {
                        'name': f.get('name', ''),
                        'type': f.get('type', 'text'),
                        'required': f.get('required', False)
                    }
                    for f in form.get('fields', [])[:10]  # Limit fields per form
                ]
            })
        
        domain_hint = initial_analysis.get('domain', 'unknown') if initial_analysis else 'unknown'
        
        prompt = f"""You are a senior QA engineer analyzing a web application.

Application Context:
- Domain (initial): {domain_hint}
- Base URL: {base_url}
- Pages Discovered: {len(pages)}

Page Structure:
{json.dumps(formatted_pages, indent=2)}

Forms Discovered:
{json.dumps(formatted_forms, indent=2)}

Key UI Elements:
- Headings: {', '.join(headings[:50])}
- Buttons: {', '.join(buttons[:50])}
- Links: {', '.join(links[:50])}

Analyze and provide:
1. Confirmed domain and application type
2. Primary entities (what the app manages)
3. Key operations (what users can do)
4. User roles (if identifiable)
5. Critical user flows that MUST be tested
6. Business rules inferred from forms
7. Test priorities (high/medium/low for each flow)

Respond in JSON format:
{{
    "domain": "string",
    "application_type": "string",
    "primary_entities": [
        {{
            "name": "EntityName",
            "operations": ["Create", "Read", "Update", "Delete"],
            "forms_related": ["form_name"],
            "pages_related": ["page_url"]
        }}
    ],
    "key_operations": [
        {{
            "name": "OperationName",
            "description": "What this operation does",
            "priority": "high|medium|low",
            "pages_involved": ["url1", "url2"]
        }}
    ],
    "user_roles": ["Role1", "Role2"],
    "critical_flows": [
        {{
            "name": "Flow Name",
            "description": "What this flow accomplishes",
            "priority": "high|medium|low",
            "steps": ["Step1", "Step2", "Step3"],
            "entities_involved": ["Entity1"],
            "test_data_needed": {{
                "field_name": "data_type"
            }}
        }}
    ],
    "business_rules": [
        "Rule description based on form validations"
    ],
    "test_priorities": {{
        "flow_name": "high|medium|low"
    }},
    "reasoning": "Detailed explanation of analysis"
}}"""

        try:
            logger.info(f"Calling OpenAI for structure analysis: {len(pages)} pages, {len(headings)} headings")
            # Use OpenAI service's rewrite_test_case method
            response = await self.openai_service.rewrite_test_case(
                system_prompt="You are an expert QA engineer. Analyze application structure and provide comprehensive insights in JSON format.",
                user_message=prompt,
                timeout=30.0,
                max_tokens=4000
            )
            
            logger.info(f"OpenAI structure response received: {response.get('tokens_used', 0)} tokens")
            
            # Parse JSON response
            content = response.get('response', '{}')
            logger.debug(f"Structure response content: {content[:200]}...")
            
            # Try to parse JSON - handle markdown code blocks
            if content.strip().startswith('```'):
                # Remove markdown code blocks
                lines = content.strip().split('\n')
                content = '\n'.join([line for line in lines if not line.strip().startswith('```')])
            
            analysis = json.loads(content)
            
            logger.info(f"Structure analysis complete: {analysis.get('domain')}, {len(analysis.get('primary_entities', []))} entities, {len(analysis.get('critical_flows', []))} flows")
            return analysis
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {e}, content: {content[:500]}")
            logger.warning("Using heuristic analysis as fallback")
            return self._heuristic_structure_analysis(pages, headings, buttons, forms, links)
        except Exception as e:
            logger.error(f"LLM structure analysis failed: {e}", exc_info=True)
            logger.warning("Using heuristic analysis as fallback")
            return self._heuristic_structure_analysis(pages, headings, buttons, forms, links)
    
    async def generate_flow(
        self,
        flow_definition: Dict[str, Any],
        pages: List[Dict[str, Any]],
        forms: List[Dict[str, Any]],
        domain: str,
        application_type: str
    ) -> Dict[str, Any]:
        """
        Phase 3: Generate detailed test flow with steps.
        
        Args:
            flow_definition: Flow definition from structure analysis
            pages: Available pages
            forms: Available forms
            domain: Application domain
            application_type: Application type
        
        Returns:
            Detailed flow with steps, test data, safety flags
        """
        if not self.openai_service.is_available():
            logger.warning("OpenAI not available, using template-based flow generation")
            return self._template_flow_generation(flow_definition, pages, forms)
        
        # Format pages and forms for prompt
        formatted_pages = [
            {
                'url': p.get('url', ''),
                'title': p.get('title', ''),
                'headings': p.get('headings', [])[:5]
            }
            for p in pages[:15]
        ]
        
        formatted_forms = [
            {
                'name': f.get('name', ''),
                'action': f.get('action', ''),
                'fields': [
                    {'name': field.get('name', ''), 'type': field.get('type', 'text'), 'required': field.get('required', False)}
                    for field in f.get('fields', [])[:8]
                ]
            }
            for f in forms[:10]
        ]
        
        prompt = f"""Generate a detailed test flow for this application:

Application Context:
- Domain: {domain}
- Application Type: {application_type}

Flow to Generate:
- Name: {flow_definition.get('name', 'Unknown')}
- Description: {flow_definition.get('description', '')}
- Priority: {flow_definition.get('priority', 'medium')}
- Entities: {', '.join(flow_definition.get('entities_involved', []))}

Available Pages:
{json.dumps(formatted_pages, indent=2)}

Available Forms:
{json.dumps(formatted_forms, indent=2)}

Generate a step-by-step test flow that:
1. Navigates through the application
2. Fills forms with appropriate test data
3. Verifies expected outcomes
4. Stops before risky actions (payments, deletions, account closures, etc.)

IMPORTANT SAFETY RULES:
- NEVER execute final submission for: payments, orders, account deletion, subscription activation, data export
- Navigate to these steps but mark safe_to_execute as false
- Use test credit cards (4111111111111111) for payment forms
- Use synthetic test data for all forms

For each step, provide:
- Step number
- Action (navigate, click, fill, verify, wait)
- Target element/description
- Test data (if needed)
- Expected result
- Safe to execute (true/false)

Respond in JSON format:
{{
    "flow_name": "string",
    "description": "string",
    "domain": "{domain}",
    "priority": "high|medium|low",
    "steps": [
        {{
            "step_number": 1,
            "action": "navigate|click|fill|verify|wait",
            "target": "element description or selector hint",
            "test_data": {{"field": "value"}} or null,
            "expected_result": "What should happen",
            "safe_to_execute": true|false,
            "verification": "What to verify after step"
        }}
    ],
    "test_data_template": {{
        "field_name": "data_type_and_example"
    }},
    "expected_outcome": "Final expected result",
    "risky_actions": ["action1", "action2"]
}}"""

        try:
            # Use OpenAI service's rewrite_test_case method
            response = await self.openai_service.rewrite_test_case(
                system_prompt="You are an expert QA engineer. Generate safe, comprehensive test flows. Always stop before risky actions. Respond in JSON format.",
                user_message=prompt,
                timeout=20.0,
                max_tokens=3000
            )
            
            # Parse JSON response
            content = response.get('response', '{}')
            flow = json.loads(content)
            
            logger.info(f"Flow generated: {flow.get('flow_name')} with {len(flow.get('steps', []))} steps")
            return flow
            
        except Exception as e:
            logger.error(f"LLM flow generation failed: {e}, using template")
            return self._template_flow_generation(flow_definition, pages, forms)
    
    async def generate_test_data(
        self,
        domain: str,
        entities: List[str],
        forms: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Generate domain-specific test data templates.
        
        Args:
            domain: Application domain
            entities: Primary entities
            forms: Forms that need test data
        
        Returns:
            Test data templates for each form/entity
        """
        if not self.openai_service.is_available():
            return self._heuristic_test_data(domain, entities, forms)
        
        # Extract form fields
        form_fields = []
        for form in forms[:10]:
            for field in form.get('fields', []):
                form_fields.append({
                    'form': form.get('name', ''),
                    'field_name': field.get('name', ''),
                    'field_type': field.get('type', 'text'),
                    'required': field.get('required', False)
                })
        
        prompt = f"""Generate test data templates for this application:

Domain: {domain}
Entities: {', '.join(entities)}
Forms: {len(forms)} forms with {len(form_fields)} fields

For each form field, provide:
- Field name
- Data type (email, name, phone, address, date, number, text, etc.)
- Example value
- Context-aware generation rules

Respond in JSON format:
{{
    "test_data_templates": {{
        "form_name": {{
            "field_name": {{
                "type": "data_type",
                "example": "example_value",
                "generation_rule": "how to generate this data"
            }}
        }}
    }},
    "domain_specific_rules": [
        "Rule for generating data in this domain"
    ]
}}"""

        try:
            # Use OpenAI service's rewrite_test_case method
            response = await self.openai_service.rewrite_test_case(
                system_prompt="You are an expert in test data generation. Create realistic, domain-appropriate test data. Respond in JSON format.",
                user_message=prompt,
                timeout=15.0,
                max_tokens=2000
            )
            
            # Parse JSON response
            content = response.get('response', '{}')
            test_data = json.loads(content)
            return test_data
            
        except Exception as e:
            logger.error(f"LLM test data generation failed: {e}, using heuristic")
            return self._heuristic_test_data(domain, entities, forms)
    
    # Heuristic fallback methods
    def _heuristic_url_analysis(self, base_url: str, domain: Optional[str]) -> Dict[str, Any]:
        """Heuristic URL analysis when LLM is unavailable."""
        url_lower = base_url.lower()
        
        domain_keywords = {
            'ecommerce': ['shop', 'store', 'cart', 'checkout', 'product', 'buy'],
            'healthcare': ['health', 'medical', 'patient', 'doctor', 'clinic', 'hospital'],
            'crm': ['crm', 'contact', 'lead', 'sales', 'opportunity'],
            'finance': ['bank', 'finance', 'payment', 'account', 'transaction'],
            'saas': ['saas', 'subscription', 'workspace', 'team', 'app'],
            'education': ['education', 'course', 'student', 'learn', 'school'],
            'real_estate': ['property', 'real estate', 'listing', 'agent'],
            'job_portal': ['job', 'career', 'recruit', 'resume', 'apply']
        }
        
        detected_domain = 'generic'
        for dom, keywords in domain_keywords.items():
            if any(kw in url_lower for kw in keywords):
                detected_domain = dom
                break
        
        return {
            'domain': detected_domain,
            'confidence': 'low',
            'expected_entities': [],
            'expected_operations': [],
            'exploration_focus': [],
            'reasoning': 'Heuristic analysis based on URL keywords'
        }
    
    def _heuristic_structure_analysis(
        self,
        pages: List[Dict],
        headings: List[str],
        buttons: List[str],
        forms: List[Dict],
        links: List[str]
    ) -> Dict[str, Any]:
        """Heuristic structure analysis when LLM is unavailable."""
        # Use existing ApplicationAnalyzer for heuristic analysis
        from app.services.exploration.application_analyzer import ApplicationAnalyzer
        
        analyzer = ApplicationAnalyzer()
        # This would need the full page structure, simplified here
        return {
            'domain': 'generic',
            'application_type': 'web_application',
            'primary_entities': [],
            'key_operations': [],
            'user_roles': ['User'],
            'critical_flows': [],
            'business_rules': [],
            'test_priorities': {},
            'reasoning': 'Heuristic analysis (LLM unavailable)'
        }
    
    def _template_flow_generation(
        self,
        flow_definition: Dict,
        pages: List[Dict],
        forms: List[Dict]
    ) -> Dict[str, Any]:
        """Template-based flow generation when LLM is unavailable."""
        # Use DomainSpecificFlowGenerator
        from app.services.exploration.domain_specific_flow_generator import DomainSpecificFlowGenerator
        from app.services.exploration.synthetic_data_generator import SyntheticDataGenerator
        
        # Create minimal context
        from app.services.exploration.application_analyzer import ApplicationContext
        context = ApplicationContext(
            domain=flow_definition.get('domain', 'generic'),
            application_type='web_application',
            primary_entities=flow_definition.get('entities_involved', []),
            key_operations=[],
            user_roles=[],
            critical_flows=[],
            business_rules=[],
            test_priorities={}
        )
        
        generator = DomainSpecificFlowGenerator(context, SyntheticDataGenerator())
        flows = generator.generate_flows(pages, forms, [])
        
        if flows:
            flow = flows[0]
            return {
                'flow_name': flow.name,
                'description': flow.description,
                'domain': flow.domain,
                'priority': flow.priority,
                'steps': [
                    {
                        'step_number': s.step_number,
                        'action': s.action,
                        'target': s.target,
                        'test_data': s.data,
                        'expected_result': s.expected_result,
                        'safe_to_execute': s.safe_to_execute
                    }
                    for s in flow.steps
                ],
                'test_data_template': flow.test_data,
                'expected_outcome': flow.expected_outcome,
                'risky_actions': []
            }
        
        return {
            'flow_name': flow_definition.get('name', 'Unknown'),
            'description': flow_definition.get('description', ''),
            'domain': 'generic',
            'priority': 'medium',
            'steps': [],
            'test_data_template': {},
            'expected_outcome': 'Flow completed',
            'risky_actions': []
        }
    
    def _heuristic_test_data(
        self,
        domain: str,
        entities: List[str],
        forms: List[Dict]
    ) -> Dict[str, Any]:
        """Heuristic test data generation when LLM is unavailable."""
        from app.services.exploration.synthetic_data_generator import SyntheticDataGenerator
        
        generator = SyntheticDataGenerator(context={'domain': domain})
        templates = {}
        
        for form in forms:
            form_name = form.get('name', 'unknown')
            templates[form_name] = {}
            for field in form.get('fields', []):
                field_name = field.get('name', '')
                field_type = field.get('type', 'text')
                templates[form_name][field_name] = {
                    'type': field_type,
                    'example': generator.generate(field_type, field_name),
                    'generation_rule': f'Generate {field_type} data'
                }
        
        return {
            'test_data_templates': templates,
            'domain_specific_rules': [f'Generate {domain}-appropriate test data']
        }

