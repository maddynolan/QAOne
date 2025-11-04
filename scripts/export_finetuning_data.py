#!/usr/bin/env python3
"""
Export AI generations from database to JSONL format for fine-tuning
"""

import json
import os
import sys
import requests
from typing import List, Dict, Any

# Backend API base URL
BASE_URL = "http://localhost:8001"


def export_ai_generations(output_file: str = "training_data.jsonl", model_filter: str = None):
    """Export AI generations from database to fine-tuning format"""
    try:
        from app.services.postgres_direct import execute_query, get_postgres_pool
        
        pool = get_postgres_pool()
        if not pool:
            print("ERROR: Database connection not available")
            print("Please ensure PostgreSQL is configured")
            return
        
        # Build query
        query = """
            SELECT prompt, output, model, endpoint, mode
            FROM ai_generations
            WHERE output IS NOT NULL
            AND prompt IS NOT NULL
            AND LENGTH(output) > 50
        """
        params = []
        
        if model_filter:
            query += " AND model LIKE %s"
            params.append(f"%{model_filter}%")
        
        query += " ORDER BY created_at DESC"
        
        results = await execute_query(query, tuple(params))
        
        if not results:
            print("No AI generations found in database")
            return
        
        print(f"Found {len(results)} AI generations to export")
        
        # Convert to Qwen fine-tuning format
        training_examples = []
        
        for row in results:
            prompt = row.get("prompt", "")
            output = row.get("output", "")
            model = row.get("model", "")
            endpoint = row.get("endpoint", "")
            
            # Skip if invalid
            if not prompt or not output:
                continue
            
            # Try to parse output as JSON
            try:
                output_json = json.loads(output)
                # Format output nicely
                output_formatted = json.dumps(output_json, indent=2, ensure_ascii=False)
            except:
                output_formatted = output
            
            # Create training example in Qwen format
            training_example = {
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a senior QA engineer specializing in comprehensive test case generation. Output valid JSON only."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    },
                    {
                        "role": "assistant",
                        "content": output_formatted
                    }
                ],
                "metadata": {
                    "model": model,
                    "endpoint": endpoint
                }
            }
            
            training_examples.append(training_example)
        
        # Write to JSONL file
        print(f"\nWriting {len(training_examples)} examples to {output_file}...")
        with open(output_file, 'w', encoding='utf-8') as f:
            for example in training_examples:
                f.write(json.dumps(example, ensure_ascii=False) + '\n')
        
        print(f"\n[OK] Exported {len(training_examples)} training examples")
        print(f"Output file: {output_file}")
        
        # Print summary by model
        model_counts = {}
        for example in training_examples:
            model = example["metadata"]["model"]
            model_counts[model] = model_counts.get(model, 0) + 1
        
        print("\nSummary by model:")
        for model, count in sorted(model_counts.items()):
            print(f"  {model}: {count} examples")
        
    except Exception as e:
        print(f"ERROR: {str(e)}")
        import traceback
        traceback.print_exc()


def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Export AI generations for fine-tuning")
    parser.add_argument("--output", "-o", default="training_data.jsonl", help="Output file path")
    parser.add_argument("--model", "-m", help="Filter by model (e.g., '7b', '14b', '32b')")
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("Export Fine-tuning Data")
    print("=" * 60)
    
    export_ai_generations(args.output, args.model)
    
    print("\n" + "=" * 60)
    print("Export Complete!")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Review the exported data")
    print("2. Clean and filter low-quality examples")
    print("3. Use for fine-tuning with: python scripts/finetune_qwen.py")


if __name__ == "__main__":
    # For async execution, we need to handle this differently
    # Since execute_query is async, we'll need to use asyncio
    import asyncio
    
    # Check if running in async context
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # If loop is running, we can't use asyncio.run()
            # Export synchronously via API instead
            print("Using API-based export...")
            # Fallback to API-based export
            try:
                response = requests.get(f"{BASE_URL}/ai/evaluation-summary")
                if response.ok:
                    print("Connected to backend API")
                    # For now, use direct database access
                    # This requires the database connection to be available
                    main()
            except:
                print("ERROR: Cannot connect to backend or database")
                print("Please ensure:")
                print("1. Backend server is running, OR")
                print("2. Database connection is configured")
                sys.exit(1)
        else:
            # Can use asyncio.run()
            # But we need to make export_ai_generations async
            print("Note: This script requires database access.")
            print("Please run it from the backend directory or ensure database connection.")
            main()
    except RuntimeError:
        # No event loop, safe to run
        main()

