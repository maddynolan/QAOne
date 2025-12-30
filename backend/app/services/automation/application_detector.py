"""
Application Detection and Selector Strategy
Detects application type and provides appropriate selector strategies
"""

import logging
import re
from typing import Dict, List, Optional, Tuple
from enum import Enum

logger = logging.getLogger(__name__)


class ApplicationType(Enum):
    """Supported application types"""
    SALESFORCE = "salesforce"
    SAP = "sap"
    ORACLE = "oracle"
    ORACLE_SIEBEL = "oracle_siebel"
    ORACLE_EBS = "oracle_ebs"
    NETSUITE = "netsuite"
    MICROSOFT_DYNAMICS = "microsoft_dynamics"
    PEGA = "pega"
    WORKDAY = "workday"
    SERVICENOW = "servicenow"
    GUIDEWIRE = "guidewire"
    AVALOQ = "avaloq"
    OUTSYSTEMS = "outsystems"
    MENDIX = "mendix"
    SNOWFLAKE = "snowflake"
    REACT = "react"
    ANGULAR = "angular"
    VUE = "vue"
    GENERIC = "generic"
    UNKNOWN = "unknown"


class SelectorStrategy(Enum):
    """Selector priority strategies"""
    SALESFORCE_LWC = "salesforce_lwc"  # Title, href, data-*, avoid dynamic classes
    SEMANTIC = "semantic"  # getByRole, getByText, getByLabel
    CSS_STABLE = "css_stable"  # ID, stable classes, attributes
    CSS_FALLBACK = "css_fallback"  # Any CSS selector


