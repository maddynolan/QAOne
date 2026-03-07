"""
JUnit XML Report Generator

Generates JUnit XML format reports from test run results.
Compatible with Jenkins, GitLab CI, GitHub Actions, and other CI/CD tools.
"""

import xml.etree.ElementTree as ET
from xml.dom import minidom
from typing import Dict, Any, List, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class JUnitReportGenerator:
    """Generate JUnit XML reports from test execution results."""

    @staticmethod
    def generate(test_run: Dict[str, Any]) -> str:
        """
        Generate JUnit XML from a test run result.

        Args:
            test_run: Dict with keys:
                - id: test run ID
                - test_case_name: name of test case
                - status: 'passed' | 'failed' | 'error'
                - duration_ms: total duration in milliseconds
                - started_at: ISO timestamp
                - steps: list of step results, each with:
                    - name: step name/description
                    - status: 'passed' | 'failed' | 'skipped'
                    - duration_ms: step duration
                    - error: error message (if failed)
                    - healed: boolean (if self-healed)
                    - working_selector: healed selector (if healed)

        Returns:
            JUnit XML string
        """
        try:
            steps = test_run.get('steps', [])
            test_case_name = test_run.get('test_case_name', test_run.get('name', 'Unknown Test'))

            # Count results
            total = len(steps)
            failures = sum(1 for s in steps if s.get('status') == 'failed')
            errors = sum(1 for s in steps if s.get('status') == 'error')
            skipped = sum(1 for s in steps if s.get('status') == 'skipped')
            duration_s = (test_run.get('duration_ms', 0) or 0) / 1000.0

            # Build XML
            testsuites = ET.Element('testsuites')
            testsuites.set('name', 'Flowstral Test Results')
            testsuites.set('tests', str(total))
            testsuites.set('failures', str(failures))
            testsuites.set('errors', str(errors))
            testsuites.set('time', f'{duration_s:.3f}')

            testsuite = ET.SubElement(testsuites, 'testsuite')
            testsuite.set('name', test_case_name)
            testsuite.set('tests', str(total))
            testsuite.set('failures', str(failures))
            testsuite.set('errors', str(errors))
            testsuite.set('skipped', str(skipped))
            testsuite.set('time', f'{duration_s:.3f}')
            testsuite.set('timestamp', test_run.get('started_at', datetime.utcnow().isoformat()))

            # Properties
            properties = ET.SubElement(testsuite, 'properties')
            for key in ['environment', 'browser', 'base_url']:
                if test_run.get(key):
                    prop = ET.SubElement(properties, 'property')
                    prop.set('name', key)
                    prop.set('value', str(test_run[key]))

            # Test cases (one per step)
            for idx, step in enumerate(steps):
                testcase = ET.SubElement(testsuite, 'testcase')
                step_name = step.get('name', step.get('description', f'Step {idx + 1}'))
                testcase.set('name', f'Step {idx + 1}: {step_name}')
                testcase.set('classname', f'{test_case_name}')
                step_duration = (step.get('duration_ms', 0) or 0) / 1000.0
                testcase.set('time', f'{step_duration:.3f}')

                status = step.get('status', 'passed')

                if status == 'failed':
                    failure = ET.SubElement(testcase, 'failure')
                    failure.set('message', step.get('error', 'Step failed'))
                    failure.set('type', step.get('error_type', 'AssertionError'))
                    failure.text = step.get('error', '')

                elif status == 'error':
                    error = ET.SubElement(testcase, 'error')
                    error.set('message', step.get('error', 'Step error'))
                    error.set('type', 'ExecutionError')
                    error.text = step.get('error', '')

                elif status == 'skipped':
                    skipped_el = ET.SubElement(testcase, 'skipped')
                    skipped_el.set('message', step.get('skip_reason', 'Skipped'))

                # Self-healing info as system-out
                if step.get('healed'):
                    system_out = ET.SubElement(testcase, 'system-out')
                    healing_info = f'Self-healed: original selector failed, healed to: {step.get("working_selector", "unknown")}'
                    system_out.text = healing_info

            # Pretty print
            rough_string = ET.tostring(testsuites, encoding='unicode')
            dom = minidom.parseString(rough_string)
            return dom.toprettyxml(indent='  ', encoding=None)

        except Exception as e:
            logger.error(f"Failed to generate JUnit XML: {e}")
            # Return minimal valid XML on error
            return f'''<?xml version="1.0" ?>
<testsuites name="Flowstral Test Results" tests="0" failures="1" errors="0" time="0">
  <testsuite name="Error" tests="1" failures="1">
    <testcase name="Report Generation" classname="Error">
      <failure message="Failed to generate report: {str(e)}" type="ReportError"/>
    </testcase>
  </testsuite>
</testsuites>'''
