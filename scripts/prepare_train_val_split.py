#!/usr/bin/env python3
"""
Split training data into train/validation sets (80/20)
"""

import json
import sys
import os
import random
from typing import List, Dict
from collections import defaultdict

def split_data(data: List[Dict], train_ratio: float = 0.8, seed: int = 42) -> tuple:
    """Split data into train and validation sets"""
    # Set seed for reproducibility
    random.seed(seed)
    
    # Shuffle data
    shuffled = data.copy()
    random.shuffle(shuffled)
    
    # Calculate split point
    split_point = int(len(shuffled) * train_ratio)
    
    train_data = shuffled[:split_point]
    val_data = shuffled[split_point:]
    
    return train_data, val_data


def balance_by_task_category(data: List[Dict]) -> List[Dict]:
    """Optionally balance by task_category to ensure fair distribution"""
    # Group by task_category
    by_category = defaultdict(list)
    for entry in data:
        category = entry.get("task_type", "unknown")
        by_category[category].append(entry)
    
    # Get minimum count per category
    min_count = min(len(items) for items in by_category.values()) if by_category else 0
    
    # Balance (optional - can be disabled)
    balanced = []
    for category, items in by_category.items():
        # Take up to min_count from each category, or all if less
        balanced.extend(items[:max(min_count, len(items))])
    
    return balanced if balanced else data


def save_jsonl(data: List[Dict], filepath: str):
    """Save data to JSONL file"""
    with open(filepath, 'w', encoding='utf-8') as f:
        for entry in data:
            f.write(json.dumps(entry, ensure_ascii=False) + '\n')


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Split training data into train/validation sets")
    parser.add_argument("input_file", help="Input JSONL file")
    parser.add_argument("--train-ratio", type=float, default=0.8, help="Train ratio (default: 0.8)")
    parser.add_argument("--train-output", default="train.jsonl", help="Output file for training data")
    parser.add_argument("--val-output", default="val.jsonl", help="Output file for validation data")
    parser.add_argument("--balance", action="store_true", help="Balance by task_category")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    
    args = parser.parse_args()
    
    # Load data
    if not os.path.exists(args.input_file):
        print(f"ERROR: File not found: {args.input_file}")
        sys.exit(1)
    
    print(f"Loading data from {args.input_file}...")
    data = []
    with open(args.input_file, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                data.append(json.loads(line))
    
    print(f"Loaded {len(data)} examples")
    
    # Balance if requested
    if args.balance:
        print("Balancing by task_category...")
        data = balance_by_task_category(data)
        print(f"After balancing: {len(data)} examples")
    
    # Split
    train_data, val_data = split_data(data, train_ratio=args.train_ratio, seed=args.seed)
    
    print(f"\nSplit:")
    print(f"  Train: {len(train_data)} examples ({len(train_data)/len(data):.1%})")
    print(f"  Validation: {len(val_data)} examples ({len(val_data)/len(data):.1%})")
    
    # Show distribution by task_category
    train_categories = defaultdict(int)
    val_categories = defaultdict(int)
    
    for entry in train_data:
        category = entry.get("task_type", "unknown")
        train_categories[category] += 1
    
    for entry in val_data:
        category = entry.get("task_type", "unknown")
        val_categories[category] += 1
    
    print(f"\nTask Category Distribution:")
    all_categories = set(train_categories.keys()) | set(val_categories.keys())
    for category in sorted(all_categories):
        train_count = train_categories.get(category, 0)
        val_count = val_categories.get(category, 0)
        print(f"  {category}:")
        print(f"    Train: {train_count}, Val: {val_count}")
    
    # Save
    print(f"\nSaving to:")
    print(f"  Train: {args.train_output}")
    print(f"  Validation: {args.val_output}")
    
    save_jsonl(train_data, args.train_output)
    save_jsonl(val_data, args.val_output)
    
    print("\n✅ Split complete!")


if __name__ == "__main__":
    main()