class ApplicationDetector:
    """Detects application type from DOM and provides selector strategies"""
    
    # Salesforce detection patterns
    SALESFORCE_INDICATORS = [
        r'lwc-\w+',  # LWC dynamic classes
        r'slds-',  # Salesforce Lightning Design System
        r'data-menubar-item',
        r'data-menulist-item',
        r'commerce-drilldown-navigation',
        r'var\(--lwc-',  # Salesforce CSS variables
        r'var\(--dxp-',  # Salesforce Experience Cloud variables
        r'/s/',  # Salesforce Experience Cloud URL pattern
    ]
    
    # React detection patterns
    REACT_INDICATORS = [
        r'data-reactroot',
        r'__reactInternalInstance',
        r'react-',
    ]
    
    # Angular detection patterns
    ANGULAR_INDICATORS = [
        r'ng-',
        r'_ngcontent-',
        r'\[ng-reflect-',
    ]
    
    # Vue detection patterns
    VUE_INDICATORS = [
        r'data-v-',
        r'__vue__',
    ]
    
    # SAP detection patterns
    SAP_INDICATORS = [
        r'sap-',  # SAP UI5 classes
        r'sapUi',  # SAP UI5 JavaScript
        r'sap\.',  # SAP namespaces
        r'/sap/',  # SAP URL pattern
        r'sap\.ui\.',  # SAP UI5 framework
        r'data-sap-ui',  # SAP UI5 data attributes
    ]
    
    # Oracle detection patterns
    ORACLE_INDICATORS = [
        r'data-afr-',  # Oracle ADF (Application Development Framework)
        r'afr-',  # Oracle ADF classes
        r'oracle\.',  # Oracle namespaces
        r'/adf/',  # Oracle ADF URL pattern
        r'x1[0-9a-f]{32}',  # Oracle Forms IDs
        r'pt_',  # Oracle PeopleSoft
        r'ps_',  # Oracle PeopleSoft
    ]
    
    # Pega detection patterns
    PEGA_INDICATORS = [
        r'data-ctl-id',  # Pega control ID
        r'data-node-id',  # Pega node ID
        r'pz-',  # Pega classes
        r'pega-',  # Pega classes
        r'/prweb/',  # Pega URL pattern
        r'pega\.',  # Pega namespaces
    ]
    
    # Workday detection patterns
    WORKDAY_INDICATORS = [
        r'data-automation-id',  # Workday automation ID
        r'data-uxid',  # Workday UX ID
        r'wd-',  # Workday classes
        r'workday\.',  # Workday namespaces
        r'/workday/',  # Workday URL pattern
        r'wdApp',  # Workday app identifier
    ]
    
    # ServiceNow detection patterns
    SERVICENOW_INDICATORS = [
        r'data-sys-id',  # ServiceNow system ID
        r'data-table',  # ServiceNow table attribute
        r'sn-',  # ServiceNow classes
        r'servicenow\.',  # ServiceNow namespaces
        r'/now/',  # ServiceNow URL pattern
        r'x-snc-',  # ServiceNow custom attributes
    ]
    
    # Snowflake detection patterns
    SNOWFLAKE_INDICATORS = [
        r'snowflake\.',  # Snowflake namespaces
        r'/snowflake/',  # Snowflake URL pattern
        r'sf-',  # Snowflake classes
        r'data-snowflake',  # Snowflake data attributes
    ]
    
    # Microsoft Dynamics 365 detection patterns
    MICROSOFT_DYNAMICS_INDICATORS = [
        r'data-dyn-control-id',  # Dynamics control ID
        r'data-dyn-',  # Dynamics data attributes
        r'dynamics\.',  # Dynamics namespaces
        r'/dynamics/',  # Dynamics URL pattern
        r'ms-crm-',  # Microsoft CRM classes
        r'crm\.',  # CRM namespaces
    ]
    
    # NetSuite detection patterns
    NETSUITE_INDICATORS = [
        r'data-ns-',  # NetSuite data attributes
        r'netsuite\.',  # NetSuite namespaces
        r'/netsuite/',  # NetSuite URL pattern
        r'ns-',  # NetSuite classes
        r'uir-',  # NetSuite UI record classes
    ]
    
    # Oracle Siebel detection patterns
    ORACLE_SIEBEL_INDICATORS = [
        r'data-sbl-',  # Siebel data attributes
        r'sbl-',  # Siebel classes
        r'siebel\.',  # Siebel namespaces
        r'/siebel/',  # Siebel URL pattern
        r's_',  # Siebel element IDs
    ]
    
    # Oracle EBS (E-Business Suite) detection patterns
    ORACLE_EBS_INDICATORS = [
        r'/OA_HTML/',  # Oracle EBS URL pattern
        r'x1[0-9a-f]{32}',  # Oracle Forms IDs
        r'oracle\.apps\.',  # Oracle Apps namespaces
        r'ebs-',  # EBS classes
    ]
    
    # Guidewire detection patterns
    GUIDEWIRE_INDICATORS = [
        r'data-gw-',  # Guidewire data attributes
        r'gw-',  # Guidewire classes
        r'guidewire\.',  # Guidewire namespaces
        r'/guidewire/',  # Guidewire URL pattern
    ]
    
    # Avaloq detection patterns
    AVALOQ_INDICATORS = [
        r'avaloq\.',  # Avaloq namespaces
        r'/avaloq/',  # Avaloq URL pattern
        r'avq-',  # Avaloq classes
        r'data-avq-',  # Avaloq data attributes
    ]
    
    # OutSystems detection patterns
    OUTSYSTEMS_INDICATORS = [
        r'outsystems\.',  # OutSystems namespaces
        r'/outsystems/',  # OutSystems URL pattern
        r'os-',  # OutSystems classes
        r'data-os-',  # OutSystems data attributes
    ]
    
    # Mendix detection patterns
    MENDIX_INDICATORS = [
        r'mx-',  # Mendix classes
        r'mendix\.',  # Mendix namespaces
        r'/mendix/',  # Mendix URL pattern
        r'data-mx-',  # Mendix data attributes
    ]
    
    @staticmethod
    def detect_application(html: str, url: str = "") -> ApplicationType:
        """
        Detect application type from HTML and URL
        
        Args:
            html: HTML content of the page
            url: Current page URL
            
        Returns:
            ApplicationType enum
        """
        html_lower = html.lower()
        url_lower = url.lower()
        
        # Check for Salesforce
        salesforce_score = 0
        for pattern in ApplicationDetector.SALESFORCE_INDICATORS:
            if re.search(pattern, html_lower, re.IGNORECASE):
                salesforce_score += 1
            if re.search(pattern, url_lower, re.IGNORECASE):
                salesforce_score += 1
        
        if salesforce_score >= 2:
            logger.info(f"[APP_DETECT] Detected Salesforce (score: {salesforce_score})")
            return ApplicationType.SALESFORCE
        
        # Check for React
        for pattern in ApplicationDetector.REACT_INDICATORS:
            if re.search(pattern, html_lower):
                logger.info(f"[APP_DETECT] Detected React")
                return ApplicationType.REACT
        
        # Check for Angular
        for pattern in ApplicationDetector.ANGULAR_INDICATORS:
            if re.search(pattern, html_lower):
                logger.info(f"[APP_DETECT] Detected Angular")
                return ApplicationType.ANGULAR
        
        # Check for Vue
        for pattern in ApplicationDetector.VUE_INDICATORS:
            if re.search(pattern, html_lower):
                logger.info(f"[APP_DETECT] Detected Vue")
                return ApplicationType.VUE
        
        # Check for SAP (check before React/Angular/Vue as it may have similar patterns)
        sap_score = 0
        for pattern in ApplicationDetector.SAP_INDICATORS:
            if re.search(pattern, html_lower, re.IGNORECASE):
                sap_score += 1
            if re.search(pattern, url_lower, re.IGNORECASE):
                sap_score += 1
        if sap_score >= 2:
            logger.info(f"[APP_DETECT] Detected SAP (score: {sap_score})")
            return ApplicationType.SAP
        
        # Check for Oracle
        oracle_score = 0
        for pattern in ApplicationDetector.ORACLE_INDICATORS:
            if re.search(pattern, html_lower, re.IGNORECASE):
                oracle_score += 1
            if re.search(pattern, url_lower, re.IGNORECASE):
                oracle_score += 1
        if oracle_score >= 2:
            logger.info(f"[APP_DETECT] Detected Oracle (score: {oracle_score})")
            return ApplicationType.ORACLE
        
        # Check for Pega
        pega_score = 0
        for pattern in ApplicationDetector.PEGA_INDICATORS:
            if re.search(pattern, html_lower, re.IGNORECASE):
                pega_score += 1
            if re.search(pattern, url_lower, re.IGNORECASE):
                pega_score += 1
        if pega_score >= 2:
            logger.info(f"[APP_DETECT] Detected Pega (score: {pega_score})")
            return ApplicationType.PEGA
        
        # Check for Workday
        workday_score = 0
        for pattern in ApplicationDetector.WORKDAY_INDICATORS:
            if re.search(pattern, html_lower, re.IGNORECASE):
                workday_score += 1
            if re.search(pattern, url_lower, re.IGNORECASE):
                workday_score += 1
        if workday_score >= 2:
            logger.info(f"[APP_DETECT] Detected Workday (score: {workday_score})")
            return ApplicationType.WORKDAY
        
        # Check for ServiceNow
        servicenow_score = 0
        for pattern in ApplicationDetector.SERVICENOW_INDICATORS:
            if re.search(pattern, html_lower, re.IGNORECASE):
                servicenow_score += 1
            if re.search(pattern, url_lower, re.IGNORECASE):
                servicenow_score += 1
        if servicenow_score >= 2:
            logger.info(f"[APP_DETECT] Detected ServiceNow (score: {servicenow_score})")
            return ApplicationType.SERVICENOW
        
        # Check for Microsoft Dynamics (check before generic)
        dynamics_score = 0
        for pattern in ApplicationDetector.MICROSOFT_DYNAMICS_INDICATORS:
            if re.search(pattern, html_lower, re.IGNORECASE):
                dynamics_score += 1
            if re.search(pattern, url_lower, re.IGNORECASE):
                dynamics_score += 1
        if dynamics_score >= 2:
            logger.info(f"[APP_DETECT] Detected Microsoft Dynamics (score: {dynamics_score})")
            return ApplicationType.MICROSOFT_DYNAMICS
        
        # Check for NetSuite
        netsuite_score = 0
        for pattern in ApplicationDetector.NETSUITE_INDICATORS:
            if re.search(pattern, html_lower, re.IGNORECASE):
                netsuite_score += 1
            if re.search(pattern, url_lower, re.IGNORECASE):
                netsuite_score += 1
        if netsuite_score >= 2:
            logger.info(f"[APP_DETECT] Detected NetSuite (score: {netsuite_score})")
            return ApplicationType.NETSUITE
        
        # Check for Oracle Siebel (check after Oracle ADF)
        siebel_score = 0
        for pattern in ApplicationDetector.ORACLE_SIEBEL_INDICATORS:
            if re.search(pattern, html_lower, re.IGNORECASE):
                siebel_score += 1
            if re.search(pattern, url_lower, re.IGNORECASE):
                siebel_score += 1
        if siebel_score >= 2:
            logger.info(f"[APP_DETECT] Detected Oracle Siebel (score: {siebel_score})")
            return ApplicationType.ORACLE_SIEBEL
        
        # Check for Oracle EBS (check after Oracle ADF)
        ebs_score = 0
        for pattern in ApplicationDetector.ORACLE_EBS_INDICATORS:
            if re.search(pattern, html_lower, re.IGNORECASE):
                ebs_score += 1
            if re.search(pattern, url_lower, re.IGNORECASE):
                ebs_score += 1
        if ebs_score >= 2:
            logger.info(f"[APP_DETECT] Detected Oracle EBS (score: {ebs_score})")
            return ApplicationType.ORACLE_EBS
        
        # Check for Guidewire
        guidewire_score = 0
        for pattern in ApplicationDetector.GUIDEWIRE_INDICATORS:
            if re.search(pattern, html_lower, re.IGNORECASE):
                guidewire_score += 1
            if re.search(pattern, url_lower, re.IGNORECASE):
                guidewire_score += 1
        if guidewire_score >= 2:
            logger.info(f"[APP_DETECT] Detected Guidewire (score: {guidewire_score})")
            return ApplicationType.GUIDEWIRE
        
        # Check for Avaloq
        avaloq_score = 0
        for pattern in ApplicationDetector.AVALOQ_INDICATORS:
            if re.search(pattern, html_lower, re.IGNORECASE):
                avaloq_score += 1
            if re.search(pattern, url_lower, re.IGNORECASE):
                avaloq_score += 1
        if avaloq_score >= 2:
            logger.info(f"[APP_DETECT] Detected Avaloq (score: {avaloq_score})")
            return ApplicationType.AVALOQ
        
        # Check for OutSystems
        outsystems_score = 0
        for pattern in ApplicationDetector.OUTSYSTEMS_INDICATORS:
            if re.search(pattern, html_lower, re.IGNORECASE):
                outsystems_score += 1
            if re.search(pattern, url_lower, re.IGNORECASE):
                outsystems_score += 1
        if outsystems_score >= 2:
            logger.info(f"[APP_DETECT] Detected OutSystems (score: {outsystems_score})")
            return ApplicationType.OUTSYSTEMS
        
        # Check for Mendix
        mendix_score = 0
        for pattern in ApplicationDetector.MENDIX_INDICATORS:
            if re.search(pattern, html_lower, re.IGNORECASE):
                mendix_score += 1
            if re.search(pattern, url_lower, re.IGNORECASE):
                mendix_score += 1
        if mendix_score >= 2:
            logger.info(f"[APP_DETECT] Detected Mendix (score: {mendix_score})")
            return ApplicationType.MENDIX
        
        # Check for Snowflake
        snowflake_score = 0
        for pattern in ApplicationDetector.SNOWFLAKE_INDICATORS:
            if re.search(pattern, html_lower, re.IGNORECASE):
                snowflake_score += 1
            if re.search(pattern, url_lower, re.IGNORECASE):
                snowflake_score += 1
        if snowflake_score >= 2:
            logger.info(f"[APP_DETECT] Detected Snowflake (score: {snowflake_score})")
            return ApplicationType.SNOWFLAKE
        
        logger.info(f"[APP_DETECT] Detected Generic/Unknown application")
        return ApplicationType.GENERIC
    
    @staticmethod
    def get_selector_strategy(app_type: ApplicationType) -> SelectorStrategy:
        """Get selector strategy for application type"""
        if app_type == ApplicationType.SALESFORCE:
            return SelectorStrategy.SALESFORCE_LWC
        elif app_type in [ApplicationType.REACT, ApplicationType.ANGULAR, ApplicationType.VUE]:
            return SelectorStrategy.SEMANTIC
        elif app_type in [ApplicationType.SAP, ApplicationType.ORACLE, ApplicationType.ORACLE_SIEBEL,
                          ApplicationType.ORACLE_EBS, ApplicationType.NETSUITE, ApplicationType.MICROSOFT_DYNAMICS,
                          ApplicationType.PEGA, ApplicationType.WORKDAY, ApplicationType.SERVICENOW,
                          ApplicationType.GUIDEWIRE, ApplicationType.AVALOQ, ApplicationType.OUTSYSTEMS,
                          ApplicationType.MENDIX, ApplicationType.SNOWFLAKE]:
            # Enterprise apps use app-specific attributes
            return SelectorStrategy.CSS_STABLE
        else:
            return SelectorStrategy.CSS_STABLE
    
    @staticmethod
    def analyze_element(element_data: Dict) -> Dict[str, any]:
        """
        Analyze element to determine best selectors
        
        Args:
            element_data: Element metadata from DOM
            
        Returns:
            Dictionary with selector recommendations
        """
        tag_name = element_data.get('tag_name', '').lower()
        attributes = element_data.get('attributes', {})
        text_content = element_data.get('text_content', '').strip()
        classes = element_data.get('class', '').split() if element_data.get('class') else []
        
        recommendations = {
            'selectors': [],
            'strategy': 'unknown',
            'confidence': 0.0,
            'warnings': []
        }
        
        # Check for Salesforce LWC patterns
        has_lwc_class = any('lwc-' in cls for cls in classes)
        has_slds_class = any('slds-' in cls for cls in classes)
        
        if has_lwc_class or has_slds_class:
            recommendations['strategy'] = 'salesforce_lwc'
            recommendations['confidence'] = 0.9
            
            # Salesforce: Prioritize title, href, data-* attributes
            if attributes.get('title'):
                recommendations['selectors'].append({
                    'type': 'attribute',
                    'selector': f'{tag_name}[title="{attributes["title"]}"]',
                    'priority': 1,
                    'reason': 'Title attribute is most stable in Salesforce LWC'
                })
            
            if tag_name == 'a' and attributes.get('href'):
                href = attributes['href']
                recommendations['selectors'].append({
                    'type': 'attribute',
                    'selector': f'a[href="{href}"]',
                    'priority': 2,
                    'reason': 'Href attribute is stable in Salesforce'
                })
            
            # Data attributes
            data_attrs = {k: v for k, v in attributes.items() if k.startswith('data-')}
            if data_attrs:
                data_selector_parts = [f'{tag_name}']
                for key, value in data_attrs.items():
                    if value:
                        data_selector_parts.append(f'[{key}="{value}"]')
                    else:
                        data_selector_parts.append(f'[{key}]')
                recommendations['selectors'].append({
                    'type': 'attribute',
                    'selector': ''.join(data_selector_parts),
                    'priority': 3,
                    'reason': 'Data attributes are stable in Salesforce'
                })
            
            # Warn about dynamic classes
            if has_lwc_class:
                recommendations['warnings'].append(
                    'Avoid using LWC dynamic classes (lwc-*) - they change on each load'
                )
        
        # Generic/Semantic selectors
        else:
            recommendations['strategy'] = 'semantic'
            recommendations['confidence'] = 0.7
            
            # ID selector (highest priority if stable)
            if attributes.get('id') and not any(x in attributes['id'] for x in ['react', 'angular', 'vue']):
                recommendations['selectors'].append({
                    'type': 'id',
                    'selector': f'#{attributes["id"]}',
                    'priority': 1,
                    'reason': 'ID selector is most specific'
                })
            
            # Role-based (for buttons, links, etc.)
            role = attributes.get('role') or ApplicationDetector._infer_role(tag_name, attributes)
            if role and text_content:
                recommendations['selectors'].append({
                    'type': 'semantic',
                    'selector': f'page.getByRole("{role}", {{ name: "{text_content[:50]}" }})',
                    'priority': 2,
                    'reason': 'Semantic locator with role and name'
                })
            
            # Label-based (for inputs)
            if tag_name in ['input', 'textarea', 'select']:
                label = attributes.get('aria-label') or attributes.get('placeholder')
                if label:
                    recommendations['selectors'].append({
                        'type': 'semantic',
                        'selector': f'page.getByLabel("{label}")',
                        'priority': 2,
                        'reason': 'Label-based selector for form fields'
                    })
            
            # Text-based
            if text_content and len(text_content) < 100:
                recommendations['selectors'].append({
                    'type': 'semantic',
                    'selector': f'page.getByText("{text_content}")',
                    'priority': 3,
                    'reason': 'Text-based selector'
                })
        
        # CSS fallback
        if attributes.get('class'):
            # Filter out dynamic classes
            stable_classes = [cls for cls in classes if not any(x in cls for x in ['lwc-', 'react-', 'ng-', 'vue-'])]
            if stable_classes:
                class_selector = f'{tag_name}.{".".join(stable_classes[:2])}'  # Limit to 2 classes
                recommendations['selectors'].append({
                    'type': 'css',
                    'selector': class_selector,
                    'priority': 4,
                    'reason': 'CSS class selector (stable classes only)'
                })
        
        # Sort by priority
        recommendations['selectors'].sort(key=lambda x: x['priority'])
        
        return recommendations
    
    @staticmethod
    def _infer_role(tag_name: str, attributes: Dict) -> Optional[str]:
        """Infer ARIA role from tag name and attributes"""
        role_map = {
            'button': 'button',
            'a': 'link',
            'input': 'textbox' if attributes.get('type') != 'button' else 'button',
            'textarea': 'textbox',
            'select': 'combobox',
            'img': 'img',
            'nav': 'navigation',
            'header': 'banner',
            'footer': 'contentinfo',
        }
        
        # Check explicit role first
        if attributes.get('role'):
            return attributes['role']
        
        # Check type for inputs
        if tag_name == 'input':
            input_type = attributes.get('type', 'text')
            if input_type == 'button' or input_type == 'submit':
                return 'button'
            elif input_type == 'checkbox':
                return 'checkbox'
            elif input_type == 'radio':
                return 'radio'
            else:
                return 'textbox'
        
        return role_map.get(tag_name)
    
    @staticmethod
    def generate_playwright_locator(element_data: Dict, app_type: ApplicationType) -> str:
        """
        Generate Playwright locator code based on application type
        
        Args:
            element_data: Element metadata
            app_type: Detected application type
            
        Returns:
            Playwright locator code string
        """
        analysis = ApplicationDetector.analyze_element(element_data)
        
        if not analysis['selectors']:
            # Fallback to generic selector
            tag_name = element_data.get('tag_name', 'div')
            return f"page.locator('{tag_name}').first()"
        
        # Get best selector
        best_selector = analysis['selectors'][0]
        selector_code = best_selector['selector']
        
        # For Salesforce, prefer attribute selectors
        if app_type == ApplicationType.SALESFORCE:
            if best_selector['type'] == 'attribute':
                return f"page.locator('{selector_code}')"
            # Fallback chain for Salesforce
            fallbacks = []
            for sel in analysis['selectors'][:3]:  # Top 3
                if sel['type'] == 'attribute':
                    fallbacks.append(f"page.locator('{sel['selector']}')")
            
            if fallbacks:
                return ' || '.join(fallbacks) if len(fallbacks) > 1 else fallbacks[0]
        
        # For semantic frameworks, use Playwright semantic locators
        if best_selector['type'] == 'semantic':
            return selector_code
        
        # CSS selector
        return f"page.locator('{selector_code}')"


# Singleton instance
_application_detector = None

def get_application_detector() -> ApplicationDetector:
    """Get singleton ApplicationDetector instance"""
    global _application_detector
    if _application_detector is None:
        _application_detector = ApplicationDetector()
    return _application_detector

