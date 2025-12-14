"""
Application Analyzer
Analyzes the application under test to understand its domain, purpose, and key flows.
Uses LLM to intelligently identify what the application does and what tests are relevant.
"""

import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class ApplicationContext:
    """Context about the application under test."""
    domain: str  # e.g., 'ecommerce', 'crm', 'healthcare', 'finance', 'saas'
    application_type: str  # e.g., 'retail_website', 'patient_portal', 'project_management'
    primary_entities: List[str]  # e.g., ['Product', 'Order', 'Customer']
    key_operations: List[str]  # e.g., ['Purchase', 'Refund', 'Account Management']
    user_roles: List[str]  # e.g., ['Customer', 'Admin', 'Vendor']
    critical_flows: List[Dict[str, Any]]  # Domain-specific critical flows
    business_rules: List[str]  # Important business rules
    test_priorities: Dict[str, str]  # What to test and priority
    metadata: Dict[str, Any] = field(default_factory=dict)


class ApplicationAnalyzer:
    """Analyzes application to understand domain and generate relevant tests."""
    
    # Common application patterns
    APPLICATION_PATTERNS = {
        'ecommerce': {
            'indicators': ['cart', 'checkout', 'product', 'add to cart', 'shopping'],
            'entities': ['Product', 'Order', 'Cart', 'Customer', 'Payment'],
            'flows': ['Browse Products', 'Add to Cart', 'Checkout', 'Order Management'],
            'test_data': {'product_names': True, 'addresses': True, 'payment_cards': True}
        },
        'crm': {
            'indicators': ['contact', 'lead', 'opportunity', 'account', 'deal'],
            'entities': ['Contact', 'Lead', 'Opportunity', 'Account', 'Deal'],
            'flows': ['Create Lead', 'Convert Lead', 'Manage Contacts', 'Track Deals'],
            'test_data': {'contact_info': True, 'company_data': True, 'deal_amounts': True}
        },
        'healthcare': {
            'indicators': ['patient', 'appointment', 'prescription', 'medical record', 'doctor'],
            'entities': ['Patient', 'Appointment', 'Prescription', 'Medical Record', 'Provider'],
            'flows': ['Schedule Appointment', 'View Records', 'Prescription Management', 'Billing'],
            'test_data': {'patient_info': True, 'medical_data': True, 'appointment_times': True}
        },
        'finance': {
            'indicators': ['account', 'transaction', 'transfer', 'balance', 'payment'],
            'entities': ['Account', 'Transaction', 'Transfer', 'Payment', 'Statement'],
            'flows': ['Account Management', 'Transfer Funds', 'Payment Processing', 'View Statements'],
            'test_data': {'account_numbers': True, 'transaction_amounts': True, 'routing_numbers': True}
        },
        'saas': {
            'indicators': ['subscription', 'plan', 'billing', 'workspace', 'team'],
            'entities': ['User', 'Subscription', 'Workspace', 'Team', 'Billing'],
            'flows': ['Sign Up', 'Subscription Management', 'Team Management', 'Billing'],
            'test_data': {'user_accounts': True, 'subscription_plans': True, 'workspace_names': True}
        },
        'education': {
            'indicators': ['course', 'student', 'enrollment', 'grade', 'assignment'],
            'entities': ['Course', 'Student', 'Enrollment', 'Grade', 'Assignment'],
            'flows': ['Course Enrollment', 'Assignment Submission', 'Grade Management', 'Student Portal'],
            'test_data': {'student_info': True, 'course_data': True, 'grades': True}
        },
        'real_estate': {
            'indicators': ['property', 'listing', 'agent', 'inquiry', 'viewing'],
            'entities': ['Property', 'Listing', 'Agent', 'Inquiry', 'Viewing'],
            'flows': ['Property Search', 'Create Listing', 'Schedule Viewing', 'Submit Inquiry'],
            'test_data': {'property_addresses': True, 'agent_info': True, 'viewing_times': True}
        },
        'job_portal': {
            'indicators': ['job', 'application', 'resume', 'candidate', 'employer'],
            'entities': ['Job', 'Application', 'Resume', 'Candidate', 'Employer'],
            'flows': ['Job Search', 'Submit Application', 'Resume Upload', 'Application Tracking'],
            'test_data': {'job_titles': True, 'resume_data': True, 'application_info': True}
        },
        'social_media': {
            'indicators': ['post', 'feed', 'profile', 'follow', 'message'],
            'entities': ['Post', 'Profile', 'Message', 'Connection', 'Content'],
            'flows': ['Create Post', 'Follow Users', 'Send Messages', 'Profile Management'],
            'test_data': {'post_content': True, 'profile_info': True, 'message_text': True}
        },
        'booking': {
            'indicators': ['booking', 'reservation', 'calendar', 'availability', 'confirmation'],
            'entities': ['Booking', 'Reservation', 'Calendar', 'Availability', 'Confirmation'],
            'flows': ['Check Availability', 'Make Booking', 'Manage Reservations', 'Cancellation'],
            'test_data': {'booking_dates': True, 'guest_info': True, 'special_requests': True}
        }
    }
    
    def __init__(self, llm_service=None):
        """Initialize with optional LLM service for intelligent analysis."""
        self.llm_service = llm_service
    
    async def analyze_application(
        self,
        pages: List[Dict[str, Any]],
        base_url: str,
        page_titles: List[str],
        headings: List[str],
        buttons: List[str],
        forms: List[Dict],
        links: List[str]
    ) -> ApplicationContext:
        """
        Analyze application to understand its domain and purpose.
        
        Args:
            pages: List of discovered pages with metadata
            base_url: Base URL of application
            page_titles: All page titles found
            headings: All headings found across pages
            buttons: All button texts found
            forms: All forms with their fields
            links: All link texts found
        
        Returns:
            ApplicationContext with domain analysis
        """
        logger.info("Analyzing application to understand domain and purpose")
        
        # Step 1: Heuristic analysis (fast, deterministic)
        heuristic_result = self._heuristic_analysis(
            base_url, page_titles, headings, buttons, forms, links
        )
        
        # Step 2: LLM analysis (if available, more intelligent)
        if self.llm_service:
            try:
                llm_result = await self._llm_analysis(
                    pages, page_titles, headings, buttons, forms
                )
                # Merge LLM insights with heuristic results
                domain = llm_result.get('domain') or heuristic_result['domain']
                application_type = llm_result.get('application_type') or heuristic_result['application_type']
            except Exception as e:
                logger.warning(f"LLM analysis failed, using heuristic: {e}")
                domain = heuristic_result['domain']
                application_type = heuristic_result['application_type']
        else:
            domain = heuristic_result['domain']
            application_type = heuristic_result['application_type']
        
        # Step 3: Identify entities and operations
        entities = self._identify_entities(headings, buttons, forms, domain)
        operations = self._identify_operations(buttons, links, forms, domain)
        user_roles = self._identify_user_roles(pages, buttons, links)
        
        # Step 4: Generate critical flows for this domain
        critical_flows = self._generate_critical_flows(
            domain, application_type, entities, operations, pages
        )
        
        # Step 5: Identify business rules
        business_rules = self._identify_business_rules(forms, domain)
        
        # Step 6: Determine test priorities
        test_priorities = self._determine_test_priorities(
            domain, critical_flows, entities
        )
        
        return ApplicationContext(
            domain=domain,
            application_type=application_type,
            primary_entities=entities,
            key_operations=operations,
            user_roles=user_roles,
            critical_flows=critical_flows,
            business_rules=business_rules,
            test_priorities=test_priorities,
            metadata={
                'base_url': base_url,
                'pages_analyzed': len(pages),
                'analyzed_at': datetime.utcnow().isoformat()
            }
        )
    
    def _heuristic_analysis(
        self,
        base_url: str,
        page_titles: List[str],
        headings: List[str],
        buttons: List[str],
        forms: List[Dict],
        links: List[str]
    ) -> Dict[str, Any]:
        """Fast heuristic analysis based on keywords and patterns."""
        all_text = ' '.join([
            base_url.lower(),
            ' '.join(page_titles).lower(),
            ' '.join(headings).lower(),
            ' '.join(buttons).lower(),
            ' '.join(links).lower()
        ])
        
        # Score each application pattern
        scores = {}
        for domain, pattern in self.APPLICATION_PATTERNS.items():
            score = 0
            for indicator in pattern['indicators']:
                if indicator.lower() in all_text:
                    score += 1
            scores[domain] = score
        
        # Get highest scoring domain
        best_domain = max(scores.items(), key=lambda x: x[1])[0] if scores else 'generic'
        
        # Determine application type
        application_type = self._determine_application_type(best_domain, all_text)
        
        return {
            'domain': best_domain,
            'application_type': application_type,
            'confidence': scores.get(best_domain, 0) / len(self.APPLICATION_PATTERNS[best_domain]['indicators']) if best_domain != 'generic' else 0
        }
    
    async def _llm_analysis(
        self,
        pages: List[Dict],
        page_titles: List[str],
        headings: List[str],
        buttons: List[str],
        forms: List[Dict]
    ) -> Dict[str, Any]:
        """Use LLM to intelligently analyze application."""
        if not self.llm_service:
            return {}
        
        prompt = f"""Analyze this web application and determine:
1. What domain/industry it belongs to (ecommerce, crm, healthcare, finance, saas, etc.)
2. What type of application it is
3. What are the primary entities (e.g., Product, Order, Patient, Contact)
4. What are the key operations (e.g., Purchase, Appointment, Create Lead)
5. What are the critical user flows that should be tested

Application Information:
- Page Titles: {', '.join(page_titles[:20])}
- Headings: {', '.join(headings[:30])}
- Buttons: {', '.join(buttons[:30])}
- Forms: {len(forms)} forms found

Respond in JSON format:
{{
    "domain": "domain_name",
    "application_type": "specific_type",
    "primary_entities": ["Entity1", "Entity2"],
    "key_operations": ["Operation1", "Operation2"],
    "critical_flows": [
        {{"name": "Flow Name", "description": "What this flow does", "priority": "high|medium|low"}}
    ],
    "reasoning": "Why you classified it this way"
}}"""
        
        try:
            response = await self.llm_service.generate(prompt)
            # Parse JSON response
            import json
            result = json.loads(response)
            return result
        except Exception as e:
            logger.warning(f"LLM analysis failed: {e}")
            return {}
    
    def _identify_entities(
        self,
        headings: List[str],
        buttons: List[str],
        forms: List[Dict],
        domain: str
    ) -> List[str]:
        """Identify primary entities in the application."""
        entities = set()
        
        # Use domain-specific patterns
        if domain in self.APPLICATION_PATTERNS:
            pattern = self.APPLICATION_PATTERNS[domain]
            for entity in pattern['entities']:
                # Check if entity appears in headings/buttons
                entity_lower = entity.lower()
                for heading in headings:
                    if entity_lower in heading.lower():
                        entities.add(entity)
                for button in buttons:
                    if entity_lower in button.lower():
                        entities.add(entity)
        
        # Extract from forms (form actions often indicate entities)
        for form in forms:
            action = form.get('action', '').lower()
            for entity in ['user', 'product', 'order', 'contact', 'patient', 'account']:
                if entity in action:
                    entities.add(entity.capitalize())
        
        return sorted(list(entities))
    
    def _identify_operations(
        self,
        buttons: List[str],
        links: List[str],
        forms: List[Dict],
        domain: str
    ) -> List[str]:
        """Identify key operations in the application."""
        operations = set()
        
        # Common operations
        operation_keywords = [
            'create', 'add', 'new', 'edit', 'update', 'delete', 'remove',
            'submit', 'save', 'cancel', 'search', 'filter', 'view', 'view details',
            'purchase', 'buy', 'order', 'checkout', 'book', 'schedule', 'register',
            'login', 'signup', 'logout', 'manage', 'configure', 'settings'
        ]
        
        all_actions = buttons + links + [form.get('action', '') for form in forms]
        
        for action in all_actions:
            action_lower = action.lower()
            for keyword in operation_keywords:
                if keyword in action_lower:
                    operations.add(keyword.capitalize())
        
        return sorted(list(operations))
    
    def _identify_user_roles(
        self,
        pages: List[Dict],
        buttons: List[str],
        links: List[str]
    ) -> List[str]:
        """Identify user roles in the application."""
        roles = set()
        
        role_keywords = ['admin', 'user', 'customer', 'patient', 'doctor', 'agent', 'manager', 'employee']
        
        all_text = ' '.join(buttons + links + [p.get('title', '') for p in pages])
        all_text_lower = all_text.lower()
        
        for keyword in role_keywords:
            if keyword in all_text_lower:
                roles.add(keyword.capitalize())
        
        # Default roles if none found
        if not roles:
            roles = {'User', 'Admin'}
        
        return sorted(list(roles))
    
    def _generate_critical_flows(
        self,
        domain: str,
        application_type: str,
        entities: List[str],
        operations: List[str],
        pages: List[Dict]
    ) -> List[Dict[str, Any]]:
        """Generate critical flows specific to this application domain."""
        flows = []
        
        # Domain-specific flows
        if domain == 'ecommerce':
            flows = [
                {
                    'name': 'Product Discovery and Purchase',
                    'description': 'Browse products, view details, add to cart, checkout',
                    'priority': 'high',
                    'steps': ['Browse Products', 'View Product Details', 'Add to Cart', 'Checkout', 'Order Confirmation']
                },
                {
                    'name': 'Account Management',
                    'description': 'Create account, login, manage profile, view orders',
                    'priority': 'high',
                    'steps': ['Sign Up', 'Login', 'View Profile', 'Update Profile', 'View Order History']
                }
            ]
        elif domain == 'crm':
            flows = [
                {
                    'name': 'Lead Management',
                    'description': 'Create lead, convert to opportunity, manage contact',
                    'priority': 'high',
                    'steps': ['Create Lead', 'View Lead Details', 'Convert Lead', 'Create Contact', 'Manage Deal']
                },
                {
                    'name': 'Contact Management',
                    'description': 'Create contact, update information, track interactions',
                    'priority': 'high',
                    'steps': ['Create Contact', 'Edit Contact', 'Add Note', 'Schedule Follow-up']
                }
            ]
        elif domain == 'healthcare':
            flows = [
                {
                    'name': 'Appointment Scheduling',
                    'description': 'Patient schedules appointment with provider',
                    'priority': 'high',
                    'steps': ['Login', 'Select Provider', 'Choose Date/Time', 'Confirm Appointment', 'View Confirmation']
                },
                {
                    'name': 'Medical Records Access',
                    'description': 'Patient views medical records and test results',
                    'priority': 'high',
                    'steps': ['Login', 'Navigate to Records', 'View Test Results', 'Download Records']
                }
            ]
        elif domain == 'finance':
            flows = [
                {
                    'name': 'Account Management',
                    'description': 'View account balance, transaction history',
                    'priority': 'high',
                    'steps': ['Login', 'View Account Summary', 'View Transactions', 'Filter Transactions']
                },
                {
                    'name': 'Fund Transfer',
                    'description': 'Transfer funds between accounts',
                    'priority': 'high',
                    'steps': ['Login', 'Navigate to Transfer', 'Select Accounts', 'Enter Amount', 'Review Transfer', 'Confirm']
                }
            ]
        elif domain == 'saas':
            flows = [
                {
                    'name': 'Subscription Management',
                    'description': 'Sign up, select plan, manage subscription',
                    'priority': 'high',
                    'steps': ['Sign Up', 'Select Plan', 'Enter Payment Info', 'Activate Subscription', 'Manage Subscription']
                },
                {
                    'name': 'Workspace Management',
                    'description': 'Create workspace, invite team members, configure settings',
                    'priority': 'high',
                    'steps': ['Create Workspace', 'Invite Members', 'Configure Settings', 'Manage Permissions']
                }
            ]
        else:
            # Generic flows based on entities and operations
            if 'Create' in operations and entities:
                flows.append({
                    'name': f'Create {entities[0]}',
                    'description': f'Create new {entities[0].lower()}',
                    'priority': 'high',
                    'steps': [f'Navigate to Create {entities[0]}', 'Fill Form', 'Submit', 'Verify Created']
                })
        
        return flows
    
    def _identify_business_rules(self, forms: List[Dict], domain: str) -> List[str]:
        """Identify business rules from forms and domain."""
        rules = []
        
        for form in forms:
            fields = form.get('fields', [])
            required_fields = [f for f in fields if f.get('required')]
            if required_fields:
                rules.append(f"Form '{form.get('name', 'Unknown')}' requires: {', '.join([f['name'] for f in required_fields])}")
        
        return rules
    
    def _determine_test_priorities(
        self,
        domain: str,
        critical_flows: List[Dict],
        entities: List[str]
    ) -> Dict[str, str]:
        """Determine what to test and priority."""
        priorities = {}
        
        # High priority: Critical flows
        for flow in critical_flows:
            if flow.get('priority') == 'high':
                priorities[flow['name']] = 'high'
        
        # Medium priority: Entity CRUD operations
        for entity in entities:
            priorities[f'{entity} CRUD Operations'] = 'medium'
        
        # Low priority: UI elements, accessibility
        priorities['UI Consistency'] = 'low'
        priorities['Accessibility'] = 'low'
        
        return priorities
    
    def _determine_application_type(self, domain: str, all_text: str) -> str:
        """Determine specific application type within domain."""
        if domain == 'ecommerce':
            if 'b2b' in all_text or 'wholesale' in all_text:
                return 'b2b_ecommerce'
            return 'retail_ecommerce'
        elif domain == 'crm':
            if 'salesforce' in all_text or 'sales' in all_text:
                return 'sales_crm'
            return 'generic_crm'
        elif domain == 'healthcare':
            if 'hospital' in all_text:
                return 'hospital_portal'
            elif 'clinic' in all_text:
                return 'clinic_portal'
            return 'patient_portal'
        
        return f'{domain}_application'







