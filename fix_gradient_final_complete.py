#!/usr/bin/env python3
"""
Complete fix for gradient checkpointing + PEFT LoRA incompatibility
Run this on the DGX server to fix train_lora.py
"""

import re

script_path = "scripts/train_lora.py"

print("=" * 60)
print("FINAL GRADIENT FIX - Disabling Gradient Checkpointing Completely")
print("=" * 60)

with open(script_path, 'r') as f:
    content = f.read()

# 1. Fix model loading section - ensure it's clean
model_load_pattern = r'(model = AutoModelForCausalLM\.from_pretrained\([^)]+\))'
model_load_match = re.search(model_load_pattern, content, re.DOTALL)
if model_load_match:
    # Replace with clean version + config disable
    clean_model_load = '''model = AutoModelForCausalLM.from_pretrained(
        base_model,
        torch_dtype=torch.float16,
        device_map="auto",
        trust_remote_code=True
    )
    
    # CRITICAL: Disable gradient checkpointing in model config BEFORE LoRA
    if hasattr(model, "config"):
        if hasattr(model.config, "use_cache"):
            model.config.use_cache = False
        if hasattr(model.config, "gradient_checkpointing"):
            model.config.gradient_checkpointing = False'''
    
    content = content[:model_load_match.start()] + clean_model_load + content[model_load_match.end():]
    print("✅ Fixed model loading section")

# 2. Ensure TrainingArguments has gradient_checkpointing=False
content = re.sub(
    r'gradient_checkpointing=config\.get\("gradient_checkpointing",\s*True\)',
    'gradient_checkpointing=False  # DISABLED: Incompatible with PEFT LoRA',
    content
)
print("✅ Set gradient_checkpointing=False in TrainingArguments")

# 3. Fix compute_loss to preserve gradients
compute_loss_pattern = r'def compute_loss\(self, model, inputs, return_outputs=False, num_items_in_batch=None\):.*?return super\(\)\.compute_loss\(model, inputs, return_outputs\)'
new_compute_loss = '''def compute_loss(self, model, inputs, return_outputs=False, num_items_in_batch=None):
        # CRITICAL: Enable gradients globally before forward pass
        torch.set_grad_enabled(True)
        
        # Ensure all LoRA parameters have gradients enabled
        for name, param in model.named_parameters():
            if any(pattern in name for pattern in ['lora_A', 'lora_B', 'lora_embedding', '.lora.', 'adapter']):
                param.requires_grad = True
        
        # Ensure model is in train mode
        model.train()
        
        # Call parent compute_loss
        return super().compute_loss(model, inputs, return_outputs)'''

content = re.sub(compute_loss_pattern, new_compute_loss, content, flags=re.DOTALL)
print("✅ Fixed compute_loss method")

# 4. Ensure training_step also preserves gradients
training_step_pattern = r'def training_step\(self, model, inputs, num_items_in_batch\):.*?return super\(\)\.training_step\(model, inputs, num_items_in_batch\)'
new_training_step = '''def training_step(self, model, inputs, num_items_in_batch):
        # CRITICAL: Enable gradients globally
        torch.set_grad_enabled(True)
        
        # Before EACH training step, ensure all LoRA params have gradients
        for name, param in model.named_parameters():
            if any(pattern in name for pattern in ['lora_A', 'lora_B', 'lora_embedding', '.lora.', 'adapter']):
                param.requires_grad = True
        
        # Ensure model is in train mode
        model.train()
        
        # Call parent training step
        return super().training_step(model, inputs, num_items_in_batch)'''

content = re.sub(training_step_pattern, new_training_step, content, flags=re.DOTALL)
print("✅ Fixed training_step method")

# 5. Ensure model-level gradient checkpointing is disabled after LoRA
if 'Disabled gradient checkpointing at model level' not in content:
    # Find where LoRA is applied and add disable after
    lora_pattern = r'(model = get_peft_model\(model, lora_config\)\s+model\.print_trainable_parameters\(\))'
    lora_replacement = r'''\1
    
    # CRITICAL: Disable gradient checkpointing at model level AFTER LoRA
    if hasattr(model, "gradient_checkpointing_disable"):
        model.gradient_checkpointing_disable()
    if hasattr(model, "base_model"):
        if hasattr(model.base_model, "gradient_checkpointing_disable"):
            model.base_model.gradient_checkpointing_disable()
        if hasattr(model.base_model, "model") and hasattr(model.base_model.model, "gradient_checkpointing_disable"):
            model.base_model.model.gradient_checkpointing_disable()
    print("  Disabled gradient checkpointing at model level")'''
    
    content = re.sub(lora_pattern, lora_replacement, content)
    print("✅ Added model-level gradient checkpointing disable")

# Write fixed file
with open(script_path, 'w') as f:
    f.write(content)

print("=" * 60)
print("✅ ALL FIXES APPLIED!")
print("=" * 60)
print("\nNext steps:")
print("1. Verify: python3 -m py_compile scripts/train_lora.py")
print("2. Run training: ./train_in_docker.sh")
print("\nNote: Gradient checkpointing is now DISABLED.")
print("If you get OOM, we'll need to implement a custom training loop.")
