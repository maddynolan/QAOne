# ✅ Best Method: Interactive Testing (No Model Reloading!)

## 🎯 The Solution

Use the **interactive test script** - it loads the model ONCE and keeps it in memory!

## 🚀 Usage

**On DGX:**

```bash
cd ~/qa_finetuning

# Start interactive Python (loads model once, ~8 min)
python3 -i test_preprocessing_interactive.py
```

**After model loads, you'll see:**
```
✅ Ready! Call test_preprocessing() to test your changes.
```

## 🔄 Workflow (No Waiting!)

**Terminal 1 (keep running):**
```bash
cd ~/qa_finetuning
python3 -i test_preprocessing_interactive.py
# Wait for model to load (only once!)
# Then you'll see: ✅ Ready!
```

**Terminal 2 (edit and test):**
```bash
cd ~/qa_finetuning/scripts
nano train_lora.py  # Make your fix
```

**Back in Terminal 1:**
```python
# Just call this function (instant, no reload!)
test_preprocessing()
```

If it fails, edit again and call `test_preprocessing()` again - **instant feedback!**

## ✅ When Test Passes

You'll see:
```
✅ ALL TESTS PASSED!
```

Then exit Python (`exit()`) and run full training:
```bash
./train_in_docker.sh
```

## 💡 Key Benefits

1. **Model loads ONCE** (~8 minutes, only first time)
2. **Tests are instant** (model stays in memory)
3. **Iterate quickly** (edit → test → repeat)
4. **No waiting** between iterations!

## 📋 Example Session

```python
# Terminal 1
$ python3 -i test_preprocessing_interactive.py
Loading model... (8 minutes)
✅ Ready!

# Terminal 2: Edit train_lora.py

# Terminal 1: Test
>>> test_preprocessing()
❌ ERROR: KeyError: 0

# Terminal 2: Fix train_lora.py

# Terminal 1: Test again (instant!)
>>> test_preprocessing()
✅ ALL TESTS PASSED!

>>> exit()
```

This is the fastest way to debug! 🎉




