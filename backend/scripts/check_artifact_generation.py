"""
Quick diagnostic script to check artifact generation status
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.flowstral.robust_salesforce_generator import RobustSalesforceGenerator
from app.services.flowstral.flowstral_artifacts import FlowstralArtifactsGenerator

print("✅ RobustSalesforceGenerator imported successfully")
print("✅ FlowstralArtifactsGenerator imported successfully")

# Check if generator is initialized
gen = RobustSalesforceGenerator()
print(f"✅ RobustSalesforceGenerator initialized: ACTION_TIMEOUT={gen.ACTION_TIMEOUT}")

artifacts_gen = FlowstralArtifactsGenerator()
print(f"✅ FlowstralArtifactsGenerator initialized")
print(f"   Has robust_salesforce_generator: {hasattr(artifacts_gen, 'robust_salesforce_generator')}")

print("\n✅ All imports and initializations successful!")
print("⚠️  If artifacts still not generating, BACKEND SERVER MUST BE RESTARTED")


